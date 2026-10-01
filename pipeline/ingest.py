"""Ingest sources into a unified item list: build/items_raw.json"""
import sqlite3, json, csv, re, hashlib, sys
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"
SR = RAW / "sr/main-pipeline/data"
ASG = RAW / "asg/generate_md"
csv.field_size_limit(10**8)

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

def norm_title(t):
    return re.sub(r"[^a-z0-9]+", " ", (t or "").lower()).strip()

def arxiv_date(u):
    m = re.search(r"arxiv\.org/abs/(\d{2})(\d{2})\.", u)
    if m:
        return f"20{m.group(1)}-{m.group(2)}"
    return None

KEEP_KINDS = {"paper_preprint", "paper_published", "blog_post", "lesswrong", "agenda_manifesto", "dataset_benchmark",
              "code_tool", "course_educational", "other", "demo_case_study", "personal_page", "podcast", "video", None}
TYPE_MAP = {"paper_preprint": "paper", "paper_published": "paper", "blog_post": "post", "lesswrong": "post",
            "agenda_manifesto": "agenda", "dataset_benchmark": "dataset", "code_tool": "code", "course_educational": "course",
            "podcast": "media", "video": "media"}

items = {}

def add(it):
    key = it["url"] or ("t:" + norm_title(it["title"]))
    if key in items:
        old = items[key]
        for k, v in it.items():
            if k == "sources":
                old["sources"] = sorted(set(old["sources"]) | set(v))
            elif k == "sr_cats":
                old["sr_cats"].update(v)
            elif not old.get(k) and v:
                old[k] = v
        old["sr_pick"] = old.get("sr_pick") or it.get("sr_pick")
    else:
        items[key] = it

# 1) Shallow Review classify table
c = sqlite3.connect(SR / "data.db")
n_sr = 0
for url, status, kind, data, rel in c.execute("select url,status,kind,data,ai_safety_relevance from classify"):
    if status != "done" or not data:
        continue
    d = json.loads(data)
    kind = d.get("kind", kind)
    if kind not in KEEP_KINDS or rel is None or rel < 0.5:
        continue
    if not d.get("title"):
        continue
    u = norm_url(url)
    date = d.get("date") or (str(d.get("published_year")) if d.get("published_year") else None) or arxiv_date(u)
    authors = [a for a in (d.get("authors") or []) if isinstance(a, str)]
    add(dict(
        url=u, title=d["title"].strip(), authors=authors[:12], orgs=(d.get("author_organizations") or [])[:6],
        date=str(date)[:10] if date else None, summary=(d.get("summary") or "").strip(),
        key_result=(d.get("key_result") or "") or "", type=TYPE_MAP.get(kind, "other"), venue=d.get("venue") or "",
        relevance=float(rel), sources=["shallowreview"], sr_cats={x["id"]: x["score"] for x in (d.get("categories") or [])},
        sr_pick=False))
    n_sr += 1
print("shallow review classify kept", n_sr)

# 2) Shallow Review curated outputs (papers.csv) -> flag picks + agenda
pp = pd.read_csv(SR / "2025-12-16-draft-post-review/papers.csv")
n_pick = 0
for _, r in pp.iterrows():
    if not isinstance(r.link_url, str):
        continue
    u = norm_url(r.link_url)
    title = r.title if isinstance(r.title, str) else r.link_text
    add(dict(url=u, title=str(title).strip(), authors=[a.strip() for a in str(r.authors).split(",")][:12] if isinstance(r.authors, str) else [],
             orgs=[], date=str(r.date)[:10] if isinstance(r.date, str) else (str(int(r.published_year)) if r.published_year == r.published_year else arxiv_date(u)),
             summary="", key_result="", type="paper" if "arxiv" in u or "openreview" in u else "post", venue="",
             relevance=0.9, sources=["shallowreview"], sr_cats={}, sr_pick=True, sr_agenda=r.agenda_name))
    key = u
    items[key]["sr_pick"] = True
    items[key].setdefault("sr_agendas", [])
    if r.agenda_name not in items[key]["sr_agendas"]:
        items[key]["sr_agendas"].append(r.agenda_name)
    n_pick += 1
print("shallow review picks", n_pick)

# 3) AI Safety Graph arXiv corpus (Apart Research; drawn from StampyAI alignment research dataset)
asg_titles_categorized = set()
cats = json.load(open(ASG / "categories.json"))
for a, subs in cats.items():
    for s, titles in subs.items():
        for t in titles:
            asg_titles_categorized.add(norm_title(t))
n_asg = 0
with open(ASG / "arxiv_papers_for_llm.csv") as f:
    for r in csv.DictReader(f):
        u = norm_url(r["url"])
        add(dict(url=u, title=re.sub(r"\s+", " ", r["title"]).strip(), authors=[], orgs=[], date=arxiv_date(u),
                 summary=re.sub(r"\s+", " ", r["abstract"]).strip(), key_result="", type="paper", venue="arXiv",
                 relevance=None, sources=["aisafetygraph"], sr_cats={}, sr_pick=False,
                 asg_cat=norm_title(r["title"]) in asg_titles_categorized))
        n_asg += 1
print("asg rows", n_asg)

# 4) Alignment Forum posts (fetched via the AF GraphQL API; see fetch_af.py)
n_af = 0
for line in open(ROOT / "data/af_posts.tsv", encoding="utf-8"):
    parts = line.rstrip("\n").split("\t")
    if len(parts) < 3: continue
    pid, date, title = parts[0], parts[1], parts[2]
    add(dict(url=f"https://www.lesswrong.com/posts/{pid}", title=title.strip(), authors=[], orgs=[], date=date,
             summary="", key_result="", type="post", venue="Alignment Forum", relevance=None, sources=["alignmentforum"],
             sr_cats={}, sr_pick=False))
    n_af += 1
print("alignment forum posts", n_af)

out = list(items.values())
for it in out:
    it["sr_cats"] = dict(it["sr_cats"])
print("unique items", len(out))
(ROOT / "data/items_raw.json").write_text(json.dumps(out))
