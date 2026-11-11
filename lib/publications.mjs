// Code nodes for published results: bundle checks, record checks, check tally and signals.
// Every check here has one correct answer, so no model and no reviewer is involved.
//
// What these checks establish: each published row is a faithful summary of a record file that
// exists at a public commit, and (after a member's check) that a second runner got the same
// verdict from the same pinned code. They do not establish that the testbed is sound or that
// the idea works at scale.
import { createHash } from "node:crypto";

export const VERDICTS = ["beats_baseline", "safe_but_incomplete", "mech_ok_no_win", "no_effect", "hurts", "mechanism_failed"];
// How a second runner can check a publication. A rescore reruns the analysis from the
// publisher's cached model calls: it verifies the scoring, not the generation.
export const MODES = ["rerun", "rescore"];
export const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const SLUG = /^[a-z0-9][a-z0-9-]{2,60}$/;
const TESTBED = /^[a-z0-9][a-z0-9_]{2,40}$/;
const REPO = /^https:\/\/github\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]{1,100})$/;
const PATH = /^(?!\/)(?!.*\.\.)[A-Za-z0-9._\/-]{1,200}$/;
const HEX40 = /^[a-f0-9]{40}$/, HEX64 = /^[a-f0-9]{64}$/;
const text = (v, max) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const num = (v) => typeof v === "number" && Number.isFinite(v);
const interval = (v) => Array.isArray(v) && v.length === 2 && v.every(num) && v[0] <= v[1];
const prob = (v) => num(v) && v >= 0 && v <= 1;
const close = (a, b) => num(a) && num(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

export function parseRepo(url) {
  const m = REPO.exec(String(url || "").replace(/\.git$/, "").replace(/\/$/, ""));
  return m ? { owner: m[1], repo: m[2], url: `https://github.com/${m[1]}/${m[2]}` } : null;
}

// The only place a publication's source is read from: one file at one commit of one public repository.
export const rawUrl = (source, path) =>
  `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${source.commit}/${path}`;

function checkStats(s, what, errors, keys) {
  if (!s || typeof s !== "object") return errors.push(`${what} must be an object.`);
  for (const k of keys) if (!num(s[k])) errors.push(`${what}.${k} must be a finite number.`);
  if ("ci95" in s && !interval(s.ci95)) errors.push(`${what}.ci95 must be [low, high].`);
  if ("p_value" in s && !prob(s.p_value)) errors.push(`${what}.p_value must be between 0 and 1.`);
}

function checkIdeaRow(x, errors) {
  const at = `idea ${x?.id ?? "?"}`;
  if (!x || typeof x !== "object") return errors.push("Each idea must be an object.");
  if (!SLUG.test(x.id || "")) errors.push(`${at}: id must be a lowercase slug (3 to 61 characters).`);
  if (!text(x.title, 200)) errors.push(`${at}: title is required (at most 200 characters).`);
  if (!text(x.description, 4000)) errors.push(`${at}: description is required (at most 4000 characters).`);
  if (!x.source || !text(x.source.title, 400)) errors.push(`${at}: source.title is required; cite the paper or post the idea comes from.`);
  if (!VERDICTS.includes(x.verdict)) errors.push(`${at}: verdict must be one of ${VERDICTS.join(", ")}.`);
  if (!Array.isArray(x.flags) || !x.flags.every((f) => text(f, 60))) errors.push(`${at}: flags must be a list of strings.`);
  if (x.control) errors.push(`${at}: control runs are not published as ideas.`);
  const g = x.gate;
  if (!g || !text(g.quantity, 200) || !num(g.observed) || !text(g.rule, 100) || typeof g.passed !== "boolean")
    errors.push(`${at}: gate needs quantity, observed, rule and passed.`);
  if (x.safety != null) checkStats(x.safety, `${at}: safety`, errors, ["method_mean", "baseline_mean", "mean_diff"]);
  if (x.safety != null && (!interval(x.safety.ci95) || !prob(x.safety.p_value))) errors.push(`${at}: safety needs ci95 and p_value.`);
  if (x.completion != null) checkStats(x.completion, `${at}: completion`, errors, ["method_mean", "baseline_mean", "mean_diff"]);
  // The verdict must be one the numbers allow. The harness decides verdicts; this only blocks contradictions.
  if (g && typeof g.passed === "boolean") {
    if (x.verdict === "mechanism_failed" && (g.passed || x.safety != null))
      errors.push(`${at}: mechanism_failed means the gate failed and no benchmark ran.`);
    if (x.verdict !== "mechanism_failed" && VERDICTS.includes(x.verdict)) {
      if (!g.passed) errors.push(`${at}: a benchmark verdict needs a passed gate.`);
      if (x.safety == null) errors.push(`${at}: a benchmark verdict needs safety statistics.`);
    }
  }
  if (x.safety != null && interval(x.safety.ci95)) {
    const [lo, hi] = x.safety.ci95;
    if (["beats_baseline", "safe_but_incomplete"].includes(x.verdict) && !(lo > 0))
      errors.push(`${at}: ${x.verdict} needs a safety interval above zero.`);
    if (x.verdict === "hurts" && !(hi < 0)) errors.push(`${at}: hurts needs a safety interval below zero.`);
    if (x.verdict === "no_effect" && !(lo <= 0 && hi >= 0)) errors.push(`${at}: no_effect needs a safety interval that includes zero.`);
  }
}

// Validate a submitted bundle against the published catalogue. Returns { errors, bundle } with a
// normalised bundle: only known fields are kept, so nothing unvetted reaches the public site.
export function checkBundle(input, base, limits) {
  const errors = [];
  const b = input && typeof input === "object" ? input : {};
  if (!SLUG.test(b.slug || "")) errors.push("slug must be a lowercase slug (3 to 61 characters).");
  if (!text(b.title, 200)) errors.push("title is required (at most 200 characters).");
  if (!text(b.summary, 2000)) errors.push("summary is required (at most 2000 characters).");
  if (!text(b.writeup, 60000)) errors.push("writeup is required (Markdown, at most 60000 characters). State the limits of the result.");
  if (!MODES.includes(b.replication)) errors.push(`replication must be one of ${MODES.join(", ")}: how a second runner can check this.`);
  const repo = parseRepo(b.source?.repo);
  if (!repo) errors.push("source.repo must be a public https://github.com/<owner>/<repo> URL.");
  if (!HEX40.test(b.source?.commit || "")) errors.push("source.commit must be a full 40-character commit hash.");
  if (b.source?.instructions != null && !text(b.source.instructions, 2000)) errors.push("source.instructions must be text (at most 2000 characters).");

  let testbed = null;
  if (b.testbed != null) {
    const t = b.testbed;
    if (!TESTBED.test(t.id || "")) errors.push("testbed.id must be lowercase letters, digits and underscores.");
    else if (base.testbeds.includes(t.id)) errors.push(`testbed ${t.id} is already in the catalogue; omit testbed to publish ideas on it.`);
    for (const k of ["name", "question", "planted", "metric", "baseline"])
      if (!text(t[k], k === "planted" ? 2000 : 400)) errors.push(`testbed.${k} is required.`);
    if (!text(t.version, 20)) errors.push("testbed.version is required.");
    if (!Array.isArray(t.topics) || !t.topics.length || !t.topics.every((x) => base.topics.includes(x)))
      errors.push("testbed.topics must list Commons topic ids.");
    testbed = { id: t.id, name: t.name, topics: t.topics, question: t.question, planted: t.planted, metric: t.metric, baseline: t.baseline, version: t.version };
  }

  const ideas = Array.isArray(b.ideas) ? b.ideas : [];
  if (!ideas.length || ideas.length > limits.maxIdeas) errors.push(`Publish between 1 and ${limits.maxIdeas} ideas per bundle.`);
  const ids = new Set();
  for (const x of ideas) {
    checkIdeaRow(x, errors);
    if (!x || typeof x !== "object") continue;
    if (ids.has(x.id)) errors.push(`idea ${x.id} appears twice.`);
    ids.add(x.id);
    if (base.ideas.includes(x.id)) errors.push(`idea ${x.id} is already in the catalogue; choose a new id.`);
    if (!base.topics.includes(x.topic)) errors.push(`idea ${x.id}: topic must be a Commons topic id.`);
    // Whether the testbed exists (catalogue, this bundle, or an earlier publication) is checked in the transaction.
    if (!TESTBED.test(x.testbed || "")) errors.push(`idea ${x.id}: testbed must be a testbed id.`);
    if (!text(x.testbed_version, 20)) errors.push(`idea ${x.id}: testbed_version is required.`);
  }
  if (testbed && !ideas.some((x) => x?.testbed === testbed.id)) errors.push("A new testbed needs at least one idea tested on it.");

  const recs = Array.isArray(b.records) ? b.records : [];
  for (const id of ids) if (recs.filter((r) => r?.idea_id === id).length !== 1) errors.push(`idea ${id} needs exactly one records entry.`);
  for (const r of recs) {
    if (!ids.has(r?.idea_id)) errors.push("records entry does not match an idea in this bundle.");
    for (const k of ["record_path", "method_path"]) if (!PATH.test(r?.[k] || "")) errors.push(`records ${r?.idea_id}: ${k} must be a relative path in the repository.`);
    for (const k of ["record_sha256", "method_sha256"]) if (!HEX64.test(r?.[k] || "")) errors.push(`records ${r?.idea_id}: ${k} must be a SHA-256 hex digest.`);
  }
  if (errors.length) return { errors };

  const source = { ...repo, commit: b.source.commit, instructions: b.source.instructions?.trim() || null };
  const row = (x) => ({
    id: x.id, title: x.title.trim(), description: x.description.trim(),
    source: { type: x.source.type ?? null, title: x.source.title, authors: x.source.authors ?? null, year: x.source.year ?? null, venue: x.source.venue ?? null, url: /^https:\/\//.test(x.source.url || "") ? x.source.url : null },
    topic: x.topic, testbed: x.testbed, testbed_version: x.testbed_version, control: false,
    verdict: x.verdict, verdict_v1: null, completion: x.completion ?? null, flags: x.flags,
    prediction: x.prediction ?? null, gate: { quantity: x.gate.quantity, observed: x.gate.observed, rule: x.gate.rule, passed: x.gate.passed },
    safety: x.safety ?? null, capability: x.capability ?? null, mechanism: x.mechanism ?? null,
    mechanism_confirmed: x.mechanism_confirmed ?? null, updated: typeof x.updated === "string" ? x.updated.slice(0, 10) : null,
    untestable_reason: null, nearest_testbed: null, needs: [],
    record: `${repo.url}/tree/${b.source.commit}/${recs.find((r) => r.idea_id === x.id).record_path.replace(/\/[^/]+$/, "")}`,
    triage: null,
  });
  return {
    errors,
    bundle: {
      slug: b.slug, title: b.title.trim(), summary: b.summary.trim(), writeup: b.writeup, replication: b.replication,
      source, testbed, ideas: ideas.map(row),
      records: recs.map((r) => ({ idea_id: r.idea_id, record_path: r.record_path, record_sha256: r.record_sha256, method_path: r.method_path, method_sha256: r.method_sha256 })),
    },
  };
}

// Compare one published row with the record file fetched from the pinned commit.
export function checkRecord(row, record) {
  const out = [];
  const check = (name, pass, detail) => out.push({ name, pass: !!pass, detail });
  check("record_id", record?.id === row.id, `${record?.id} vs ${row.id}`);
  check("testbed", record?.testbed === row.testbed && String(record?.testbed_version) === String(row.testbed_version),
    `${record?.testbed} ${record?.testbed_version} vs ${row.testbed} ${row.testbed_version}`);
  check("verdict", record?.verdict === row.verdict, `${record?.verdict} vs ${row.verdict}`);
  const g = record?.stage1;
  check("gate", !!g && g.passed === row.gate.passed && close(g.observed, row.gate.observed), `gate ${g?.passed} ${g?.observed} vs ${row.gate.passed} ${row.gate.observed}`);
  const s = record?.stage2?.safety;
  if (row.safety || s)
    check("safety", !!row.safety && !!s && ["method_mean", "baseline_mean", "mean_diff", "p_value"].every((k) => close(s[k], row.safety[k]))
      && interval(s.ci95) && close(s.ci95[0], row.safety.ci95[0]) && close(s.ci95[1], row.safety.ci95[1]),
      "published safety statistics must equal the record's");
  if (s) check("eight_seeds", Array.isArray(record.stage2.per_seed) && record.stage2.per_seed.length === 8, "Stage 2 must report eight seeds.");
  check("evaluator", text(record?.evaluator_hash, 100), "record must carry an evaluator hash");
  return out;
}

// Keep only what the comparison and the public page need from a record.
export const trimRecord = (r) => ({
  id: r.id, testbed: r.testbed, testbed_version: r.testbed_version, harness_version: r.harness_version ?? null,
  evaluator_hash: r.evaluator_hash, verdict: r.verdict,
  stage1: r.stage1 ? { quantity: r.stage1.quantity, observed: r.stage1.observed, rule: r.stage1.rule, passed: r.stage1.passed } : null,
  stage2: r.stage2 ? {
    safety: r.stage2.safety ? { ...Object.fromEntries(["method_mean", "baseline_mean", "mean_diff", "p_value", "ci95"].map((k) => [k, r.stage2.safety[k]])) } : null,
    completion: r.stage2.completion ? { measured: !!r.stage2.completion.measured, ci95: r.stage2.completion.ci95 ?? null } : null,
    per_seed: (r.stage2.per_seed || []).map((p) => ({ seed: p.seed })),
  } : null,
});

// Member checks decide the status. One agreeing member replicates; a disagreement disputes;
// a majority of at least two disagreeing members rejects.
export function tally(checks) {
  const yes = checks.filter((c) => c.agree).length, no = checks.length - yes;
  if (no >= 2 && no > yes) return "rejected";
  if (no > 0 && no >= yes) return "disputed";
  return yes > 0 ? "replicated" : "unreplicated";
}

// Beta(1+k, 1+n-k) posterior, as in SynthCore's summarize.rate. Integer parameters, so the
// regularised incomplete beta function is a finite binomial sum.
const cdf = (x, a, b) => {
  const n = a + b - 1;
  let total = 0, c = 1;
  for (let j = 0; j <= n; j++) {
    if (j >= a) total += c * x ** j * (1 - x) ** (n - j);
    c = (c * (n - j)) / (j + 1);
  }
  return total;
};
const ppf = (p, a, b) => {
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (cdf(mid, a, b) < p) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
};
export const rate = (k, n) => ({ k, n, mean: (1 + k) / (2 + n), ci80: [ppf(0.1, 1 + k, 1 + n - k), ppf(0.9, 1 + k, 1 + n - k)] });
const quadrant = (mech, win) =>
  mech.mean >= 0.5 ? (win.mean >= 0.5 ? "pursue" : "real, not yet useful") : win.mean >= 0.5 ? "wins, cause unclear" : "deprioritize";

// Direction signals for every topic and testbed touched by a replicated published idea:
// the catalogue's counts plus the replicated ideas. Unreplicated and disputed ideas never count.
export function signals(base, replicated, minIdeas) {
  const groups = new Map();
  for (const x of replicated) {
    const key = `${x.topic}|${x.testbed}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(x);
  }
  return [...groups].map(([key, xs]) => {
    const [topic, testbed] = key.split("|");
    const old = base.signals.find((s) => s.topic === topic && s.testbed === testbed);
    const n = (old?.tested ?? 0) + xs.length;
    const mech = rate((old?.mechanism_rate.k ?? 0) + xs.filter((x) => x.gate.passed).length, n);
    const win = rate((old?.win_rate.k ?? 0) + xs.filter((x) => x.verdict === "beats_baseline").length, n);
    return { topic, testbed, tested: n, mechanism_rate: mech, win_rate: win, reading: quadrant(mech, win), tentative: n < minIdeas, community: xs.length };
  });
}
