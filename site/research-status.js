const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function evidenceLink(value) {
  if (typeof value !== 'string') return '';
  if (/^\/research\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes('..')) return value;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
}
export function researchStatusSections(project) {
  const groups = [
    ['Completed studies and checks', project.completed_steps, 'Completed means the study ran; its support rule may have failed. Read each finding with its original scope.'],
    ['Partial studies', project.partial_steps, 'Completion is not established. A partial session-exit log does not establish that work is currently running.'],
    ['Open experiments and integration work', project.next_steps, 'These items remain open. Listing an item does not automatically queue a job.'],
    ['Available workflows', project.available_steps, 'Existing workflows are available separately from proposed new experiments.'],
  ];
  return groups.filter(([, items]) => items?.length).map(([title, items, note]) =>
    `<section class="panel"><h2>${esc(title)}</h2><p class="fine">${esc(note)}</p>${items.map(item => {
      const href = evidenceLink(item.evidence_url);
      return `<article class="row"><div class="meta"><span class="badge">${esc(item.status)}</span></div><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p>${href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">Read evidence ↗</a>` : ''}</article>`;
    }).join('')}</section>`
  ).join('');
}
