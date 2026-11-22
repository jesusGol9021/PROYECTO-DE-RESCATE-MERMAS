import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { randomUUID } from 'crypto'

export async function audit(actorId: string | null, action: string, entityType: string, entityId?: string | null, metadata?: unknown) {
  try {
    await db.insert(auditLogs).values({
      id: randomUUID(), actorId, action, entityType, entityId: entityId ?? null,
      metadata: metadata == null ? null : JSON.stringify(metadata),
    })
  } catch {
    // La auditoría no debe romper una operación de negocio válida.
  }
}
