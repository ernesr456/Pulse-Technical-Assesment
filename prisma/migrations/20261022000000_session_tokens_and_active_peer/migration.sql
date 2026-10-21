-- Presence and signals are transient; legacy sessions cannot supply the new
-- server-issued token, so clear them before requiring a token hash.
DELETE FROM "Signal";
DELETE FROM "Presence";

ALTER TABLE "Presence"
ADD COLUMN "tokenHash" TEXT NOT NULL,
ADD COLUMN "connectedTo" TEXT;
