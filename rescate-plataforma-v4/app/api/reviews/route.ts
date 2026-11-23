import { NextResponse } from 'next/server'
import { and, avg, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { donations, reservations, reviews, user as users } from '@/lib/db/schema'
import { getCurrentUser, assertApproved } from '@/lib/current-user'
import { randomUUID } from 'crypto'

export async function GET() {
  const profile = await getCurrentUser()
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const rows = await db.select({ id: reviews.id, rating: reviews.rating, comment: reviews.comment, createdAt: reviews.createdAt, fromName: users.name })
    .from(reviews).innerJoin(users, eq(reviews.fromUserId, users.id)).where(eq(reviews.toUserId, profile.id)).orderBy(desc(reviews.createdAt)).limit(50)
  const [summary] = await db.select({ average: avg(reviews.rating), total: sql<number>`count(*)` }).from(reviews).where(eq(reviews.toUserId, profile.id))
  return NextResponse.json({ data: rows, summary: { average: Number(summary?.average ?? 0), total: Number(summary?.total ?? 0) } })
}

export async function POST(request: Request) {
  const profile = await getCurrentUser()
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try { assertApproved(profile) } catch { return NextResponse.json({ error: 'Cuenta no aprobada.' }, { status: 403 }) }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const reservationId = typeof body?.reservationId === 'string' ? body.reservationId : ''
  const rating = Number(body?.rating)
  const comment = typeof body?.comment === 'string' ? body.comment.trim().slice(0, 500) : null
  if (!reservationId || !Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: 'Calificación inválida.' }, { status: 400 })
  const [reservation] = await db.select({ id: reservations.id, userId: reservations.userId, donationId: reservations.donationId })
    .from(reservations).where(and(eq(reservations.id, reservationId), eq(reservations.status, 'completed'))).limit(1)
  if (!reservation) return NextResponse.json({ error: 'La reserva no está completada.' }, { status: 404 })
  const [donation] = await db.select({ userId: donations.userId }).from(donations).where(eq(donations.id, reservation.donationId)).limit(1)
  const ownerId = donation?.userId ?? ''
  const isReceiver = profile.id === reservation.userId && profile.role === 'receiver'
  const isOwnerDonor = Boolean(ownerId) && profile.id === ownerId && profile.role === 'donor'
  if (!isReceiver && !isOwnerDonor) return NextResponse.json({ error: 'Solo el donante y el receptor que participaron en esta entrega pueden calificarla.' }, { status: 403 })
  const toUserId = isReceiver ? ownerId : reservation.userId
  if (!toUserId || toUserId === profile.id) return NextResponse.json({ error: 'No se pudo determinar a quién calificar.' }, { status: 400 })
  try {
    await db.insert(reviews).values({ id: randomUUID(), reservationId, fromUserId: profile.id, toUserId, rating, comment })
  } catch { return NextResponse.json({ error: 'Ya calificaste esta entrega.' }, { status: 409 }) }
  return NextResponse.json({ data: { created: true } }, { status: 201 })
}
