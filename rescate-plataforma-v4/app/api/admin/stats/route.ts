import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { donations, reservations, user as users } from '@/lib/db/schema'
import { and, count, eq, gt, sql } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/current-user'
import { refreshLifecycle } from '@/lib/expiration'

export async function GET() {
  const profile = await getCurrentUser()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Solo administradores.' }, { status: 403 })

  await refreshLifecycle()
  const now = new Date()

  const [pending, donors, receivers, active, rescued, totalPublished, avgMatch, activeReservations, cancelled] = await Promise.all([
    db.select({ value: count() }).from(users).where(eq(users.verificationStatus, 'pending')),
    db.select({ value: count() }).from(users).where(eq(users.role, 'donor')),
    db.select({ value: count() }).from(users).where(eq(users.role, 'receiver')),
    db.select({ value: count() }).from(donations).where(and(eq(donations.status, 'available'), gt(donations.expiresAt, now), sql`${donations.availableFrom} <= ${now}`, sql`(${donations.foodExpiresAt} IS NULL OR ${donations.foodExpiresAt} > ${now})`)),
    db.select({ value: count() }).from(reservations).where(eq(reservations.status, 'completed')),
    db.select({ value: count() }).from(donations),
    db.select({ value: sql<number>`coalesce(avg(extract(epoch from (${reservations.createdAt} - ${donations.createdAt})) / 60), 0)` }).from(reservations).innerJoin(donations, eq(reservations.donationId, donations.id)).where(sql`${reservations.status} in ('requested','completed')`),
    db.select({ value: count() }).from(reservations).where(eq(reservations.status, 'requested')),
    db.select({ value: count() }).from(reservations).where(eq(reservations.status, 'cancelled')),
  ])

  const published = Number(totalPublished[0]?.value ?? 0)
  const rescuedCount = Number(rescued[0]?.value ?? 0)
  return NextResponse.json({ data: {
    pending: Number(pending[0]?.value ?? 0),
    donors: Number(donors[0]?.value ?? 0),
    receivers: Number(receivers[0]?.value ?? 0),
    active: Number(active[0]?.value ?? 0),
    rescued: rescuedCount,
    rescueRate: published ? Math.round((rescuedCount / published) * 100) : 0,
    avgMatchMinutes: Math.round(Number(avgMatch[0]?.value ?? 0)),
    activeReservations: Number(activeReservations[0]?.value ?? 0),
    cancelled: Number(cancelled[0]?.value ?? 0),
    totalPublished: published,
  } })
}
