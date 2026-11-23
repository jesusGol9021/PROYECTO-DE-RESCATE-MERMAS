-- v0.4.1: consentimiento informado y bloqueo persistente tras intentos de validación fallidos.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "privacyConsent" boolean NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "privacyConsentAt" timestamp;

-- Normaliza códigos heredados con un nuevo valor comprobado contra el índice UNIQUE.
DO $$
DECLARE
  item record;
  generated_code text;
BEGIN
  FOR item IN SELECT "id" FROM "reservations"
    WHERE "status" IN ('requested','confirmed') AND "pickupCode" !~ '^[0-9]{6}$'
  LOOP
    LOOP
      generated_code := LPAD((floor(random() * 900000) + 100000)::text, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "reservations" WHERE "pickupCode" = generated_code);
    END LOOP;
    UPDATE "reservations" SET "pickupCode" = generated_code WHERE "id" = item."id";
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS "reservation_validation_attempts" (
  "userId" text PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "attempts" integer NOT NULL DEFAULT 0 CHECK ("attempts" >= 0),
  "windowStartedAt" timestamp NOT NULL DEFAULT now(),
  "blockedUntil" timestamp,
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reservation_validation_attempts_blocked_idx
  ON "reservation_validation_attempts" ("blockedUntil");
