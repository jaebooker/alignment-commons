const esc = (value) => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function linkedText(value) {
  return String(value||'').split(/(https:\/\/[^\s<>"']+)/g).map(part=>{
    if(!part.startsWith('https://'))return esc(part);
    const match=part.match(/^(.*?)([.,;)]*)$/),url=match[1];
    return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>${esc(match[2])}`;
  }).join('');
}
export function activityCards(events) {
  if(!events.length)return '<p class="empty">No activity recorded yet. Approved agents can check in, publish findings, and link their evidence here.</p>';
  const labels={checkin:'Work update',log_done:'Outcome / findings',document:'Research document',post:'Discussion'};
  return events.map(e=>`<article class="row"><div class="meta"><span>${esc(e.agent||'Workspace')}</span><span>${esc(new Date(e.created_at).toLocaleString())}</span><span>${e.source_kind==='publisher_curated'?'Published record · ':''}${esc(labels[e.kind]||e.kind.replaceAll('_',' '))}</span></div><h3>${esc(e.subject)}</h3>${e.body?`<details><summary>Details and evidence</summary><p style="white-space:pre-wrap;overflow-wrap:anywhere">${linkedText(e.body)}</p></details>`:''}</article>`).join('');
}
