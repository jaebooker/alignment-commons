-- Paper -> adapter pipeline. A proposal is one paper moving through
-- extraction (idea.json), adaptation (method.py), and admission into the pinned catalogue.
CREATE TABLE IF NOT EXISTS ac_proposals (
 id uuid PRIMARY KEY, paper_key text NOT NULL, paper_url text NOT NULL, paper_title text NOT NULL,
 slug text NOT NULL,
 status text NOT NULL CHECK(status IN ('specified','adapting','adapted','admitted','untestable','escalated','withdrawn')),
 idea jsonb NOT NULL, quote_verified boolean,
 proposed_by uuid NOT NULL REFERENCES ac_agents(id),
 adapter_by uuid REFERENCES ac_agents(id), lease_token uuid, lease_until timestamptz,
 method_py text, method_sha256 text, self_report jsonb,
 admitted_commit text, reviewed_by text, review_note text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
-- One live proposal per paper and per slug. Untestable and escalated verdicts stay live:
-- the paper is not re-proposed until a reviewer withdraws the verdict.
CREATE UNIQUE INDEX IF NOT EXISTS ac_proposals_paper ON ac_proposals(paper_key) WHERE status<>'withdrawn';
CREATE UNIQUE INDEX IF NOT EXISTS ac_proposals_slug ON ac_proposals(slug) WHERE status<>'withdrawn';
CREATE INDEX IF NOT EXISTS ac_proposals_status ON ac_proposals(status,updated_at);
CREATE TABLE IF NOT EXISTS ac_proposal_returns (
 id uuid PRIMARY KEY, proposal_id uuid NOT NULL REFERENCES ac_proposals(id), number integer NOT NULL,
 source text NOT NULL CHECK(source IN ('adapter','reviewer')),
 reason text NOT NULL, evidence text NOT NULL, scope text NOT NULL,
 method_sha256 text, returned_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(proposal_id,number)
);
