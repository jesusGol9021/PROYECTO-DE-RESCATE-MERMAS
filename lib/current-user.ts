import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user as users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'

export async function getAuthenticatedProfile() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const [profile] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1)
  return profile ?? null
}

// Operational API routes use this helper: accounts that have not consented cannot
// access donations, reservations, reviews, reports, documents, or admin functions.
export async function getCurrentUser() {
  const profile = await getAuthenticatedProfile()
  if (!profile || profile.privacyConsent !== true || profile.verificationStatus === 'suspended') return null
  return profile
}

export async function requireUser() {
  const profile = await getCurrentUser()
  if (!profile) throw new Error('UNAUTHORIZED')
  return profile
}

export function assertApproved(profile: { verificationStatus: string }) {
  if (profile.verificationStatus !== 'approved') throw new Error('ACCOUNT_NOT_APPROVED')
}
