import { NextResponse } from 'next/server'
import { and, desc, eq, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/lib/db'
import { donations, reservations, user as users } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/current-user'

function dateValue(value: string | null, label: string): string | null {
  if (value === null || value === '') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Fecha ${label} inválida.`)
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`Fecha ${label} inválida.`)
  return value
}
function nextDay(value: string) {
  const d = new Date(`${value}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
function csvCell(value: unknown) {
  let text = value == null ? '' : value instanceof Date ? value.toISOString() : String(value)
  if (/^[\s]*[=+@\-]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export async function GET(request: Request) {
  const profile = await getCurrentUser()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Solo administradores.' }, { status: 403 })
  const url = new URL(request.url)
  let from: string | null
  let to: string | null
  try {
    from = dateValue(url.searchParams.get('from'), 'inicial')
    to = dateValue(url.searchParams.get('to'), 'final')
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Rango de fechas inválido.' }, { status: 400 })
  }
  if (from && to && from > to) return NextResponse.json({ error: 'La fecha inicial no puede ser posterior a la final.' }, { status: 400 })
  const receiver = alias(users, 'receiver')
  const operationDate = sql`COALESCE(${reservations.completedAt}, ${reservations.createdAt}, ${donations.createdAt})`
  const conditions: SQL[] = []
  if (from) conditions.push(sql`${operationDate} >= ${`${from} 00:00:00`}::timestamp`)
  if (to) conditions.push(sql`${operationDate} < ${`${nextDay(to)} 00:00:00`}::timestamp`)
  const rows = await db.select({
    operationDate,
    donationId: donations.id,
    donationTitle: donations.title,
    category: donations.category,
    quantity: donations.quantity,
    quantityKg: donations.quantityKg,
    lotStatus: donations.status,
    availableFrom: donations.availableFrom,
    foodExpiresAt: donations.foodExpiresAt,
    pickupDeadline: donations.expiresAt,
    donorOrganization: users.organizationName,
    donorName: users.name,
    receiverName: receiver.name,
    reservationId: reservations.id,
    reservationStatus: reservations.status,
    reservationCreatedAt: reservations.createdAt,
    completedAt: reservations.completedAt,
  }).from(donations)
    .innerJoin(users, eq(donations.userId, users.id))
    .leftJoin(reservations, eq(reservations.donationId, donations.id))
    .leftJoin(receiver, eq(reservations.userId, receiver.id))
    .where(conditions.length ? and(...conditions) : sql`TRUE`)
    .orderBy(desc(operationDate)).limit(10001)
  if (rows.length > 10000) return NextResponse.json({ error: 'El rango supera 10 000 registros. Filtra por un periodo más corto para exportar el informe de forma segura.' }, { status: 413 })
  const headers = ['Fecha de operación','ID del lote','Lote','Categoría','Cantidad declarada','Peso declarado (kg)','Estado del lote','Disponible desde','Vencimiento del alimento','Límite de recojo','Organización donante','Nombre donante','Receptor','ID reserva','Estado de reserva','Reserva creada','Entrega completada']
  const lines = [headers, ...rows.map(r => [r.operationDate, r.donationId, r.donationTitle, r.category, r.quantity, r.quantityKg, r.lotStatus, r.availableFrom, r.foodExpiresAt, r.pickupDeadline, r.donorOrganization, r.donorName, r.receiverName, r.reservationId, r.reservationStatus, r.reservationCreatedAt, r.completedAt])]
  const csv = '\uFEFF' + lines.map(row => row.map(csvCell).join(',')).join('\r\n')
  const suffix = from || to ? `_${from || 'inicio'}_${to || 'hoy'}` : ''
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rescate_reportes${suffix}.csv"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
