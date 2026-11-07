import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createService } from "../lib/service.mjs";
import { compareRuns } from "../lib/agreement.mjs";
import catalog from "../lib/catalog.json" with { type: "json" };

const secret = () => randomBytes(32).toString("base64url");
const admin = secret(), sa = secret(), sb = secret(), sc = secret();
const reject = (p, status) => assert.rejects(p, (e) => e.status === status);
const spec = catalog.ideas.find((x) => x.id === "decoupled-approval");
const base = JSON.parse(await readFile("tests/fixtures/record.json", "utf8"));
const provenance = {
  source_commit: catalog.commit, method_sha256: spec.method_sha256,
  record_sha256: "b".repeat(64), dirty: false, stage2_seeds: 8,
  command: "python run.py ideas/decoupled-approval --stage2-seeds 8",
};
// Same verdict, but a safety interval that cannot overlap the fixture's.
const shifted = structuredClone(base);
shifted.stage2.safety.ci95 = [5, 6];
const evidence = {
  evidence: "Run B safety CI [5, 6] vs A [0.96, 1.08]; B's per-seed baselines are all zero.",
  scope: "Rerun this test only; do not change the adapter or evaluator.",
};
let pg, service, ids = {};
before(async () => {
  pg = new PGlite();
  for (const f of ["001_commons", "002_reviewers", "003_returns", "004_agreement"])
    await pg.exec(await readFile(`migrations/${f}.sql`, "utf8"));
  const strip = (q) => (s, p) =>
    s.startsWith("SELECT pg_advisory_xact_lock") ? { rows: [] } : q.query(s, p);
  service = createService(
    { query: strip(pg), transaction: (fn) => pg.transaction((tx) => fn({ query: strip(tx) })) },
    { adminToken: admin },
  );
  for (const [s, name] of [[sa, "A"], [sb, "B"], [sc, "C"]]) {
    const a = await service("apply",
      { name, runtime: "test", operator: "op", purpose: "agreement", secret: s }, "", name);
    await service("review_agent", { id: a.id, status: "approved" }, admin);
    ids[s] = a.id;
  }
});
after(async () => pg.close());

const run = async (job, s, record = base) => {
  const c = await service("claim_job", { id: job }, s);
  return service("submit_result", { id: job, lease_token: c.lease_token, record, provenance }, s);
};
const queue = () => service("create_job", { idea_id: spec.id, prediction: "Pre-registered." }, sa);
const statuses = async (job) =>
  (await pg.query("SELECT review_status FROM ac_results WHERE job_id=$1 ORDER BY created_at", [job]))
    .rows.map((r) => r.review_status);
const jobStatus = async (job) =>
  (await pg.query("SELECT status FROM ac_jobs WHERE id=$1", [job])).rows[0].status;

test("two agreeing runs from different agents replicate with no human review", async () => {
  const j = await queue();
  const first = await run(j.id, sa);
  assert.equal(first.status, "awaiting_pair");
  assert.equal(await jobStatus(j.id), "queued");
  await reject(service("claim_job", { id: j.id }, sa), 409); // the first runner cannot pair with itself
  const second = await run(j.id, sb);
  assert.equal(second.status, "replicated");
  assert.equal(second.comparison.agree, true);
  assert.equal(second.comparison.identical_record, true);
  assert.deepEqual(await statuses(j.id), ["replicated", "replicated"]);
  assert.equal(await jobStatus(j.id), "replicated");
  const view = await service("overview");
  assert.equal(view.results.find((r) => r.id === second.id).reviewed_by, "agreement gate");
  assert.equal(view.comparisons[0].job_id, j.id);
  assert.equal(view.jobs.find((x) => x.id === j.id).runs, 2);
  assert.ok(view.events.some((e) => e.kind === "test_replicated" && e.subject === j.id));
});

test("disagreement goes to a human; rejecting one run pairs the survivor with a new runner", async () => {
  const j = await queue();
  await run(j.id, sa);
  const b = await run(j.id, sb, shifted);
  assert.equal(b.status, "disputed");
  assert.deepEqual(b.comparison.checks.filter((c) => !c.pass).map((c) => c.name), ["safety_ci_overlap"]);
  assert.equal(await jobStatus(j.id), "disputed");
  await reject(service("claim_job", { id: j.id }, sc), 409); // nothing to claim while disputed
  await service("review_result",
    { id: b.id, status: "rejected", note: "Run B's baseline is degenerate.", ...evidence }, admin);
  assert.deepEqual(await statuses(j.id), ["awaiting_pair", "rejected"]);
  assert.equal(await jobStatus(j.id), "queued");
  await reject(service("claim_job", { id: j.id }, sa), 409); // A's run is still live
  const c = await run(j.id, sc);
  assert.equal(c.status, "replicated");
  assert.deepEqual(await statuses(j.id), ["replicated", "rejected", "replicated"]);
  assert.equal((await service("returns", { job: j.id })).length, 1);
});

test("a rejected runner may rerun, and a human may settle a dispute by accepting", async () => {
  const j = await queue();
  await run(j.id, sa);
  const b = await run(j.id, sb, shifted);
  const a = (await pg.query("SELECT id FROM ac_results WHERE job_id=$1 AND agent_id=$2", [j.id, ids[sa]])).rows[0];
  await service("review_result", { id: a.id, status: "accepted", note: "A's record checked." }, admin);
  assert.equal(await jobStatus(j.id), "accepted");
  await service("review_result",
    { id: b.id, status: "rejected", note: "B diverged.", ...evidence }, admin);
  assert.equal(await jobStatus(j.id), "accepted", "rejecting the loser never reopens an accepted test");
  const rs = await service("returns", { job: j.id });
  assert.equal(rs.length, 1);
  assert.equal(rs[0].result_id, b.id);
});

test("compareRuns gates on evaluator, verdict and completion evidence", () => {
  const mk = (agent, record, prov = provenance) => ({ agent_id: agent, record, provenance: prov, digest: JSON.stringify(record) });
  const failing = (a, b) => compareRuns(a, b).checks.filter((c) => !c.pass).map((c) => c.name);
  assert.deepEqual(failing(mk("a", base), mk("b", base)), []);
  assert.deepEqual(failing(mk("a", base), mk("a", base)), ["independent_agents"]);
  assert.deepEqual(failing(mk("a", base), mk("b", { ...base, evaluator_hash: "other" })), ["same_evaluator"]);
  assert.deepEqual(failing(mk("a", base), mk("b", { ...base, verdict: "no_effect" })), ["verdict_match"]);
  assert.deepEqual(failing(mk("a", base), mk("b", { ...base, verdict: "mechanism_failed", stage2: null })),
    ["verdict_match", "stage2_presence"]);
  const withCompletion = (ci) => ({ ...base, stage2: { ...base.stage2, completion: { measured: true, ci95: ci } } });
  assert.deepEqual(failing(mk("a", withCompletion([0, 1])), mk("b", withCompletion([0.5, 2]))), []);
  assert.deepEqual(failing(mk("a", withCompletion([0, 1])), mk("b", withCompletion([2, 3]))), ["completion_ci_overlap"]);
  assert.deepEqual(failing(mk("a", withCompletion([0, 1])), mk("b", base)), ["completion_ci_overlap"]);
  assert.equal(compareRuns(mk("a", base), mk("b", shifted)).identical_record, false);
});
