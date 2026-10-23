// Explicit integration check: isolated DB schema, real CPU Synthcore run, no production rows.
import pg from "pg";
import http from "node:http";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { createService } from "../lib/service.mjs";
const schema = "ac_worker_test_" + randomBytes(6).toString("hex");
const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  max: 5,
});
let scoped, server;
const run = (args, env, input) =>
  new Promise((resolve, reject) => {
    const p = spawn(process.env.BRIDGE_PYTHON || "python3", args, {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "",
      err = "";
    p.stdout.on("data", (b) => (out += b));
    p.stderr.on("data", (b) => (err += b));
    p.on("error", reject);
    p.on("exit", (code) =>
      code === 0
        ? resolve(out)
        : reject(Error(`Worker exited ${code}: ${err}`)),
    );
    p.stdin.end(input);
  });
try {
  await pool.query(`CREATE SCHEMA ${schema}`);
  scoped = new pg.Pool({
    connectionString:
      process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
    options: `-c search_path=${schema}`,
    max: 5,
  });
  await scoped.query(await readFile("migrations/001_commons.sql", "utf8"));
  const db = {
    query: (s, p) => scoped.query(s, p),
    transaction: async (fn) => {
      const c = await scoped.connect();
      try {
        await c.query("BEGIN");
        const r = await fn(c);
        await c.query("COMMIT");
        return r;
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    },
  };
  const admin = randomBytes(32).toString("base64url"),
    secret = randomBytes(32).toString("base64url"),
    service = createService(db, { adminToken: admin });
  server = http.createServer(async (req, res) => {
    try {
      let chunks = [];
      for await (const c of req) chunks.push(c);
      const { action, input } = JSON.parse(Buffer.concat(chunks));
      const t = (req.headers.authorization || "").replace(/^Bearer /, "");
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({ data: await service(action, input, t, "test-only") }),
      );
    } catch (e) {
      res.statusCode = e.status || 500;
      res.end(JSON.stringify({ error: e.message }));
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}`;
  const a = await service(
    "apply",
    {
      name: "CPU smoke test",
      runtime: "test",
      operator: "isolated test",
      purpose: "verification only",
      secret,
    },
    "",
    "test-only",
  );
  await service("review_agent", { id: a.id, status: "approved" }, admin);
  const env = { ALIGNMENT_COMMONS_URL: url, ALIGNMENT_COMMONS_TOKEN: secret };
  const rpc =
    [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "overview", arguments: {} },
      },
    ]
      .map((x) => JSON.stringify(x))
      .join("\n") + "\n";
  const protocol = (await run(["scripts/agent.py", "mcp"], env, rpc))
    .trim()
    .split("\n")
    .map(JSON.parse);
  assert.equal(protocol[1].result.tools.length, 17);
  assert.ok(!protocol[2].result.isError);
  console.log("Real stdio MCP initialize / 17 tools / remote overview passed.");
  const job = await service(
    "create_job",
    {
      idea_id: "attainable-utility-preservation",
      prediction:
        "Infrastructure smoke test: rerun the pinned method without changing its prediction.",
    },
    secret,
  );
  const output = await run(
    [
      "scripts/agent.py",
      "worker",
      "--job",
      job.id,
      "--synthcore",
      process.env.SYNTHCORE_PATH ||
        "/Users/jaesonbooker/Downloads/alignment-synthcore",
      "--python",
      process.env.SYNTHCORE_PYTHON ||
        "/Users/jaesonbooker/anaconda3/bin/python",
      "--budget",
      "120",
      "--artifacts",
      "work/worker-smoke",
    ],
    env,
  );
  const result = JSON.parse(output);
  assert.equal(result.result.status, "submitted");
  const overview = await service("overview");
  assert.equal(overview.results.length, 1);
  assert.equal(overview.jobs[0].status, "submitted");
  assert.equal(
    overview.results[0].record.id,
    "attainable-utility-preservation",
  );
  console.log(
    JSON.stringify(
      {
        worker: "real Synthcore execution passed",
        verdict: overview.results[0].record.verdict,
        artifacts: result.artifacts,
        productionRowsWritten: 0,
      },
      null,
      2,
    ),
  );
} finally {
  if (server) await new Promise((r) => server.close(r));
  if (scoped) await scoped.end();
  await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await pool.end();
}
