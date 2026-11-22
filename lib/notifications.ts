import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { randomUUID } from 'crypto'

export async function notify(userId: string, title: string, message: string, type = 'info') {
  await db.insert(notifications).values({ id: randomUUID(), userId, title, message, type })
}
