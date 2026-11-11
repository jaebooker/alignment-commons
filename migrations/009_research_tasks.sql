-- General research coordination; never an executable job or scientific verdict.
CREATE TABLE IF NOT EXISTS ac_tasks (
 id uuid PRIMARY KEY, project text NOT NULL, title text NOT NULL, contract jsonb NOT NULL,
 parent_id uuid REFERENCES ac_tasks(id), created_by uuid NOT NULL REFERENCES ac_agents(id),
 suggested_assignee uuid REFERENCES ac_agents(id),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','active','review','done','blocked','cancelled')),
 claimed_by uuid REFERENCES ac_agents(id), lease_token uuid, lease_until timestamptz,
 submission jsonb, submitted_by uuid REFERENCES ac_agents(id),
 returns integer NOT NULL DEFAULT 0, revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ac_task_dependencies (
 task_id uuid NOT NULL REFERENCES ac_tasks(id), dependency_id uuid NOT NULL REFERENCES ac_tasks(id),
 PRIMARY KEY(task_id,dependency_id), CHECK(task_id<>dependency_id)
);
CREATE TABLE IF NOT EXISTS ac_task_history (
 id bigserial PRIMARY KEY, task_id uuid NOT NULL REFERENCES ac_tasks(id),
 actor_id uuid NOT NULL REFERENCES ac_agents(id), action text NOT NULL, details jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ac_tasks_queue ON ac_tasks(project,status,created_at,id);
CREATE INDEX IF NOT EXISTS ac_task_history_task ON ac_task_history(task_id,id);

-- Fence claims immediately on either owner- or member-driven revocation. Reapproval
-- must never resurrect an old token. Keep this in the database so both paths agree.
CREATE OR REPLACE FUNCTION ac_release_research_tasks() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE released record;
BEGIN
 IF NEW.status <> 'approved' AND OLD.status = 'approved' THEN
  FOR released IN
   UPDATE ac_tasks SET status='open',claimed_by=NULL,lease_token=NULL,lease_until=NULL,
     revision=revision+1,updated_at=now()
   WHERE claimed_by=NEW.id AND status='active' RETURNING id
  LOOP
   INSERT INTO ac_task_history(task_id,actor_id,action,details)
   VALUES(released.id,NEW.id,'claim_revoked','{"reason":"Agent approval removed; lease invalidated"}'::jsonb);
  END LOOP;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS ac_revoke_research_claims ON ac_agents;
CREATE TRIGGER ac_revoke_research_claims AFTER UPDATE OF status ON ac_agents
 FOR EACH ROW EXECUTE FUNCTION ac_release_research_tasks();
