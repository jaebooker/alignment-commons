-- Agreement gate: a test needs two runs from different agents. A code node compares them.
-- Agreement marks both results replicated without human review; disagreement goes to a human.
ALTER TABLE ac_jobs DROP CONSTRAINT IF EXISTS ac_jobs_status_check;
ALTER TABLE ac_jobs ADD CONSTRAINT ac_jobs_status_check
 CHECK(status IN ('queued','running','submitted','accepted','rejected','failed','escalated','replicated','disputed'));
ALTER TABLE ac_results DROP CONSTRAINT IF EXISTS ac_results_review_status_check;
ALTER TABLE ac_results ADD CONSTRAINT ac_results_review_status_check
 CHECK(review_status IN ('submitted','accepted','rejected','awaiting_pair','replicated','disputed'));
-- One live result per agent per test, and at most one result waiting for a partner.
CREATE UNIQUE INDEX IF NOT EXISTS ac_results_live_per_agent ON ac_results(job_id,agent_id) WHERE review_status<>'rejected';
CREATE UNIQUE INDEX IF NOT EXISTS ac_results_one_awaiting ON ac_results(job_id) WHERE review_status IN ('submitted','awaiting_pair');
CREATE TABLE IF NOT EXISTS ac_comparisons (
 id uuid PRIMARY KEY, job_id uuid NOT NULL REFERENCES ac_jobs(id),
 result_a uuid NOT NULL REFERENCES ac_results(id), result_b uuid NOT NULL REFERENCES ac_results(id),
 agree boolean NOT NULL, checks jsonb NOT NULL, identical_record boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ac_comparisons_job ON ac_comparisons(job_id,created_at);
