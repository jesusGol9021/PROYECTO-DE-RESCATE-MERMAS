import { NextResponse } from 'next/server'
import { refreshLifecycle } from '@/lib/expiration'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 24) {
    return NextResponse.json({ error: 'CRON_SECRET no está configurado o es demasiado corto.' }, { status: 503 })
  }
  const authorization = request.headers.get('authorization')
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }
  try {
    const result = await refreshLifecycle()
    return NextResponse.json({ ok: true, at: new Date().toISOString(), ...result })
  } catch (error) {
    console.error('Fallo al actualizar vencimientos', error)
    return NextResponse.json({ error: 'No se pudieron actualizar los vencimientos.' }, { status: 500 })
  }
}
