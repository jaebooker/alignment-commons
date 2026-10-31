// Research history is separate from the frozen catalogue and its direction signals.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const RESULTS = {met:['Succeeded under criterion','win'],not_met:['Criterion not met','gate'],inconclusive:['Interpretation withheld','null'],mixed:['Mixed — see hypotheses','mech'],not_assessed:['Not assessed','null']};
const RUNS = {completed:'Run completed',proposed:'Proposed — not run',blocked:'Blocked — not run'};
function safeLink(value) {
  if (typeof value !== 'string') return '';
  if (/^\/research\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes('..')) return value;
  try { const u=new URL(value); return u.protocol==='https:'&&!u.username&&!u.password?u.href:''; } catch { return ''; }
}
function matches(row, view) {
  return view==='completed'?row.run_status==='completed':view==='met'?row.run_status==='completed'&&row.result==='met':view==='mixed'?row.run_status==='completed'&&row.result==='mixed':view==='proposed'?row.run_status==='proposed'||row.run_status==='blocked':true;
}
function rowHTML(row) {
  const result=RESULTS[row.result]||['Unknown','null'];
  const links=(row.evidence||[]).map(safeLink).filter(Boolean);
  return `<article class="matrix-row" data-run-status="${esc(row.run_status)}" data-result="${esc(row.result)}">
    <div class="matrix-badges"><span class="v ${row.run_status==='completed'?'mech':'null'}">${esc(RUNS[row.run_status]||'Unknown')}</span>${row.run_status==='completed'?`<span class="v ${result[1]}">${esc(result[0])}</span>`:''}</div>
    <h4>${esc(row.title)}</h4><p class="matrix-stage">${esc(row.stage)}${row.idea_ids.length>1?' · Shared study; listed under each relevant idea, counted once':''}</p>
    <p>${esc(row.detail)}</p>
    <details class="matrix-design"><summary>${row.run_status==='proposed'?'Draft design and success criterion':'Criterion and component results'}</summary>
      <p><b>${row.run_status==='proposed'?'Candidate success rule':'Criterion'}:</b> ${esc(row.success_rule)}</p>
      ${row.prerequisites?`<p><b>Before running:</b> ${esc(row.prerequisites)}</p>`:''}
      ${row.comparison?`<p>${esc(row.comparison)}</p>`:''}${row.analysis?`<p class="fine">${esc(row.analysis)}</p>`:''}
      ${row.resources?`<p class="fine">${esc(row.resources)}</p>`:''}
      ${(row.components||[]).map(c=>`<p><b>${esc(c.name)}:</b> ${esc(RESULTS[c.result]?.[0]||c.result)}. ${esc(c.detail)}</p>`).join('')}
    </details>
    ${links.length?`<div class="cite">${links.map((url,i)=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Evidence${links.length>1?' '+(i+1):''} ↗</a>`).join(' · ')}</div>`:''}
  </article>`;
}
export function renderIdeaTests(id, matrix, view='all') {
  if (!matrix) return '';
  const all=matrix.tests.filter(t=>t.idea_ids.includes(id));
  if (!all.length) return '';
  const completed=all.filter(t=>t.run_status==='completed').length;
  const met=all.filter(t=>t.run_status==='completed'&&t.result==='met').length;
  const mixed=all.filter(t=>t.run_status==='completed'&&t.result==='mixed').length;
  const proposed=all.filter(t=>t.run_status==='proposed').length;
  const selected=all.filter(t=>matches(t,view));
  return `<details class="test-history" id="tests-${esc(id)}" ${view!=='all'&&selected.length?'open':''}>
    <summary>Tests &amp; follow-ups · ${completed} run · ${met} succeeded under criterion${mixed?` · ${mixed} mixed`:""} · ${proposed} proposed</summary>
    <p class="fine">Counts describe documented checks in different stages/settings, not independent replications or a success rate. Expand each criterion for its scope.</p>
    ${selected.length?selected.map(rowHTML).join(''):'<p class="fine">No matching test records. This is not evidence of failure or absence of research.</p>'}
  </details>`;
}
export function renderMatrixOverview(matrix, ideas, view='all') {
  if (!matrix) return '<p class="fine">The per-idea test registry is temporarily unavailable; historical catalogue verdicts remain below.</p>';
  const controls=new Set(ideas.filter(i=>i.control).map(i=>i.id));
  const research=matrix.tests.filter(t=>!t.idea_ids.every(id=>controls.has(id)));
  const completed=research.filter(t=>t.run_status==='completed').length;
  const met=research.filter(t=>t.run_status==='completed'&&t.result==='met').length;
  const proposed=research.filter(t=>t.run_status==='proposed').length;
  return `<section class="about matrix-overview" id="test-registry"><h2>One idea, several tests</h2>
    <p>Review: ${esc(matrix.reviewed)}. <b>${completed} documented research checks</b> · <b>${met} met their stated criterion</b> · <b>${proposed} draft follow-ups</b>. Includes separate programme studies; controls excluded. Gates, benchmarks and diagnostic checks are counted separately, not pooled as independent replications.</p>
    <p><b>Run completed</b> tells you the work ran. <b>Succeeded under criterion</b> means the specified local rule passed. <b>Criterion not met</b> preserves negative and inconclusive-at-minimum results. Mixed studies show each hypothesis. Proposed tests have no result and are not queued or preregistered.</p>
    <div class="matrix-tools"><label>Show test records <select id="matrix-view" aria-label="Show test records">${[['all','All statuses'],['completed','Run completed'],['met','Succeeded under criterion'],['mixed','Mixed hypothesis results'],['proposed','Proposed / blocked']].map(([id,label])=>`<option value="${id}" ${id===view?'selected':''}>${label}</option>`).join('')}</select></label>
    <label>Jump to an idea <select id="matrix-idea" aria-label="Jump to an idea"><option value="">Choose an idea…</option>${ideas.filter(x=>!x.control).map(x=>`<option value="${esc(x.id)}">${esc(x.title)}</option>`).join('')}${matrix.programmes.map(x=>`<option value="${esc(x.id)}">Programme: ${esc(x.title)}</option>`).join('')}</select></label></div>
    <h3>Recommended next registrations</h3><ol>${matrix.priority_ids.map(id=>matrix.tests.find(t=>t.id===id)).filter(Boolean).map(t=>`<li><button class="chip" type="button" data-test-focus="${esc(t.idea_ids[0])}">${esc(t.title)}</button> <span class="fine">Proposed; ${t.origin==='existing_open'?'existing open follow-up':'new draft design'}</span></li>`).join('')}</ol>
    <details><summary>Shared design rules and evidence limits</summary><ul>${matrix.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></details>
    <p><a href="/research/test-matrix-2026-10-31/REPORT.md" target="_blank" rel="noopener">Download the complete test plan ↗</a> · <a href="/test-matrix.json" target="_blank" rel="noopener">Structured registry ↗</a></p></section>`;
}
export function renderProgrammes(matrix, view='all') {
  if (!matrix) return '';
  return `<section class="tbsec"><h2>Related programmes: separate studies</h2><p class="fine">These are outside the original catalogue’s 29 tested research adaptations. Selected recent histories are shown here; each project links to its fuller record. Open these histories for the recent Go failure, Bounded Agency limits and Claude’s new mixed KL confirmation. They do not change historical direction signals.</p>${matrix.programmes.map(p=>`<div class="tbcard"><h3><a href="${esc(p.url)}">${esc(p.title)} ↗</a></h3>${renderIdeaTests(p.id,matrix,view)}</div>`).join('')}</section>`;
}
