-- v2.7 migration: add privacy opt-out + index for explore page
--
-- Run via Neon SQL Editor (https://console.neon.tech) on the
-- vibecheck-style project. Idempotent — safe to re-run.

-- 1. Privacy flag. Existing rows default to public (current implicit behavior).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;

-- 2. Composite index for the /explore query:
--    SELECT ... FROM users WHERE is_public = true AND vibe_label IS NOT NULL
--    ORDER BY updated_at DESC LIMIT 50
-- Postgres can use this index for both the WHERE filter and the ORDER BY.
CREATE INDEX IF NOT EXISTS users_public_recent_idx
  ON users (is_public, updated_at DESC)
  WHERE vibe_label IS NOT NULL;
