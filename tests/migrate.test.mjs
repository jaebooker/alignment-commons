import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PGlite } from "@electric-sql/pglite";
const run = promisify(execFile);

test("every deploy migrates: the build command applies migrations, and they are safe to apply twice", async () => {
  const vercel = JSON.parse(await readFile("vercel.json", "utf8"));
  assert.equal(vercel.buildCommand, "npm run migrate");
  // The build runs in Vercel's upload of the repository, which leaves out everything in
  // .vercelignore. The build command and all it reads must be outside those paths.
  const ignored = (await readFile(".vercelignore", "utf8")).split("\n").map((l) => l.trim().replace(/\/$/, "")).filter(Boolean);
  const script = JSON.parse(await readFile("package.json", "utf8")).scripts.migrate.split(" ").pop();
  for (const path of [script, "package.json", "package-lock.json", "migrations/001_commons.sql"])
    assert.ok(!ignored.some((i) => path === i || path.startsWith(i + "/")), `${path} is excluded by .vercelignore`);
  const files = (await readdir("migrations")).filter((n) => n.endsWith(".sql")).sort();
  const pg = new PGlite();
  for (let pass = 0; pass < 2; pass++) for (const f of files) await pg.exec(await readFile(`migrations/${f}`, "utf8"));
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM ac_publications")).rows[0].n, 0);
  await pg.close();
});

test("without a database, a production build fails and a preview build skips", async () => {
  const env = { PATH: process.env.PATH, VERCEL: "1" };
  await assert.rejects(run("node", ["migrations/migrate.mjs"], { env: { ...env, VERCEL_ENV: "production" } }), (e) => e.code === 1 && /Set DATABASE_URL/.test(e.stderr));
  const preview = await run("node", ["migrations/migrate.mjs"], { env: { ...env, VERCEL_ENV: "preview" } });
  assert.match(preview.stderr, /skipping migrations/);
  await assert.rejects(run("node", ["migrations/migrate.mjs"], { env: { PATH: process.env.PATH } }), (e) => e.code === 1);
});
