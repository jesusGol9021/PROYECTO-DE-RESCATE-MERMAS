-- v0.4.1: alinear donations con lib/db/schema.ts.
-- Seguro para instalaciones existentes: no elimina datos ni columnas.
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "district" text;
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "bio" text;
