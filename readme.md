# Alignment Commons

A navigable atlas of AI alignment and safety research. Drill from an area (Interpretability) to a subfield (Mechanistic interpretability) to a topic (Sparse autoencoders), with a filterable reading list at every level.

Live site: deployed from `site/` on Vercel.

## What's in it

About 2,900 papers and posts, each placed in 1 to 3 of 139 topics across 11 areas.

| Source | What we use | License / terms |
|---|---|---|
| [Shallow Review of Technical AI Safety 2025](https://shallowreview.ai) (Arb Research and contributors) | Classified link database, the 800+ outputs picked for the review ("SR pick"), and 78 agenda profiles shown on topic pages | Public data repo: [arb-consulting/shallow-review-2025](https://github.com/arb-consulting/shallow-review-2025) |
| [AI Safety Graph](https://ai-safety-graph.github.io/AISafetyGraph/) (Apart Research) | arXiv papers with abstracts, filtered to safety-relevant ones | MIT |
| [StampyAI Alignment Research Dataset](https://huggingface.co/datasets/StampyAI/alignment-research-dataset) | Upstream of the AI Safety Graph arXiv list | See dataset card |
| [Alignment Forum](https://www.alignmentforum.org) | Titles and dates of recent and top-rated posts, via the public GraphQL API | Links out to the original posts |

Slade Byrd's [AI Safety Literature Database](https://sladebyrd.com/ai-safety-db) inspired the project. No data is copied from it.

## Layout

```
site/            static site (index.html + data.json), what Vercel serves
pipeline/        build scripts
  taxonomy.py    the 3-level tree: areas > subfields > topics, with match patterns
  ingest.py      merge sources into data/items_raw.json
  classify.py    place items into topics (labels.json wins over patterns)
  export.py      write site/data.json
  fetch_af.py    refresh data/af_posts.tsv from the Alignment Forum API
  fetch_sources.sh  clone source repos into raw/
data/
  af_posts.tsv   Alignment Forum posts (id, date, title)
  labels.json    reviewed topic assignments keyed by URL ({"t": [...]} or {"drop": 1})
```

## Rebuild

```
pip install -r pipeline/requirements.txt
python pipeline/fetch_af.py        # optional: pull newer AF posts
./pipeline/build.sh
```

## How placement works

1. `classify.py` scores each item against each topic's title and abstract patterns, plus Shallow Review's own category labels.
2. Every item was then reviewed by Claude, and the decisions live in `data/labels.json`. A label overrides the pattern match. `{"drop": 1}` removes general ML papers that are not about safety.
3. New items get the pattern match until reviewed. Run `python pipeline/classify.py --dump` to write `data/review.tsv` with the candidates and their suggested topics.

To fix a misfile, edit its entry in `data/labels.json` (or add one) and rebuild.

## Known gaps

- 2026 arXiv papers: arXiv was not reachable from the build environment. Adding an arXiv fetcher is the next step.
- 2023 to 2024 forum posts are thin. `fetch_af.py --pages 30` fills most of that.
