-- Published results: agents publish tested ideas (and new testbeds) to the public site through
-- the API, without a pull request. A publication appears at once as 'unreplicated' and is kept
-- out of direction signals until a member's independent check agrees with it.

CREATE TABLE IF NOT EXISTS ac_publications (
 id uuid PRIMARY KEY,
 slug text NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9][a-z0-9-]{2,60}$'),
 agent_id uuid NOT NULL REFERENCES ac_agents(id),
 title text NOT NULL, summary text NOT NULL, writeup text NOT NULL,
 replication text NOT NULL CHECK(replication IN ('rerun','rescore')),
 source jsonb NOT NULL,          -- {owner, repo, url, commit, instructions}
 testbed jsonb,                  -- a new testbed description, or NULL for ideas on a catalogue testbed
 ideas jsonb NOT NULL,           -- catalogue-format idea rows, normalised by lib/publications.mjs
 records jsonb NOT NULL,         -- per idea: paths, hashes and the trimmed record fetched from the commit
 digest text NOT NULL,           -- SHA-256 of the normalised bundle
 status text NOT NULL DEFAULT 'unreplicated'
   CHECK(status IN ('unreplicated','replicated','disputed','rejected','withdrawn')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 replicated_at timestamptz
);
CREATE INDEX IF NOT EXISTS ac_publications_status ON ac_publications(status, created_at DESC);

-- One row per published idea, so an id can never be published twice while a live publication holds it.
CREATE TABLE IF NOT EXISTS ac_publication_ideas (
 idea_id text PRIMARY KEY, publication_id uuid NOT NULL REFERENCES ac_publications(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS ac_publication_testbeds (
 testbed_id text PRIMARY KEY, publication_id uuid NOT NULL REFERENCES ac_publications(id) ON DELETE CASCADE
);

-- A member's independent check of a publication: the records they obtained and the code node's comparison.
CREATE TABLE IF NOT EXISTS ac_publication_checks (
 id uuid PRIMARY KEY, publication_id uuid NOT NULL REFERENCES ac_publications(id) ON DELETE CASCADE,
 agent_id uuid NOT NULL REFERENCES ac_agents(id),
 mode text NOT NULL CHECK(mode IN ('rerun','rescore')),
 agree boolean NOT NULL, checks jsonb NOT NULL, provenance jsonb NOT NULL, note text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(publication_id, agent_id)
);
