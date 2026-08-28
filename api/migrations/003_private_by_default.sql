-- New vibe pages are drafts until the owner explicitly publishes them.
-- Existing rows keep their current visibility.

ALTER TABLE users
  ALTER COLUMN is_public SET DEFAULT false;
