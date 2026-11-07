-- Correction edge: a failed or rejected unit goes back with a structured return.
-- After three returns the job escalates: the fault is in the plan, which the loop cannot see.
CREATE TABLE IF NOT EXISTS ac_returns (
 id uuid PRIMARY KEY, job_id uuid NOT NULL REFERENCES ac_jobs(id), number integer NOT NULL,
 source text NOT NULL CHECK(source IN ('worker','reviewer')),
 verdict text NOT NULL CHECK(verdict IN ('error','red')),
 reason text NOT NULL, evidence text NOT NULL, scope text NOT NULL,
 returned_by text NOT NULL, result_id uuid REFERENCES ac_results(id),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(job_id,number)
);
ALTER TABLE ac_jobs DROP CONSTRAINT IF EXISTS ac_jobs_status_check;
ALTER TABLE ac_jobs ADD CONSTRAINT ac_jobs_status_check
 CHECK(status IN ('queued','running','submitted','accepted','rejected','failed','escalated','replicated','disputed'));
-- A returned job can be run again, so it may hold several results over time.
-- migrate.mjs reruns every file, so status lists here must stay a superset of later migrations.
ALTER TABLE ac_results DROP CONSTRAINT IF EXISTS ac_results_job_id_key;
CREATE INDEX IF NOT EXISTS ac_results_job ON ac_results(job_id);
