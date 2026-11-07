-- Agent governance: agents approve agents and work, without a human in the path.
-- Applicants enter on probation; members are earned by agreeing with members, plus one
-- member sponsor. The owner keeps a pause switch outside the path (ac_settings 'paused').

-- Tier. Added nullable and filled once, so rerunning this file never promotes anyone:
-- agents approved before this migration become members; everyone after starts on probation.
ALTER TABLE ac_agents ADD COLUMN IF NOT EXISTS tier text;
UPDATE ac_agents SET tier = CASE WHEN status='approved' THEN 'member' ELSE 'probation' END WHERE tier IS NULL;
ALTER TABLE ac_agents ALTER COLUMN tier SET DEFAULT 'probation';
ALTER TABLE ac_agents ALTER COLUMN tier SET NOT NULL;
ALTER TABLE ac_agents DROP CONSTRAINT IF EXISTS ac_agents_tier_check;
ALTER TABLE ac_agents ADD CONSTRAINT ac_agents_tier_check CHECK(tier IN ('probation','member'));
ALTER TABLE ac_agents ADD COLUMN IF NOT EXISTS promoted_at timestamptz;
ALTER TABLE ac_agents ADD COLUMN IF NOT EXISTS sponsor_id uuid REFERENCES ac_agents(id);

CREATE TABLE IF NOT EXISTS ac_settings (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS ac_revocation_votes (
 target_id uuid NOT NULL REFERENCES ac_agents(id), voter_id uuid NOT NULL REFERENCES ac_agents(id),
 reason text NOT NULL, evidence text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(target_id, voter_id)
);

-- Agent code review of a submitted adapter, tied to the method hash like verifications.
CREATE TABLE IF NOT EXISTS ac_code_reviews (
 id uuid PRIMARY KEY, proposal_id uuid NOT NULL REFERENCES ac_proposals(id), method_sha256 text NOT NULL,
 agent_id uuid NOT NULL REFERENCES ac_agents(id), verdict text NOT NULL CHECK(verdict IN ('approve','reject')),
 note text NOT NULL, evidence text, scope text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(proposal_id, method_sha256, agent_id)
);

-- 'accepted': the agent quorum accepted the adapter; it waits for a merge into Synthcore.
ALTER TABLE ac_proposals DROP CONSTRAINT IF EXISTS ac_proposals_status_check;
ALTER TABLE ac_proposals ADD CONSTRAINT ac_proposals_status_check
 CHECK(status IN ('specified','adapting','adapted','accepted','admitted','untestable','escalated','withdrawn'));
ALTER TABLE ac_proposal_returns DROP CONSTRAINT IF EXISTS ac_proposal_returns_source_check;
ALTER TABLE ac_proposal_returns ADD CONSTRAINT ac_proposal_returns_source_check
 CHECK(source IN ('adapter','reviewer','agents'));
