import { NextResponse } from 'next/server'
import { avg, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { reviews, user as users } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/current-user'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentUser()
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Usuario inválido.' }, { status: 400 })
  const [target] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, id)).limit(1)
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
  const data = await db.select({ id: reviews.id, rating: reviews.rating, comment: reviews.comment, createdAt: reviews.createdAt, fromName: users.name })
    .from(reviews).innerJoin(users, eq(reviews.fromUserId, users.id)).where(eq(reviews.toUserId, id)).orderBy(desc(reviews.createdAt)).limit(50)
  const [summary] = await db.select({ average: avg(reviews.rating), total: sql<number>`count(*)` }).from(reviews).where(eq(reviews.toUserId, id))
  return NextResponse.json({ data, summary: { average: Number(summary?.average ?? 0), total: Number(summary?.total ?? 0) }, user: target })
}
