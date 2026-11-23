import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { verificationDocuments } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/current-user'
import { audit } from '@/lib/audit'
import { randomUUID } from 'crypto'

export async function GET() {
  const profile = await getCurrentUser(); if (!profile) return NextResponse.json({error:'No autorizado'},{status:401})
  const rows = await db.select({id:verificationDocuments.id,type:verificationDocuments.type,fileName:verificationDocuments.fileName,status:verificationDocuments.status,note:verificationDocuments.note,createdAt:verificationDocuments.createdAt,reviewedAt:verificationDocuments.reviewedAt}).from(verificationDocuments).where(eq(verificationDocuments.userId,profile.id)).orderBy(desc(verificationDocuments.createdAt))
  return NextResponse.json({data:rows})
}
export async function POST(request: Request) {
  const profile = await getCurrentUser(); if (!profile) return NextResponse.json({error:'No autorizado'},{status:401})
  const body = await request.json().catch(()=>null) as Record<string,unknown>|null
  const type = typeof body?.type==='string'?body.type.trim().slice(0,80):''
  const fileName = typeof body?.fileName==='string'?body.fileName.trim().slice(0,160):''
  const dataUrl = typeof body?.dataUrl==='string'?body.dataUrl:''
  if (!type || !fileName) return NextResponse.json({error:'Indica el tipo y el nombre del documento.'},{status:400})
  const match = /^data:(application\/pdf|image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(dataUrl)
  if (!match) return NextResponse.json({error:'Adjunta un PDF, PNG, JPEG o WebP en formato válido.'},{status:400})
  const bytes = Buffer.from(match[2], 'base64')
  if (!bytes.length || bytes.length > 3_500_000) return NextResponse.json({error:'El documento no puede superar 3.5 MB.'},{status:400})
  if (match[1].toLowerCase().startsWith('image/')) {
    const mime = match[1].toLowerCase()
    const signatureOk = mime === 'image/png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : mime === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : bytes.subarray(0,4).toString('ascii') === 'RIFF' && bytes.subarray(8,12).toString('ascii') === 'WEBP'
    if (!signatureOk) return NextResponse.json({error:'El contenido no coincide con el formato de la imagen.'},{status:400})
  } else if (bytes.subarray(0,5).toString('ascii') !== '%PDF-') {
    return NextResponse.json({error:'El archivo no parece ser un PDF válido.'},{status:400})
  }
  const [created] = await db.insert(verificationDocuments).values({id:randomUUID(),userId:profile.id,type,fileName,dataUrl}).returning({id:verificationDocuments.id,type:verificationDocuments.type,fileName:verificationDocuments.fileName,status:verificationDocuments.status})
  await audit(profile.id,'document_uploaded','verification_document',created.id,{type,fileName})
  return NextResponse.json({data:created},{status:201})
}
