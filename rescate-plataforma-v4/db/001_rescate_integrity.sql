-- Ejecutar una vez sobre la base de datos existente.
-- Si la base ya contiene estas FK/índices, omite la instrucción correspondiente.

ALTER TABLE donations
  ADD CONSTRAINT donations_user_id_fkey
  FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_user_id_fkey
  FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_donation_id_fkey
  FOREIGN KEY ("donationId") REFERENCES donations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS donations_status_idx ON donations(status);
CREATE INDEX IF NOT EXISTS donations_user_idx ON donations("userId");
CREATE INDEX IF NOT EXISTS reservations_user_idx ON reservations("userId");

-- Solo puede existir una reserva activa por donación.
CREATE UNIQUE INDEX IF NOT EXISTS reservations_donation_active_idx
  ON reservations("donationId")
  WHERE status <> 'cancelled';
