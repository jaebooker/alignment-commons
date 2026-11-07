import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createService, MAX_RETURNS } from "../lib/service.mjs";
import catalog from "../lib/catalog.json" with { type: "json" };

const secret = () => randomBytes(32).toString("base64url");
const admin = secret(), sa = secret(), sb = secret();
const reject = (p, status) => assert.rejects(p, (e) => e.status === status);
const runnable = catalog.ideas.filter((x) => x.testbed);
let pg, service;
before(async () => {
  pg = new PGlite();
  for (const f of ["001_commons", "002_reviewers", "003_returns", "004_agreement", "005_pipeline", "006_adapter_verification", "007_learning_edge"])
    await pg.exec(await readFile(`migrations/${f}.sql`, "utf8"));
  const strip = (q) => (s, p) =>
    s.startsWith("SELECT pg_advisory_xact_lock") ? { rows: [] } : q.query(s, p);
  service = createService(
    {
      query: strip(pg),
      transaction: (fn) => pg.transaction((tx) => fn({ query: strip(tx) })),
    },
    { adminToken: admin },
  );
  for (const [s, name] of [[sa, "Runner A"], [sb, "Runner B"]]) {
    const a = await service("apply",
      { name, runtime: "test", operator: "op", purpose: "returns", secret: s }, "", name);
    await service("review_agent", { id: a.id, status: "approved" }, admin);
  }
});
after(async () => pg.close());

const ret = (reason) => ({
  reason,
  evidence: "worker.log: expected 302, got 200 at handlers/auth.py:88",
  scope: "Rerun this idea only; do not change the adapter or other jobs.",
});
const queue = (idea) =>
  service("create_job", { idea_id: idea.id, prediction: "Pre-registered." }, sa);
const jobRow = async (id) =>
  (await pg.query("SELECT status FROM ac_jobs WHERE id=$1", [id])).rows[0].status;

test("a worker failure needs reason, evidence and scope, and requeues only that unit", async () => {
  const [one, two] = [await queue(runnable[0]), await queue(runnable[1])];
  const c = await service("claim_job", { id: one.id }, sa);
  assert.deepEqual(c.returns, []);
  await reject(service("fail_job",
    { id: one.id, lease_token: c.lease_token, reason: "crashed" }, sa), 400);
  assert.equal(await jobRow(one.id), "running", "a bare reason must not count as a return");
  const back = await service("fail_job",
    { id: one.id, lease_token: c.lease_token, ...ret("Runner exited 1") }, sa);
  assert.deepEqual(back, { status: "queued", returns: 1, remaining: MAX_RETURNS - 1 });
  assert.equal(await jobRow(two.id), "queued", "the other unit is untouched");
  // The next worker sees what came back and what it may touch.
  const c2 = await service("claim_job", { id: one.id }, sb);
  assert.equal(c2.returns.length, 1);
  assert.equal(c2.returns[0].scope, ret("x").scope);
  assert.equal(c2.returns[0].returned_by, "Runner A");
  await reject(service("fail_job",
    { id: one.id, lease_token: c.lease_token, ...ret("stale") }, sa), 409);
  await service("release_job",
    { id: one.id, lease_token: c2.lease_token, reason: "handing back" }, sb);
  assert.equal((await service("returns", { job: one.id })).length, 1,
    "a voluntary release is not a correction");
});

test("the third return escalates and blocks requeueing the idea at this commit", async () => {
  const idea = runnable[2], j = await queue(idea);
  let last;
  for (let i = 1; i <= MAX_RETURNS; i++) {
    const c = await service("claim_job", { id: j.id }, i % 2 ? sa : sb);
    assert.equal(c.returns.length, i - 1);
    last = await service("fail_job",
      { id: j.id, lease_token: c.lease_token, ...ret(`attempt ${i} failed`) }, i % 2 ? sa : sb);
  }
  assert.deepEqual(last, { status: "escalated", returns: MAX_RETURNS, remaining: 0 });
  await reject(service("claim_job", { id: j.id }, sa), 409);
  await reject(queue(idea), 409);
  const view = await service("overview");
  assert.equal(view.jobs.find((x) => x.id === j.id).returns, MAX_RETURNS);
  assert.ok(view.events.some((e) => e.kind === "test_escalated" && e.subject === j.id));
});

test("a worker may escalate at once when the plan is the problem", async () => {
  const j = await queue(runnable[3]);
  const c = await service("claim_job", { id: j.id }, sa);
  const back = await service("fail_job",
    { id: j.id, lease_token: c.lease_token, ...ret("Adapter imports a removed API"), escalate: true }, sa);
  assert.equal(back.status, "escalated");
});

test("a reviewer rejection returns the unit once, and the rerun can submit fresh evidence", async () => {
  const spec = catalog.ideas.find((x) => x.id === "decoupled-approval");
  const record = JSON.parse(await readFile("tests/fixtures/record.json", "utf8"));
  const provenance = {
    source_commit: catalog.commit, method_sha256: spec.method_sha256,
    record_sha256: "b".repeat(64), dirty: false, stage2_seeds: 8,
    command: "python run.py ideas/decoupled-approval --stage2-seeds 8",
  };
  const j = await queue(spec);
  const submit = async (s) => {
    const c = await service("claim_job", { id: j.id }, s);
    return service("submit_result", { id: j.id, lease_token: c.lease_token, record, provenance }, s);
  };
  const first = await submit(sa);
  await reject(service("review_result",
    { id: first.id, status: "rejected", note: "Baseline untuned" }, admin), 400);
  assert.equal((await service("returns", { job: j.id })).length, 0, "an unstructured rejection changes nothing");
  const r = await service("review_result",
    { id: first.id, status: "rejected", note: "Baseline untuned", ...ret("x") }, admin);
  assert.equal(r.job.status, "queued");
  await service("review_result",
    { id: first.id, status: "rejected", note: "Still untuned", ...ret("x") }, admin);
  const rs = await service("returns", { job: j.id });
  assert.equal(rs.length, 1, "re-rejecting the same result is not a second return");
  assert.equal(rs[0].source, "reviewer");
  assert.equal(rs[0].reason, "Baseline untuned");
  assert.equal(rs[0].result_id, first.id);
  const second = await submit(sb);
  assert.notEqual(second.id, first.id);
  await service("review_result",
    { id: second.id, status: "accepted", note: "Tuned baseline checked." }, admin);
  assert.equal(await jobRow(j.id), "accepted");
});
