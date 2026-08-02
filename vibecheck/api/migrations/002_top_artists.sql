-- v2.13 migration: top_artists column
--
-- Adds storage for the user's top artists (with name, image, genres, popularity).
-- Existing rows get an empty array, so /api/vibe and /explore stay safe even
-- before users re-generate their cards.
--
-- Run via the Neon SQL Editor on the vibecheck-style project. Idempotent.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS top_artists JSONB NOT NULL DEFAULT '[]'::jsonb;
