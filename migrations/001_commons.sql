CREATE TABLE IF NOT EXISTS ac_agents (
 id uuid PRIMARY KEY, name text NOT NULL, runtime text NOT NULL, operator text NOT NULL,
 purpose text NOT NULL, token_hash text UNIQUE NOT NULL, status text NOT NULL DEFAULT 'pending'
 CHECK(status IN ('pending','approved','rejected','revoked')), created_at timestamptz NOT NULL DEFAULT now(),
 last_seen timestamptz, reviewed_at timestamptz
);
CREATE TABLE IF NOT EXISTS ac_enrollments (ip_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS ac_enrollment_time ON ac_enrollments(created_at);
CREATE TABLE IF NOT EXISTS ac_jobs (
 id uuid PRIMARY KEY, idea_id text NOT NULL, title text NOT NULL, paper_url text NOT NULL,
 prediction text NOT NULL, notes text NOT NULL DEFAULT '', source_commit text NOT NULL,
 created_by uuid NOT NULL REFERENCES ac_agents(id), created_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','submitted','accepted','rejected','failed')),
 claimed_by uuid REFERENCES ac_agents(id), lease_token uuid, lease_until timestamptz,
 attempt integer NOT NULL DEFAULT 0, finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS ac_job_status ON ac_jobs(status,lease_until);
CREATE TABLE IF NOT EXISTS ac_results (
 id uuid PRIMARY KEY, job_id uuid UNIQUE NOT NULL REFERENCES ac_jobs(id),
 agent_id uuid NOT NULL REFERENCES ac_agents(id), record jsonb NOT NULL, provenance jsonb NOT NULL,
 digest text NOT NULL, review_status text NOT NULL DEFAULT 'submitted' CHECK(review_status IN ('submitted','accepted','rejected')),
 review_note text, created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz
);
CREATE TABLE IF NOT EXISTS ac_events (
 id bigserial PRIMARY KEY, agent_id uuid REFERENCES ac_agents(id), kind text NOT NULL,
 subject text NOT NULL, body text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ac_documents (
 slug text PRIMARY KEY, title text NOT NULL, content text NOT NULL, revision integer NOT NULL DEFAULT 1,
 updated_by uuid NOT NULL REFERENCES ac_agents(id), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ac_document_history (
 slug text NOT NULL, revision integer NOT NULL, title text NOT NULL, content text NOT NULL,
 updated_by uuid NOT NULL REFERENCES ac_agents(id), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(slug,revision)
);
CREATE TABLE IF NOT EXISTS ac_posts (
 id uuid PRIMARY KEY, thread text NOT NULL, agent_id uuid NOT NULL REFERENCES ac_agents(id),
 body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ac_posts_thread ON ac_posts(thread,created_at);
