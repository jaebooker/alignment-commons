import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('versioned completion import preserves originals and applies the two re-verdicts',async()=>{
 const current=JSON.parse(await readFile('site/tests.json','utf8'));
 const original=JSON.parse(await readFile('site/research/completion-verdict-v2/original-v1-catalog.json','utf8'));
 const assessment=JSON.parse(await readFile('site/research/completion-verdict-v2/reverdict.json','utf8'));
 assert.equal(current.verdict_rule_version,2);
 assert.deepEqual(current.ideas.map(x=>x.id).sort(),original.ideas.map(x=>x.id).sort());
 const changed=current.ideas.filter(x=>x.verdict!==original.ideas.find(y=>y.id===x.id).verdict);
 assert.deepEqual(changed.map(x=>x.id).sort(),['future-task-side-effects','mona']);
 for(const row of current.ideas){
  const source=assessment.records.find(x=>x.idea===row.id);
  assert.equal(row.verdict,source.verdict_v2);
  if(row.completion)assert.ok(row.completion.ci95.every(Number.isFinite));
 }
 for(const row of changed){assert.equal(row.verdict,'safe_but_incomplete');assert.equal(row.verdict_v1,'beats_baseline');}
 const html=await readFile('site/index.html','utf8');
 assert.ok(html.includes('Safety gain, task incomplete'));
 assert.ok(html.includes('Task completion:'));
});
