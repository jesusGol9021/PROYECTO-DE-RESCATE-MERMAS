import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { user as users } from '@/lib/db/schema'
import { getAuthenticatedProfile } from '@/lib/current-user'
import { eq } from 'drizzle-orm'

export async function GET() {
  const profile = await getAuthenticatedProfile()
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  return NextResponse.json({ data: profile })
}

export async function PATCH(request: Request) {
  const profile = await getAuthenticatedProfile()
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (profile.privacyConsent !== true && body?.privacyConsent !== true) {
    return NextResponse.json({ error: 'Debes aceptar el aviso de privacidad para usar las funciones de Rescate.' }, { status: 403 })
  }
  const acceptedConsent = body?.privacyConsent === true && profile.privacyConsent !== true
  const role = body?.role === 'donor' || body?.role === 'receiver' ? body.role : null
  const organizationName = typeof body?.organizationName === 'string' ? body.organizationName.trim().slice(0, 160) : profile.organizationName
  const incomingLatitude = typeof body?.latitude === 'number' ? body.latitude : typeof body?.lat === 'number' ? body.lat : undefined
  const incomingLongitude = typeof body?.longitude === 'number' ? body.longitude : typeof body?.lng === 'number' ? body.lng : undefined
  const latitude = incomingLatitude ?? profile.latitude
  const longitude = incomingLongitude ?? profile.longitude
  if (latitude != null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) return NextResponse.json({ error: 'Latitud inválida.' }, { status: 400 })
  if (longitude != null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) return NextResponse.json({ error: 'Longitud inválida.' }, { status: 400 })
  const incomingTaxId = typeof body?.taxId === 'string' ? body.taxId.trim() : undefined
  if (incomingTaxId !== undefined && incomingTaxId !== '' && !/^\d{11}$/.test(incomingTaxId)) return NextResponse.json({ error: 'El RUC debe contener 11 dígitos o dejarse vacío.' }, { status: 400 })
  const taxId = incomingTaxId === undefined ? (profile as any).taxId ?? null : incomingTaxId || null
  const phone = typeof body?.phone === 'string' ? body.phone.trim().slice(0, 40) : (profile as any).phone ?? null
  const district = typeof body?.district === 'string' ? body.district.trim().slice(0, 80) : (profile as any).district ?? null
  const bio = typeof body?.bio === 'string' ? body.bio.trim().slice(0, 500) : (profile as any).bio ?? null

  if (role && role !== profile.role && profile.verificationStatus === 'approved') {
    return NextResponse.json({ error: 'El rol de una cuenta aprobada no puede cambiarse desde el perfil.' }, { status: 400 })
  }

  const [updated] = await db.update(users)
    .set({
      ...(role ? { role } : {}),
      organizationName,
      taxId,
      latitude,
      longitude,
      phone,
      district,
      bio,
      ...(acceptedConsent ? { privacyConsent: true, privacyConsentAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, profile.id))
    .returning()

  return NextResponse.json({ data: updated })
}
