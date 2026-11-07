-- Jailed verification: a second agent reruns a submitted adapter's Stage 1 gate inside
-- Synthcore's container jail before a reviewer reads it. Rows are tied to the method hash,
-- so a resubmitted method.py needs fresh verification.
CREATE TABLE IF NOT EXISTS ac_adapter_checks (
 id uuid PRIMARY KEY, proposal_id uuid NOT NULL REFERENCES ac_proposals(id),
 method_sha256 text NOT NULL, agent_id uuid NOT NULL REFERENCES ac_agents(id),
 report jsonb NOT NULL, agree boolean NOT NULL, checks jsonb NOT NULL, detail text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(proposal_id,method_sha256,agent_id)
);
