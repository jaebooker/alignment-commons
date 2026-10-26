import {test} from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import handler from '../api/commons.js';
import {createService} from '../lib/service.mjs';

test('public research API needs no database or agent approval and leaves mutation authorization intact',async()=>{
 const service=createService({query(){throw Error('Projects must not read private research tables');}});
 const projects=await service('projects');
 assert.equal(projects.projects.length,4);
 assert.ok(!JSON.stringify(projects).includes('/Users/'));
 for(const p of projects.projects){
  for(const source of p.sources)assert.match(source.content_sha256,/^[a-f0-9]{64}$/);
  for(const link of [...p.links,...(p.figures||[]).map(f=>({url:f.src}))]){
   if(link.url.startsWith('/research/'))await access('site'+link.url);
  }
  const brief=await readFile(`site/research/notes/${p.id}.md`,'utf8');assert.ok(!brief.includes('/Users/'));
 }
 const response={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(value){this.body=value;return this;}};
 await handler({method:'GET',query:{action:'projects'},headers:{}},response);
 assert.equal(response.code,200);assert.equal(response.body.data.projects.length,4);
 assert.equal(response.headers['Cache-Control'],'no-store');
});
