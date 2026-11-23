import { NextResponse } from 'next/server'
import { and, asc, avg, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { donations, reservations, reviews, user as users } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/current-user'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentUser()
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Donación inválida.' }, { status: 400 })

  const [donation] = await db.select({ id: donations.id }).from(donations).where(eq(donations.id, id)).limit(1)
  if (!donation) return NextResponse.json({ error: 'Donación no encontrada.' }, { status: 404 })

  const rows = await db.select({
    id: reviews.id, rating: reviews.rating, comment: reviews.comment, createdAt: reviews.createdAt, fromName: users.name,
  }).from(reviews)
    .innerJoin(reservations, eq(reviews.reservationId, reservations.id))
    .innerJoin(users, eq(reviews.fromUserId, users.id))
    .where(eq(reservations.donationId, id))
    .orderBy(desc(reviews.createdAt)).limit(20)

  const [summary] = await db.select({
    average: avg(reviews.rating), total: sql<number>`count(*)`,
  }).from(reviews).innerJoin(reservations, eq(reviews.reservationId, reservations.id)).where(eq(reservations.donationId, id))

  return NextResponse.json({
    data: rows,
    summary: { average: Number(summary?.average ?? 0), total: Number(summary?.total ?? 0) },
  })
}
