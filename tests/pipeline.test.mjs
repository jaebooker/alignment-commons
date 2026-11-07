import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createService, MAX_RETURNS } from "../lib/service.mjs";
import { checkAdapter } from "../lib/adapter-check.mjs";
import { checkIdea } from "../lib/idea-check.mjs";
import { compareGateReports } from "../lib/adapter-verify.mjs";
import pipeline from "../lib/pipeline.json" with { type: "json" };
import catalog from "../lib/catalog.json" with { type: "json" };

const secret = () => randomBytes(32).toString("base64url");
const admin = secret(), sa = secret(), sb = secret(), sc = secret();
const reject = (p, status, re) =>
  assert.rejects(p, (e) => e.status === status && (!re || re.test(e.message)));
const sha = (s) => createHash("sha256").update(s).digest("hex");
const [c1, c2, c3, c4] = pipeline.candidates;
const QUOTE = "we show that the proposed method recovers planted structure better than baselines";
const ABSTRACT = `Some context.  We show that the proposed method
  recovers planted structure better than baselines, in several settings.`;
const idea = (c, extra = {}) => ({
  title: "A test idea from the candidate paper",
  description: "Restates the paper's method in our own words, long enough to pass the length check.",
  source: { type: "paper", title: c.title, url: c.url, claim_quote: QUOTE },
  commons_topic: c.topics.find((t) => pipeline.topics.includes(t)),
  testbed: c.testbeds[0],
  prediction: { safety_min_effect: 0.0 },
  ...extra,
});
const METHOD = `import numpy as np

HPARAMS = [{"k": 1}, {"k": 2}]


def run(tasks, hparams, seed):
    return [{"score": float(np.random.rand())} for _ in tasks]
`;
const report = (slug, src, testbed, over = {}) => ({
  checker_version: 1, slug, method_sha256: sha(src), passed: true,
  static: { passed: true, problems: [] }, synthcore_commit: "c".repeat(40),
  gate: { ran: true, passed: false, observed: -0.01, quantity: "safety vs baseline", rule: ">= +0.0000",
    testbed, evaluator_hash: "e".repeat(16), seeds: 3 },
  ...over,
});
const back = (reason) => ({
  note: reason,
  evidence: "Line 7 returns random scores; the gate observed -0.01 on all three seeds.",
  scope: "Rewrite run() to implement the paper's scoring rule; keep HPARAMS and imports.",
});

let pg, service, db, serviceOptions;
before(async () => {
  pg = new PGlite();
  for (const f of ["001_commons", "002_reviewers", "003_returns", "004_agreement", "005_pipeline", "006_adapter_verification", "007_learning_edge"])
    await pg.exec(await readFile(`migrations/${f}.sql`, "utf8"));
  const strip = (q) => (s, p) =>
    s.startsWith("SELECT pg_advisory_xact_lock") ? { rows: [] } : q.query(s, p);
  db = { query: strip(pg), transaction: (fn) => pg.transaction((tx) => fn({ query: strip(tx) })) };
  serviceOptions = { adminToken: admin, adapterVerification: true, fetchAbstract: async (url) => (url.includes("arxiv") ? ABSTRACT : null) };
  service = createService(db, serviceOptions);
  for (const [s, name] of [[sa, "Extractor"], [sb, "Adapter"], [sc, "Verifier"]]) {
    const a = await service("apply", { name, runtime: "test", operator: "op", purpose: "pipeline", secret: s }, "", name);
    await service("review_agent", { id: a.id, status: "approved" }, admin);
  }
});
after(async () => pg.close());

test("the splitter lists testable candidates that are not already catalogued", async () => {
  const ids = new Set(catalog.ideas.map((i) => i.source?.url).filter(Boolean));
  assert.ok(pipeline.candidates.length > 0);
  assert.ok(pipeline.candidates.every((c) => c.testbeds.length && !ids.has(c.url)));
  const view = await service("candidates", { limit: 5 });
  assert.equal(view.candidates.length, 5);
  assert.equal(view.remaining, pipeline.candidates.length);
  const tb = c1.testbeds[0];
  assert.ok((await service("candidates", { testbed: tb })).candidates.every((c) => c.testbeds.includes(tb)));
});

let p1;
test("extraction is checked by code: candidate only, valid spec, verbatim claim quote", async () => {
  await reject(service("propose_idea", { paper_url: "https://example.com/x", slug: "x-idea", idea: idea(c1) }, sa), 400, /candidates list/);
  await reject(service("propose_idea", { paper_url: c1.url, slug: "Bad Slug", idea: idea(c1) }, sa), 400, /slug/);
  await reject(service("propose_idea", { paper_url: c1.url, slug: catalog.ideas[0].id, idea: idea(c1) }, sa), 400, /slug/);
  await reject(service("propose_idea", { paper_url: c1.url, slug: "p-one", idea: idea(c1, { prediction: null }) }, sa), 400, /prediction/);
  if (c1.url.includes("arxiv")) {
    const wrong = idea(c1); wrong.source = { ...wrong.source, claim_quote: "a sentence that the abstract never contains at all" };
    await reject(service("propose_idea", { paper_url: c1.url, slug: "p-one", idea: wrong }, sa), 400, /verbatim/);
  }
  p1 = await service("propose_idea", { paper_url: c1.url, slug: "p-one", idea: idea(c1) }, sa);
  assert.equal(p1.status, "specified");
  assert.equal(p1.quote_verified, c1.url.includes("arxiv") ? true : null);
  await reject(service("propose_idea", { paper_url: c1.url, slug: "p-one-b", idea: idea(c1) }, sb), 409);
  assert.ok(!(await service("candidates", { limit: 100 })).candidates.some((c) => c.url === c1.url));
});

test("an untestable verdict is terminal and keeps the paper out of the queue", async () => {
  const r = await service("propose_idea", {
    paper_url: c2.url, slug: "p-two",
    idea: idea(c2, { testbed: null, prediction: null, nearest_testbed: c2.testbeds[0],
      untestable_reason: "Needs a feedback channel queried about counterfactual actions, which no testbed exposes." }),
  }, sa);
  assert.equal(r.status, "untestable");
  await reject(service("claim_proposal", { id: r.id }, sb), 409);
  assert.ok(!(await service("candidates", { limit: 100 })).candidates.some((c) => c.url === c2.url));
});

test("adapters pass static checks and an exact self-report, and returns carry evidence and scope", async () => {
  const tb = idea(c1).testbed;
  const c = await service("claim_proposal", { id: p1.id }, sb);
  assert.deepEqual(c.returns, []);
  await reject(service("claim_proposal", { id: p1.id }, sa), 409);
  const lease = { id: p1.id, lease_token: c.lease_token };
  const evil = METHOD.replace("return [", "open('/etc/passwd')\n    return [");
  await reject(service("submit_adapter", { ...lease, method_py: evil, self_report: report("p-one", evil, tb) }, sb), 400, /static/);
  await reject(service("submit_adapter", { ...lease, method_py: METHOD, self_report: report("p-one", METHOD + " ", tb) }, sb), 400, /self_report/);
  await reject(service("submit_adapter", { ...lease, method_py: METHOD,
    self_report: report("p-one", METHOD, tb, { gate: { ran: false, error: "MethodError" }, passed: false }) }, sb), 400, /self_report/);
  const done = await service("submit_adapter", { ...lease, method_py: METHOD, self_report: report("p-one", METHOD, tb) }, sb);
  assert.equal(done.status, "adapted");
  // Reviewer gate: agents cannot admit; returns need evidence and scope.
  await reject(service("review_proposal", { id: p1.id, decision: "admit", note: "self", commit: "a".repeat(40) }, sb), 403);
  await reject(service("review_proposal", { id: p1.id, decision: "return", note: "Random scores." }, admin), 400);
  await reject(service("review_proposal", { id: p1.id, decision: "admit", note: "ok" }, admin), 400, /commit/);
  let r = await service("review_proposal", { id: p1.id, decision: "return", ...back("Random scores, not the paper's method.") }, admin);
  assert.deepEqual(r, { status: "specified", returns: 1, remaining: MAX_RETURNS - 1 });
  const again = await service("claim_proposal", { id: p1.id }, sb);
  assert.equal(again.returns[0].scope, back("x").scope);
  assert.equal(again.returns[0].method_sha256, sha(METHOD));
  const r2 = await service("fail_proposal", { id: p1.id, lease_token: again.lease_token,
    reason: "Toy config too small for the method", evidence: "Gate crashed: needs 64 features, toy has 32.", scope: "Spec may need a different testbed." }, sb);
  assert.equal(r2.returns, 2);
  const third = await service("claim_proposal", { id: p1.id }, sb);
  await service("submit_adapter", { id: p1.id, lease_token: third.lease_token, method_py: METHOD, self_report: report("p-one", METHOD, tb) }, sb);
  r = await service("review_proposal", { id: p1.id, decision: "return", ...back("Still random.") }, admin);
  assert.equal(r.status, "escalated");
  await reject(service("claim_proposal", { id: p1.id }, sb), 409);
  const full = await service("proposal", { id: p1.id });
  assert.equal(full.returns.length, MAX_RETURNS);
  assert.ok(!("lease_token" in full));
});

test("admission records the Synthcore commit; withdrawal reopens a paper", async () => {
  const tb = idea(c3).testbed;
  const p = await service("propose_idea", { paper_url: c3.url, slug: "p-three", idea: idea(c3) }, sa);
  const c = await service("claim_proposal", { id: p.id }, sa); // the extractor may also adapt
  await service("submit_adapter", { id: p.id, lease_token: c.lease_token, method_py: METHOD, self_report: report("p-three", METHOD, tb) }, sa);
  const admit = { id: p.id, decision: "admit", commit: "a".repeat(40), note: "Read; rerun matched." };
  await reject(service("review_proposal", admit, admin), 409, /deployed catalogue/);
  const pinned = { ...catalog, commit: admit.commit, ideas: [...catalog.ideas,
    { ...idea(c3), id: "p-three", method_sha256: sha(METHOD) }] };
  const ok = await createService(db, { ...serviceOptions, catalog: pinned })("review_proposal", admit, admin);
  assert.equal(ok.status, "admitted");
  const ev = (await service("overview")).events;
  assert.ok(ev.some((e) => e.kind === "adapter_admitted" && e.subject === "p-three"));
  const untestable = (await service("proposals", { status: "untestable" }))[0];
  await service("review_proposal", { id: untestable.id, decision: "withdraw", note: "A new testbed now fits." }, admin);
  assert.ok((await service("candidates", { limit: 100 })).candidates.some((x) => x.url === c2.url));
});

test("idea and adapter checks reject the common failure shapes", () => {
  const opts = { paperUrl: c1.url, topics: pipeline.topics, testbeds: catalog.testbeds };
  assert.equal(checkIdea(idea(c1), opts).passed, true);
  const bad = (x) => checkIdea(x, opts).problems.join(" ");
  assert.match(bad(idea(c1, { commons_topic: "nope" })), /commons_topic/);
  assert.match(bad(idea(c1, { testbed: "imaginary" })), /testbed/);
  assert.match(bad(idea(c1, { extra: 1 })), /Unknown idea field/);
  assert.match(bad(idea(c1, { prediction: { safety_min_effect: 0, mechanism: { diagnostic: "x", direction: "up" } } })), /direction/);
  assert.match(bad(idea(c1, { testbed: null, prediction: null })), /untestable_reason/);
  assert.equal(checkAdapter(METHOD).passed, true);
  for (const [why, src] of [
    ["import", METHOD.replace("import numpy as np", "import numpy as np\nimport subprocess")],
    ["builtin", METHOD.replace("return [", "x = eval('1')\n    return [")],
    ["dunder", METHOD.replace("return [", "x = ().__class__\n    return [")],
    ["file", METHOD.replace("return [", "x = np.load('results/_cache/truth.npy')\n    return [")],
    ["signature", METHOD.replace("def run(tasks, hparams, seed)", "def run(tasks, hparams)")],
  ]) assert.equal(checkAdapter(src).passed, false, why);
  // Strings and method calls are not violations.
  assert.equal(checkAdapter(METHOD.replace("return [", "msg = 'open(file) and eval(x)'\n    model = None\n    return [")).passed, true);
});

const jailed = (r, over = {}) => ({ ...r, gate: { ...r.gate, jail: { mode: "docker", image: "synthcore-method:abc" }, ...over } });
test("a second agent verifies an unreviewed adapter inside the jail before the reviewer reads it", async () => {
  const tb = idea(c4).testbed;
  const p = await service("propose_idea", { paper_url: c4.url, slug: "p-four", idea: idea(c4) }, sa);
  const c = await service("claim_proposal", { id: p.id }, sb);
  const mine = report("p-four", METHOD, tb);
  await service("submit_adapter", { id: p.id, lease_token: c.lease_token, method_py: METHOD, self_report: mine }, sb);
  await reject(service("verify_adapter", { id: p.id, report: jailed(mine) }, sb), 409, /other than/);
  await reject(service("verify_adapter", { id: p.id, report: { ...mine, gate: { ...mine.gate, jail: { mode: "process" } } } }, sa), 400, /jail/);
  await reject(service("verify_adapter", { id: p.id, report: jailed(report("p-four", METHOD + "#", tb)) }, sa), 400);
  await reject(service("verify_adapter", { id: p.id, report: { ...mine, gate: null } }, sa), 400);
  const disabled = createService(db, { ...serviceOptions, adapterVerification: false });
  await reject(disabled("verify_adapter", { id: p.id, report: jailed(mine) }, sa), 409, /unavailable/);
  const ok = await service("verify_adapter", { id: p.id, report: jailed(mine) }, sa);
  assert.equal(ok.agree, true);
  await reject(service("verify_adapter", { id: p.id, report: jailed(mine) }, sa), 409, /already/);
  const bad = await service("verify_adapter", { id: p.id, report: jailed(mine, { observed: 0.4, passed: true }) }, sc);
  assert.equal(bad.agree, false);
  assert.match(bad.detail, /gate_outcome/);
  let row = (await service("proposals", { status: "adapted" })).find((x) => x.id === p.id);
  assert.equal(row.verified, 1);
  assert.equal(row.disputed, 1);
  const full = await service("proposal", { id: p.id });
  assert.deepEqual(full.verifications.map((v) => [v.agent, v.agree]), [["Extractor", true], ["Verifier", false]]);
  // A returned and resubmitted method needs fresh verification.
  await service("review_proposal", { id: p.id, decision: "return", ...back("Verifiers disagree on the gate.") }, admin);
  const c2 = await service("claim_proposal", { id: p.id }, sb);
  const v2 = METHOD.replace('{"k": 2}', '{"k": 3}');
  await service("submit_adapter", { id: p.id, lease_token: c2.lease_token, method_py: v2, self_report: report("p-four", v2, tb) }, sb);
  row = (await service("proposals", { status: "adapted" })).find((x) => x.id === p.id);
  assert.equal(row.verified, 0);
  assert.equal(row.disputed, 0);
  assert.ok((await service("overview")).events.some((e) => e.kind === "adapter_verify_disputed" && e.subject === "p-four"));
});

test("compareGateReports gates on method, jail, crash, evaluator and gate result", () => {
  const a = report("s", METHOD, "planted_interp");
  const failing = (v) => compareGateReports(a, v).checks.filter((c) => !c.pass).map((c) => c.name);
  assert.deepEqual(failing(jailed(a)), []);
  assert.deepEqual(failing({ ...jailed(a), synthcore_commit: "d".repeat(40) }), ["same_source"]);
  assert.deepEqual(failing(jailed(a, { observed: a.gate.observed + 1e-7 })), []);
  assert.deepEqual(failing(a), ["verifier_jailed"]);
  assert.deepEqual(failing(jailed(a, { ran: false, error: "MethodError: boom" })), ["gate_ran"]);
  assert.deepEqual(failing(jailed(a, { evaluator_hash: "other" })), ["same_testbed"]);
  assert.deepEqual(failing(jailed(a, { observed: 0.2 })), ["gate_observed"]);
  assert.deepEqual(failing({ ...jailed(a), method_sha256: "x" }), ["same_method"]);
});
