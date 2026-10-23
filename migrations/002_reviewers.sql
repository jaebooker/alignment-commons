CREATE TABLE IF NOT EXISTS ac_reviewers (
 id uuid PRIMARY KEY, name text NOT NULL, token_hash text UNIQUE NOT NULL,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
 created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
);
ALTER TABLE ac_agents ADD COLUMN IF NOT EXISTS reviewed_by text;
ALTER TABLE ac_results ADD COLUMN IF NOT EXISTS reviewed_by text;
