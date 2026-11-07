// Code node: validate an extracted idea.json before it enters the pipeline.
// Mirrors Synthcore's "Adding an idea" format. The claim quote is what makes the
// extraction checkable: a program can confirm it appears in the paper's abstract.
const IDEA_KEYS = ["title", "description", "source", "direction", "commons_topic", "testbed",
  "nearest_testbed", "untestable_reason", "prediction"];
const SOURCE_KEYS = ["type", "title", "authors", "year", "venue", "url", "claim_quote"];
const MECH_KEYS = ["diagnostic", "direction", "mode", "min_effect", "threshold"];
const text = (v, lo, hi) => typeof v === "string" && v.trim().length >= lo && v.length <= hi;
const num = Number.isFinite;

export const SLUG = /^[a-z0-9][a-z0-9-]{2,60}$/;
export function checkIdea(idea, { paperUrl, topics, testbeds }) {
  const p = [];
  if (!idea || typeof idea !== "object" || Array.isArray(idea)) return { passed: false, problems: ["idea must be an object."] };
  for (const k of Object.keys(idea)) if (!IDEA_KEYS.includes(k)) p.push(`Unknown idea field ${k}.`);
  if (!text(idea.title, 5, 200)) p.push("title: 5 to 200 characters.");
  if (!text(idea.description, 40, 4000)) p.push("description: 40 to 4000 characters, in your own words.");
  const s = idea.source;
  if (!s || typeof s !== "object") p.push("source is required.");
  else {
    for (const k of Object.keys(s)) if (!SOURCE_KEYS.includes(k)) p.push(`Unknown source field ${k}.`);
    if (s.url !== paperUrl) p.push("source.url must be the candidate paper's URL.");
    if (!text(s.title, 5, 300)) p.push("source.title is required.");
    if (!text(s.claim_quote, 20, 600))
      p.push("source.claim_quote: 20 to 600 characters copied verbatim from the abstract, stating the claim under test.");
  }
  if (!topics.includes(idea.commons_topic)) p.push("commons_topic must be an Alignment Commons topic id.");
  if (idea.direction !== undefined && !text(idea.direction, 3, 200)) p.push("direction: short path text.");
  const ids = testbeds.map((t) => t.id);
  if (idea.nearest_testbed != null && !ids.includes(idea.nearest_testbed)) p.push("nearest_testbed must be a catalogue testbed.");
  const untestable = idea.testbed == null;
  if (untestable) {
    if (!text(idea.untestable_reason, 40, 2000))
      p.push("untestable_reason: say what the method needs that no testbed exposes (40 to 2000 characters).");
    if (idea.prediction != null) p.push("An untestable idea has no prediction.");
  } else {
    if (!ids.includes(idea.testbed)) p.push("testbed must be a catalogue testbed id or null.");
    if (idea.untestable_reason != null) p.push("A testable idea has no untestable_reason.");
    const pr = idea.prediction;
    if (!pr || typeof pr !== "object") p.push("prediction is required for a testable idea, written before any run.");
    else {
      for (const k of Object.keys(pr)) if (!["safety_min_effect", "mechanism"].includes(k)) p.push(`Unknown prediction field ${k}.`);
      if (!num(pr.safety_min_effect)) p.push("prediction.safety_min_effect must be a number.");
      const m = pr.mechanism;
      if (m != null) {
        for (const k of Object.keys(m)) if (!MECH_KEYS.includes(k)) p.push(`Unknown mechanism field ${k}.`);
        if (!text(m.diagnostic, 1, 80)) p.push("mechanism.diagnostic names a testbed diagnostic.");
        if (!["higher", "lower"].includes(m.direction)) p.push("mechanism.direction is higher or lower.");
        const mode = m.mode ?? "relative";
        if (!["relative", "absolute"].includes(mode)) p.push("mechanism.mode is relative or absolute.");
        if (mode === "relative" && !num(m.min_effect)) p.push("A relative mechanism needs min_effect.");
        if (mode === "absolute" && !num(m.threshold)) p.push("An absolute mechanism needs threshold.");
      }
    }
  }
  return { passed: p.length === 0, problems: p, untestable };
}

// The extraction loop's check: the quoted claim must appear in the paper's abstract.
export const normalize = (t) => t.toLowerCase().replace(/[\s ]+/g, " ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim();
export async function arxivAbstract(url, fetchImpl = fetch) {
  const id = /arxiv\.org\/(?:abs|pdf)\/([0-9]{4}\.[0-9]{4,5})/i.exec(url)?.[1];
  if (!id) return null;
  try {
    const r = await fetchImpl(`https://export.arxiv.org/api/query?id_list=${id}`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const m = /<summary>([\s\S]*?)<\/summary>/.exec(await r.text());
    return m ? m[1] : null;
  } catch {
    return null;
  }
}
