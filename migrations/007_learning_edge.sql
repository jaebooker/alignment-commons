-- Learning edge. An untestable verdict counts toward the testbed roadmap only once a
-- second extractor, who never saw the first verdict, independently agrees.
-- confirmed: NULL pending, true agreed (or reviewer confirmed), false disputed.
ALTER TABLE ac_proposals ADD COLUMN IF NOT EXISTS confirmed boolean;
CREATE TABLE IF NOT EXISTS ac_extractions (
 id uuid PRIMARY KEY, proposal_id uuid NOT NULL REFERENCES ac_proposals(id),
 agent_id uuid NOT NULL REFERENCES ac_agents(id), slug text NOT NULL, idea jsonb NOT NULL,
 quote_verified boolean, agree boolean NOT NULL, detail text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(proposal_id,agent_id)
);
