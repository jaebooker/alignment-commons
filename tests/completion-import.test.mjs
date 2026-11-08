import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('versioned completion import preserves originals and applies the two re-verdicts',async()=>{
 const current=JSON.parse(await readFile('site/tests.json','utf8'));
 const original=JSON.parse(await readFile('site/research/completion-verdict-v2/original-v1-catalog.json','utf8'));
 const assessment=JSON.parse(await readFile('site/research/completion-verdict-v2/reverdict.json','utf8'));
 assert.equal(current.verdict_rule_version,2);
 const imported=JSON.parse(await readFile('site'+current.additions[0].import_record,'utf8'));
 const addedIds=imported.added.map(x=>x.id);
 // v3 is additive: the v2 ideas are exactly the original catalogue's, plus the recorded additions.
 assert.deepEqual(current.ideas.map(x=>x.id).filter(id=>!addedIds.includes(id)).sort(),original.ideas.map(x=>x.id).sort());
 assert.deepEqual(current.additions[0].ideas.slice().sort(),addedIds.slice().sort());
 for(const a of imported.added)assert.equal(current.ideas.find(x=>x.id===a.id).verdict,a.verdict);
 const v2rows=current.ideas.filter(x=>!addedIds.includes(x.id));
 const changed=v2rows.filter(x=>x.verdict!==original.ideas.find(y=>y.id===x.id).verdict);
 assert.deepEqual(changed.map(x=>x.id).sort(),['future-task-side-effects','mona']);
 for(const row of v2rows){
  const source=assessment.records.find(x=>x.idea===row.id);
  assert.equal(row.verdict,source.verdict_v2);
  if(row.completion)assert.ok(row.completion.ci95.every(Number.isFinite));
 }
 for(const row of changed){assert.equal(row.verdict,'safe_but_incomplete');assert.equal(row.verdict_v1,'beats_baseline');}
 const html=await readFile('site/index.html','utf8');
 assert.ok(html.includes('Safety gain, task incomplete'));
 assert.ok(html.includes('Task completion:'));
});
