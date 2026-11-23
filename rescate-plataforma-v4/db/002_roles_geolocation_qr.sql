-- En bases nuevas, ejecutar después de 000_schema.sql. En bases antiguas,
-- revisar si es necesario aplicar 001_rescate_integrity.sql antes de esta migración.
-- PostgreSQL / Supabase / Neon / Railway / Render PostgreSQL.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'receiver';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "organizationName" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "verificationStatus" text NOT NULL DEFAULT 'pending';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "latitude" double precision;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "longitude" double precision;

ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "imageUrl" text;
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "latitude" double precision;
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "longitude" double precision;

ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "qrToken" text;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "pickupCode" text;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "completedAt" timestamp;

-- Rellena tokens para reservas creadas con la versión anterior.
UPDATE "reservations"
SET "qrToken" = COALESCE("qrToken", md5(random()::text || clock_timestamp()::text || id)),
    "pickupCode" = COALESCE("pickupCode", upper(substr(md5(random()::text || clock_timestamp()::text || id), 1, 6)))
WHERE "qrToken" IS NULL OR "pickupCode" IS NULL;

ALTER TABLE "reservations" ALTER COLUMN "qrToken" SET NOT NULL;
ALTER TABLE "reservations" ALTER COLUMN "pickupCode" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS reservations_qr_token_unique ON "reservations"("qrToken");
CREATE UNIQUE INDEX IF NOT EXISTS reservations_pickup_code_unique ON "reservations"("pickupCode");
CREATE INDEX IF NOT EXISTS user_role_idx ON "user"("role");
CREATE INDEX IF NOT EXISTS user_verification_idx ON "user"("verificationStatus");
CREATE INDEX IF NOT EXISTS donations_location_idx ON "donations"("latitude", "longitude");
CREATE INDEX IF NOT EXISTS reservations_status_idx ON "reservations"("status");

-- Un solo rescate activo por lote.
DROP INDEX IF EXISTS reservations_donation_active_idx;
CREATE UNIQUE INDEX reservations_donation_active_idx
ON "reservations"("donationId")
WHERE "status" IN ('requested','confirmed');
