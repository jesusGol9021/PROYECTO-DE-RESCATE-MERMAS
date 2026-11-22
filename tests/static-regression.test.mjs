import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const read = (p) => {
  // Some Windows extraction workflows omit dotfiles. Keep the canonical .env.example,
  // but permit the visible env.example fallback shipped in the same archive.
  const fallback = p === '.env.example' && !existsSync(resolve(root, p)) && existsSync(resolve(root, 'env.example'))
  return readFileSync(resolve(root, fallback ? 'env.example' : p), 'utf8')
}

test('v0.4.1 has idempotent migrations for donation fields, consent and lockout', () => {
  const m4 = read('db/004_donations_columns.sql')
  const m5 = read('db/005_privacy_consent_and_validation_lockout.sql')
  const m6 = read('db/006_profiles_and_food_windows.sql')
  assert.match(m4, /ADD COLUMN IF NOT EXISTS "phone"/)
  assert.match(m4, /ADD COLUMN IF NOT EXISTS "district"/)
  assert.match(m4, /ADD COLUMN IF NOT EXISTS "bio"/)
  assert.match(m5, /"privacyConsent" boolean NOT NULL DEFAULT false/)
  assert.match(m5, /CREATE TABLE IF NOT EXISTS "reservation_validation_attempts"/)
  assert.match(m6, /ADD COLUMN IF NOT EXISTS "availableFrom"/)
  assert.match(m6, /ADD COLUMN IF NOT EXISTS "foodExpiresAt"/)
  assert.match(m6, /ADD COLUMN IF NOT EXISTS "taxId"/)
  assert.match(read('db/007_persistent_auth_rate_limit.sql'), /CREATE TABLE IF NOT EXISTS "rateLimit"/)
  assert.match(read('db/000_schema.sql'), /"verificationStatus" text NOT NULL/)
  assert.doesNotMatch(read('db/000_schema.sql'), /"verificationStatus text/)
})

test('registration requires and records consent on the server', () => {
  const auth = read('lib/auth.ts')
  const form = read('components/auth-form.tsx')
  const privacy = read('app/privacidad/page.tsx')
  assert.match(auth, /privacyConsent: \{ type: 'boolean', required: true/)
  assert.match(auth, /if \(user\.privacyConsent !== true\) return false/)
  assert.match(auth, /storage: 'database'/)
  assert.match(auth, /'\/sign-in\/email': \{ window: 60, max: 5 \}/)
  assert.match(auth, /privacyConsentAt: new Date\(\)/)
  assert.match(form, /name="privacyConsent" required/)
  assert.match(privacy, /PRIVACY_CONTACT_EMAIL/)
  assert.match(read('.env.example'), /PRIVACY_CONTROLLER_NAME=/)
})

test('unconsented users cannot reach protected APIs and existing accounts have a gate', () => {
  const currentUser = read('lib/current-user.ts')
  const profile = read('app/api/profile/route.ts')
  const app = read('app/page.tsx')
  assert.match(currentUser, /profile\.privacyConsent !== true/)
  assert.match(profile, /body\?\.privacyConsent !== true/)
  assert.match(app, /if \(p\.privacyConsent !== true \|\| p\.verificationStatus === 'suspended'\) return/)
  assert.match(app, /acceptPrivacyConsent/)
})

test('GPS API accepts browser lat/lng and validates coordinate ranges', () => {
  const route = read('app/api/profile/route.ts')
  assert.match(route, /body\?\.lat/)
  assert.match(route, /body\?\.lng/)
  assert.match(route, /latitude < -90 \|\| latitude > 90/)
  assert.match(route, /longitude < -180 \|\| longitude > 180/)
})

test('donations API uses a finite radius fallback and validates image data', () => {
  const route = read('app/api/donations/route.ts')
  assert.match(route, /Number\.isFinite\(parsedRadius\).*: 15/)
  assert.ok(route.includes('(png|jpeg|webp)'), 'La API debe limitar imágenes a PNG/JPEG/WebP')
  assert.match(route, /validSignature/)
})

test('donor reservation responses omit QR and pickup-code secrets', () => {
  const route = read('app/api/reservations/route.ts')
  assert.match(route, /randomInt\(100000, 1_000_000\)/)
  assert.match(route, /const \{ qrToken: _qrToken, pickupCode: _pickupCode, \.\.\.safeRow \} = row/)
  const manual = read('app/page.tsx')
  assert.match(manual, /JSON\.stringify\(\{pickupCode:code\}\)/)
})

test('delivery validation is owner-bound, supports QR/code and limits repeated failures', () => {
  const route = read('app/api/reservations/validate/route.ts')
  assert.match(route, /MAX_FAILED_ATTEMPTS = 5/)
  assert.match(route, /WINDOW_MS = 15 \* 60 \* 1000/)
  assert.match(route, /eq\(donations\.userId, profile\.id\)/)
  assert.match(route, /eq\(reservations\.pickupCode, pickupCode\)/)
  assert.match(route, /eq\(reservations\.qrToken, token\)/)
  assert.match(route, /status: 429/)
})

test('ratings require the requester/donor participating in the completed delivery', () => {
  const route = read('app/api/reviews/route.ts')
  assert.match(route, /profile\.id === reservation\.userId && profile\.role === 'receiver'/)
  assert.match(route, /profile\.id === ownerId && profile\.role === 'donor'/)
  assert.match(route, /status: 403/)
})

test('donation endpoint does not return the receiver email', () => {
  const route = read('app/api/my-donations/route.ts')
  assert.doesNotMatch(route, /receiverEmail:\s*users\.email/)
})

test('document upload checks MIME signatures and size on the server', () => {
  const route = read('app/api/documents/route.ts')
  assert.ok(route.includes('application\\/pdf') && route.includes('image\\/(?:png|jpeg|webp)'), 'La API debe limitar MIME de documentos')
  assert.match(route, /3_500_000/)
  assert.match(route, /signatureOk/)
})

test('security headers and environment secrets are documented safely', () => {
  assert.ok(existsSync(resolve(root, 'next.config.mjs')))
  const config = read('next.config.mjs')
  assert.match(config, /X-Content-Type-Options/)
  assert.match(config, /X-Frame-Options/)
  assert.match(config, /Referrer-Policy/)
  assert.match(config, /NODE_ENV === 'production'/)
  const env = read('.env.example')
  assert.match(env, /BETTER_AUTH_SECRET=/)
  assert.match(env, /DATABASE_URL=/)
  const ignore = read('.gitignore')
  assert.match(ignore, /!\.env\.example/)
})


test('lot editing, availability windows, and food expiry are supported by API and UI', () => {
  const api = read('app/api/donations/route.ts')
  const page = read('app/page.tsx')
  assert.match(api, /export async function PATCH\(request: Request\)/)
  assert.match(api, /availableFrom: availableFrom!/)
  assert.match(api, /foodExpiresAt: foodExpiresAt!/)
  assert.match(api, /'scheduled' : 'available'/)
  assert.match(page, /Guardar cambios/)
  assert.match(page, /Vencimiento del alimento/)
})

test('admin can suspend/reactivate for review and report export is role-gated', () => {
  const usersApi = read('app/api/admin/users/route.ts')
  const adminPage = read('app/admin/page.tsx')
  const reportApi = read('app/api/admin/reports/route.ts')
  assert.match(usersApi, /verificationStatus === 'suspended'/)
  assert.match(usersApi, /target\.role === 'admin'/)
  assert.match(adminPage, /Suspender/)
  assert.match(adminPage, /Descargar CSV/)
  assert.match(reportApi, /profile\?\.role !== 'admin'/)
  assert.match(reportApi, /Content-Disposition/)
  assert.ok(reportApi.includes('text/csv'))
})

test('document review does not automatically approve an organization', () => {
  const api = read('app/api/admin/documents/route.ts')
  assert.doesNotMatch(api, /set\(\{verificationStatus:'approved'/)
  assert.match(api, /document_reviewed/)
})

test('scheduled expiry job is protected with a dedicated secret', () => {
  const cron = read('app/api/cron/expire/route.ts')
  const vercel = read('vercel.json')
  const env = read('.env.example')
  assert.match(cron, /authorization !== `Bearer \$\{secret\}`/)
  assert.match(cron, /refreshLifecycle/)
  assert.match(vercel, /0 9 \* \* \*/)
  assert.match(env, /CRON_SECRET=/)
})

test('receipt escapes user-controlled text and includes quantity and food expiry', () => {
  const tools = read('components/phase3-tools.tsx')
  assert.match(tools, /function escapeHtml/)
  assert.match(tools, /Cantidad declarada/)
  assert.match(tools, /Vencimiento del alimento/)
})


test('fresh schema migration is syntactically quote-safe and lock table is documented in CI', () => {
  const schema = read('db/000_schema.sql')
  assert.match(schema, /CREATE TABLE IF NOT EXISTS "user"/)
  assert.match(schema, /"verificationStatus" text NOT NULL DEFAULT 'pending'/)
  assert.match(schema, /CREATE TABLE IF NOT EXISTS "rateLimit"/)
  const workflow = read('.github/workflows/quality.yml')
  assert.match(workflow, /db\/007_persistent_auth_rate_limit\.sql/)
  assert.match(workflow, /db\/008_declared_weight_kg\.sql/)
  assert.ok(existsSync(resolve(root, 'tests/database-smoke.sql')))
})


test('declared kilograms are stored separately and used for impact reports', () => {
  assert.match(read('lib/db/schema.ts'), /quantityKg: doublePrecision\('quantityKg'\)/)
  assert.match(read('app/api/donations/route.ts'), /parseQuantityKg/)
  assert.match(read('app/api/dashboard/route.ts'), /sum\(\$\{donations\.quantityKg\}\)/)
  assert.match(read('app/api/admin/reports/route.ts'), /Peso declarado \(kg\)/)
  assert.match(read('components/phase3-tools.tsx'), /Peso declarado \(kg\)/)
})


test('network rescue rate uses global published-lot denominator', () => {
  const dashboard = read('app/api/dashboard/route.ts')
  assert.match(dashboard, /db\.select\(\{ value: count\(\) \}\)\.from\(donations\),/)
})


test('reservation hold never outlives pickup/food deadlines and post-commit notifications are non-fatal', () => {
  const route = read('app/api/reservations/route.ts')
  const validate = read('app/api/reservations/validate/route.ts')
  const expiration = read('lib/expiration.ts')
  assert.match(route, /Math\.min\(holdExpiresAt\.getTime\(\), donation\.expiresAt\.getTime\(\), donation\.foodExpiresAt\?\.getTime\(\)/)
  assert.match(route, /Promise\.allSettled\(/)
  assert.match(validate, /gt\(donations\.expiresAt, now\)/)
  assert.match(validate, /donations\.foodExpiresAt, now/)
  assert.match(expiration, /const lotExpired = !lot \|\| lot\.expiresAt <= now/)
  assert.match(expiration, /status: 'expired'/)
})
