"""Classify items into the taxonomy -> build/data.json"""
import json, re, collections as C
from pathlib import Path
import pandas as pd
from taxonomy import TAXONOMY

ROOT = Path(__file__).resolve().parent.parent
B = ROOT / "data"
items = json.loads((B / "items_raw.json").read_text())
def _nt(t): return re.sub(r"[^a-z0-9]+", " ", (t or "").lower()).strip()
_by = {}
for it in items:
    k = _nt(it["title"])
    if k in _by:
        o = _by[k]
        o["sources"] = sorted(set(o["sources"]) | set(it["sources"]))
        o["sr_cats"].update(it.get("sr_cats", {}))
        o["sr_pick"] = o.get("sr_pick") or it.get("sr_pick")
        o.setdefault("sr_agendas", []); o["sr_agendas"] += [a for a in it.get("sr_agendas", []) if a not in o["sr_agendas"]]
        for f in ("summary", "authors", "date", "key_result", "orgs"):
            if not o.get(f) and it.get(f): o[f] = it[f]
        if "arxiv.org" in (it["url"] or "") and "arxiv.org" not in (o["url"] or ""): o["alt_url"] = o["url"]; o["url"] = it["url"]
    else:
        _by[k] = it
items = list(_by.values())

def comp(pats):
    return [re.compile(p if p.startswith(r"\b") or p.startswith("(") else r"(?<![a-z])" + p, re.I) for p in pats]

leaves, subs = [], []
for a in TAXONOMY:
    for s in a["subs"]:
        s["_kw"] = comp(s["kw"]); s["area"] = a["id"]; subs.append(s)
        for t in s["topics"]:
            t["_kw"] = comp(t["kw"]); t["sub"] = s["id"]; t["area"] = a["id"]; leaves.append(t)

sr_to_leaf = C.defaultdict(list); sr_to_sub = C.defaultdict(list)
for t in leaves:
    for x in t["sr"]: sr_to_leaf[x].append(t)
for s in subs:
    for x in s["sr"]: sr_to_sub[x].append(s)

# Shallow Review agenda name -> leaf (for curated picks)
AGENDA_TO_LEAF = {
 "Sparse Coding": "sae", "Reverse engineering": "circuits", "Causal Abstractions": "patching", "Extracting latent knowledge": "elk",
 "Lie and deception detectors": "deceptprobe", "Model diffing": "diffing", "Data attribution": "dataattr", "Pragmatic interpretability": "autointerp",
 "Learning dynamics and developmental interpretability": "dynamics", "Representation structure and geometry": "geometry",
 "Human inductive biases": "brainlike", "Monitoring concepts": "probes", "Activation engineering": "actsteer",
 "Guaranteed-Safe AI": "gsai", "Scientist AI": "scientistai", "Brainlike-AGI Safety": "brainlike",
 "Weak-to-strong generalization": "w2st", "Supervising AIs improving AIs": "aar", "AI explanations of AIs": "autointerp", "Debate": "debatet",
 "LLM introspection training": "introspect", "Agent foundations": "embedded", "Tiling agents": "tiling", "High-Actuation Spaces": "embedded",
 "Asymptotic guarantees": "asymptotic", "Heuristic explanations": "heuristic", "Behavior alignment theory": "behavtheory", "Other corrigibility": "corrigibility",
 "Natural abstractions": "natabs", "The Learning-Theoretic Agenda": "infrabayes", "Aligning to context": "pluralistic", "Aligning to the social contract": "pluralistic",
 "Theory for aligning multiple AIs": "socialtech", "Tools for aligning multiple AIs": "socialtech", "Aligned to who?": "pluralistic", "Aligning what?": "pluralistic",
 "AGI metrics": "benchmarks", "Capability evals": "benchmarks", "Autonomy evals": "autonomy", "WMD evals (Weapons of Mass Destruction)": "cbrn",
 "Situational awareness and self-awareness evals": "saeval", "Steganography evals": "stego", "AI deception evals": "schemeevals", "AI scheming evals": "schemeevals",
 "Sandbagging evals": "sandbag", "Self-replication evals": "selfrep", "Various Redteams": "redteam", "Other evals": "evalmethod",
 "Iterative alignment at pretrain-time": "pretrainalign", "Iterative alignment at post-train-time": "rlhfcore", "Black-box make-AI-solve-it": "aar",
 "Inoculation prompting": "emis", "Inference-time: In-context learning": "specs", "Inference-time: Steering": "actsteer",
 "Capability removal: unlearning": "unlearning", "Control": "protocols", "Safeguards (inference-time auxiliaries)": "safeguards",
 "Chain of thought monitoring": "cotmonitor", "Model values / model preferences": "modelvalues", "Character training and persona steering": "persona",
 "Emergent misalignment": "emis", "Model specs and constitutions": "specs", "Model psychopathology": "psychopath", "Data filtering": "pretrainalign",
 "Hyperstition studies": "hyperstition", "Data poisoning defense": "poisoning", "Synthetic data for alignment": "synthdata", "Data quality for alignment": "synthdata",
 "Mild optimisation": "mildopt", "RL safety": "safeexplore", "Assistance games, assistive agents": "assistance", "Harm reduction for open weights": "tamperresist",
 "The \"Neglected Approaches\" Approach": "fieldstrategy", "Other interpretability": None, "Concept-based interpretability": "concepts",
 "OpenAI": "systemcards", "Google Deepmind": "systemcards", "Anthropic": "systemcards", "xAI": "systemcards", "Meta": "systemcards", "China": "systemcards", "Others": "systemcards",
}
leaf_by_id = {t["id"]: t for t in leaves}
sub_by_id = {s["id"]: s for s in subs}

def hits(pats, text):
    return sum(1 for p in pats if p.search(text))

assign_stats = C.Counter()
SAFETY_CTX = re.compile(r"safe|align|risk|robust|interpretab|explain|transparen|trust|human feedback|preference|values?\b|ethic|moral|deceiv|decept|adversarial|reward|oversight|verif|harm|misuse|corrigib|catastroph|existential|governance|policy makers|regulat|superintelligen|\bAGI\b|manipulat|attack|backdoor|poison|privacy|uncertain|calibrat|out-of-distribution|anomal|fair", re.I)
BAD_TITLE = re.compile(r"^(unable to extract|unknown -|content unavailable|error|untitled|page not found|access denied|just a moment)", re.I)
import sys, os
LABELS = json.load(open(B / "labels.json")) if os.path.exists(B / "labels.json") else {}
DUMP = "--dump" in sys.argv
STRONG = re.compile(r"safe|align|interpretab|explain|reward|oversight|corrigib|decept|deceiv|value|ethic|moral|adversarial|robust|misuse|risk", re.I)
review = []
out = []
for it in items:
    title = it["title"] or ""
    lab = LABELS.get(it["url"])
    if lab is not None and not DUMP:
        if lab.get("drop"):
            assign_stats["claude_dropped"] += 1
            continue
        tps = [t for t in lab["t"] if t in leaf_by_id]
        if tps:
            it["topics"] = tps
            it["subs"] = sorted({leaf_by_id[t]["sub"] for t in tps})
            it["areas"] = sorted({sub_by_id[x]["area"] for x in it["subs"]})
            it["labeled"] = 1
            assign_stats["claude_labeled"] += 1
            out.append(it)
            continue
    if BAD_TITLE.search(title):
        assign_stats["bad_title"] += 1
        continue
    if it["sources"] == ["aisafetygraph"] and not it.get("asg_cat") and not SAFETY_CTX.search(title + " " + (it.get("summary") or "")):
        assign_stats["asg_no_safety_ctx"] += 1
        continue
    abs_ = (it.get("summary") or "") + " " + (it.get("key_result") or "")
    leaf_sc = C.Counter(); sub_sc = C.Counter()
    for t in leaves:
        th = hits(t["_kw"], title); ah = hits(t["_kw"], abs_)
        s = 3 * th + min(ah, 3)
        if s: leaf_sc[t["id"]] += s
    for s in subs:
        th = hits(s["_kw"], title); ah = hits(s["_kw"], abs_)
        v = 3 * th + min(ah, 3)
        if v: sub_sc[s["id"]] += v
    for cid, sc in it.get("sr_cats", {}).items():
        for t in sr_to_leaf.get(cid, []): leaf_sc[t["id"]] += 4 * sc
        for s in sr_to_sub.get(cid, []): sub_sc[s["id"]] += 4 * sc
    for ag in it.get("sr_agendas", []):
        lid = AGENDA_TO_LEAF.get(ag)
        if lid: leaf_sc[lid] += 6
    # combine: leaf gets half of its parent's subfield score
    comb = {lid: v + 0.5 * sub_sc.get(leaf_by_id[lid]["sub"], 0) for lid, v in leaf_sc.items()}
    ranked = sorted(comb.items(), key=lambda kv: -kv[1])
    topics = []
    if ranked and leaf_sc[ranked[0][0]] >= 2.5:
        topics.append(ranked[0][0])
        top = ranked[0][1]
        for lid, v in ranked[1:]:
            if len(topics) >= 3: break
            if leaf_sc[lid] >= 3 and v >= 0.6 * top:
                topics.append(lid)
    subs_only = []
    if not topics:
        sr = sorted(sub_sc.items(), key=lambda kv: -kv[1])
        if sr and sr[0][1] >= 2.4:
            subs_only.append(sr[0][0])
    is_asg_only = it["sources"] == ["aisafetygraph"]
    if not topics and not subs_only and not is_asg_only:
        topics.append("othercomment")
    if not topics and not subs_only:
        if is_asg_only:
            assign_stats["asg_dropped"] += 1
            if DUMP and STRONG.search(title): review.append((it, ["-"]))
            continue
        assign_stats["unplaced"] += 1
    # ASG-only items: require stronger evidence (corpus includes capabilities papers cited by safety work)
    if is_asg_only and topics and leaf_sc[topics[0]] < 3 and not it.get("asg_cat"):
        assign_stats["asg_weak_dropped"] += 1
        if DUMP and STRONG.search(title): review.append((it, ["-"]))
        continue
    if is_asg_only and not topics and not (subs_only and sub_sc[subs_only[0]] >= 3):
        assign_stats["asg_dropped"] += 1
        if DUMP and STRONG.search(title): review.append((it, ["-"]))
        continue
    assign_stats["placed_topic" if topics else ("placed_sub" if subs_only else "unplaced_kept")] += 1
    it["topics"] = topics
    it["subs"] = sorted({leaf_by_id[t]["sub"] for t in topics} | set(subs_only))
    it["areas"] = sorted({sub_by_id[s]["area"] for s in it["subs"]})
    it["_score"] = ranked[0][1] if ranked else 0
    out.append(it)
    if DUMP: review.append((it, topics or ["sub:" + subs_only[0]]))

print(assign_stats, len(out))
leafcount = C.Counter(t for it in out for t in it["topics"])
for a in TAXONOMY:
    na = sum(1 for it in out if a["id"] in it["areas"])
    print(f"\n## {a['name']} ({na})")
    for s in a["subs"]:
        ns = sum(1 for it in out if s["id"] in it["subs"])
        print(f"  {s['name']} ({ns}): " + ", ".join(f"{t['name']}={leafcount[t['id']]}" for t in s["topics"]))
if DUMP:
    review.sort(key=lambda r: (r[1][0], r[0]["title"]))
    with open(B / "review.tsv", "w") as f:
        for n, (it, tp) in enumerate(review):
            src = "".join(x[0] for x in it["sources"])
            f.write(f"{n}\t{it['url']}\t{','.join(tp)}\t{src}\t{it['title'][:110]}\n")
    print("review rows", len(review))
else:
    json.dump(out, open(B / "items_classified.json", "w"))
