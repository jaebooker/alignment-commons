import json, re, pandas as pd
from pathlib import Path
from taxonomy import TAXONOMY
import importlib.util
ROOT = Path(__file__).resolve().parent.parent
B = ROOT / "data"
AG2LEAF = None
src = (ROOT/"pipeline/classify.py").read_text()
m = re.search(r"AGENDA_TO_LEAF = (\{.*?\n\})", src, re.S); AG2LEAF = eval(m.group(1))
items = json.load(open(B/"items_classified.json"))
items.sort(key=lambda i: (i.get("date") or "0000"), reverse=True)
SRC = {"shallowreview": "sr", "aisafetygraph": "asg", "alignmentforum": "af"}
def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"
out = []
for k, it in enumerate(items):
    a = it.get("authors") or []
    auth = ", ".join(a[:4]) + (" et al." if len(a) > 4 else "")
    out.append({"i": k, "t": it["title"], "u": it["url"], "d": it.get("date") or "", "a": auth,
                "s": clip(it.get("summary"), 420), "y": it.get("type") or "other", "r": 1 if it.get("labeled") else 0,
                "src": [SRC[x] for x in it["sources"]], "p": 1 if it.get("sr_pick") else 0,
                "tp": it["topics"], "sb": it["subs"], "ar": it["areas"]})
# agendas
ag = pd.read_csv(ROOT/"raw/sr/main-pipeline/data/2025-12-16-draft-post-review/agendas.csv")
agendas = []
for _, r in ag.iterrows():
    leaf = AG2LEAF.get(r["name"])
    if not leaf: continue
    f = lambda x: x if isinstance(x, str) else ""
    agendas.append({"name": r["name"], "leaf": leaf, "summary": f(r.one_sentence_summary), "toc": clip(f(r.theory_of_change).strip('"'), 600),
                    "names": clip(f(r.some_names), 200), "ftes": f(str(r.estimated_ftes)) if r.estimated_ftes == r.estimated_ftes else "",
                    "critiques": f(r.critiques), "approach": f(r.broad_approach_text), "target": f(r.target_case_text)})
tax = []
for a in TAXONOMY:
    tax.append({"id": a["id"], "name": a["name"], "desc": a["desc"], "color": a["color"],
                "subs": [{"id": s["id"], "name": s["name"], "desc": s["desc"],
                          "topics": [{"id": t["id"], "name": t["name"], "desc": t["desc"]} for t in s["topics"]]} for s in a["subs"]]})
data = {"built": "2026-10-01", "taxonomy": tax, "items": out, "agendas": agendas}
js = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
(ROOT/"site/data.json").write_text(js)
print(len(out), len(agendas), round(len(js)/1e6, 2), "MB")
