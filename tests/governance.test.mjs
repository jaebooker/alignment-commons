import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createService } from "../lib/service.mjs";
import { RULES } from "../lib/governance.mjs";
import catalog from "../lib/catalog.json" with { type: "json" };
import pipeline from "../lib/pipeline.json" with { type: "json" };

const caps = JSON.parse(await readFile("tests/fixtures/capabilities.json", "utf8"));
const secret = () => randomBytes(32).toString("base64url");
const admin = secret();
const S = { m1: secret(), m2: secret(), m3: secret(), p1: secret(), p2: secret(), p3: secret(), cap: secret() };
const ID = {};
const reject = (p, status, re) => assert.rejects(p, (e) => e.status === status && (!re || re.test(e.message)));
const sha = (x) => createHash("sha256").update(x).digest("hex");
const spec = catalog.ideas.find((x) => x.id === "decoupled-approval");
const base = JSON.parse(await readFile("tests/fixtures/record.json", "utf8"));
const withCI = (lo, hi) => { const r = structuredClone(base); r.stage2.safety.ci95 = [lo, hi]; return r; };
const provenance = { source_commit: catalog.commit, method_sha256: spec.method_sha256, record_sha256: "b".repeat(64),
  dirty: false, stage2_seeds: 8, command: "python run.py ideas/decoupled-approval --stage2-seeds 8" };
const back = { evidence: "Line 7 returns random scores; the jailed gate saw -0.01 on all seeds.",
  scope: "Implement the paper's scoring rule in run(); keep HPARAMS and imports." };

let pg, service;
before(async () => {
  pg = new PGlite();
  for (const f of ["001_commons", "002_reviewers", "003_returns", "004_agreement", "005_pipeline",
    "006_adapter_verification", "007_learning_edge", "008_agent_governance"])
    await pg.exec(await readFile(`migrations/${f}.sql`, "utf8"));
  const strip = (q) => (s, p) => (s.startsWith("SELECT pg_advisory_xact_lock") ? { rows: [] } : q.query(s, p));
  service = createService(
    { query: strip(pg), transaction: (fn) => pg.transaction((tx) => fn({ query: strip(tx) })) },
    { adminToken: admin, capabilities: caps, adapterVerification: true,
      fetchAbstract: async () => "We show that the proposed method recovers planted structure better than baselines." },
  );
  let n = 0;
  for (const [k, s] of Object.entries(S)) {
    const a = await service("apply", { name: k.toUpperCase(), runtime: "test", operator: "op", purpose: "governance", secret: s }, "", `ip-${n++ % 4}`);
    ID[k] = a.id;
  }
  // Bootstrap: the owner sponsors the first members. Everyone else earns it.
  for (const k of ["m1", "m2", "m3"]) await service("review_agent", { id: ID[k], status: "approved" }, admin);
});
after(async () => pg.close());

const queue = () => service("create_job", { idea_id: spec.id, prediction: "Pre-registered by a member." }, S.m2);
const run = async (job, s, record = base) => {
  const c = await service("claim_job", { id: job }, s);
  return service("submit_result", { id: job, lease_token: c.lease_token, record, provenance }, s);
};
const statusOf = async (job) => (await pg.query("SELECT status FROM ac_jobs WHERE id=$1", [job])).rows[0].status;

test("anyone can enroll onto probation, which is powerless and rate limited", async () => {
  const me = await service("me", {}, S.p1);
  assert.deepEqual([me.status, me.tier], ["approved", "probation"]);
  assert.equal(me.track_record.eligible, false);
  for (const action of ["create_job", "write_doc", "sponsor_agent", "vote_revoke", "review_code", "record_admission"])
    await reject(service(action, { id: ID.m1 }, S.p1), 403, /Members only/);
  await pg.query("INSERT INTO ac_events(agent_id,kind,subject) SELECT $1,'checkin','x' FROM generate_series(1,$2)",
    [ID.cap, RULES.probationDailyWrites]);
  await reject(service("checkin", { task: "one more" }, S.cap), 429);
  const gov = await service("governance");
  assert.deepEqual(gov.agents.filter((a) => a.tier === "member").map((a) => a.name).sort(), ["M1", "M2", "M3"]);
});

test("every agreement needs a member: two probation runs never pair", async () => {
  const j = await queue();
  await run(j.id, S.p1);
  await reject(service("claim_job", { id: j.id }, S.p2), 409, /member must run the second/);
  assert.equal((await run(j.id, S.m2)).status, "replicated");
});

test("a member tiebreak settles a dispute by majority; the outvoted run is rejected", async () => {
  const j = await queue();
  await run(j.id, S.m1);
  assert.equal((await run(j.id, S.p1, withCI(5, 6))).status, "disputed");
  assert.equal(await statusOf(j.id), "disputed");
  await reject(service("claim_job", { id: j.id }, S.p2), 409, /member's tiebreak/);
  await reject(service("claim_job", { id: j.id }, S.m1), 409, /independent runner/);
  // A tiebreaker who walks away returns the test to disputed, not to the queue.
  const c = await service("claim_job", { id: j.id }, S.m3);
  await service("release_job", { id: j.id, lease_token: c.lease_token, reason: "out of time" }, S.m3);
  assert.equal(await statusOf(j.id), "disputed");
  const t = await run(j.id, S.m3);
  assert.equal(t.status, "replicated");
  const res = (await pg.query("SELECT a.name,r.review_status,r.reviewed_by FROM ac_results r JOIN ac_agents a ON a.id=r.agent_id WHERE r.job_id=$1 ORDER BY r.created_at", [j.id])).rows;
  assert.deepEqual(res.map((r) => [r.name, r.review_status]), [["M1", "replicated"], ["P1", "rejected"], ["M3", "replicated"]]);
  assert.ok(res.every((r) => r.reviewed_by === "tiebreak"));
  assert.equal((await service("me", {}, S.p1)).track_record.rejected_results_30d, 1);
});

test("membership is earned: agreements with members, age, and a member sponsor with a cooldown", async () => {
  for (const first of [S.m1, S.m1, S.m1, S.m2, S.m2]) {
    const j = await queue();
    await run(j.id, first);
    await run(j.id, S.p2);
  }
  let rec = (await service("me", {}, S.p2)).track_record;
  assert.deepEqual([rec.agreements, rec.distinct_partners, rec.eligible], [5, 2, false]); // too young
  await reject(service("sponsor_agent", { id: ID.p2, note: "early" }, S.m1), 409, /Not eligible/);
  await pg.query("UPDATE ac_agents SET created_at=now()-interval '8 days' WHERE id=ANY($1)", [[ID.p1, ID.p2]]);
  assert.equal((await service("me", {}, S.p2)).track_record.eligible, true);
  await reject(service("sponsor_agent", { id: ID.p2, note: "self" }, S.p2), 403);
  const ok = await service("sponsor_agent", { id: ID.p2, note: "Five clean replications." }, S.m1);
  assert.equal(ok.tier, "member");
  // P1 lost a tiebreak, and M1 is on cooldown anyway.
  await reject(service("sponsor_agent", { id: ID.p1, note: "x" }, S.m2), 409, /Not eligible/);
  await reject(service("sponsor_agent", { id: ID.p1, note: "x" }, S.m1), 409, /every 7 days/);
});

test("members revoke by vote, and a recent sponsor answers for its sponsee", async () => {
  await reject(service("vote_revoke", { id: ID.p2, reason: "x", evidence: "y" }, S.p1), 403);
  const ev = { reason: "Submitted fabricated records", evidence: "Records digest-identical to another job's run." };
  let v = await service("vote_revoke", { id: ID.p2, ...ev }, S.m2);
  assert.deepEqual([v.votes, v.needed, v.revoked], [1, 2, false]);
  v = await service("vote_revoke", { id: ID.p2, ...ev }, S.m3);
  assert.deepEqual([v.revoked, v.sponsor_demoted], [true, ID.m1]);
  await reject(service("checkin", { task: "x" }, S.p2), 403);
  assert.equal((await service("me", {}, S.m1)).tier, "probation");
});

const METHOD = `import numpy as np

HPARAMS = [{"k": 1}]


def run(tasks, hparams, seed):
    return [{"score": float(np.random.rand())} for _ in tasks]
`;
const QUOTE = "we show that the proposed method recovers planted structure better than baselines";
const ideaFor = (c, extra = {}) => ({
  title: "An idea extracted from the candidate paper",
  description: "Restates the paper's method in our own words, long enough to pass the length check.",
  source: { type: "paper", title: c.title, url: c.url, claim_quote: QUOTE },
  commons_topic: c.topics.find((t) => pipeline.topics.includes(t)),
  testbed: c.testbeds[0], prediction: { safety_min_effect: 0 }, ...extra,
});
const reportFor = (slug, src, testbed, jail) => ({
  checker_version: 1, slug, method_sha256: sha(src), passed: true, static: { passed: true, problems: [] },
  synthcore_commit: "c".repeat(40),
  gate: { ran: true, passed: false, observed: -0.01, quantity: "safety", rule: ">= 0", testbed,
    evaluator_hash: "e".repeat(16), seeds: 3, jail: jail ? { mode: "docker", image: "synthcore-method:x" } : { mode: "process" } },
});
const adapted = async (c, slug) => {
  const p = await service("propose_idea", { paper_url: c.url, slug, idea: ideaFor(c) }, S.p1);
  const l = await service("claim_proposal", { id: p.id }, S.p1);
  await service("submit_adapter", { id: p.id, lease_token: l.lease_token, method_py: METHOD,
    self_report: reportFor(slug, METHOD, c.testbeds[0], false) }, S.p1);
  return p.id;
};

test("an agent quorum accepts an adapter; a member records the merge", async () => {
  const c = pipeline.candidates[30];
  const pid = await adapted(c, "gov-one");
  const verify = (s) => service("verify_adapter", { id: pid, report: reportFor("gov-one", METHOD, c.testbeds[0], true) }, s);
  assert.equal((await verify(S.p3)).quorum.verifications, 0, "probation verifications do not count");
  assert.equal((await verify(S.m2)).quorum.decision, "waiting");
  assert.equal((await verify(S.m3)).quorum.decision, "waiting"); // still needs a code approval
  await reject(service("review_code", { id: pid, verdict: "approve", note: "x" }, S.p3), 403);
  const r = await service("review_code", { id: pid, verdict: "approve", note: "Implements the scoring rule; no I/O." }, S.m2);
  assert.equal(r.quorum.decision, "accepted");
  assert.equal((await service("governance")).merge_queue[0].slug, "gov-one");
  await reject(service("record_admission", { id: pid, commit: "a".repeat(40) }, S.p3), 403);
  const done = await service("record_admission", { id: pid, commit: "a".repeat(40) }, S.m3);
  assert.equal(done.status, "admitted");
});

test("one member's code rejection returns the adapter with its evidence and scope", async () => {
  const c = pipeline.candidates[31];
  const pid = await adapted(c, "gov-two");
  await reject(service("review_code", { id: pid, verdict: "reject", note: "Random scores" }, S.m2), 400);
  const r = await service("review_code", { id: pid, verdict: "reject", note: "Random scores, not the method.", ...back }, S.m2);
  assert.equal(r.quorum.decision, "returned");
  const full = await service("proposal", { id: pid });
  assert.deepEqual([full.status, full.returns[0].source, full.returns[0].scope], ["specified", "agents", back.scope]);
});

const untestable = (c, needs) => ({ ...ideaFor(c), testbed: null, prediction: null, needs,
  untestable_reason: "Needs the poisoned training set; the testbed exposes only weights and clean inputs." });
test("probation agents cannot confirm each other; a member tiebreak settles a disputed verdict blind", async () => {
  const [c1, c2] = pipeline.candidates.slice(40);
  const p = await service("propose_idea", { paper_url: c1.url, slug: "gov-u1", idea: untestable(c1, ["poisoned_training_data"]) }, S.p1);
  const r = await service("propose_idea", { paper_url: c1.url, slug: "gov-u1b", idea: untestable(c1, ["poisoned_training_data"]) }, S.p3);
  assert.equal(r.confirmation, "recorded");
  assert.ok((await service("candidates", { limit: 100 })).candidates.some((x) => x.url === c1.url), "still awaiting a member");
  // A member disagrees: disputed, still hidden, still listed for a tiebreak.
  assert.equal((await service("propose_idea", { paper_url: c1.url, slug: "gov-u1-testable", idea: ideaFor(c1) }, S.m2)).confirmation, "disputed");
  assert.equal((await service("proposal", { id: p.id })).pending_confirmation, true);
  assert.ok((await service("candidates", { limit: 100 })).candidates.some((x) => x.url === c1.url));
  await reject(service("propose_idea", { paper_url: c1.url, slug: "gov-u1c", idea: ideaFor(c1) }, S.p3), 409, /member must break/);
  await reject(service("propose_idea", { paper_url: c1.url, slug: "gov-u1c", idea: ideaFor(c1) }, S.m2), 409, /already judged/);
  const t = await service("propose_idea", { paper_url: c1.url, slug: "gov-u1c", idea: ideaFor(c1) }, S.m3);
  assert.deepEqual([t.outcome, t.status], ["testable", "specified"]);
  const now = await service("proposal", { id: p.id });
  assert.equal(now.slug, "gov-u1-testable");
  // Majority untestable: confirmed by the tiebreak.
  const q = await service("propose_idea", { paper_url: c2.url, slug: "gov-u2", idea: untestable(c2, ["poisoned_training_data"]) }, S.m2);
  await service("propose_idea", { paper_url: c2.url, slug: "gov-u2b", idea: ideaFor(c2) }, S.p1);
  const t2 = await service("propose_idea", { paper_url: c2.url, slug: "gov-u2c", idea: untestable(c2, ["poisoned_training_data", "gpu"]) }, S.m3);
  assert.equal(t2.outcome, "confirmed");
  assert.equal((await service("proposal", { id: q.id })).confirmed, true);
});

test("the owner's pause freezes agent decisions, enrollment included", async () => {
  await reject(service("set_paused", { paused: true, reason: "x" }, S.m2), 403);
  await service("set_paused", { paused: true, reason: "Investigating a suspected sybil ring." }, admin);
  const a = await service("apply", { name: "Late", runtime: "t", operator: "o", purpose: "p", secret: secret() }, "", "ip-late");
  assert.equal(a.status, "pending");
  await reject(service("vote_revoke", { id: ID.p1, reason: "x", evidence: "y" }, S.m2), 423);
  assert.equal((await service("governance")).paused, true);
  await service("set_paused", { paused: false, reason: "Resolved." }, admin);
  assert.equal((await service("governance")).paused, false);
});

test("three disagreeing runs escalate instead of guessing", async () => {
  const j = await queue();
  await run(j.id, S.m2);
  await run(j.id, S.p1, withCI(5, 6));
  const t = await run(j.id, S.m3, withCI(10, 11));
  assert.equal(t.status, "escalated");
  assert.equal(await statusOf(j.id), "escalated");
});
