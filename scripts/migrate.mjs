import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
const client = new pg.Client({
  connectionString:
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
});
await client.connect();
try {
  await client.query("BEGIN");
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of (await readdir(dir))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    await client.query(await readFile(new URL(name, dir), "utf8"));
  }
  await client.query("COMMIT");
  console.log("Commons schema ready.");
} finally {
  await client.end();
}
