import { and, eq, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { donations, reservations } from '@/lib/db/schema'
import { notify } from '@/lib/notifications'
import { audit } from '@/lib/audit'

/**
 * Refreshes lifecycle states idempotently. Besides the 30-minute hold, a lot's
 * pickup deadline or food-expiration timestamp also ends an active reservation.
 */
export async function refreshLifecycle(now = new Date()) {
  const activated = await db.update(donations).set({ status: 'available' }).where(and(
    eq(donations.status, 'scheduled'),
    sql`${donations.availableFrom} <= ${now}`,
    sql`${donations.expiresAt} > ${now}`,
    sql`(${donations.foodExpiresAt} IS NULL OR ${donations.foodExpiresAt} > ${now})`,
  )).returning({ id: donations.id })

  const expiredLots = await db.update(donations).set({ status: 'expired' }).where(and(
    sql`${donations.status} IN ('available','scheduled')`,
    sql`LEAST(${donations.expiresAt}, COALESCE(${donations.foodExpiresAt}, ${donations.expiresAt})) <= ${now}`,
  )).returning({ id: donations.id })

  const stale = await db.select({ id: reservations.id })
    .from(reservations)
    .innerJoin(donations, eq(reservations.donationId, donations.id))
    .where(and(
      sql`${reservations.status} IN ('requested','confirmed')`,
      or(
        isNull(reservations.expiresAt),
        lte(reservations.expiresAt, now),
        lte(donations.expiresAt, now),
        sql`${donations.foodExpiresAt} IS NOT NULL AND ${donations.foodExpiresAt} <= ${now}`,
      )!,
    ))

  let expiredReservations = 0
  for (const item of stale) {
    const released = await db.transaction(async (tx) => {
      const [reservation] = await tx.select({
        id: reservations.id, userId: reservations.userId, donationId: reservations.donationId,
        status: reservations.status, expiresAt: reservations.expiresAt,
      }).from(reservations).where(eq(reservations.id, item.id)).limit(1).for('update')
      if (!reservation || !['requested', 'confirmed'].includes(reservation.status)) return null

      const [lot] = await tx.select({
        status: donations.status, availableFrom: donations.availableFrom,
        expiresAt: donations.expiresAt, foodExpiresAt: donations.foodExpiresAt,
      }).from(donations).where(eq(donations.id, reservation.donationId)).limit(1).for('update')

      const reservationExpired = !reservation.expiresAt || reservation.expiresAt <= now
      const lotExpired = !lot || lot.expiresAt <= now || (lot.foodExpiresAt !== null && lot.foodExpiresAt <= now)
      if (!reservationExpired && !lotExpired) return null

      const [changed] = await tx.update(reservations).set({ status: 'expired' }).where(and(
        eq(reservations.id, reservation.id),
        sql`${reservations.status} IN ('requested','confirmed')`,
      )).returning({ id: reservations.id })
      if (!changed) return null

      if (lot?.status === 'reserved') {
        const newStatus = lotExpired ? 'expired' : lot.availableFrom > now ? 'scheduled' : 'available'
        await tx.update(donations).set({ status: newStatus }).where(and(
          eq(donations.id, reservation.donationId), eq(donations.status, 'reserved'),
        ))
      }
      return { reservationId: reservation.id, receiverId: reservation.userId }
    })
    if (!released) continue
    expiredReservations += 1
    await Promise.allSettled([
      notify(released.receiverId, 'Reserva liberada', 'La reserva venció o terminó el plazo del lote; ya no se puede validar esa entrega.', 'warning'),
      audit(null, 'reservation_expired', 'reservation', released.reservationId),
    ])
  }
  return { activated: activated.length, expiredLots: expiredLots.length, expiredReservations }
}
