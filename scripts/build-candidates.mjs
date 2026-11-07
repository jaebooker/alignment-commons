// Splitter (code node). Picks atlas papers that a current testbed could plausibly test,
// minus papers already in the pinned catalogue. Cut by testability, not by atlas folder:
// a paper is a candidate when one of its topics is a topic some testbed measures.
// Deterministic; rerun after the atlas or the catalogue changes, then commit lib/pipeline.json.
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const atlas = JSON.parse(await readFile(new URL("site/data.json", root), "utf8"));
const catalog = JSON.parse(await readFile(new URL("lib/catalog.json", root), "utf8"));

export const paperKey = (url = "", title = "") => {
  const ax = /arxiv\.org\/(?:abs|pdf)\/([0-9]{4}\.[0-9]{4,5})/i.exec(url);
  if (ax) return `arxiv:${ax[1]}`;
  if (url) return `url:${url.replace(/^https?:\/\/(www\.)?/, "").replace(/[/#?]+$/, "").toLowerCase()}`;
  return `title:${title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
};

const byTopic = {};
for (const t of catalog.testbeds) for (const tp of t.topics) (byTopic[tp] ??= []).push(t.id);
const taken = new Set();
for (const i of catalog.ideas) {
  if (i.source?.url) taken.add(paperKey(i.source.url));
  if (i.source?.title) taken.add(paperKey("", i.source.title));
}
const topics = atlas.taxonomy.flatMap((a) => a.subs.flatMap((s) => s.topics.map((t) => t.id)));
const candidates = atlas.items
  .filter((i) => i.y === "paper" && i.u && i.tp?.some((tp) => byTopic[tp]))
  .filter((i) => !taken.has(paperKey(i.u)) && !taken.has(paperKey("", i.t)))
  .map((i) => ({
    key: paperKey(i.u),
    title: i.t,
    url: i.u,
    date: i.d,
    authors: i.a,
    summary: i.s,
    topics: i.tp,
    testbeds: [...new Set(i.tp.flatMap((tp) => byTopic[tp] ?? []))],
    sr_pick: i.p === 1,
  }))
  // Shallow Review picks first, then newest.
  .sort((a, b) => b.sr_pick - a.sr_pick || String(b.date).localeCompare(String(a.date)));

await writeFile(
  new URL("lib/pipeline.json", root),
  JSON.stringify({ built: atlas.built, catalog_commit: catalog.commit, topics, candidates }, null, 1) + "\n",
);
console.log(`${candidates.length} candidate papers across ${Object.keys(byTopic).length} testbed topics.`);
