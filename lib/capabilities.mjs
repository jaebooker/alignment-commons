// Learning edge helpers. The vocabulary lives in Synthcore (capabilities.json) and
// arrives through the pinned catalogue; Commons never defines capabilities itself.
export const EMPTY = { capabilities: {}, provides: {} };
export const vocabulary = (caps) => Object.keys(caps?.capabilities ?? {});
// The first testbed that provides every need, or null. "other" is never provided.
export function coveringTestbed(needs, caps) {
  if (!Array.isArray(needs) || !needs.length || needs.includes("other")) return null;
  for (const [tb, provides] of Object.entries(caps?.provides ?? {}).sort(([a], [b]) => a.localeCompare(b)))
    if (needs.every((n) => provides.includes(n))) return tb;
  return null;
}
// Blind confirmation: two extractors agree a paper is untestable when both say so and
// name at least one missing capability in common.
export function compareExtractions(first, second) {
  const a = first.testbed == null, b = second.testbed == null;
  if (!b) return { agree: false, detail: `second extractor found it testable on ${second.testbed}` };
  const shared = (first.needs ?? []).filter((n) => (second.needs ?? []).includes(n));
  return shared.length && a
    ? { agree: true, detail: `both untestable; shared needs: ${shared.join(", ")}` }
    : { agree: false, detail: `both untestable but no shared need (${(first.needs ?? []).join(", ")} vs ${(second.needs ?? []).join(", ")})` };
}
