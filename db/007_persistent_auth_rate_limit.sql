-- v0.4.1: almacenamiento persistente para el limitador de Better Auth.
-- Ejecutar después de 006_profiles_and_food_windows.sql.
CREATE TABLE IF NOT EXISTS "rateLimit" (
  "id" text PRIMARY KEY,
  "key" text NOT NULL UNIQUE,
  "count" integer NOT NULL DEFAULT 0,
  "lastRequest" bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limit_last_request_idx ON "rateLimit" ("lastRequest");
