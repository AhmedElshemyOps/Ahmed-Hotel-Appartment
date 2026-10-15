import { test } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import express from "express";
import { createCloudRouter } from "../server/cloud";
import { HttpError } from "../server/auth/permissions";
const connection = process.env.TEST_POSTGRES_URL;
function isolatedConnection() {
  const url = new URL(connection!);
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.pathname !== "/ahq_test"
  )
    throw Error(
      "PostgreSQL rehearsal requires a local disposable ahq_test database.",
    );
  return url;
}
async function migrate(pool: Pool) {
  for (const f of (await readdir(new URL("../migrations/", import.meta.url)))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pool.query(
      await readFile(new URL("../migrations/" + f, import.meta.url), "utf8"),
    );
}
const id = () => randomUUID().replace(/-/g, "");
test(
  "real PostgreSQL serializes simultaneous invitations and duplicate acceptance without exceeding ten seats",
  { skip: !connection },
  async () => {
    isolatedConnection();
    const admin = new Pool({ connectionString: connection }),
      schema = "ahq_concurrency_" + id();
    await admin.query(`CREATE SCHEMA ${schema}`);
    const pool = new Pool({
      connectionString: connection,
      max: 20,
      options: `-c search_path=${schema},public`,
    });
    let server: any;
    let runtime: Pool | undefined;
    const runtimeRole = "ahq_runtime_" + id();
    try {
      await migrate(pool);
      await pool.query(
        "BEGIN;INSERT INTO organizations VALUES('a','SYNTHETIC concurrency company','gm');INSERT INTO memberships VALUES('gm','a',1,'General Manager');COMMIT;",
      );
      let invitedEmail = "invited@example.test";
      await admin.query(`CREATE ROLE ${runtimeRole} NOLOGIN`);
      await pool.query(
        `GRANT USAGE ON SCHEMA ${schema} TO ${runtimeRole}; GRANT SELECT ON ALL TABLES IN SCHEMA ${schema} TO ${runtimeRole}; GRANT INSERT,UPDATE ON member_profiles TO ${runtimeRole}; GRANT INSERT,DELETE ON memberships TO ${runtimeRole}; GRANT UPDATE(role) ON memberships TO ${runtimeRole}; GRANT INSERT ON team_invitations TO ${runtimeRole}; GRANT UPDATE(status,accepted_by) ON team_invitations TO ${runtimeRole}; GRANT INSERT,DELETE ON readiness_grants TO ${runtimeRole}; GRANT UPDATE(capability) ON readiness_grants TO ${runtimeRole}; GRANT INSERT ON audit_events TO ${runtimeRole}; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA ${schema} TO ${runtimeRole};`,
      );
      runtime = new Pool({
        connectionString: connection,
        max: 20,
        options: `-c role=${runtimeRole} -c search_path=${schema},public`,
      });
      const app = express();
      app.use(express.json());
      app.use(
        "/api",
        createCloudRouter(runtime, async (token) => ({
          uid: token,
          email: invitedEmail,
          email_verified: true,
          auth_time: Math.floor(Date.now() / 1000),
          firebase: { sign_in_second_factor: "totp" },
        })),
      );
      app.use((e: any, _q: any, r: any, _n: any) =>
        r
          .status(e instanceof HttpError ? e.status : 500)
          .json({ error: e.message }),
      );
      server = app.listen(0, "127.0.0.1");
      await new Promise<void>((r) => server.once("listening", r));
      const base = `http://127.0.0.1:${server.address().port}/api`;
      const call = (path: string, body: any, uid = "gm") =>
        fetch(base + path, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${uid}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      const attempts = await Promise.all(
        Array.from({ length: 16 }, (_, i) =>
          call("/management/invitations", {
            email: i === 0 ? "invited@example.test" : `person${i}@example.test`,
            displayName: `SIMULATED ${i}`,
            role: "Read-Only Viewer",
            capabilities: [],
          }),
        ),
      );
      assert.equal(attempts.filter((r) => r.status === 200).length, 9);
      assert.equal(attempts.filter((r) => r.status === 409).length, 7);
      const reserved = (
        await pool.query(
          "SELECT count(*)::int AS n,count(DISTINCT seat)::int AS seats FROM team_invitations WHERE status='pending'",
        )
      ).rows[0];
      assert.deepEqual(reserved, { n: 9, seats: 9 });
      // Choose the first successful reservation and use its bound email for both simulated identity claims.
      const responses = await Promise.all(
        attempts.filter((r) => r.status === 200).map((r) => r.json()),
      );
      const first = responses[0];
      invitedEmail = (
        await pool.query("SELECT email FROM team_invitations WHERE id=$1", [
          first.id,
        ])
      ).rows[0].email;
      const accept = await Promise.all([
        call("/team/accept", { token: first.token }, "new-one"),
        call("/team/accept", { token: first.token }, "new-two"),
      ]);
      assert.deepEqual(accept.map((r) => r.status).sort(), [200, 410]);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM memberships WHERE organization_id='a'",
          )
        ).rows[0].n,
        2,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM memberships WHERE role='General Manager'",
          )
        ).rows[0].n,
        1,
      );
    } finally {
      if (server) await new Promise<void>((r) => server.close(() => r()));
      await runtime?.end();
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.query(`DROP ROLE IF EXISTS ${runtimeRole}`);
      await admin.end();
    }
  },
);
test(
  "isolated PostgreSQL dump and restore reproduces schema and synthetic record hashes",
  { skip: !connection, timeout: 120000 },
  async () => {
    const url = isolatedConnection(),
      admin = new Pool({ connectionString: connection }),
      suffix = id(),
      source = "ahq_backup_test_" + suffix,
      target = "ahq_restore_check_" + suffix;
    let pool: Pool | undefined;
    try {
      await admin.query(`CREATE DATABASE ${source}`);
      await admin.query(`CREATE DATABASE ${target}`);
      const a = new URL(url),
        b = new URL(url);
      a.pathname = "/" + source;
      b.pathname = "/" + target;
      pool = new Pool({ connectionString: a.toString() });
      await migrate(pool);
      await pool.query(
        "BEGIN;INSERT INTO organizations VALUES('backup','SYNTHETIC restore company','backup-gm');INSERT INTO memberships VALUES('backup-gm','backup',1,'General Manager');COMMIT;",
      );
      await pool.end();
      pool = undefined;
      const { stdout } = await promisify(execFile)(
        process.execPath,
        ["--import", "tsx", "scripts/staging-restore.ts"],
        {
          env: {
            ...process.env,
            APP_ENV: "staging",
            STAGING_PROJECT_ID: "synthetic-rehearsal",
            PRODUCTION_PROJECT_ID: "synthetic-production-placeholder",
            STAGING_DATABASE_URL: a.toString(),
            STAGING_RESTORE_DATABASE_URL: b.toString(),
          },
          timeout: 110000,
          maxBuffer: 100000,
        },
      );
      assert.equal(JSON.parse(stdout).result, "passed");
      assert.ok(
        JSON.parse(stdout).tables.some(
          (t: any) => t.table === "memberships" && t.count === 1,
        ),
      );
      if (url.password) assert.equal(stdout.includes(url.password), false);
    } finally {
      await pool?.end();
      await admin.query(`DROP DATABASE IF EXISTS ${source} WITH (FORCE)`);
      await admin.query(`DROP DATABASE IF EXISTS ${target} WITH (FORCE)`);
      await admin.end();
    }
  },
);

test(
  "real PostgreSQL permits owner releases under restricted grants and denies rewriting their source snapshot",
  { skip: !connection },
  async () => {
    isolatedConnection();
    const admin = new Pool({ connectionString: connection }),
      schema = "ahq_owner_" + id(),
      role = "ahq_owner_runtime_" + id();
    let runtime: Pool | undefined, server: any;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const pool = new Pool({
      connectionString: connection,
      options: `-c search_path=${schema},public`,
    });
    try {
      await migrate(pool);
      await pool.query(
        "INSERT INTO organizations VALUES('a','SYNTHETIC owner company','gm');INSERT INTO memberships VALUES('gm','a',1,'General Manager');",
      );
      await pool.query(
        "INSERT INTO workspaces(organization_id,data) VALUES($1,$2)",
        [
          "a",
          {
            apartments: [{ id: "u0", unitNumber: "101" }],
            reservations: [],
            channels: [],
          },
        ],
      );
      await pool.query(
        "INSERT INTO owner_property_access(organization_id,owner_uid,owner_email,unit_id,granted_by) VALUES('a','owner','owner@example.test','u0','gm')",
      );
      await admin.query(`CREATE ROLE ${role} NOLOGIN`);
      await pool.query(
        `GRANT USAGE ON SCHEMA ${schema} TO ${role};GRANT SELECT ON ALL TABLES IN SCHEMA ${schema} TO ${role};GRANT UPDATE(role) ON memberships TO ${role};GRANT INSERT,UPDATE ON workspaces TO ${role};GRANT INSERT ON owner_report_releases,audit_events TO ${role};GRANT UPDATE(withdrawn) ON owner_report_releases TO ${role};GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA ${schema} TO ${role};`,
      );
      runtime = new Pool({
        connectionString: connection,
        options: `-c role=${role} -c search_path=${schema},public`,
      });
      const app = express();
      app.use(express.json());
      app.use(
        "/api",
        createCloudRouter(runtime, async (token) => ({
          uid: token,
          email: token === "owner" ? "owner@example.test" : "gm@example.test",
          email_verified: true,
          auth_time: Math.floor(Date.now() / 1000),
          firebase: { sign_in_second_factor: "totp" },
        })),
      );
      app.use((e: any, _q: any, r: any, _n: any) =>
        r
          .status(e instanceof HttpError ? e.status : 500)
          .json({ error: e.message }),
      );
      server = app.listen(0, "127.0.0.1");
      await new Promise<void>((r) => server.once("listening", r));
      const base = `http://127.0.0.1:${server.address().port}/api`;
      const post = async (path: string, body: unknown) =>
        fetch(base + path, {
          method: "POST",
          headers: {
            Authorization: "Bearer gm",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      const release = await post("/connected-evidence/owners/release", {
        unitId: "u0",
        type: "DAILY",
        date: "2026-10-15",
        expectedRevision: 0,
        confirm: true,
      });
      assert.equal(release.status, 201);
      const data = await release.json();
      const get = await fetch(base + "/owner/reports", {
        headers: { Authorization: "Bearer owner" },
      });
      assert.equal(get.status, 200);
      const reports = await get.json();
      assert.equal(reports.reports.length, 1);
      assert.ok(!JSON.stringify(reports).includes("source_snapshot"));
      await assert.rejects(
        runtime.query("UPDATE owner_report_releases SET snapshot='{}'"),
        /permission denied/,
      );
      await assert.rejects(
        pool.query("UPDATE owner_report_releases SET source_snapshot='{}'"),
        /immutable/,
      );
      assert.equal(
        (await post("/connected-evidence/owners/withdraw", { id: data.id }))
          .status,
        200,
      );
      assert.equal(
        (
          await (
            await fetch(base + "/owner/reports", {
              headers: { Authorization: "Bearer owner" },
            })
          ).json()
        ).reports.length,
        0,
      );
    } finally {
      if (server) await new Promise<void>((r) => server.close(() => r()));
      await runtime?.end();
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.query(`DROP ROLE IF EXISTS ${role}`);
      await admin.end();
    }
  },
);
