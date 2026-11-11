import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
// Applies every migration file, in order, in one transaction. The files are written to be
// re-runnable, so this is safe on every deploy: vercel.json runs it as the build command,
// against the database of the environment being built (production or preview).
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  // A production build without a database must fail loudly. Other builds (a preview without
  // database variables, a fork) still deploy the static site; the workspace API reports 503.
  if (process.env.VERCEL && process.env.VERCEL_ENV !== "production") {
    console.warn("No DATABASE_URL in this build environment: skipping migrations.");
    process.exit(0);
  }
  console.error("Set DATABASE_URL_UNPOOLED or DATABASE_URL to the database to migrate.");
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("BEGIN");
  // Two deploys building at once must not interleave schema changes.
  await client.query("SELECT pg_advisory_xact_lock(hashtext('alignment-commons:migrate'))");
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of (await readdir(dir))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    await client.query(await readFile(new URL(name, dir), "utf8"));
  }
  await client.query("COMMIT");
  console.log("Commons schema ready.");
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`Migration failed; nothing was applied: ${e.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
