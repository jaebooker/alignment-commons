"""Pull tested-idea results from Alignment SynthCore into the site.

    python pipeline/fetch_tests.py                       # from GitHub (main branch)
    python pipeline/fetch_tests.py ~/alignment-synthcore  # from a local checkout
    python pipeline/fetch_tests.py --problems-only ~/alignment-synthcore  # only site/testbed-problems.json

Reads results/commons.json from the SynthCore repo, checks that every idea and testbed
points at a topic that exists here, that every idea's testbed is described, and that
testbed core-problem ids match site/coverage.json, then writes site/tests.json and
site/testbed-problems.json (which core problems each testbed plants, for the coverage grid).

site/tests.json is currently a frozen snapshot that tests/test-matrix.test.mjs and
tests/completion-import.test.mjs pin by hash. Use --problems-only to refresh the problem
mapping without touching it. The site loads it next
to data.json and shows each idea on its topic page and on the Tested ideas page.
Standard library only.
"""
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
URL = "https://raw.githubusercontent.com/jaebooker/alignment-synthcore/main/results/commons.json"


def load(src: str | None) -> dict:
    if src:
        return json.loads((Path(src) / "results" / "commons.json").read_text())
    with urllib.request.urlopen(URL, timeout=30) as r:
        return json.loads(r.read())


def write_problems(data: dict) -> None:
    out = {"generated": data.get("generated"), "repo": data.get("repo"),
           "testbeds": {tb["id"]: {"problems": tb.get("problems", []), "note": tb.get("problems_note", "")}
                        for tb in data["testbeds"]}}
    if not any(v["problems"] for v in out["testbeds"].values()):
        raise SystemExit("SynthCore testbeds carry no core-problem tags (TESTBED_PROBLEMS in summarize.py)")
    (ROOT / "site" / "testbed-problems.json").write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    print(f"core-problem tags for {len(out['testbeds'])} testbeds -> site/testbed-problems.json")


def check_problems(data: dict) -> None:
    cov = ROOT / "site" / "coverage.json"
    if cov.exists():
        problems = {p["id"] for p in json.loads(cov.read_text())["problems"]}
        badp = sorted({p for tb in data["testbeds"] for p in tb.get("problems", []) if p not in problems})
        if badp:
            raise SystemExit(f"unknown core-problem ids on SynthCore testbeds: {badp}")


def main():
    args = [a for a in sys.argv[1:] if a != "--problems-only"]
    data = load(args[0] if args else None)
    check_problems(data)
    if "--problems-only" in sys.argv:
        write_problems(data)
        return
    site = json.loads((ROOT / "site" / "data.json").read_text())
    topics = {t["id"] for a in site["taxonomy"] for s in a["subs"] for t in s["topics"]}
    bad = sorted({str(x["topic"]) for x in data["ideas"] if x["topic"] not in topics} |
                 {t for tb in data["testbeds"] for t in tb["topics"] if t not in topics})
    if bad:
        raise SystemExit(f"unknown Commons topic ids in SynthCore results: {bad}")
    tbs = {tb["id"] for tb in data["testbeds"]}
    orphans = sorted({x["testbed"] for x in data["ideas"] if x["testbed"] and x["testbed"] not in tbs})
    if orphans:
        raise SystemExit(f"ideas on testbeds SynthCore does not describe (add them to TESTBEDS in summarize.py): {orphans}")
    (ROOT / "site" / "tests.json").write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False))
    write_problems(data)
    real = [x for x in data["ideas"] if not x["control"] and x["testbed"]]
    gaps = [x for x in data["ideas"] if x["verdict"] == "untestable"]
    print(f"{len(real)} tested ideas on {len(data['testbeds'])} testbeds, {len(gaps)} untestable -> site/tests.json")


if __name__ == "__main__":
    main()
