import { NextResponse } from 'next/server'
import { and, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { donations, reservations, user as users } from '@/lib/db/schema'
import { getCurrentUser, assertApproved } from '@/lib/current-user'
import { audit } from '@/lib/audit'
import { refreshLifecycle } from '@/lib/expiration'

const EARTH_RADIUS_KM = 6371
function haversineSql(lat: number, lng: number) {
  return sql<number>`(${EARTH_RADIUS_KM} * 2 * asin(sqrt(
    power(sin(radians(${donations.latitude} - ${lat}) / 2), 2) +
    cos(radians(${lat})) * cos(radians(${donations.latitude})) *
    power(sin(radians(${donations.longitude} - ${lng}) / 2), 2)
  )))`
}
function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? null : date
}
function validateDonationFields(data: { title: string; category: string; quantity: string; pickupAddress: string; availableFrom: Date | null; expiresAt: Date | null; foodExpiresAt: Date | null }, now = new Date()) {
  if (!data.title || data.title.length > 120 || !data.category || data.category.length > 60 || !data.quantity || data.quantity.length > 60 || !data.pickupAddress || data.pickupAddress.length > 240) {
    return 'Completa correctamente producto, categoría, cantidad y dirección.'
  }
  if (!data.availableFrom || !data.expiresAt || !data.foodExpiresAt) return 'Indica cuándo estará disponible, la hora límite de recojo y el vencimiento del alimento.'
  if (data.expiresAt <= now) return 'La hora límite de recojo debe estar en el futuro.'
  if (data.availableFrom >= data.expiresAt) return 'La disponibilidad debe comenzar antes de la hora límite de recojo.'
  if (data.foodExpiresAt <= data.availableFrom) return 'El vencimiento del alimento debe ser posterior al inicio de disponibilidad.'
  if (data.expiresAt > data.foodExpiresAt) return 'La hora límite de recojo no puede superar el vencimiento del alimento.'
  return null
}
function parseQuantityKg(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === '') return null
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1_000_000) return undefined
  return parsed
}
function validateImage(imageUrl: string | null) {
  if (!imageUrl) return null
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(imageUrl)
  if (!match) return 'La foto debe ser PNG, JPEG o WebP válida.'
  const bytes = Buffer.from(match[2], 'base64')
  if (bytes.length > 1_800_000 || bytes.length === 0) return 'La foto no puede superar 1.8 MB.'
  const type = match[1].toLowerCase()
  const validSignature = type === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : type === 'jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  return validSignature ? null : 'El contenido no coincide con el formato de la imagen.'
}

export async function GET(request: Request) {
  const profile = await getCurrentUser()
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  await refreshLifecycle()
  const now = new Date()
  const url = new URL(request.url)
  const latParam = url.searchParams.get('lat')
  const lngParam = url.searchParams.get('lng')
  const lat = latParam === null ? Number.NaN : Number(latParam)
  const lng = lngParam === null ? Number.NaN : Number(lngParam)
  const parsedRadius = Number(url.searchParams.get('radius') ?? 15)
  const radius = Number.isFinite(parsedRadius) ? Math.min(Math.max(parsedRadius, 1), 100) : 15
  // Include future scheduled donations so receivers can discover them before pickup begins.
  // Reservation POST still requires the donation to be currently available.
  const conditions = [sql`${donations.status} IN ('available', 'scheduled')`, gt(donations.expiresAt, now), or(isNull(donations.foodExpiresAt), gt(donations.foodExpiresAt, now))!]
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  if (hasLocation) {
    const latDelta = radius / 111
    const lngDelta = radius / (111 * Math.max(Math.cos(lat * Math.PI / 180), 0.1))
    conditions.push(sql`${donations.latitude} between ${lat - latDelta} and ${lat + latDelta}`)
    conditions.push(sql`${donations.longitude} between ${lng - lngDelta} and ${lng + lngDelta}`)
  }
  const distance = hasLocation ? haversineSql(lat, lng) : sql<number>`0`
  if (hasLocation) conditions.push(sql`(${distance}) <= ${radius}`)
  const rows = await db.select({
    id: donations.id, title: donations.title, category: donations.category, quantity: donations.quantity, quantityKg: donations.quantityKg,
    pickupAddress: donations.pickupAddress, imageUrl: donations.imageUrl, availableFrom: donations.availableFrom,
    foodExpiresAt: donations.foodExpiresAt, expiresAt: donations.expiresAt, status: donations.status, createdAt: donations.createdAt,
    latitude: donations.latitude, longitude: donations.longitude, donor: users.name, donorId: donations.userId, distanceKm: distance,
    ratingAverage: sql<number | null>`(SELECT AVG(r.rating) FROM "reviews" r WHERE r."toUserId" = ${donations.userId})`,
    ratingCount: sql<number>`(SELECT COUNT(*) FROM "reviews" r WHERE r."toUserId" = ${donations.userId})`,
    donationRatingAverage: sql<number | null>`(SELECT AVG(r.rating) FROM "reviews" r INNER JOIN "reservations" rr ON rr.id = r."reservationId" WHERE rr."donationId" = ${donations.id})`,
    donationRatingCount: sql<number>`(SELECT COUNT(*) FROM "reviews" r INNER JOIN "reservations" rr ON rr.id = r."reservationId" WHERE rr."donationId" = ${donations.id})`,
  }).from(donations).innerJoin(users, eq(donations.userId, users.id)).where(and(...conditions))
    .orderBy(hasLocation ? distance : desc(donations.createdAt)).limit(50)
  return NextResponse.json({ data: rows, locationApplied: hasLocation, radiusKm: radius })
}

export async function POST(request: Request) {
  const profile = await getCurrentUser()
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (profile.role !== 'donor') return NextResponse.json({ error: 'Solo las cuentas Donante pueden publicar lotes.' }, { status: 403 })
  try { assertApproved(profile) } catch { return NextResponse.json({ error: 'Tu organización debe ser aprobada por un administrador antes de publicar.' }, { status: 403 }) }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const category = typeof body?.category === 'string' ? body.category.trim() : ''
  const quantity = typeof body?.quantity === 'string' ? body.quantity.trim() : ''
  const quantityKg = parseQuantityKg(body?.quantityKg)
  if (quantityKg === undefined) return NextResponse.json({ error: 'El peso en kg debe ser un número positivo de hasta 1 000 000.' }, { status: 400 })
  const pickupAddress = typeof body?.pickupAddress === 'string' ? body.pickupAddress.trim() : ''
  const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl : null
  const now = new Date()
  const availableFrom = body?.availableFrom === undefined ? now : parseDate(body.availableFrom)
  const expiresAt = parseDate(body?.expiresAt)
  const foodExpiresAt = parseDate(body?.foodExpiresAt)
  const fieldError = validateDonationFields({ title, category, quantity, pickupAddress, availableFrom, expiresAt, foodExpiresAt }, now)
  if (fieldError) return NextResponse.json({ error: fieldError }, { status: 400 })
  const imageError = validateImage(imageUrl)
  if (imageError) return NextResponse.json({ error: imageError }, { status: 400 })
  const latitude = typeof body?.latitude === 'number' ? body.latitude : profile.latitude
  const longitude = typeof body?.longitude === 'number' ? body.longitude : profile.longitude
  if (latitude == null || longitude == null) return NextResponse.json({ error: 'Guarda primero la ubicación del punto de recojo.' }, { status: 400 })
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return NextResponse.json({ error: 'Latitud inválida.' }, { status: 400 })
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return NextResponse.json({ error: 'Longitud inválida.' }, { status: 400 })
  const [created] = await db.insert(donations).values({
    id: randomUUID(), userId: profile.id, title, category, quantity, quantityKg, pickupAddress, imageUrl,
    availableFrom: availableFrom!, foodExpiresAt: foodExpiresAt!, expiresAt: expiresAt!, latitude, longitude,
    phone: profile.phone, district: profile.district, bio: profile.bio,
    status: availableFrom! > now ? 'scheduled' : 'available',
  }).returning()
  try { await audit(profile.id, 'donation_created', 'donation', created.id, { title, category, quantity, quantityKg, availableFrom, foodExpiresAt, expiresAt }) } catch (error) { console.error('No se pudo registrar la auditoría del lote:', error) }
  return NextResponse.json({ data: created }, { status: 201 })
}

export async function PATCH(request: Request) {
  const profile = await getCurrentUser()
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (profile.role !== 'donor') return NextResponse.json({ error: 'Solo el donante puede editar sus publicaciones.' }, { status: 403 })
  try { assertApproved(profile) } catch { return NextResponse.json({ error: 'Tu organización debe estar aprobada.' }, { status: 403 }) }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const donationId = typeof body?.donationId === 'string' ? body.donationId.trim() : ''
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const category = typeof body?.category === 'string' ? body.category.trim() : ''
  const quantity = typeof body?.quantity === 'string' ? body.quantity.trim() : ''
  const quantityKg = parseQuantityKg(body?.quantityKg)
  if (quantityKg === undefined) return NextResponse.json({ error: 'El peso en kg debe ser un número positivo de hasta 1 000 000.' }, { status: 400 })
  const pickupAddress = typeof body?.pickupAddress === 'string' ? body.pickupAddress.trim() : ''
  const availableFrom = parseDate(body?.availableFrom)
  const expiresAt = parseDate(body?.expiresAt)
  const foodExpiresAt = parseDate(body?.foodExpiresAt)
  const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl : null
  if (!donationId || donationId.length > 80) return NextResponse.json({ error: 'Lote inválido.' }, { status: 400 })
  const fieldError = validateDonationFields({ title, category, quantity, pickupAddress, availableFrom, expiresAt, foodExpiresAt })
  if (fieldError) return NextResponse.json({ error: fieldError }, { status: 400 })
  const imageError = validateImage(imageUrl)
  if (imageError) return NextResponse.json({ error: imageError }, { status: 400 })
  try {
    const updated = await db.transaction(async (tx) => {
      const [lot] = await tx.select({ id: donations.id, status: donations.status }).from(donations)
        .where(and(eq(donations.id, donationId), eq(donations.userId, profile.id))).limit(1).for('update')
      if (!lot || !['available', 'scheduled'].includes(lot.status)) throw new Error('NOT_EDITABLE')
      const [activeReservation] = await tx.select({ id: reservations.id }).from(reservations)
        .where(and(eq(reservations.donationId, donationId), sql`${reservations.status} IN ('requested','confirmed')`)).limit(1)
      if (activeReservation) throw new Error('HAS_RESERVATION')
      const now = new Date()
      const [result] = await tx.update(donations).set({
        title, category, quantity, quantityKg, pickupAddress, availableFrom: availableFrom!, foodExpiresAt: foodExpiresAt!, expiresAt: expiresAt!,
        ...(body?.imageUrl === null ? { imageUrl: null } : body?.imageUrl === undefined ? {} : { imageUrl }),
        status: availableFrom! > now ? 'scheduled' : 'available',
      }).where(and(eq(donations.id, donationId), eq(donations.userId, profile.id))).returning()
      return result
    })
    await audit(profile.id, 'donation_updated', 'donation', donationId)
    return NextResponse.json({ data: updated })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    if (code === 'HAS_RESERVATION') return NextResponse.json({ error: 'No puedes editar un lote con una reserva activa.' }, { status: 409 })
    if (code === 'NOT_EDITABLE') return NextResponse.json({ error: 'Solo puedes editar lotes disponibles o programados sin reservas.' }, { status: 409 })
    return NextResponse.json({ error: 'No se pudo editar el lote.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const profile = await getCurrentUser()
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (profile.role !== 'donor') return NextResponse.json({ error: 'Solo el donante puede cancelar una publicación.' }, { status: 403 })
  const body = await request.json().catch(() => null) as { donationId?: unknown } | null
  const donationId = typeof body?.donationId === 'string' ? body.donationId.trim() : ''
  if (!donationId) return NextResponse.json({ error: 'Donación inválida.' }, { status: 400 })
  try {
    await db.transaction(async tx => {
      const [lot] = await tx.select({ id: donations.id, status: donations.status }).from(donations)
        .where(and(eq(donations.id, donationId), eq(donations.userId, profile.id))).limit(1).for('update')
      if (!lot || !['available', 'scheduled'].includes(lot.status)) throw new Error('NOT_AVAILABLE')
      const [active] = await tx.select({ id: reservations.id }).from(reservations)
        .where(and(eq(reservations.donationId, donationId), sql`${reservations.status} IN ('requested','confirmed')`)).limit(1)
      if (active) throw new Error('HAS_RESERVATION')
      await tx.update(donations).set({ status: 'cancelled' }).where(eq(donations.id, donationId))
    })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    if (code === 'HAS_RESERVATION') return NextResponse.json({ error: 'No puedes cancelar un lote que ya está reservado.' }, { status: 409 })
    if (code === 'NOT_AVAILABLE') return NextResponse.json({ error: 'El lote no está disponible para cancelar.' }, { status: 404 })
    return NextResponse.json({ error: 'No se pudo cancelar el lote.' }, { status: 500 })
  }
  await audit(profile.id, 'donation_cancelled', 'donation', donationId)
  return NextResponse.json({ data: { cancelled: true } })
}
