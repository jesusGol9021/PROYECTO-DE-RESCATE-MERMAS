import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { auditLogs, user as users } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/current-user'
export async function GET(){ const p=await getCurrentUser(); if(p?.role!=='admin')return NextResponse.json({error:'Solo administradores.'},{status:403}); const rows=await db.select({id:auditLogs.id,action:auditLogs.action,entityType:auditLogs.entityType,entityId:auditLogs.entityId,metadata:auditLogs.metadata,createdAt:auditLogs.createdAt,actorName:users.name}).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorId)).orderBy(desc(auditLogs.createdAt)).limit(100); return NextResponse.json({data:rows}) }
