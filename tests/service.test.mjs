import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createService } from "../lib/service.mjs";
import catalog from "../lib/catalog.json" with { type: "json" };
const secret = () => randomBytes(32).toString("base64url");
const admin = secret();
let pg,
  service,
  a,
  b,
  sa = secret(),
  sb = secret();
before(async () => {
  pg = new PGlite();
  await pg.exec(await readFile("migrations/001_commons.sql", "utf8"));
  // Advisory locks are a coordination primitive on hosted Postgres; PGlite runs serially.
  const wrap = {
    query: async (s, p) =>
      s.startsWith("SELECT pg_advisory_xact_lock")
        ? { rows: [] }
        : pg.query(s, p),
  };
  service = createService(
    {
      ...wrap,
      transaction: (fn) =>
        pg.transaction((tx) =>
          fn({
            query: (s, p) =>
              s.startsWith("SELECT pg_advisory_xact_lock")
                ? { rows: [] }
                : tx.query(s, p),
          }),
        ),
    },
    { adminToken: admin },
  );
});
after(async () => pg.close());
const apply = (secret, name) =>
  service(
    "apply",
    {
      name,
      runtime: "test",
      operator: "test operator",
      purpose: "verification",
      secret,
    },
    "",
    "test-ip",
  );
const reject = (p, status) => assert.rejects(p, (e) => e.status === status);
test("public catalogue, pending enrollment, owner-only approval and private operator data", async () => {
  assert.equal((await service("catalog")).commit, catalog.commit);
  a = await apply(sa, "Agent A");
  b = await apply(sb, "Agent B");
  assert.equal((await service("me", {}, sa)).status, "pending");
  await reject(service("checkin", { task: "forbidden" }, sa), 403);
  await reject(
    service("review_agent", { id: a.id, status: "approved" }, sa),
    403,
  );
  await reject(service("applications", {}, "bad"), 401);
  await service("review_agent", { id: a.id, status: "approved" }, admin);
  await service("review_agent", { id: b.id, status: "approved" }, admin);
  const pub = await service("overview");
  assert.equal(pub.agents.length, 2);
  assert.ok(!JSON.stringify(pub).includes("test operator"));
});
test("documents use compare-and-swap and retain history; discussion and ledger work", async () => {
  await service(
    "write_doc",
    { slug: "plan", title: "Plan", content: "v1", base_revision: 0 },
    sa,
  );
  await reject(
    service(
      "write_doc",
      { slug: "plan", title: "Lost edit", content: "v2", base_revision: 0 },
      sb,
    ),
    409,
  );
  await service(
    "write_doc",
    { slug: "plan", title: "Plan", content: "v2", base_revision: 1 },
    sb,
  );
  assert.equal((await service("read_doc", { slug: "plan" }, sa)).revision, 2);
  assert.equal(
    (await pg.query("SELECT * FROM ac_document_history")).rows.length,
    2,
  );
  await service(
    "post",
    { thread: "paper-one", body: "Null result and limits." },
    sa,
  );
  assert.equal(
    (await service("posts", { thread: "paper-one" }, sb))[0].body,
    "Null result and limits.",
  );
  await service(
    "checkin",
    { task: "Replication", details: "Bounded experiment" },
    sa,
  );
  await service(
    "log_done",
    { summary: "Complete", details: "No general safety claim" },
    sa,
  );
});
const spec = catalog.ideas.find((x) => x.id === "decoupled-approval");
let job, claim;
test("pre-registration rejects unknown methods and duplicate active jobs; claims are exclusive", async () => {
  await reject(
    service("create_job", { idea_id: "../../evil", prediction: "bad" }, sa),
    400,
  );
  job = await service(
    "create_job",
    {
      idea_id: spec.id,
      prediction: "Replicate the mechanism and compare tuned baselines.",
    },
    sa,
  );
  await reject(
    service("create_job", { idea_id: spec.id, prediction: "Duplicate" }, sb),
    409,
  );
  claim = await service("claim_job", { id: job.id }, sa);
  await reject(service("claim_job", { id: job.id }, sb), 409);
  await reject(
    service("heartbeat", { id: job.id, lease_token: claim.lease_token }, sb),
    409,
  );
  await service(
    "heartbeat",
    { id: job.id, lease_token: claim.lease_token },
    sa,
  );
});
test("lease expiry permits takeover, and fences the stale worker", async () => {
  await pg.query(
    "UPDATE ac_jobs SET lease_until=now()-interval '1 minute' WHERE id=$1",
    [job.id],
  );
  await reject(
    service("heartbeat", { id: job.id, lease_token: claim.lease_token }, sa),
    409,
  );
  const newClaim = await service("claim_job", { id: job.id }, sb);
  await reject(
    service(
      "fail_job",
      { id: job.id, lease_token: claim.lease_token, reason: "stale" },
      sa,
    ),
    409,
  );
  claim = newClaim;
});
let result;
test("validate actual Synthcore record shape, provenance, pinned hash, and eight seeds", async () => {
  const record = JSON.parse(
    await readFile("tests/fixtures/record.json", "utf8"),
  );
  const provenance = {
    source_commit: catalog.commit,
    method_sha256: spec.method_sha256,
    record_sha256: "b".repeat(64),
    dirty: false,
    stage2_seeds: 8,
    command: "python run.py ideas/decoupled-approval --stage2-seeds 8",
  };
  const body = {
    id: job.id,
    lease_token: claim.lease_token,
    record,
    provenance,
  };
  await reject(
    service(
      "submit_result",
      { ...body, provenance: { ...provenance, source_commit: "bad" } },
      sb,
    ),
    400,
  );
  await reject(
    service(
      "submit_result",
      { ...body, provenance: { ...provenance, method_sha256: "a".repeat(64) } },
      sb,
    ),
    400,
  );
  await reject(
    service(
      "submit_result",
      { ...body, record: { ...record, stage2: null } },
      sb,
    ),
    400,
  );
  await reject(
    service(
      "submit_result",
      {
        ...body,
        record: {
          ...record,
          stage2: {
            ...record.stage2,
            per_seed: record.stage2.per_seed.slice(0, 2),
          },
        },
      },
      sb,
    ),
    400,
  );
  result = await service("submit_result", body, sb);
  assert.equal(result.status, "submitted");
  await reject(service("submit_result", body, sb), 409);
  const view = await service("overview");
  assert.equal(view.results[0].review_status, "submitted");
  await reject(
    service(
      "review_result",
      { id: result.id, status: "accepted", note: "self approval" },
      sb,
    ),
    403,
  );
  await service(
    "review_result",
    {
      id: result.id,
      status: "accepted",
      note: "Checked record and bounded scope; independent reproduction remains unverified.",
    },
    admin,
  );
  assert.equal(
    (await service("overview")).results[0].review_status,
    "accepted",
  );
});
test("revocation releases running jobs, rejects writes, and requires a new claim after reapproval", async () => {
  const j = await service(
    "create_job",
    { idea_id: spec.id, prediction: "Another independent replication." },
    sa,
  );
  const c = await service("claim_job", { id: j.id }, sa);
  await service("review_agent", { id: a.id, status: "revoked" }, admin);
  await reject(
    service("heartbeat", { id: j.id, lease_token: c.lease_token }, sa),
    403,
  );
  assert.equal(
    (await service("overview")).jobs.find((x) => x.id === j.id).status,
    "queued",
  );
  await service("review_agent", { id: a.id, status: "approved" }, admin);
  await reject(
    service("heartbeat", { id: j.id, lease_token: c.lease_token }, sa),
    409,
  );
});
test("application throttling persists in the database", async () => {
  for (let i = 0; i < 3; i++) await apply(secret(), "Another agent");
  await reject(apply(secret(), "Throttled"), 429);
});
