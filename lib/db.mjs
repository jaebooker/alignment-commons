import pg from "pg";
import { attachDatabasePool } from "@vercel/functions";
let pool;
export function database() {
  if (!process.env.DATABASE_URL)
    throw Object.assign(new Error("Workspace database is not configured."), {
      status: 503,
    });
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 10000,
    });
    if (process.env.VERCEL) attachDatabasePool(pool);
  }
  return {
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
}
