import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createService} from '../lib/service.mjs';
import {activityCards} from '../site/activity.js';

test('public activity pagination preserves the full ledger, supports agent filtering and excludes operator credentials',async()=>{
 const pg=new PGlite();
 try {
  await pg.exec(await readFile('migrations/001_commons.sql','utf8'));
  const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
  for(const [id,name] of [[a,'Codex'],[b,'Other']])await pg.query("INSERT INTO ac_agents(id,name,runtime,operator,purpose,token_hash,status) VALUES($1,$2,'test','PRIVATE OPERATOR','purpose',$3,'approved')",[id,name,id]);
  for(let i=0;i<123;i++)await pg.query("INSERT INTO ac_events(agent_id,kind,subject,body) VALUES($1,'checkin',$2,'evidence')",[i%2?a:b,`Update ${i}`]);
  const service=createService({query:(s,p)=>pg.query(s,p)});
  let before,all=[];
  do {const page=await service('activity',{before});assert.ok(page.events.length<=50);all.push(...page.events);before=page.next_cursor;}while(before);
  assert.equal(all.length,123);assert.equal(new Set(all.map(e=>String(e.id))).size,123);
  assert.ok(all.every((e,i)=>i===0||BigInt(e.id)<BigInt(all[i-1].id)));
  assert.ok(!JSON.stringify(all).includes('PRIVATE OPERATOR'));
  assert.deepEqual(Object.keys(all[0]).sort(),['agent','agent_id','body','created_at','id','kind','subject']);
  let selected=[],cursor;
  do {const page=await service('activity',{agent:a,before:cursor});selected.push(...page.events);cursor=page.next_cursor;}while(cursor);
  assert.equal(selected.length,61);assert.ok(selected.every(e=>e.agent_id===a));
  for(const input of [{before:0},{before:-1},{before:1.5},{before:'invalid'},{before:true},{before:['1']},{before:'9223372036854775808'},{agent:'invalid'}])await assert.rejects(service('activity',input),e=>e.status===400);
 } finally {await pg.close();}
});

test('agent findings escape untrusted text and link only HTTPS evidence',()=>{
 const html=activityCards([{agent:'<script>bad</script>',kind:'log_done',subject:'<img onerror=bad>',body:'javascript:bad https://example.org/report.json\n<script>bad</script>',created_at:'2026-10-25T00:00:00Z'}]);
 assert.ok(!html.includes('<script>')&&!html.includes('<img'));
 assert.ok(html.includes('&lt;script&gt;')&&html.includes('href="https://example.org/report.json"'));
 assert.ok(!html.includes('href="javascript:'));
 assert.ok(html.includes('Details and evidence')&&html.includes('Outcome / findings'));
});

test('published research is independent of agent authorization and clearly labelled',async()=>{
 const service=createService({query(){throw Error('Published records must not access live identity tables');}});
 const published=await service('research_activity');
 assert.ok(published.provenance.includes('separate from authenticated'));
 assert.ok(published.records.length>=6);
 assert.ok(published.records.every(r=>r.source_kind==='publisher_curated'));
 assert.ok(!JSON.stringify(published).includes('/Users/'));
 assert.ok(activityCards(published.records).includes('Published record'));
 assert.ok(published.records.some(r=>r.subject.includes('Historical Test 1')));
});
