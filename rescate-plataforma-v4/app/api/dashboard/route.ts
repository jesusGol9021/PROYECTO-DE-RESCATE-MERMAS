import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { donations, reservations, user as users } from '@/lib/db/schema'
import { and, count, eq, gt, sql } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/current-user'
import { refreshLifecycle } from '@/lib/expiration'

export async function GET() {
  const profile = await getCurrentUser()
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  await refreshLifecycle()
  const now = new Date()

  const [active, inProgress, organizations, rescued, published, rescuedKg, cancelled] = await Promise.all([
    db.select({ value: count() }).from(donations).where(and(eq(donations.status, 'available'), gt(donations.expiresAt, now), sql`${donations.availableFrom} <= ${now}`, sql`(${donations.foodExpiresAt} IS NULL OR ${donations.foodExpiresAt} > ${now})`)),
    db.select({ value: count() }).from(reservations).where(eq(reservations.status, 'requested')),
    db.select({ value: count() }).from(users).where(and(eq(users.verificationStatus, 'approved'), sql`${users.role} in ('donor','receiver')`)),
    db.select({ value: count() }).from(reservations).where(eq(reservations.status, 'completed')),
    db.select({ value: count() }).from(donations),
    db.select({ value: sql<number>`coalesce(sum(${donations.quantityKg}), 0)` }).from(donations).innerJoin(reservations, eq(reservations.donationId, donations.id)).where(and(eq(reservations.status, 'completed'), eq(donations.userId, profile.id))),
    db.select({ value: count() }).from(reservations).where(eq(reservations.status, 'cancelled')),
  ])
  const totalPublished = Number(published[0]?.value ?? 0)
  const totalRescued = Number(rescued[0]?.value ?? 0)
  return NextResponse.json({ data: {
    activeDonations: Number(active[0]?.value ?? 0),
    rescuesInProgress: Number(inProgress[0]?.value ?? 0),
    connectedOrganizations: Number(organizations[0]?.value ?? 0),
    beneficiaries: totalRescued,
    rescuedLots: totalRescued,
    rescuedKg: Number(rescuedKg[0]?.value ?? 0),
    cancelledReservations: Number(cancelled[0]?.value ?? 0),
    rescueRate: totalPublished ? Math.round((totalRescued / totalPublished) * 100) : 0,
    role: profile.role,
    verificationStatus: profile.verificationStatus,
  } })
}
