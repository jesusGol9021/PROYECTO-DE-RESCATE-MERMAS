-- Esquema inicial para una base PostgreSQL NUEVA.
-- Si ya tienes las tablas del proyecto anterior, no ejecutes este archivo.

CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  "image" text,
  "role" text NOT NULL DEFAULT 'receiver',
  "organizationName" text,
  "taxId" text,
  "verificationStatus" text NOT NULL DEFAULT 'pending',
  "privacyConsent" boolean NOT NULL DEFAULT false,
  "privacyConsentAt" timestamp,
  "latitude" double precision,
  "longitude" double precision,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY,
  "expiresAt" timestamp NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamp,
  "refreshTokenExpiresAt" timestamp,
  "scope" text,
  "password" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "donations" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "category" text NOT NULL,
  "quantity" text NOT NULL,
  "quantityKg" double precision,
  "pickupAddress" text NOT NULL,
  "imageUrl" text,
  "availableFrom" timestamp NOT NULL DEFAULT now(),
  "foodExpiresAt" timestamp,
  "expiresAt" timestamp NOT NULL,
  "status" text NOT NULL DEFAULT 'available',
  "latitude" double precision,
  "longitude" double precision,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "reservations" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "donationId" text NOT NULL REFERENCES "donations"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'requested',
  "qrToken" text NOT NULL UNIQUE,
  "pickupCode" text NOT NULL UNIQUE,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "completedAt" timestamp
);


-- Better Auth persistent rate limiter (shared across serverless instances).
CREATE TABLE IF NOT EXISTS "rateLimit" (
  "id" text PRIMARY KEY,
  "key" text NOT NULL UNIQUE,
  "count" integer NOT NULL DEFAULT 0,
  "lastRequest" bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limit_last_request_idx ON "rateLimit" ("lastRequest");
