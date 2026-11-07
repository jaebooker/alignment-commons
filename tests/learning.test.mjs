import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createService } from "../lib/service.mjs";
import { coveringTestbed, compareExtractions } from "../lib/capabilities.mjs";
import pipeline from "../lib/pipeline.json" with { type: "json" };

// Synthcore's capabilities.json, as the next catalogue pin will carry it.
const caps = JSON.parse(await readFile("tests/fixtures/capabilities.json", "utf8"));
const secret = () => randomBytes(32).toString("base64url");
const admin = secret(), sa = secret(), sb = secret(), sc = secret();
const reject = (p, status, re) => assert.rejects(p, (e) => e.status === status && (!re || re.test(e.message)));
const [k1, k2, k3, k4] = pipeline.candidates.slice(20);
const QUOTE = "we show that the proposed method recovers planted structure better than baselines";
const ABSTRACT = "Intro. We show that the proposed method recovers planted structure better than baselines.";
const base = (c) => ({
  title: "An idea extracted from the candidate paper",
  description: "Restates the paper's method in our own words, long enough to pass the length check.",
  source: { type: "paper", title: c.title, url: c.url, claim_quote: QUOTE },
  commons_topic: c.topics.find((t) => pipeline.topics.includes(t)),
});
const untestable = (c, needs, extra = {}) => ({
  ...base(c), testbed: null, nearest_testbed: c.testbeds[0], needs, prediction: null,
  untestable_reason: "Needs the poisoned training set; the testbed only exposes weights and a few clean inputs.",
  ...extra,
});
const testable = (c) => ({ ...base(c), testbed: c.testbeds[0], prediction: { safety_min_effect: 0 } });

let pg, service, mk;
before(async () => {
  pg = new PGlite();
  for (const f of ["001_commons", "002_reviewers", "003_returns", "004_agreement", "005_pipeline",
    "006_adapter_verification", "007_learning_edge"])
    await pg.exec(await readFile(`migrations/${f}.sql`, "utf8"));
  const strip = (q) => (s, p) => (s.startsWith("SELECT pg_advisory_xact_lock") ? { rows: [] } : q.query(s, p));
  const db = { query: strip(pg), transaction: (fn) => pg.transaction((tx) => fn({ query: strip(tx) })) };
  mk = (capabilities) => createService(db, { adminToken: admin, capabilities, fetchAbstract: async () => ABSTRACT });
  service = mk(caps);
  for (const [s, name] of [[sa, "First"], [sb, "Second"], [sc, "Third"]]) {
    const a = await service("apply", { name, runtime: "test", operator: "op", purpose: "edge", secret: s }, "", name);
    await service("review_agent", { id: a.id, status: "approved" }, admin);
  }
});
after(async () => pg.close());

test("untestable verdicts must name missing capabilities that no testbed provides", async () => {
  const go = (needs, slug = "k-one") => service("propose_idea", { paper_url: k1.url, slug, idea: untestable(k1, needs) }, sa);
  await reject(go(undefined), 400, /needs/);
  await reject(go(["telepathy"]), 400, /needs/);
  // Stale on arrival: interactive_gridworld already offers both.
  await reject(go(["online_interaction", "approval_queries"]), 400, /interactive_gridworld provides/);
  await reject(service("propose_idea", { paper_url: k1.url, slug: "k-one", idea: { ...testable(k1), needs: ["gpu"] } }, sa), 400, /no needs/);
});

let p1;
test("a pending verdict is hidden, stays a candidate, and counts only as pending", async () => {
  p1 = await service("propose_idea", { paper_url: k1.url, slug: "k-one", idea: untestable(k1, ["poisoned_training_data"]) }, sa);
  assert.equal(p1.status, "untestable");
  const listed = (await service("proposals")).find((x) => x.id === p1.id);
  assert.equal(listed.pending_confirmation, true);
  assert.ok(!("idea" in listed) && !("paper_url" in listed));
  assert.ok(!("idea" in (await service("proposal", { id: p1.id }))));
  const ledger = JSON.stringify((await service("activity")).events);
  assert.ok(!ledger.includes("k-one") && !ledger.includes(k1.title), "the ledger must not leak a pending verdict");
  assert.ok((await service("candidates", { limit: 100 })).candidates.some((c) => c.url === k1.url));
  const road = (await service("roadmap")).needs.find((n) => n.id === "poisoned_training_data");
  assert.deepEqual([road.confirmed, road.pending, road.papers.length], [0, 1, 0]);
});

test("a blind second extraction confirms the verdict and the need joins the roadmap and brief", async () => {
  await reject(service("propose_idea", { paper_url: k1.url, slug: "k-one-b", idea: untestable(k1, ["poisoned_training_data"]) }, sa), 409, /different agent/);
  const r = await service("propose_idea", { paper_url: k1.url, slug: "k-one-b",
    idea: untestable(k1, ["poisoned_training_data", "gpu"]) }, sb);
  assert.equal(r.confirmation, "confirmed");
  assert.equal(r.id, p1.id);
  const road = (await service("roadmap")).needs.find((n) => n.id === "poisoned_training_data");
  assert.deepEqual([road.confirmed, road.pending], [1, 0]);
  assert.equal(road.papers[0].url, k1.url);
  assert.equal(road.nearest[k1.testbeds[0]], 1);
  const view = await service("candidates", { limit: 100 });
  assert.ok(!view.candidates.some((c) => c.url === k1.url));
  assert.deepEqual(view.brief.confirmed_unmet.map((n) => n.id), ["poisoned_training_data"]);
  assert.ok(view.brief.provides.interactive_gridworld.includes("approval_queries"));
  const full = await service("proposal", { id: p1.id });
  assert.equal(full.confirmed, true);
  assert.equal(full.extractions[0].agent, "Second");
  await reject(service("propose_idea", { paper_url: k1.url, slug: "k-one-c", idea: untestable(k1, ["poisoned_training_data"]) }, sc), 409);
});

test("disagreement goes to a reviewer, who can adopt the testable extraction or confirm", async () => {
  const p = await service("propose_idea", { paper_url: k2.url, slug: "k-two", idea: untestable(k2, ["poisoned_training_data"]) }, sa);
  const r = await service("propose_idea", { paper_url: k2.url, slug: "k-two-testable", idea: testable(k2) }, sb);
  assert.equal(r.confirmation, "disputed");
  let road = (await service("roadmap")).needs.find((n) => n.id === "poisoned_training_data");
  assert.equal(road.disputed, 1);
  await reject(service("review_proposal", { id: p.id, decision: "adopt_second", note: "x" }, sb), 403);
  const adopted = await service("review_proposal", { id: p.id, decision: "adopt_second", note: "The first extractor missed the backdoor testbed." }, admin);
  assert.deepEqual([adopted.status, adopted.slug], ["specified", "k-two-testable"]);
  const c = await service("claim_proposal", { id: p.id }, sc);
  assert.equal(c.slug, "k-two-testable");
  // Both untestable, different needs: a reviewer confirms.
  const q = await service("propose_idea", { paper_url: k3.url, slug: "k-three", idea: untestable(k3, ["poisoned_training_data"]) }, sa);
  const d = await service("propose_idea", { paper_url: k3.url, slug: "k-three-b", idea: untestable(k3, ["language_model_agents"]) }, sb);
  assert.equal(d.confirmation, "disputed");
  await reject(service("review_proposal", { id: q.id, decision: "adopt_second", note: "x" }, admin), 409, /also untestable/);
  const ok = await service("review_proposal", { id: q.id, decision: "confirm", note: "Both needs are real." }, admin);
  assert.equal(ok.confirmed, true);
  road = await service("roadmap");
  assert.equal(road.needs.find((n) => n.id === "language_model_agents"), undefined, "the first extraction's needs count");
  assert.equal(road.needs.find((n) => n.id === "poisoned_training_data").confirmed, 2);
});

test("a re-pinned catalogue with a new testbed reopens covered verdicts", async () => {
  const later = JSON.parse(JSON.stringify(caps));
  later.provides.poisoning = ["model_weights", "clean_samples", "poisoned_training_data"];
  const repinned = mk(later);
  const cand = await repinned("candidates", { limit: 100 });
  assert.ok(cand.candidates.some((c) => c.url === k1.url), "confirmed but covered: back in the queue");
  assert.equal((await repinned("roadmap")).needs.find((n) => n.id === "poisoned_training_data"), undefined);
  assert.equal((await repinned("proposals", { status: "untestable" })).find((x) => x.id === p1.id).stale_covered_by, "poisoning");
  const fresh = await repinned("propose_idea", { paper_url: k1.url, slug: "k-one-poisoning",
    idea: { ...testable(k1), testbed: k1.testbeds[0] } }, sc);
  assert.equal(fresh.status, "specified");
  const old = await repinned("proposal", { id: p1.id });
  assert.deepEqual([old.status, old.reviewed_by], ["withdrawn", "capability reopen"]);
  assert.ok((await repinned("overview")).events.some((e) => e.kind === "untestable_reopened"));
});

test("without a vocabulary in the pin, needs stay optional and the roadmap says why it is empty", async () => {
  const old = mk(undefined);
  const r = await old("propose_idea", { paper_url: k4.url, slug: "k-four", idea: untestable(k4, undefined, { needs: undefined }) }, sa);
  assert.equal(r.status, "untestable");
  assert.match((await old("roadmap")).note, /Re-pin/);
});

test("capability helpers", () => {
  assert.equal(coveringTestbed(["online_interaction", "expert_queries"], caps), "confounded_imitation");
  assert.equal(coveringTestbed(["online_interaction", "gpu"], caps), null);
  assert.equal(coveringTestbed(["other"], caps), null);
  assert.equal(compareExtractions({ testbed: null, needs: ["a", "b"] }, { testbed: null, needs: ["b"] }).agree, true);
  assert.equal(compareExtractions({ testbed: null, needs: ["a"] }, { testbed: null, needs: ["b"] }).agree, false);
  assert.equal(compareExtractions({ testbed: null, needs: ["a"] }, { testbed: "x" }).agree, false);
});
