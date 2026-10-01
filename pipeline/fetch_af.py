"""Refresh data/af_posts.tsv from the Alignment Forum GraphQL API.

Usage: python pipeline/fetch_af.py [--pages N]
Pulls the newest posts (view "new") and the all-time top posts (view "top"),
merges them with what is already in data/af_posts.tsv, and rewrites the file.
Columns: post id, YYYY-MM-DD, title.
"""
import argparse, json, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data/af_posts.tsv"
API = "https://www.alignmentforum.org/graphql"

def page(view, offset, limit=100):
    q = '{posts(input:{terms:{view:"%s",limit:%d,offset:%d}}){results{_id title postedAt}}}' % (view, limit, offset)
    url = API + "?query=" + urllib.parse.quote(q)
    req = urllib.request.Request(url, headers={"User-Agent": "alignment-commons/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)["data"]["posts"]["results"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", type=int, default=10, help="pages of 100 per view")
    args = ap.parse_args()
    rows = {}
    if OUT.exists():
        for line in OUT.read_text(encoding="utf-8").splitlines():
            p = line.split("\t")
            if len(p) == 3: rows[p[0]] = p
    for view in ("new", "top"):
        for i in range(args.pages):
            res = page(view, i * 100)
            if not res: break
            for r in res:
                rows[r["_id"]] = [r["_id"], (r["postedAt"] or "")[:10], " ".join(r["title"].split())]
            time.sleep(1)
    OUT.write_text("\n".join("\t".join(v) for v in sorted(rows.values(), key=lambda v: v[1], reverse=True)) + "\n", encoding="utf-8")
    print(f"{len(rows)} posts in {OUT}")

if __name__ == "__main__":
    main()
