-- Fase 2 + 3: mapa, notificaciones, reputación, incidencias, auditoría,
-- verificación documental, perfil y expiración automática de reservas.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "district" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "bio" text;

ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "expiresAt" timestamp;
UPDATE "reservations" SET "expiresAt" = "createdAt" + interval '30 minutes' WHERE "expiresAt" IS NULL AND "status" = 'requested';

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "type" text NOT NULL DEFAULT 'info',
  "title" text NOT NULL,
  "message" text NOT NULL,
  "readAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON "notifications"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "reviews" (
  "id" text PRIMARY KEY,
  "reservationId" text NOT NULL REFERENCES "reservations"("id") ON DELETE CASCADE,
  "fromUserId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "toUserId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "rating" integer NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "comment" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  UNIQUE("reservationId", "fromUserId")
);
CREATE INDEX IF NOT EXISTS reviews_to_user_idx ON "reviews"("toUserId");

CREATE TABLE IF NOT EXISTS "incidents" (
  "id" text PRIMARY KEY,
  "reservationId" text REFERENCES "reservations"("id") ON DELETE SET NULL,
  "reporterId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "description" text NOT NULL,
  "status" text NOT NULL DEFAULT 'open',
  "resolution" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "resolvedAt" timestamp
);
CREATE INDEX IF NOT EXISTS incidents_status_idx ON "incidents"("status");

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" text PRIMARY KEY,
  "actorId" text REFERENCES "user"("id") ON DELETE SET NULL,
  "action" text NOT NULL,
  "entityType" text NOT NULL,
  "entityId" text,
  "metadata" text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON "audit_logs"("createdAt");

CREATE TABLE IF NOT EXISTS "verification_documents" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "fileName" text NOT NULL,
  "dataUrl" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "note" text,
  "reviewedBy" text REFERENCES "user"("id") ON DELETE SET NULL,
  "reviewedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_documents_user_idx ON "verification_documents"("userId");
CREATE INDEX IF NOT EXISTS verification_documents_status_idx ON "verification_documents"("status");
