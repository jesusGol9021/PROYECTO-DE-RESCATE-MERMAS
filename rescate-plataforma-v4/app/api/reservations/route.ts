import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { donations, reservations, user as users } from '@/lib/db/schema'
import { and, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm'
import { getCurrentUser, assertApproved } from '@/lib/current-user'
import { randomInt, randomUUID } from 'crypto'
import { notify } from '@/lib/notifications'
import { refreshLifecycle } from '@/lib/expiration'
import { audit } from '@/lib/audit'

function pickupCode() {
  return randomInt(100000, 1_000_000).toString()
}

export async function GET() {
  const profile = await getCurrentUser()
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  await refreshLifecycle()

  const filter = profile.role === 'receiver' ? eq(reservations.userId, profile.id) : eq(donations.userId, profile.id)
  const rows = await db.select({
    id: reservations.id, donationId: reservations.donationId, status: reservations.status, createdAt: reservations.createdAt,
    completedAt: reservations.completedAt, expiresAt: reservations.expiresAt, qrToken: reservations.qrToken, pickupCode: reservations.pickupCode,
    donationTitle: donations.title, pickupAddress: donations.pickupAddress, quantity: donations.quantity, quantityKg: donations.quantityKg, availableFrom: donations.availableFrom, foodExpiresAt: donations.foodExpiresAt, pickupDeadline: donations.expiresAt,
    receiverName: users.name,
    ratingAverage: sql<number | null>`(SELECT AVG(r.rating) FROM "reviews" r WHERE r."reservationId" = ${reservations.id})`,
    ratingCount: sql<number>`(SELECT COUNT(*) FROM "reviews" r WHERE r."reservationId" = ${reservations.id})`,
    myRating: sql<number | null>`(SELECT r2.rating FROM "reviews" r2 WHERE r2."reservationId" = ${reservations.id} AND r2."fromUserId" = ${profile.id} LIMIT 1)`,
  }).from(reservations)
    .innerJoin(donations, eq(reservations.donationId, donations.id))
    .innerJoin(users, eq(reservations.userId, users.id))
    .where(filter)
    .orderBy(desc(reservations.createdAt))

  const data = rows.map((row) => {
    if (profile.role === 'receiver' && row.status === 'requested') return row
    if (profile.role === 'receiver') { const { qrToken: _qrToken, pickupCode: _pickupCode, ...safeRow } = row; return safeRow }
    const { qrToken: _qrToken, pickupCode: _pickupCode, ...safeRow } = row
    return safeRow
  })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const profile = await getCurrentUser()
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (profile.role !== 'receiver') return NextResponse.json({ error: 'Solo las cuentas Receptor pueden reservar lotes.' }, { status: 403 })
  try { assertApproved(profile) } catch { return NextResponse.json({ error: 'Tu organización debe ser aprobada por un administrador antes de reservar.' }, { status: 403 }) }

  const body = await request.json().catch(() => null) as { donationId?: unknown } | null
  const donationId = typeof body?.donationId === 'string' ? body.donationId.trim() : ''
  if (!donationId || donationId.length > 80) return NextResponse.json({ error: 'Donación inválida.' }, { status: 400 })

  try {
    const result = await db.transaction(async (tx) => {
      const now = new Date()
      // Lock the lot first. The same locked row is used to decide availability and
      // update its state, preventing concurrent receivers from double-booking it.
      const [donation] = await tx.select({
        id: donations.id, userId: donations.userId, status: donations.status,
        availableFrom: donations.availableFrom, expiresAt: donations.expiresAt,
        foodExpiresAt: donations.foodExpiresAt,
      }).from(donations).where(eq(donations.id, donationId)).limit(1).for('update')
      if (!donation) throw new Error('NOT_FOUND')
      if (donation.userId === profile.id) throw new Error('OWN_DONATION')
      if (donation.status === 'reserved') throw new Error('ALREADY_RESERVED')
      if (donation.status === 'cancelled') throw new Error('CANCELLED')
      if (donation.status === 'completed') throw new Error('COMPLETED')
      if (donation.status === 'expired' || donation.expiresAt <= now || (donation.foodExpiresAt && donation.foodExpiresAt <= now)) throw new Error('EXPIRED')
      if (donation.availableFrom > now) throw new Error('NOT_STARTED')
      if (!['available', 'scheduled'].includes(donation.status)) throw new Error('NOT_AVAILABLE')

      // A scheduled lot whose start time has passed is eligible even if its
      // lifecycle job has not yet updated its persisted status.
      const holdExpiresAt = new Date(now.getTime() + 30 * 60 * 1000)
      const expiresAt = new Date(Math.min(holdExpiresAt.getTime(), donation.expiresAt.getTime(), donation.foodExpiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER))
      if (expiresAt <= now) throw new Error('EXPIRED')
      const [reserved] = await tx.update(donations).set({ status: 'reserved' })
        .where(and(eq(donations.id, donationId), sql`${donations.status} IN ('available','scheduled')`))
        .returning({ id: donations.id })
      if (!reserved) throw new Error('ALREADY_RESERVED')
      const [reservation] = await tx.insert(reservations).values({ id: randomUUID(), userId: profile.id, donationId, status: 'requested', qrToken: randomUUID(), pickupCode: pickupCode(), expiresAt }).returning()
      return { reservation, donorId: donation.userId }
    })
    // Do not report a failed request after the reservation transaction has already committed.
    const notifications = await Promise.allSettled([
      notify(profile.id, 'Reserva confirmada', 'Tu reserva está activa hasta la hora indicada en el detalle. Presenta el QR o código al momento del recojo.', 'success'),
      audit(profile.id, 'reservation_created', 'reservation', result.reservation.id, { donationId }),
      notify(result.donorId, 'Tu lote fue reservado', 'Un receptor reservó uno de tus lotes. Revisa el panel para preparar el recojo.', 'success'),
    ])
    for (const outcome of notifications) if (outcome.status === 'rejected') console.error('Tarea secundaria tras crear reserva falló:', outcome.reason)
    return NextResponse.json({ data: result.reservation }, { status: 201 })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    if (code === 'OWN_DONATION') return NextResponse.json({ error: 'No puedes reservar tu propia donación.' }, { status: 400 })
    if (code === 'NOT_FOUND') return NextResponse.json({ error: 'No encontramos esta donación. Actualiza la lista.' }, { status: 404 })
    if (code === 'NOT_STARTED') return NextResponse.json({ error: 'Este lote todavía está programado. Podrás reservarlo cuando comience su disponibilidad.' }, { status: 409 })
    if (code === 'ALREADY_RESERVED') return NextResponse.json({ error: 'Este lote ya fue reservado por otro receptor. Actualiza la lista.' }, { status: 409 })
    if (code === 'EXPIRED') return NextResponse.json({ error: 'El plazo de recojo o el vencimiento del alimento ya pasó.' }, { status: 409 })
    if (code === 'CANCELLED') return NextResponse.json({ error: 'El donante canceló esta publicación.' }, { status: 409 })
    if (code === 'COMPLETED') return NextResponse.json({ error: 'Este lote ya fue entregado.' }, { status: 409 })
    if (code === 'NOT_AVAILABLE') return NextResponse.json({ error: 'Este lote no está disponible para reservar.' }, { status: 409 })
    return NextResponse.json({ error: 'No fue posible crear la reserva.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const profile = await getCurrentUser()
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (profile.role !== 'receiver') return NextResponse.json({ error: 'Solo el receptor puede cancelar esta reserva.' }, { status: 403 })
  const body = await request.json().catch(() => null) as { reservationId?: unknown } | null
  const reservationId = typeof body?.reservationId === 'string' ? body.reservationId.trim() : ''
  if (!reservationId) return NextResponse.json({ error: 'Reserva inválida.' }, { status: 400 })

  const result = await db.transaction(async (tx) => {
    const [reservation] = await tx.select({ id: reservations.id, donationId: reservations.donationId })
      .from(reservations).where(and(eq(reservations.id, reservationId), eq(reservations.userId, profile.id), eq(reservations.status, 'requested'))).limit(1).for('update')
    if (!reservation) return null
    await tx.update(reservations).set({ status: 'cancelled' }).where(eq(reservations.id, reservation.id))
    await tx.update(donations).set({ status: sql`CASE WHEN ${donations.expiresAt} <= NOW() OR (${donations.foodExpiresAt} IS NOT NULL AND ${donations.foodExpiresAt} <= NOW()) THEN 'expired' WHEN ${donations.availableFrom} > NOW() THEN 'scheduled' ELSE 'available' END` }).where(and(eq(donations.id, reservation.donationId), eq(donations.status, 'reserved')))
    return reservation
  })
  if (!result) return NextResponse.json({ error: 'Reserva no encontrada.' }, { status: 404 })
  await notify(profile.id, 'Reserva cancelada', 'El lote volvió a estar disponible para la red.', 'info')
  await audit(profile.id, 'reservation_cancelled', 'reservation', reservationId)
  return NextResponse.json({ data: { cancelled: true } })
}
