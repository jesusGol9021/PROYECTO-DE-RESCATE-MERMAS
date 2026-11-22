-- Verificación de esquema después de ejecutar las migraciones en PostgreSQL de pruebas.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user' AND column_name='verificationStatus') THEN RAISE EXCEPTION 'Falta user.verificationStatus'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user' AND column_name='privacyConsent') THEN RAISE EXCEPTION 'Falta user.privacyConsent'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user' AND column_name='taxId') THEN RAISE EXCEPTION 'Falta user.taxId'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='donations' AND column_name='availableFrom') THEN RAISE EXCEPTION 'Falta donations.availableFrom'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='donations' AND column_name='foodExpiresAt') THEN RAISE EXCEPTION 'Falta donations.foodExpiresAt'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='donations' AND column_name='quantityKg') THEN RAISE EXCEPTION 'Falta donations.quantityKg'; END IF;
  IF to_regclass('public."rateLimit"') IS NULL THEN RAISE EXCEPTION 'Falta tabla Better Auth rateLimit'; END IF;
  IF to_regclass('public.reservation_validation_attempts') IS NULL THEN RAISE EXCEPTION 'Falta tabla reservation_validation_attempts'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='reservations_donation_active_idx') THEN RAISE EXCEPTION 'Falta índice de reserva activa'; END IF;
END $$;
SELECT 'Database smoke check OK' AS result;
