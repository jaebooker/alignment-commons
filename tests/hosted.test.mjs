import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { readFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { createService } from "../lib/service.mjs";
const schema = "ac_test_" + randomBytes(6).toString("hex");
test(
  "hosted Postgres: real concurrent claims, document creation, and approval revocation",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const owner = new pg.Client({
      connectionString:
        process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
    });
    await owner.connect();
    let pool;
    try {
      await owner.query(`CREATE SCHEMA ${schema}`);
      pool = new pg.Pool({
        connectionString:
          process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
        options: `-c search_path=${schema}`,
        max: 5,
      });
      await pool.query(
        (await readFile("migrations/001_commons.sql", "utf8")) +
          (await readFile("migrations/002_reviewers.sql", "utf8")),
      );
      const db = {
        query: (s, p) => pool.query(s, p),
        transaction: async (fn) => {
          const c = await pool.connect();
          try {
            await c.query("BEGIN");
            const out = await fn(c);
            await c.query("COMMIT");
            return out;
          } catch (e) {
            await c.query("ROLLBACK");
            throw e;
          } finally {
            c.release();
          }
        },
      };
      const admin = randomBytes(32).toString("base64url"),
        s = createService(db, { adminToken: admin });
      const tokens = [
        randomBytes(32).toString("base64url"),
        randomBytes(32).toString("base64url"),
      ];
      const agents = [];
      for (const secret of tokens) {
        const a = await s(
          "apply",
          {
            name: "test-only",
            runtime: "test",
            operator: "test-only",
            purpose: "isolated schema verification",
            secret,
          },
          "",
          randomUUID(),
        );
        await s("review_agent", { id: a.id, status: "approved" }, admin);
        agents.push(a);
      }
      const j = await s(
        "create_job",
        {
          idea_id: "decoupled-approval",
          prediction: "Isolated verification only",
        },
        tokens[0],
      );
      const race = await Promise.allSettled(
        tokens.map((t) => s("claim_job", { id: j.id }, t)),
      );
      assert.equal(race.filter((x) => x.status === "fulfilled").length, 1);
      assert.equal(
        race.find((x) => x.status === "rejected").reason.status,
        409,
      );
      const docs = await Promise.allSettled(
        tokens.map((t) =>
          s(
            "write_doc",
            {
              slug: "concurrent",
              title: "test",
              content: "race",
              base_revision: 0,
            },
            t,
          ),
        ),
      );
      assert.equal(docs.filter((x) => x.status === "fulfilled").length, 1);
      assert.equal(
        docs.find((x) => x.status === "rejected").reason.status,
        409,
      );
      const winner = race.findIndex((x) => x.status === "fulfilled"),
        claim = race[winner].value;
      await s(
        "review_agent",
        { id: agents[winner].id, status: "revoked" },
        admin,
      );
      await assert.rejects(
        s(
          "heartbeat",
          { id: j.id, lease_token: claim.lease_token },
          tokens[winner],
        ),
        (e) => e.status === 403,
      );
      assert.equal((await s("overview")).jobs[0].status, "queued");
    } finally {
      if (pool) await pool.end();
      await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await owner.end();
    }
  },
);
