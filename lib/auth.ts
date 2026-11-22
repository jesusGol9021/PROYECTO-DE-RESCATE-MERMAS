import { betterAuth } from 'better-auth'
import { pool } from '@/lib/db'

const origin = (value?: string) => value ? `https://${value}` : undefined
const authSecret = process.env.BETTER_AUTH_SECRET
if (process.env.NODE_ENV === 'production' && (!authSecret || authSecret.length < 32)) {
  throw new Error('BETTER_AUTH_SECRET es obligatorio en producción y debe tener al menos 32 caracteres.')
}

export const auth = betterAuth({
  secret: authSecret,
  database: pool,
  baseURL: process.env.BETTER_AUTH_URL ?? origin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ?? origin(process.env.VERCEL_URL) ?? process.env.V0_RUNTIME_URL,
  emailAndPassword: { enabled: true, autoSignIn: true },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: 'database',
    modelName: 'rateLimit',
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 5 },
      '/forget-password': { window: 60, max: 3 },
    },
  },
  user: {
    additionalFields: {
      taxId: { type: 'string', required: false, input: false },
      privacyConsent: { type: 'boolean', required: true, defaultValue: false, input: true },
      privacyConsentAt: { type: 'date', required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (user.privacyConsent !== true) return false
          return { data: { ...user, privacyConsentAt: new Date() } }
        },
      },
    },
  },
  trustedOrigins: [
    ...(process.env.NODE_ENV === 'development' ? [
      'http://localhost:3000',
      ...[process.env.V0_RUNTIME_URL, process.env.V0_DEV_APP_URL, process.env.V0_BUILD_URL, process.env.V0_SANDBOX_URL].filter(Boolean),
    ] : []),
    ...(process.env.NODE_ENV === 'production' ? [origin(process.env.VERCEL_URL), origin(process.env.VERCEL_PROJECT_PRODUCTION_URL)].filter(Boolean) : []),
  ] as string[],
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  ...(process.env.NODE_ENV === 'development' ? {
    advanced: { defaultCookieAttributes: { sameSite: 'none' as const, secure: true } },
  } : {}),
})
