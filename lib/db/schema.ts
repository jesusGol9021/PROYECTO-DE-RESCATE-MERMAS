import { bigint, boolean, doublePrecision, index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  role: text('role').notNull().default('receiver'),
  organizationName: text('organizationName'),
  taxId: text('taxId'),
  verificationStatus: text('verificationStatus').notNull().default('pending'),
  privacyConsent: boolean('privacyConsent').notNull().default(false),
  privacyConsentAt: timestamp('privacyConsentAt'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  phone: text('phone'),
  district: text('district'),
  bio: text('bio'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
}, (table) => ({
  roleIdx: index('user_role_idx').on(table.role),
  verificationIdx: index('user_verification_idx').on(table.verificationStatus),
}))

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

export const donations = pgTable('donations', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  category: text('category').notNull(),
  quantity: text('quantity').notNull(),
  quantityKg: doublePrecision('quantityKg'),
  pickupAddress: text('pickupAddress').notNull(),
  imageUrl: text('imageUrl'),
  availableFrom: timestamp('availableFrom').notNull().defaultNow(),
  foodExpiresAt: timestamp('foodExpiresAt'),
  expiresAt: timestamp('expiresAt').notNull(),
  status: text('status').notNull().default('available'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  phone: text('phone'),
  district: text('district'),
  bio: text('bio'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('donations_status_idx').on(table.status),
  userIdx: index('donations_user_idx').on(table.userId),
  locationIdx: index('donations_location_idx').on(table.latitude, table.longitude),
}))

export const reservations = pgTable('reservations', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  donationId: text('donationId').notNull().references(() => donations.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('requested'),
  qrToken: text('qrToken').notNull().unique(),
  pickupCode: text('pickupCode').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  completedAt: timestamp('completedAt'),
  expiresAt: timestamp('expiresAt'),
}, (table) => ({
  userIdx: index('reservations_user_idx').on(table.userId),
  donationIdx: uniqueIndex('reservations_donation_active_idx').on(table.donationId).where(sql`${table.status} in ('requested','confirmed')`),
  statusIdx: index('reservations_status_idx').on(table.status),
}))

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('info'),
  title: text('title').notNull(),
  message: text('message').notNull(),
  readAt: timestamp('readAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
}, (table) => ({ userCreatedIdx: index('notifications_user_created_idx').on(table.userId, table.createdAt) }))

export const reviews = pgTable('reviews', {
  id: text('id').primaryKey(),
  reservationId: text('reservationId').notNull().references(() => reservations.id, { onDelete: 'cascade' }),
  fromUserId: text('fromUserId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  toUserId: text('toUserId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
}, (table) => ({ uniqueReview: uniqueIndex('reviews_reservation_from_unique').on(table.reservationId, table.fromUserId), toUserIdx: index('reviews_to_user_idx').on(table.toUserId) }))

export const incidents = pgTable('incidents', {
  id: text('id').primaryKey(),
  reservationId: text('reservationId').references(() => reservations.id, { onDelete: 'set null' }),
  reporterId: text('reporterId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('open'),
  resolution: text('resolution'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  resolvedAt: timestamp('resolvedAt'),
}, (table) => ({ statusIdx: index('incidents_status_idx').on(table.status) }))

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  actorId: text('actorId').references(() => user.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entityType: text('entityType').notNull(),
  entityId: text('entityId'),
  metadata: text('metadata'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
}, (table) => ({ createdIdx: index('audit_logs_created_idx').on(table.createdAt) }))

export const verificationDocuments = pgTable('verification_documents', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  fileName: text('fileName').notNull(),
  dataUrl: text('dataUrl').notNull(),
  status: text('status').notNull().default('pending'),
  note: text('note'),
  reviewedBy: text('reviewedBy').references(() => user.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewedAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
}, (table) => ({ userIdx: index('verification_documents_user_idx').on(table.userId), statusIdx: index('verification_documents_status_idx').on(table.status) }))


// Persistent lockout for repeated invalid delivery-validation codes.
export const reservationValidationAttempts = pgTable('reservation_validation_attempts', {
  userId: text('userId').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  attempts: integer('attempts').notNull().default(0),
  windowStartedAt: timestamp('windowStartedAt').notNull().defaultNow(),
  blockedUntil: timestamp('blockedUntil'),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
}, (table) => ({ blockedIdx: index('reservation_validation_attempts_blocked_idx').on(table.blockedUntil) }))


// Better Auth persistent rate limiting: one counter per key/window.
export const rateLimit = pgTable('rateLimit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull().default(0),
  lastRequest: bigint('lastRequest', { mode: 'number' }).notNull(),
}, (table) => ({ lastRequestIdx: index('rate_limit_last_request_idx').on(table.lastRequest) }))
