import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { donations, reservations, user as users } from '@/lib/db/schema'
import { desc, eq, sql } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/current-user'

export async function GET() {
  const profile = await getCurrentUser()
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (profile.role !== 'donor') return NextResponse.json({ error: 'Solo donantes.' }, { status: 403 })
  const rows = await db.select({
    id: donations.id, title: donations.title, category: donations.category, quantity: donations.quantity, quantityKg: donations.quantityKg,
    pickupAddress: donations.pickupAddress, imageUrl: donations.imageUrl, availableFrom: donations.availableFrom, foodExpiresAt: donations.foodExpiresAt, expiresAt: donations.expiresAt,
    status: donations.status, createdAt: donations.createdAt, receiverName: users.name,
    ratingAverage: sql<number | null>`(SELECT AVG(r.rating) FROM "reviews" r WHERE r."toUserId" = ${donations.userId})`,
    ratingCount: sql<number>`(SELECT COUNT(*) FROM "reviews" r WHERE r."toUserId" = ${donations.userId})`,
    donationRatingAverage: sql<number | null>`(SELECT AVG(r.rating) FROM "reviews" r INNER JOIN "reservations" rr ON rr.id = r."reservationId" WHERE rr."donationId" = ${donations.id})`,
    donationRatingCount: sql<number>`(SELECT COUNT(*) FROM "reviews" r INNER JOIN "reservations" rr ON rr.id = r."reservationId" WHERE rr."donationId" = ${donations.id})`,
  }).from(donations)
    .leftJoin(reservations, eq(reservations.donationId, donations.id))
    .leftJoin(users, eq(reservations.userId, users.id))
    .where(eq(donations.userId, profile.id)).orderBy(desc(donations.createdAt), desc(reservations.createdAt))
  const unique = new Map<string, typeof rows[number]>()
  for (const row of rows) if (!unique.has(row.id) || row.receiverName) unique.set(row.id, row)
  return NextResponse.json({ data: [...unique.values()] })
}
