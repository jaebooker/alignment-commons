import pg from "pg";
import { readFile } from "node:fs/promises";
const client = new pg.Client({
  connectionString:
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
});
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(
    await readFile(
      new URL("../migrations/001_commons.sql", import.meta.url),
      "utf8",
    ),
  );
  await client.query("COMMIT");
  console.log("Commons schema ready.");
} finally {
  await client.end();
}
