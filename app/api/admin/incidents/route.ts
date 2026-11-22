import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { incidents, user as users } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/current-user'
import { audit } from '@/lib/audit'

async function admin(){ const p=await getCurrentUser(); return p?.role==='admin'?p:null }
export async function GET(){ const p=await admin(); if(!p)return NextResponse.json({error:'Solo administradores.'},{status:403}); const rows=await db.select({id:incidents.id,type:incidents.type,description:incidents.description,status:incidents.status,resolution:incidents.resolution,createdAt:incidents.createdAt,reporterName:users.name}).from(incidents).innerJoin(users,eq(incidents.reporterId,users.id)).orderBy(desc(incidents.createdAt)).limit(100); return NextResponse.json({data:rows}) }
export async function PATCH(request:Request){ const p=await admin(); if(!p)return NextResponse.json({error:'Solo administradores.'},{status:403}); const b=await request.json().catch(()=>null) as Record<string,unknown>|null; const id=typeof b?.id==='string'?b.id:''; const status=b?.status==='open'||b?.status==='in_review'||b?.status==='resolved' ? b.status : null; const resolution=typeof b?.resolution==='string'?b.resolution.trim().slice(0,1000):null; if(!id||!status)return NextResponse.json({error:'Datos inválidos.'},{status:400}); const [u]=await db.update(incidents).set({status,resolution:resolution||undefined,resolvedAt:status==='resolved'?new Date():null}).where(eq(incidents.id,id)).returning(); if(!u)return NextResponse.json({error:'Incidencia no encontrada.'},{status:404}); await audit(p.id,'incident_updated','incident',id,{status}); return NextResponse.json({data:u}) }
