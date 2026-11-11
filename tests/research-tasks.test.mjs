import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createService } from '../lib/service.mjs';
let pg, service, a, b, probation;
const secret = () => randomBytes(32).toString('base64url');
const admin = secret(), sa = secret(), sb = secret(), sp = secret();
const reject = (p, code) => assert.rejects(p, e => e.status === code);
const contract = { objective:'Assess evaluator validity', inputs:'Pinned source abc, protocol v1',
  outputs:'Audit report with reproducible checks', acceptance:'Every metric checked against planted truth',
  constraints:'Offline only; preserve frozen results; no paid compute', requirements:'Python and testbed expertise', budget_minutes:60 };
const call = (action, input, token=sa) => service(action,input,token);
const create = (extra={}) => call('create_task', { project:'pilot',title:'Audit evaluator',contract,...extra });
const claim = (t, token=sa) => call('claim_task', { id:t.id,revision:t.revision,plan:'Python available; offline audit under 60 minutes' },token);
const submit = (t, token=sa) => call('submit_task', { id:t.id,revision:t.revision,lease_token:t.lease_token,
  summary:'Audit complete',artifacts:'repo/report.md at abc, sha256:example',validation:'Checks match criteria',limitations:'Toy environment only' },token);
const review = (t, decision='accept', token=sb) => call('review_task',{ id:t.id,revision:t.revision,decision,
  reason:'Checked deliverable',evidence:'Report lines 1-20 and reproduced checks',scope:'Evaluator audit only' },token);
before(async () => {
 pg=new PGlite();
 for (const name of (await readdir('migrations')).filter(n=>n.endsWith('.sql')).sort()) await pg.exec(await readFile(`migrations/${name}`,'utf8'));
 const wrap = q => ({query:(s,p)=>s.startsWith('SELECT pg_advisory_xact_lock')?Promise.resolve({rows:[]}):q.query(s,p)});
 service=createService({...wrap(pg),transaction:fn=>pg.transaction(tx=>fn(wrap(tx)))},{adminToken:admin});
 const apply = (name,secret) => service('apply',{name,secret,runtime:'test',operator:'private',purpose:'test'},'',name);
 a=await apply('A',sa); b=await apply('B',sb); probation=await apply('P',sp);
 for (const x of [a,b]) await call('review_agent',{id:x.id,status:'approved'},admin);
});
after(async()=>pg.close());
test('task contracts, dependencies, assignment, independent acceptance and history', async()=>{
 await reject(create({contract:{}}),400);
 await reject(call('create_task',{project:'pilot',title:'x',contract},sp),403);
 const parent=await create();
 const child=await create({parent_id:parent.id,dependencies:[parent.id],assignee:b.id});
 await reject(claim(child),409);
 const run=await claim(parent);
 await reject(claim(parent,sb),409);
 await reject(call('task',{id:run.id},''),401);
 assert.ok(!JSON.stringify(await call('tasks',{})).includes(run.lease_token));
 const submitted=await submit(run);
 await reject(review(submitted,'accept',sa),403);
 await reject(review(submitted,'accept',sp),403);
 assert.equal((await review(submitted)).status,'done');
 const ready=await call('tasks',{assignee:b.id});
 assert.equal(ready[0].dependencies_done,true);
 const accepted=await claim(child,sp); // suggestion is not a reservation; probation can work
 const details=await call('task',{id:child.id});
 assert.ok(!JSON.stringify(details).includes(accepted.lease_token));
 assert.equal(details.parent_id,parent.id);
 assert.equal(details.history.length,2);
 const result=await review(await submit(accepted,sp));
 assert.equal(result.status,'done');
 await reject(call('cancel_task',{id:result.id,revision:result.revision,reason:'erase'},sa),409);
});
test('revision fencing, lease expiry takeover, and release preserve handoff',async()=>{
 let t=await claim(await create()); const old={...t};
 t=await call('heartbeat_task',{id:t.id,revision:t.revision,lease_token:t.lease_token,progress:'Inspected metric'});
 await reject(submit(old),409);
 await pg.query("UPDATE ac_tasks SET lease_until=now()-interval '1 minute' WHERE id=$1",[t.id]);
 await reject(submit({...t,lease_token:old.lease_token}),409);
 const next=await claim(t,sb);
 await reject(submit({...next,lease_token:old.lease_token},sa),409);
 const released=await call('release_task',{id:next.id,revision:next.revision,lease_token:next.lease_token,
 reason:'Time budget reached',evidence:'Audit partly done',next_step:'Check baseline'},sb);
 assert.equal(released.status,'open');
 const details=await call('task',{id:t.id});
 assert.equal(details.history.at(-1).details.next_step,'Check baseline');
});
test('returns escalate, immutable dependencies, blocked recovery and cancellation',async()=>{
 let t=await create();
 for(let i=0;i<3;i++) t=await review(await submit(await claim(t)),'return');
 assert.equal(t.status,'blocked'); assert.equal(t.returns,3);
 await reject(claim(t),409);
 t=await call('reopen_task',{id:t.id,revision:t.revision,reason:'Missing input recovered',evidence:'Source recovered at commit def'});
 t=await call('cancel_task',{id:t.id,revision:t.revision,reason:'Superseded by changed protocol'});
 const dependent=await create({dependencies:[t.id]}); await reject(claim(dependent),409);
 await reject(create({project:'other',dependencies:[t.id]}),400);
 await reject(create({dependencies:['00000000-0000-0000-0000-000000000000']}),400);
});
test('pause and revoked credentials cannot mutate; revoked holder can be replaced',async()=>{
 let t=await claim(await create(),sp);
 await call('set_paused',{paused:true,reason:'Maintenance'},admin);
 await reject(submit(t,sp),423); await reject(create(),423);
 await call('set_paused',{paused:false,reason:'Resume'},admin);
 await call('review_agent',{id:probation.id,status:'revoked'},admin);
 await reject(submit(t,sp),403);
 const queue=await call('tasks',{}); assert.equal(queue.find(x=>x.id===t.id).available,true);
 await call('review_agent',{id:probation.id,status:'approved'},admin);
 await reject(submit(t,sp),409); // reapproval cannot resurrect the old lease
 t=await call('task',{id:t.id});
 assert.equal(t.history.at(-1).action,'claim_revoked');
 t=await claim(t,sb); assert.equal(t.claimed_by,b.id);
});
test('assignment requests and blockers keep a resumable audit trail',async()=>{
 let t=await create();
 await reject(call('assign_task',{id:t.id,revision:t.revision,assignee:'00000000-0000-0000-0000-000000000000',reason:'Fit'}),400);
 t=await call('assign_task',{id:t.id,revision:t.revision,assignee:b.id,reason:'Has evaluator experience'});
 assert.equal(t.suggested_assignee,b.id);
 t=await call('assign_task',{id:t.id,revision:t.revision,reason:'Open to any qualified agent'});
 assert.equal(t.suggested_assignee,null);
 t=await claim(t);
 await reject(call('heartbeat_task',{id:t.id,revision:t.revision,lease_token:'wrong',progress:'x'}),409);
 t=await call('block_task',{id:t.id,revision:t.revision,lease_token:t.lease_token,
  reason:'Missing protocol',evidence:'Pinned input lacks protocol',next_step:'Supply versioned protocol'});
 assert.equal(t.status,'blocked');
 const detail=await call('task',{id:t.id});
 assert.equal(detail.history.at(-1).details.next_step,'Supply versioned protocol');
 await reject(call('tasks',{limit:101}),400);
 assert.equal((await call('tasks',{limit:1,offset:0})).length,1);
});
