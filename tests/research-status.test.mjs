import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {researchStatusSections} from '../site/research-status.js';
const data=JSON.parse(await readFile(new URL('../lib/projects.json',import.meta.url),'utf8'));
test('completed work has linked evidence and is separate from open work',async()=>{
 for(const project of data.projects){
  assert.ok(project.completed_steps.length>0);
  for(const item of project.completed_steps){
   assert.ok(item.evidence_url,item.title);
   if(item.evidence_url.startsWith('/research/'))await access('site'+item.evidence_url);
  }
  const open=new Set(project.next_steps.map(x=>x.title));
  assert.ok(project.completed_steps.every(x=>!open.has(x.title)));
 }
 const kl=data.projects.find(x=>x.id==='kl-anchoring');
 assert.ok(kl.completed_steps.some(x=>x.title.startsWith('Experiment 3:')));
 assert.ok(!kl.next_steps.some(x=>x.title.startsWith('Experiment 3:')));
 const ba=data.projects.find(x=>x.id==='bounded-agency');
 assert.ok(!ba.next_steps.some(x=>/Separate capacity from optimization budget/.test(x.title)));
 assert.ok(ba.completed_steps.some(x=>/Capacity and optimization-budget/.test(x.title)));
 assert.ok(ba.partial_steps.some(x=>/completion unknown/i.test(x.status)));
 assert.ok(!ba.completed_steps.some(x=>/Visible-marker/.test(x.title)));
});
test('status renderer preserves failed and partial labels, escapes content and refuses unsafe links',()=>{
 const html=researchStatusSections({completed_steps:[{title:'<script>x</script>',detail:'A & B',status:'Completed — unsupported',evidence_url:'javascript:alert(1)'}],partial_steps:[{title:'Partial',status:'Completion unknown'}],next_steps:[{title:'Still open',detail:'New test',evidence_url:'/research/protocol.md'}]});
 assert.ok(html.includes('Completed studies and checks'));
 assert.ok(html.includes('Completed — unsupported'));
 assert.ok(html.includes('Partial studies'));
 assert.ok(html.includes('Open experiments and integration work'));
 assert.ok(html.includes('&lt;script&gt;'));
 assert.ok(!html.includes('javascript:'));
 assert.ok(html.includes('/research/protocol.md'));
 assert.ok(!html.includes('Available workflows'));
});
