import { NextResponse } from 'next/server'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/current-user'

export async function GET() {
  const profile = await getCurrentUser()
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const rows = await db.select().from(notifications).where(eq(notifications.userId, profile.id)).orderBy(desc(notifications.createdAt)).limit(30)
  return NextResponse.json({ data: rows, unread: rows.filter(x => !x.readAt).length })
}

export async function PATCH() {
  const profile = await getCurrentUser()
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, profile.id), isNull(notifications.readAt)))
  return NextResponse.json({ data: { read: true } })
}
