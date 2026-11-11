import { randomUUID } from 'node:crypto';

export const TASK_WRITES = new Set(['create_task', 'assign_task', 'claim_task', 'heartbeat_task',
  'release_task', 'submit_task', 'review_task', 'block_task', 'reopen_task', 'cancel_task']);
export const TASK_MEMBER_WRITES = ['create_task', 'assign_task', 'review_task', 'reopen_task', 'cancel_task'];
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const str = (v, name, max = 8000) => {
  if (typeof v !== 'string' || !v.trim() || v.length > max) fail(400, `Invalid ${name}.`);
  return v.trim();
};
const uuid = v => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v || '')) fail(400, 'Invalid task or agent id.');
  return v;
};
const rows = async (q, sql, p = []) => (await q.query(sql, p)).rows;
// Never expose the lease credential through queue, detail, or history reads.
const publicTask = ({ lease_token, ...t }) => t;
const dependencyQuery = `SELECT d.dependency_id,t.title,t.status FROM ac_task_dependencies d
 JOIN ac_tasks t ON t.id=d.dependency_id WHERE d.task_id=$1 ORDER BY d.dependency_id`;
export async function readTasks(q, action, input) {
  if (action === 'task') {
    const t = (await rows(q, 'SELECT * FROM ac_tasks WHERE id=$1', [uuid(input.id)]))[0];
    if (!t) fail(404, 'Task not found.');
    return { ...publicTask(t), dependencies: await rows(q, dependencyQuery, [t.id]),
      children: await rows(q, 'SELECT id,title,status FROM ac_tasks WHERE parent_id=$1 ORDER BY created_at,id', [t.id]),
      history: await rows(q, 'SELECT * FROM ac_task_history WHERE task_id=$1 ORDER BY id', [t.id]) };
  }
  const limit = input.limit ?? 50, offset = input.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) fail(400, 'Invalid pagination.');
  if (input.status && !['open','active','review','done','blocked','cancelled'].includes(input.status)) fail(400, 'Invalid status.');
  const list = await rows(q, `SELECT t.*,
    NOT EXISTS(SELECT 1 FROM ac_task_dependencies d JOIN ac_tasks dep ON dep.id=d.dependency_id
      WHERE d.task_id=t.id AND dep.status<>'done') AS dependencies_done,
    (t.status='open' OR (t.status='active' AND (t.lease_until<=now() OR
      NOT EXISTS(SELECT 1 FROM ac_agents a WHERE a.id=t.claimed_by AND a.status='approved')))) AS available
    FROM ac_tasks t WHERE ($1::text IS NULL OR t.project=$1) AND ($2::text IS NULL OR t.status=$2)
      AND ($3::uuid IS NULL OR t.suggested_assignee=$3)
    ORDER BY t.created_at,t.id LIMIT $4 OFFSET $5`,
  [input.project ? str(input.project, 'project', 100) : null, input.status ?? null,
    input.assignee ? uuid(input.assignee) : null, limit, offset]);
  return list.map(publicTask);
}

// Called inside the service's authenticated, rate-limited transaction. Contracts and
// dependency edges are immutable; edges point only to existing tasks, so cycles cannot form.
export async function writeTask(q, action, input, actor) {
  const history = async (taskId, details) => {
    await q.query('INSERT INTO ac_task_history(task_id,actor_id,action,details) VALUES($1,$2,$3,$4)',
      [taskId, actor.id, action, JSON.stringify(details)]);
    await q.query('INSERT INTO ac_events(agent_id,kind,subject,body) VALUES($1,$2,$3,$4)',
      [actor.id, action, taskId, String(details.reason || details.title || action).slice(0, 4000)]);
  };
  const approved = async value => {
    if (!value) return null;
    if (!(await rows(q, "SELECT id FROM ac_agents WHERE id=$1 AND status='approved'", [uuid(value)])).length)
      fail(400, 'Assignee must be an approved agent.');
    return value;
  };
  if (action === 'create_task') {
    const title = str(input.title, 'title', 240), project = str(input.project, 'project', 100);
    const contract = {};
    for (const key of ['objective','inputs','outputs','acceptance','constraints','requirements'])
      contract[key] = str(input.contract?.[key], `contract.${key}`);
    const minutes = input.contract?.budget_minutes;
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 10080) fail(400, 'budget_minutes must be 1–10080.');
    contract.budget_minutes = minutes;
    if (!Array.isArray(input.dependencies ?? []) || (input.dependencies ?? []).length > 30) fail(400, 'Invalid dependencies.');
    const dependencies = [...new Set((input.dependencies ?? []).map(uuid))];
    const parent = input.parent_id ? uuid(input.parent_id) : null;
    for (const ref of [...dependencies, ...(parent ? [parent] : [])]) {
      const existing = (await rows(q, 'SELECT project FROM ac_tasks WHERE id=$1', [ref]))[0];
      if (!existing || existing.project !== project) fail(400, 'Dependencies and parent must exist in the same project.');
    }
    const taskId = randomUUID(), assignee = await approved(input.assignee);
    await q.query(`INSERT INTO ac_tasks(id,project,title,contract,parent_id,created_by,suggested_assignee)
      VALUES($1,$2,$3,$4,$5,$6,$7)`, [taskId,project,title,JSON.stringify(contract),parent,actor.id,assignee]);
    for (const dep of dependencies) await q.query('INSERT INTO ac_task_dependencies VALUES($1,$2)', [taskId,dep]);
    await history(taskId, { title, contract, dependencies, parent_id: parent, assignee });
    return { id: taskId, status: 'open', revision: 1 };
  }
  const t = (await rows(q, `SELECT *,lease_until>now() AS lease_live FROM ac_tasks WHERE id=$1 FOR UPDATE`, [uuid(input.id)]))[0];
  if (!t) fail(404, 'Task not found.');
  if (!Number.isInteger(input.revision) || input.revision !== t.revision) fail(409, 'Task changed; reread task and use its revision.');
  const update = async (sql, values, details) => {
    const result = (await rows(q, `UPDATE ac_tasks SET ${sql},revision=revision+1,updated_at=now() WHERE id=$1 RETURNING *`, [t.id,...values]))[0];
    await history(t.id, details);
    return publicTask(result);
  };
  const clear = 'claimed_by=NULL,lease_token=NULL,lease_until=NULL';
  const owned = () => {
    if (t.status !== 'active' || t.claimed_by !== actor.id || !t.lease_live || input.lease_token !== t.lease_token)
      fail(409, 'A current task lease is required.');
  };
  if (action === 'assign_task') {
    if (t.status !== 'open') fail(409, 'Only open tasks can be assigned.');
    const assignee = await approved(input.assignee);
    const reason = str(input.reason, 'reason');
    return update('suggested_assignee=$2', [assignee], { assignee, reason });
  }
  if (action === 'claim_task') {
    const holderApproved = t.claimed_by && (await rows(q, "SELECT id FROM ac_agents WHERE id=$1 AND status='approved'", [t.claimed_by])).length;
    if (t.status !== 'open' && !(t.status === 'active' && (!t.lease_live || !holderApproved))) fail(409, 'Task is not available.');
    if ((await rows(q, dependencyQuery, [t.id])).some(d => d.status !== 'done')) fail(409, 'Dependencies are not done.');
    const plan = str(input.plan, 'plan (capability fit, budget and next step)');
    const lease = randomUUID();
    const result = await update("status='active',claimed_by=$2,lease_token=$3,lease_until=now()+interval '30 minutes'", [actor.id,lease], { plan });
    return { ...result, lease_token: lease };
  }
  if (['heartbeat_task','release_task','block_task','submit_task'].includes(action)) {
    owned();
    if (action === 'heartbeat_task') return update("lease_until=now()+interval '30 minutes'", [], { progress: str(input.progress, 'progress') });
    if (action === 'submit_task') {
      const submission = {};
      for (const key of ['summary','artifacts','validation','limitations']) submission[key] = str(input[key], key);
      return update(`status='review',submission=$2,submitted_by=$3,${clear}`, [JSON.stringify(submission),actor.id], submission);
    }
    const details = { reason: str(input.reason, 'reason'), evidence: str(input.evidence, 'evidence'), next_step: str(input.next_step, 'next_step') };
    return update(`status='${action === 'block_task' ? 'blocked' : 'open'}',${clear}`, [], details);
  }
  if (action === 'review_task') {
    if (t.status !== 'review') fail(409, 'Task is not awaiting review.');
    if (t.submitted_by === actor.id) fail(403, 'A different member must review the deliverable.');
    if (!['accept','return'].includes(input.decision)) fail(400, 'Invalid review decision.');
    const details = { decision: input.decision, reason: str(input.reason, 'reason'), evidence: str(input.evidence, 'evidence'), scope: str(input.scope, 'scope') };
    const returns = t.returns + (input.decision === 'return' ? 1 : 0);
    return update('status=$2,returns=$3', [input.decision === 'accept' ? 'done' : returns >= 3 ? 'blocked' : 'open',returns], details);
  }
  if (action === 'reopen_task') {
    if (t.status !== 'blocked') fail(409, 'Only blocked tasks can reopen; changed contracts need a new task.');
    return update("status='open'", [], { reason: str(input.reason, 'reason'), evidence: str(input.evidence, 'evidence') });
  }
  if (action === 'cancel_task') {
    if (!['open','blocked'].includes(t.status)) fail(409, 'Only open or blocked tasks can be cancelled.');
    return update("status='cancelled'", [], { reason: str(input.reason, 'reason') });
  }
  fail(400, 'Unknown task action.');
}
