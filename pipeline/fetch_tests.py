"""Pull tested-idea results from Alignment SynthCore into the site.

    python pipeline/fetch_tests.py                       # from GitHub (main branch)
    python pipeline/fetch_tests.py ../alignment-synthcore  # from a local checkout

Reads results/commons.json from the SynthCore repo, checks that every idea and testbed
points at a topic that exists here, and writes site/tests.json. The site loads it next
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


def main():
    data = load(sys.argv[1] if len(sys.argv) > 1 else None)
    site = json.loads((ROOT / "site" / "data.json").read_text())
    topics = {t["id"] for a in site["taxonomy"] for s in a["subs"] for t in s["topics"]}
    bad = sorted({str(x["topic"]) for x in data["ideas"] if x["topic"] not in topics} |
                 {t for tb in data["testbeds"] for t in tb["topics"] if t not in topics})
    if bad:
        raise SystemExit(f"unknown Commons topic ids in SynthCore results: {bad}")
    (ROOT / "site" / "tests.json").write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False))
    real = [x for x in data["ideas"] if not x["control"] and x["testbed"]]
    gaps = [x for x in data["ideas"] if x["verdict"] == "untestable"]
    print(f"{len(real)} tested ideas on {len(data['testbeds'])} testbeds, {len(gaps)} untestable -> site/tests.json")


if __name__ == "__main__":
    main()
