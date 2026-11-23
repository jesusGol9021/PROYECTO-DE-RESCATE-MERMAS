import { NextResponse } from 'next/server'
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { donations, reservations, reservationValidationAttempts } from '@/lib/db/schema'
import { getCurrentUser, assertApproved } from '@/lib/current-user'
import { notify } from '@/lib/notifications'
import { audit } from '@/lib/audit'

const MAX_FAILED_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

export async function POST(request: Request) {
  const profile = await getCurrentUser()
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (profile.role !== 'donor') return NextResponse.json({ error: 'Solo el donante puede validar la entrega.' }, { status: 403 })
  try { assertApproved(profile) } catch { return NextResponse.json({ error: 'Cuenta no aprobada.' }, { status: 403 }) }

  const now = new Date()
  const [attemptState] = await db.select({ blockedUntil: reservationValidationAttempts.blockedUntil })
    .from(reservationValidationAttempts).where(eq(reservationValidationAttempts.userId, profile.id)).limit(1)
  if (attemptState?.blockedUntil && attemptState.blockedUntil > now) {
    const retryAfter = Math.max(1, Math.ceil((attemptState.blockedUntil.getTime() - now.getTime()) / 1000))
    return NextResponse.json({ error: 'Demasiados intentos fallidos. Inténtalo nuevamente en 15 minutos.' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } })
  }

  const body = await request.json().catch(() => null) as { token?: unknown; pickupCode?: unknown } | null
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  const pickupCode = typeof body?.pickupCode === 'string' ? body.pickupCode.trim() : ''
  if ((!token && !pickupCode) || (token && pickupCode) || (pickupCode && !/^\d{6}$/.test(pickupCode)) || token.length > 200) {
    return NextResponse.json({ error: 'Código de validación inválido.' }, { status: 400 })
  }

  let completed: { reservationId: string; receiverId: string; donationTitle: string } | null
  try {
    completed = await db.transaction(async (tx) => {
      const credential = token ? eq(reservations.qrToken, token) : eq(reservations.pickupCode, pickupCode)
      const [reservation] = await tx.select({
        id: reservations.id, donationId: reservations.donationId, userId: reservations.userId,
      }).from(reservations).innerJoin(donations, eq(reservations.donationId, donations.id))
        .where(and(
          credential,
          eq(reservations.status, 'requested'),
          gt(reservations.expiresAt, now),
          gt(donations.expiresAt, now),
          or(isNull(donations.foodExpiresAt), gt(donations.foodExpiresAt, now))!,
          eq(donations.userId, profile.id),
          eq(donations.status, 'reserved'),
        )).limit(1).for('update')
      if (!reservation) return null
      const [updatedReservation] = await tx.update(reservations).set({ status: 'completed', completedAt: now })
        .where(and(eq(reservations.id, reservation.id), eq(reservations.status, 'requested')))
        .returning({ id: reservations.id })
      if (!updatedReservation) return null
      const [donation] = await tx.update(donations).set({ status: 'delivered' })
        .where(and(eq(donations.id, reservation.donationId), eq(donations.userId, profile.id), eq(donations.status, 'reserved')))
        .returning({ id: donations.id, title: donations.title })
      if (!donation) throw new Error('DONATION_STATE_CONFLICT')
      return { reservationId: reservation.id, receiverId: reservation.userId, donationTitle: donation.title }
    })
  } catch (error) {
    console.error('Error interno al validar entrega', error)
    return NextResponse.json({ error: 'No fue posible validar la entrega. Revisa la reserva e inténtalo nuevamente.' }, { status: 500 })
  }

  if (!completed) {
    const cutoff = new Date(now.getTime() - WINDOW_MS)
    const blockedUntil = new Date(now.getTime() + WINDOW_MS)
    try {
      await db.insert(reservationValidationAttempts).values({
        userId: profile.id, attempts: 1, windowStartedAt: now, blockedUntil: null, updatedAt: now,
      }).onConflictDoUpdate({
        target: reservationValidationAttempts.userId,
        set: {
          attempts: sql`CASE WHEN ${reservationValidationAttempts.windowStartedAt} <= ${cutoff} THEN 1 ELSE ${reservationValidationAttempts.attempts} + 1 END`,
          windowStartedAt: sql`CASE WHEN ${reservationValidationAttempts.windowStartedAt} <= ${cutoff} THEN ${now} ELSE ${reservationValidationAttempts.windowStartedAt} END`,
          blockedUntil: sql`CASE WHEN ${reservationValidationAttempts.windowStartedAt} <= ${cutoff} THEN NULL WHEN ${reservationValidationAttempts.attempts} + 1 >= ${MAX_FAILED_ATTEMPTS} THEN ${blockedUntil} ELSE ${reservationValidationAttempts.blockedUntil} END`,
          updatedAt: now,
        },
      })
    } catch (error) {
      console.error('No se pudo registrar el intento fallido de validación', error)
      return NextResponse.json({ error: 'No fue posible procesar la validación.' }, { status: 500 })
    }
    return NextResponse.json({ error: 'Código no válido o reserva no disponible.' }, { status: 404 })
  }

  // Delivery has already been committed; notification/audit failures must not make the client
  // believe the transaction failed and retry a completed delivery.
  const postCommit = await Promise.allSettled([
    db.delete(reservationValidationAttempts).where(eq(reservationValidationAttempts.userId, profile.id)),
    notify(profile.id, 'Entrega confirmada', `La entrega de ${completed.donationTitle} quedó registrada.`, 'success'),
    notify(completed.receiverId, 'Rescate completado', `El donante confirmó la entrega de ${completed.donationTitle}.`, 'success'),
    audit(profile.id, 'delivery_confirmed', 'reservation', completed.reservationId, { donationTitle: completed.donationTitle }),
  ])
  for (const outcome of postCommit) if (outcome.status === 'rejected') console.error('Tarea secundaria tras confirmar entrega falló:', outcome.reason)
  return NextResponse.json({ data: { validated: true, donationTitle: completed.donationTitle } })
}
