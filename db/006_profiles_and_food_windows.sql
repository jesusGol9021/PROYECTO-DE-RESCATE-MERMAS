-- v0.4.1: completa identificación y ventana operativa del alimento.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "taxId" text;
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "availableFrom" timestamp;
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "foodExpiresAt" timestamp;

-- Migra registros históricos usando la fecha de creación y el límite de recojo conocido.
UPDATE "donations" SET "availableFrom" = COALESCE("availableFrom", "createdAt", now()) WHERE "availableFrom" IS NULL;
UPDATE "donations" SET "foodExpiresAt" = "expiresAt" WHERE "foodExpiresAt" IS NULL;
ALTER TABLE "donations" ALTER COLUMN "availableFrom" SET DEFAULT now();
ALTER TABLE "donations" ALTER COLUMN "availableFrom" SET NOT NULL;

CREATE INDEX IF NOT EXISTS donations_available_from_idx ON "donations" ("availableFrom");
CREATE INDEX IF NOT EXISTS donations_food_expires_idx ON "donations" ("foodExpiresAt");
