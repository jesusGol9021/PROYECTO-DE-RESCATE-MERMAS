-- v0.4.1: peso total declarado en kilogramos, separado de la descripción libre.
-- En registros heredados se rellena solo cuando la cantidad indica explícitamente kg/kilogramo(s).
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "quantityKg" double precision;
WITH matched AS (
  SELECT "id", replace(substring("quantity" from '([0-9]+([.,][0-9]+)?)\s*(kg|kgs|kilo|kilogramas?)'), ',', '.')::double precision AS kg
  FROM "donations"
  WHERE "quantity" ~* '([0-9]+([.,][0-9]+)?)\s*(kg|kgs|kilo|kilogramas?)'
)
UPDATE "donations" d SET "quantityKg" = matched.kg
FROM matched
WHERE d."id" = matched."id" AND d."quantityKg" IS NULL AND matched.kg > 0;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'donations_quantity_kg_positive'
      AND conrelid = 'donations'::regclass
  ) THEN
    ALTER TABLE "donations" ADD CONSTRAINT donations_quantity_kg_positive
      CHECK ("quantityKg" IS NULL OR "quantityKg" > 0);
  END IF;
END $$;
