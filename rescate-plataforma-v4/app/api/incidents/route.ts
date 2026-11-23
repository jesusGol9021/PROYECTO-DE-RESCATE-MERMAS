import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { donations, incidents, reservations } from '@/lib/db/schema'
import { getCurrentUser, assertApproved } from '@/lib/current-user'
import { audit } from '@/lib/audit'
import { randomUUID } from 'crypto'

const types = ['Alimento en mal estado','Donante no entregó','Receptor no acudió','Información incorrecta','Problema con el recojo','Otro']
export async function GET() {
  const profile = await getCurrentUser(); if (!profile) return NextResponse.json({ error:'No autorizado' },{status:401})
  const rows = await db.select().from(incidents).where(eq(incidents.reporterId, profile.id)).orderBy(desc(incidents.createdAt)).limit(30)
  return NextResponse.json({ data: rows })
}
export async function POST(request: Request) {
  const profile = await getCurrentUser(); if (!profile) return NextResponse.json({ error:'No autorizado' },{status:401})
  try { assertApproved(profile) } catch { return NextResponse.json({ error:'Cuenta no aprobada.' },{status:403}) }
  const body = await request.json().catch(()=>null) as Record<string,unknown>|null
  const reservationId = typeof body?.reservationId==='string' ? body.reservationId : null
  const type = typeof body?.type==='string' ? body.type : ''
  const description = typeof body?.description==='string' ? body.description.trim().slice(0,1000) : ''
  if (!types.includes(type) || !description) return NextResponse.json({ error:'Completa el tipo y la descripción.' },{status:400})
  if (reservationId) {
    const [r] = await db.select({id:reservations.id,userId:reservations.userId,donorId:donations.userId}).from(reservations).innerJoin(donations,eq(reservations.donationId,donations.id)).where(eq(reservations.id,reservationId)).limit(1)
    if (!r || (r.userId !== profile.id && r.donorId !== profile.id && profile.role !== 'admin')) return NextResponse.json({ error:'Reserva no válida.' },{status:403})
  }
  const [created] = await db.insert(incidents).values({ id:randomUUID(), reservationId, reporterId:profile.id, type, description }).returning()
  await audit(profile.id,'incident_created','incident',created.id,{type,reservationId})
  return NextResponse.json({data:created},{status:201})
}
