# Agenda x problem coverage grid -> site/coverage.json
#
# Rows: Shallow Review 2025 agendas. Columns: davidad's 13 "orthodox" alignment
# problems. A cell is filled only where Shallow Review's own editors tagged the
# agenda with that problem. Commons adds no judgments here: untagged agendas stay
# untagged, and the tag is agenda-level (every output of an agenda counts toward
# each of its problems).
#
# Reads raw/sr (pipeline/fetch_sources.sh) and site/data.json (run after export.py).
import json, re, sys
from collections import Counter
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
SR = ROOT / "raw/sr/main-pipeline/data/2025-12-16-draft-post-review"

# The list as Shallow Review defines it (main-pipeline/shallow_review/draft_types.py).
AF = "https://www.alignmentforum.org/posts/mnoc3cKY3gXMrTybs/a-list-of-core-ai-safety-problems-and-how-i-hope-to-solve#"
PROBLEMS = [
    ("value_fragile", "Value is fragile and hard to specify", "Value is fragile", "1__Value_is_fragile_and_hard_to_specify"),
    ("corrigibility_anti_natural", "Corrigibility is anti-natural", "Corrigibility", "2__Corrigibility_is_anti_natural"),
    ("pivotal_dangerous_capabilities", "Pivotal processes require dangerous capabilities", "Pivotal: dangerous capabilities", "3__Pivotal_processes_require_dangerous_capabilities"),
    ("goals_misgeneralize", "Goals misgeneralize out of distribution", "Goal misgeneralization", "4__Goals_misgeneralize_out_of_distribution"),
    ("instrumental_convergence", "Instrumental convergence", "Instrumental convergence", "5__Instrumental_convergence"),
    ("pivotal_incomprehensible_plans", "Pivotal processes likely require incomprehensibly complex plans", "Pivotal: incomprehensible plans", "6__Pivotal_processes_likely_require_incomprehensibly_complex_plans"),
    ("superintelligence_fool_supervisors", "Superintelligence can fool human supervisors", "Fools human supervisors", "7__Superintelligence_can_fool_human_supervisors"),
    ("superintelligence_hack_software", "Superintelligence can hack software supervisors", "Hacks software supervisors", "8__Superintelligence_can_hack_software_supervisors"),
    ("humans_not_first_class", "Humans cannot be first-class parties to a superintelligent value handshake", "Value handshake", "9__Humans_cannot_be_first_class_parties_to_a_superintelligent_value_handshake"),
    ("humanlike_minds_not_safe", "Humanlike minds/goals are not necessarily safe", "Humanlike minds", "10__Humanlike_minds_goals_are_not_necessarily_safe"),
    ("someone_else_deploys", "Someone else will deploy unsafe superintelligence first", "Someone else deploys", "11__Someone_else_will_deploy_unsafe_superintelligence_first"),
    ("boxed_agi_exfiltrate", "A boxed AGI might exfiltrate itself by steganography, spearphishing", "Boxed AGI exfiltrates", "12__A_boxed_AGI_might_exfiltrate_itself_by_steganography__spearphishing"),
    ("fair_sane_pivotal", "Fair, sane pivotal processes", "Fair, sane pivotal processes", "13__Fair__sane_pivotal_processes"),
]
PIDS = {p[0] for p in PROBLEMS}

# Same normalisation as ingest.py, so SR output links match Commons item URLs.
def norm_url(u):
    u = (u or "").strip()
    u = re.sub(r"^http://", "https://", u)
    m = re.search(r"arxiv\.org/(abs|pdf|html)/(\d{4}\.\d{4,5}|[a-z\-]+/\d{7})(v\d+)?", u)
    if m:
        return "https://arxiv.org/abs/" + m.group(2)
    m2 = re.search(r"(?:lesswrong\.com|alignmentforum\.org)/posts/([A-Za-z0-9]{17})", u)
    if m2:
        return "https://www.lesswrong.com/posts/" + m2.group(1)
    u = u.replace("://www.lesswrong.com", "://lesswrong.com").replace("://www.alignmentforum.org", "://alignmentforum.org")
    u = re.sub(r"[?#].*$", "", u) if "lesswrong" in u or "alignmentforum" in u else u
    return u.rstrip("/")

src = (ROOT / "pipeline/classify.py").read_text()
AG2LEAF = eval(re.search(r"AGENDA_TO_LEAF = (\{.*?\n\})", src, re.S).group(1))

parsed = json.load(open(SR / "source-parsed.json"))
tags = {}
for it in parsed["items"]:
    a = it.get("agenda_attributes")
    if not a:
        continue
    ids = a["orthodox_problems"]
    ids = eval(ids) if isinstance(ids, str) else ids
    unknown = set(ids) - PIDS
    if unknown:
        sys.exit(f"Unknown orthodox problem id(s) for {it['name']!r}: {sorted(unknown)}")
    tags[it["name"]] = ids

ag = pd.read_csv(SR / "agendas.csv")
papers = pd.read_csv(SR / "papers.csv")
indexed = {it["u"] for it in json.load(open(ROOT / "site/data.json"))["items"]}

rows, missing = [], []
for _, r in ag.iterrows():
    name = r["name"]
    if name not in tags:
        missing.append(name)
        continue
    urls = {norm_url(u) for u in papers.loc[papers.agenda_name == name, "link_url"].dropna()}
    rows.append({"name": name, "section": r["section"], "leaf": AG2LEAF.get(name) or "",
                 "problems": tags[name], "outputs": len(urls), "indexed": len(urls & indexed)})
if missing:
    sys.exit(f"Agendas in agendas.csv with no parsed attributes: {missing}")

cols = []
for pid, name, short, anchor in PROBLEMS:
    on = [r for r in rows if pid in r["problems"]]
    cols.append({"id": pid, "name": name, "short": short, "url": AF + anchor,
                 "agendas": len(on), "outputs": sum(r["outputs"] for r in on)})

out = {"generated": pd.Timestamp.now().strftime("%Y-%m-%d"),
       "source": {"name": "Shallow Review of Technical AI Safety 2025", "url": "https://github.com/arb-consulting/shallow-review-2025",
                  "problems_from": "https://www.alignmentforum.org/posts/mnoc3cKY3gXMrTybs"},
       "problems": cols, "agendas": rows}
(ROOT / "site/coverage.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
tagged = sum(1 for r in rows if r["problems"])
print(f"{len(rows)} agendas ({tagged} tagged, {len(rows) - tagged} untagged) x {len(cols)} problems")
for c in sorted(cols, key=lambda c: c["agendas"]):
    print(f"  {c['agendas']:>3} agendas {c['outputs']:>4} outputs  {c['name']}")
