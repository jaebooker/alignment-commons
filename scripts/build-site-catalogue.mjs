// Build lib/site-catalogue.json: what the published catalogue already holds, for the API.
// The API function cannot read site/ at runtime, so the ids it must not collide with, the
// Commons topic ids and each signal's counts are copied here. Deterministic; rerun after
// site/tests.json or site/data.json changes, then commit. tests/publications.test.mjs fails if stale.
import { readFile, writeFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const json = async (p) => JSON.parse(await readFile(new URL(p, root), "utf8"));
export async function build() {
  const tests = await json("site/tests.json"), data = await json("site/data.json");
  return {
    catalogue_version: tests.catalogue_version, min_ideas: tests.min_ideas,
    ideas: tests.ideas.map((x) => x.id).sort(),
    testbeds: tests.testbeds.map((t) => t.id).sort(),
    topics: data.taxonomy.flatMap((a) => a.subs.flatMap((s) => s.topics.map((t) => t.id))).sort(),
    signals: tests.signals.map((s) => ({ topic: s.topic, testbed: s.testbed, tested: s.tested,
      mechanism_rate: { k: s.mechanism_rate.k }, win_rate: { k: s.win_rate.k } })),
  };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  await writeFile(new URL("lib/site-catalogue.json", root), JSON.stringify(await build(), null, 1) + "\n");
  console.log("lib/site-catalogue.json written");
}
