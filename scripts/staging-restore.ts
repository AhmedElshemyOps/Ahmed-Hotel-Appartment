import dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH, quiet: true });
import { Pool, type PoolClient } from "pg";
import { mkdtemp, rm, chmod } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
let phase = "configuration";
async function run() {
  const source = process.env.STAGING_DATABASE_URL,
    destination = process.env.STAGING_RESTORE_DATABASE_URL;
  if (
    process.env.APP_ENV !== "staging" ||
    !source ||
    !destination ||
    source === destination ||
    !process.env.STAGING_PROJECT_ID ||
    !process.env.PRODUCTION_PROJECT_ID ||
    process.env.STAGING_PROJECT_ID === process.env.PRODUCTION_PROJECT_ID
  )
    throw Error(
      "Use separate staging projects and distinct source/restore databases with APP_ENV=staging.",
    );
  const sourceUrl = new URL(source),
    targetUrl = new URL(destination);
  if (
    !/(?:^|_)staging(?:_|$)|^ahq_backup_test_/i.test(
      sourceUrl.pathname.slice(1),
    )
  )
    throw Error("Source database name must explicitly identify staging.");
  if (!/^\/[a-z0-9_]*_restore_check_[a-z0-9_]+$/i.test(targetUrl.pathname))
    throw Error(
      "Restore database name must contain _restore_check_ followed by a unique suffix.",
    );
  if (
    sourceUrl.hostname === targetUrl.hostname &&
    (sourceUrl.port || "5432") === (targetUrl.port || "5432") &&
    sourceUrl.pathname === targetUrl.pathname
  )
    throw Error("Restore must target a different database.");
  const a = new Pool({ connectionString: source, max: 1 }),
    b = new Pool({ connectionString: destination, max: 1 });
  const dir = await mkdtemp(path.join(tmpdir(), "ahq-staging-restore-"));
  await chmod(dir, 0o700);
  let client: PoolClient | undefined;
  try {
    phase = "source table discovery";
    const tables = (
      await a.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
      )
    ).rows.map((r) => r.tablename);
    if (
      !tables.length ||
      (
        await b.query(
          "SELECT tablename FROM pg_tables WHERE schemaname='public'",
        )
      ).rows.length
    )
      throw Error(
        "Source must contain staging tables and restore database must be empty.",
      );
    if (
      (
        await b.query(
          "SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace LIMIT 1",
        )
      ).rows.length ||
      (
        await b.query(
          "SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace LIMIT 1",
        )
      ).rows.length
    )
      throw Error("Restore namespace must contain no relations or functions.");
    const identifier = (s: string) => '"' + s.replace(/"/g, '""') + '"';
    const digest = async (db: any, table: string) => {
      const rows = (
        await db.query(
          `SELECT row_to_json(t)::text AS row FROM public.${identifier(table)} t LIMIT 10001`,
        )
      ).rows;
      if (rows.length > 10000)
        throw Error(
          "Rehearsal verification limit is 10,000 rows per table; use an approved large-database restore process.",
        );
      return {
        count: rows.length,
        hash: createHash("sha256")
          .update(
            rows
              .map((r: any) => r.row)
              .sort()
              .join("\n"),
          )
          .digest("hex"),
      };
    };
    client = await a.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const exported = (await client.query("SELECT pg_export_snapshot() AS id"))
      .rows[0].id;
    phase = "consistent source hashes";
    const expected = [];
    for (const table of tables)
      expected.push({ table, ...(await digest(client!, table)) });
    const file = path.join(dir, "staging.dump");
    phase = "pg_dump";
    await promisify(execFile)(
      "pg_dump",
      [
        "--format=custom",
        "--no-owner",
        "--no-acl",
        `--snapshot=${exported}`,
        `--file=${file}`,
      ],
      {
        env: {
          ...process.env,
          PGHOST: sourceUrl.searchParams.get("host") || sourceUrl.hostname,
          PGPORT: sourceUrl.port || "5432",
          PGUSER: decodeURIComponent(sourceUrl.username),
          PGPASSWORD: decodeURIComponent(sourceUrl.password),
          PGDATABASE: sourceUrl.pathname.slice(1),
          ...(sourceUrl.searchParams.get("sslmode")
            ? { PGSSLMODE: sourceUrl.searchParams.get("sslmode")! }
            : {}),
        },
        timeout: 120000,
        maxBuffer: 4096,
      },
    );
    await chmod(file, 0o600);
    await client.query("COMMIT");
    client.release();
    client = undefined;
    const restoreEnv = {
      ...process.env,
      PGHOST: targetUrl.searchParams.get("host") || targetUrl.hostname,
      PGPORT: targetUrl.port || "5432",
      PGUSER: decodeURIComponent(targetUrl.username),
      PGPASSWORD: decodeURIComponent(targetUrl.password),
      PGDATABASE: targetUrl.pathname.slice(1),
      ...(targetUrl.searchParams.get("sslmode")
        ? { PGSSLMODE: targetUrl.searchParams.get("sslmode")! }
        : {}),
    };
    phase = "pg_restore";
    await promisify(execFile)(
      "pg_restore",
      [
        "--no-owner",
        "--no-acl",
        "--exit-on-error",
        "--clean",
        "--if-exists",
        "--single-transaction",
        `--dbname=${targetUrl.pathname.slice(1)}`,
        file,
      ],
      { env: restoreEnv, timeout: 120000, maxBuffer: 4096 },
    );
    phase = "restored table hashes";
    const actual = [];
    for (const table of tables)
      actual.push({ table, ...(await digest(b, table)) });
    if (JSON.stringify(expected) !== JSON.stringify(actual))
      throw Error("Restored table hashes or row counts differ.");
    console.log(
      JSON.stringify(
        {
          result: "passed",
          scope: "Isolated staging database restore",
          tables: actual,
          credentials: "not printed",
          limitations:
            "This validates the database copy. Identity, file-object backups, bucket permissions and MFA recovery require separate checks.",
        },
        null,
        2,
      ),
    );
  } finally {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
    await Promise.all([a.end(), b.end()]);
    await rm(dir, { recursive: true, force: true });
  }
}
run().catch(() => {
  console.error(
    `Staging restore did not pass at ${phase}. Check isolated database access, empty restore target, PostgreSQL client tools and server versions. Connection strings and command output are intentionally withheld.`,
  );
  process.exitCode = 1;
});
