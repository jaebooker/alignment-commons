import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {renderIdeaTests,renderMatrixOverview,renderProgrammes} from '../site/test-matrix.js';
const bytes=await readFile('site/tests.json');
const catalogue=JSON.parse(bytes);
const matrix=JSON.parse(await readFile('site/test-matrix.json','utf8'));
test('every research idea has two distinct unrun designs and historical records stay tied to source',async()=>{
 assert.equal(matrix.catalogue_sha256,createHash('sha256').update(bytes).digest('hex'));
 assert.equal(matrix.catalogue_snapshot,'/research/catalogue-v3-2026-11-08/catalogue-snapshot.json');
 assert.deepEqual(await readFile('site'+matrix.catalogue_snapshot),bytes);
 // The v2 planning snapshot stays as history, and every row it published is unchanged in v3.
 const v2=JSON.parse(await readFile('site/research/test-matrix-2026-10-31/catalogue-snapshot.json','utf8'));
 assert.equal(catalogue.additions[0].previous_catalogue_sha256,createHash('sha256').update(await readFile('site/research/test-matrix-2026-10-31/catalogue-snapshot.json')).digest('hex'));
 for(const row of v2.ideas)assert.deepEqual(catalogue.ideas.find(x=>x.id===row.id),row);
 assert.deepEqual(catalogue.testbeds.slice(0,v2.testbeds.length),v2.testbeds);
 const ids=matrix.tests.map(t=>t.id);assert.equal(new Set(ids).size,ids.length);
 for(const idea of catalogue.ideas.filter(i=>!i.control)){
  const rows=matrix.tests.filter(t=>t.idea_ids.includes(idea.id));
  const draft=rows.filter(t=>t.kind==='proposal');assert.ok(draft.length>=2,idea.id);
  assert.equal(new Set(draft.map(t=>t.title)).size,draft.length);
  for(const d of draft){assert.ok(['proposed','registered'].includes(d.run_status));assert.equal(d.result,'not_assessed');if(d.run_status==='registered'){const study=matrix.tests.find(t=>t.id===d.study_id);assert.ok(study&&study.kind==='follow_up');assert.ok(d.evidence.some(u=>u.endsWith('/protocol.json')));}assert.ok(d.prerequisites&&d.success_rule&&d.analysis);if(d.run_status==='proposed')assert.ok(!d.evidence.length);}
  const original=rows.find(t=>t.id==='catalog-'+idea.id);assert.equal(original.source_verdict,idea.verdict);
  if(idea.verdict==='untestable')assert.equal(original.run_status,'blocked');
  else if(!idea.safety){assert.equal(original.stage,'Gate only');assert.ok(original.detail.includes('full benchmark was not run'));}
 }
 for(const t of matrix.tests){
  if(t.result==='met')assert.equal(t.run_status,'completed');
  if(t.run_status==='completed')assert.ok(t.evidence.length&&t.success_rule);
  for(const url of t.evidence.filter(u=>u.startsWith('/research/')))await access('site'+url);
 }
});
test('negative original results, later success and component failures coexist without pooling',()=>{
 const mona=renderIdeaTests('mona',matrix);
 assert.ok(mona.includes('Original verdict: safe_but_incomplete'));
 assert.ok(mona.includes('Test 7: myopia'));
 assert.ok(mona.includes('Succeeded under criterion'));
 const rr=matrix.tests.find(t=>t.id==='vase-blind-spot-8b');assert.equal(rr.result,'not_met');assert.equal(rr.components.find(c=>c.name==='Vase reduction').result,'met');
 const kl=matrix.tests.find(t=>t.id==='kl-exp3-confirm-v1');assert.equal(kl.result,'mixed');assert.equal(kl.components[2].result,'not_met');
 const summary=renderMatrixOverview(matrix,catalogue.ideas);assert.ok(summary.includes('not pooled as independent replications'));assert.ok(summary.includes('92 unregistered draft follow-ups'));
 assert.equal(matrix.tests.filter(t=>t.id==='myopia-decoupling-v1').length,1);
});
test('filtering proposed and succeeded rows never presents proposals as successful runs',()=>{
 const proposed=renderIdeaTests('accel-levels',matrix,'proposed');assert.ok(proposed.includes('Proposed — not run'));assert.ok(!proposed.includes('data-run-status="completed"'));
 const met=renderIdeaTests('accel-levels',matrix,'met');assert.ok(met.includes('Known-policy cross-start'));assert.ok(!met.includes('data-run-status="proposed"'));assert.ok(!met.includes('Criterion not met'));
 assert.ok(renderProgrammes(matrix).includes('outside the original catalogue'));
 const mixed=renderIdeaTests('programme-kl',matrix,'mixed');assert.ok(mixed.includes('1 mixed'));assert.ok(mixed.includes('H3: stronger anchor'));assert.ok(mixed.includes('Criterion not met'));assert.ok(!mixed.includes('data-run-status="proposed"'));
 assert.equal(renderIdeaTests('accel-levels',null),'');assert.ok(renderMatrixOverview(null,[]).includes('temporarily unavailable'));
});
test('research row text escapes markup and evidence rejects active or credential-bearing URLs',()=>{
 const hostile={tests:[{id:'x',idea_ids:['x'],title:'<img onerror=alert(1)>',run_status:'completed',result:'met',stage:'x',detail:'<script>x</script>',success_rule:'A & B',evidence:['javascript:alert(1)','https://user:password@example.com','/research/../private','https://example.com/evidence']}]};
 const html=renderIdeaTests('x',hostile);assert.ok(html.includes('&lt;img'));assert.ok(html.includes('A &amp; B'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('javascript:'));assert.ok(!html.includes('user:password'));assert.ok(!html.includes('/research/../private'));assert.ok(html.includes('https://example.com/evidence'));
});

test('registered designs point to real studies and started records never acquire success badges',()=>{
 const started=renderIdeaTests('exploit-hunting-monitor',matrix,'started');
 assert.ok(started.includes('Calibration complete — confirmation not authorized'));
 assert.ok(!started.includes('data-run-status="completed"'));
 assert.ok(started.includes('data-run-status="calibration_complete"'));
 assert.ok(!started.includes('class="v win"'));
 const row=matrix.tests.find(t=>t.id==='rr-coverage-v1');assert.equal(row.result,'not_met');assert.ok(row.detail.includes('every vase'));
 const changed=matrix.tests.find(t=>t.id==='changing-mask-factorial-v1');assert.equal(changed.result,'mixed');assert.equal(changed.components[0].result,'not_met');assert.equal(changed.components[2].result,'met');
 assert.equal(matrix.tests.filter(t=>t.kind==='proposal'&&t.run_status==='registered').length,4);
});

test('catalogue v3 adds 14 swarm ideas, each with a catalogue row and two unregistered designs',()=>{
 const added=catalogue.ideas.filter(i=>catalogue.additions[0].ideas.includes(i.id));
 assert.equal(added.length,14);assert.equal(catalogue.catalogue_version,3);
 const designs=matrix.tests.filter(t=>t.kind==='proposal'&&added.some(i=>t.idea_ids.includes(i.id)));
 assert.equal(designs.length,28);
 for(const d of designs){assert.equal(d.run_status,'proposed');assert.equal(d.origin,'new_design');assert.ok(!d.evidence.length);}
 for(const i of added.filter(i=>i.safety)){const row=matrix.tests.find(t=>t.id==='catalog-'+i.id);assert.ok(row.detail.includes('hindsight'));assert.ok(row.components.some(c=>c.name==='Hindsight-best baseline comparison'));}
 const fg=matrix.tests.find(t=>t.id==='catalog-swarm-formal-gate');assert.equal(fg.result,'not_met');assert.equal(fg.components[0].result,'met');
});
