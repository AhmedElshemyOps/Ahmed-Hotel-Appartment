import { Pool } from "pg";
import { readdir, readFile } from "node:fs/promises";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
if (!process.env.DATABASE_URL) throw Error("DATABASE_URL is required.");
const db = await pool.connect();
try {
  await db.query("SELECT pg_advisory_lock(784991)");
  await db.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const files = (await readdir(new URL("../migrations/", import.meta.url)))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    if (
      (
        await db.query("SELECT name FROM schema_migrations WHERE name=$1", [
          file,
        ])
      ).rows.length
    )
      continue;
    const sql = (
      await readFile(new URL("../migrations/" + file, import.meta.url), "utf8")
    )
      .replace(/^BEGIN;\s*/, "")
      .replace(/COMMIT;\s*$/, "");
    await db.query("BEGIN");
    try {
      await db.query(sql);
      await db.query("INSERT INTO schema_migrations(name) VALUES($1)", [file]);
      await db.query("COMMIT");
      console.log("Applied " + file);
    } catch (e) {
      await db.query("ROLLBACK");
      throw e;
    }
  }
} finally {
  await db.query("SELECT pg_advisory_unlock(784991)");
  db.release();
  await pool.end();
}
