import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { user as users } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/current-user'
import { notify } from '@/lib/notifications'
import { audit } from '@/lib/audit'

async function admin() {
  const profile = await getCurrentUser()
  return profile?.role === 'admin' ? profile : null
}

export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: 'Solo administradores.' }, { status: 403 })
  const rows = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, organizationName: users.organizationName, taxId: users.taxId, verificationStatus: users.verificationStatus, createdAt: users.createdAt })
    .from(users).orderBy(desc(users.createdAt))
  return NextResponse.json({ data: rows })
}

export async function PATCH(request: Request) {
  const actor = await admin()
  if (!actor) return NextResponse.json({ error: 'Solo administradores.' }, { status: 403 })
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const userId = typeof body?.userId === 'string' ? body.userId.trim() : ''
  const verificationStatus = body?.verificationStatus === 'approved' || body?.verificationStatus === 'rejected' || body?.verificationStatus === 'pending' || body?.verificationStatus === 'suspended' ? body.verificationStatus : null
  if (!userId || !verificationStatus) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 })
  if (userId === actor.id) return NextResponse.json({ error: 'No puedes modificar el estado de tu propia cuenta administrativa.' }, { status: 400 })
  const [target] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, userId)).limit(1)
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
  if (target.role === 'admin') return NextResponse.json({ error: 'La gestión de cuentas administrativas requiere un procedimiento separado.' }, { status: 403 })
  const [updated] = await db.update(users).set({ verificationStatus, updatedAt: new Date() }).where(eq(users.id, userId)).returning({ id: users.id, verificationStatus: users.verificationStatus })
  if (updated) {
    const verb = verificationStatus === 'approved' ? 'aprobada' : verificationStatus === 'rejected' ? 'rechazada' : verificationStatus === 'suspended' ? 'suspendida' : 'puesta en revisión'
    const message = verificationStatus === 'approved' ? 'Ya puedes operar en la plataforma.' : verificationStatus === 'suspended' ? 'Tu acceso operativo está suspendido. Contacta al administrador por el canal oficial.' : 'Revisa tu cuenta y documentación.'
    await Promise.allSettled([notify(userId, `Cuenta ${verb}`, message, verificationStatus === 'approved' ? 'success' : 'warning'), audit(actor.id, 'verification_updated', 'user', userId, { verificationStatus })])
  }
  return NextResponse.json({ data: updated })
}
