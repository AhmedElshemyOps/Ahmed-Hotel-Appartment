import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import express from "express";
import { commitBatch, createCloudRouter } from "../server/cloud";
import { HttpError, type Actor } from "../server/auth/permissions";
import { lockedWorkspace } from "../server/db/workspace";
import { applyReservationEvent, verifyWebhook } from "../server/integrations/pms/webhook";
import { createHmac } from "node:crypto";
import { previewPms, type Mapping } from "../server/integrations/pms/import";

export async function fixture() {
  const db = new PGlite();
  await db.exec(
    await readFile(
      new URL("../migrations/001_cloud.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL("../migrations/002_integrations.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    "BEGIN; INSERT INTO organizations VALUES('a','Company A','gm'); INSERT INTO memberships VALUES('gm','a',1,'General Manager'); INSERT INTO memberships VALUES('viewer','a',2,'Read-Only Viewer'); COMMIT;",
  );
  const client = {
    query: (sql: string, params?: any[]) => db.query(sql, params),
    release: () => {},
  };
  const pool = {
    query: client.query,
    connect: async () => client,
  } as unknown as Pool;
  const actor = {
    uid: "gm",
    organization_id: "a",
    role: "General Manager",
  } as Actor;
  const ws = await lockedWorkspace(client as any, "a");
  ws.data.apartments = [{ id: "u", unitNumber: "101" } as any];
  await db.query("UPDATE workspaces SET data=$1 WHERE organization_id=$2", [
    ws.data,
    "a",
  ]);
  return { db, pool, actor, client };
}
async function batch(f: Awaited<ReturnType<typeof fixture>>, rate = 100) {
  const ws = await lockedWorkspace(f.client as any, "a");
  const fields = [
    "externalId",
    "unitNumber",
    "checkInDate",
    "checkOutDate",
    "bookingDate",
    "status",
    "channel",
    "dailyRateAED",
    "commissionRatePercent",
    "currency",
  ];
  const mapping = Object.fromEntries(fields.map((x) => [x, x])) as Mapping;
  const csv =
    fields.join(",") +
    "\nr1,101,2026-10-01,2026-10-03,2026-09-01,Completed,Expedia," +
    rate +
    ",18,AED";
  const preview = previewPms(
    csv,
    mapping,
    "lodgify-a",
    ws.data.apartments,
    ws.data.channels,
    ws.data.reservations,
  );
  const id = randomUUID();
  await f.db.query(
    "INSERT INTO import_batches(id,organization_id,actor_uid,source,file_name,file_hash,revision,preview) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [id, "a", "gm", "lodgify-a", "file.csv", "hash", ws.revision, preview],
  );
  return id;
}

test("PostgreSQL constraints enforce one GM and ten seats; sole GM cannot be removed", async () => {
  const f = await fixture();
  try {
    await assert.rejects(() =>
      f.db.exec(
        "INSERT INTO memberships VALUES('othergm','a',3,'General Manager')",
      ),
    );
    await assert.rejects(() =>
      f.db.exec(
        "INSERT INTO memberships VALUES('eleven','a',11,'Read-Only Viewer')",
      ),
    );
    await assert.rejects(() =>
      f.db.exec("DELETE FROM memberships WHERE uid='gm'"),
    );
    await assert.rejects(() =>
      f.db.exec("UPDATE organizations SET gm_uid='viewer' WHERE id='a'"),
    );
    await f.db.exec(
      "BEGIN; SET CONSTRAINTS ALL DEFERRED; UPDATE memberships SET seat=CASE WHEN uid='gm' THEN 2 ELSE 1 END,role=CASE WHEN uid='gm' THEN 'Read-Only Viewer' ELSE 'General Manager' END WHERE uid IN ('gm','viewer'); UPDATE organizations SET gm_uid='viewer' WHERE id='a'; COMMIT;",
    );
  } finally {
    await f.db.close();
  }
});
test("commit retry is idempotent, updates replace and rollback restores exact older version", async () => {
  const f = await fixture();
  try {
    const id = await batch(f);
    await commitBatch(f.pool, f.actor, id);
    await commitBatch(f.pool, f.actor, id);
    let ws = await lockedWorkspace(f.client as any, "a");
    assert.equal(ws.data.reservations.length, 1);
    assert.equal(ws.data.reservations[0].data.dailyRateAED, 100);
    const newer = await batch(f, 150);
    await commitBatch(f.pool, f.actor, newer);
    await assert.rejects(
      () => commitBatch(f.pool, f.actor, id, true),
      /updated after/,
    );
    await commitBatch(f.pool, f.actor, newer, true);
    ws = await lockedWorkspace(f.client as any, "a");
    assert.equal(ws.data.reservations[0].data.dailyRateAED, 100);
    await commitBatch(f.pool, f.actor, id, true);
    await commitBatch(f.pool, f.actor, id, true);
    ws = await lockedWorkspace(f.client as any, "a");
    assert.equal(ws.data.reservations.length, 0);
    assert.equal(
      (await f.db.query("SELECT * FROM audit_events")).rows.length,
      4,
    );
  } finally {
    await f.db.close();
  }
});
test("stale previews, cross-company IDs and reader mutations are rejected", async () => {
  const f = await fixture();
  try {
    const a = await batch(f),
      b = await batch(f, 200);
    await commitBatch(f.pool, f.actor, a);
    await assert.rejects(() => commitBatch(f.pool, f.actor, b), /data changed/);
    await assert.rejects(
      () => commitBatch(f.pool, { ...f.actor, organization_id: "b" }, a),
      /Membership changed/,
    );
    await assert.rejects(
      () =>
        commitBatch(
          f.pool,
          { uid: "viewer", organization_id: "a", role: "Read-Only Viewer" },
          a,
        ),
      /role/,
    );
  } finally {
    await f.db.close();
  }
});
test("HTTP routes deny anonymous, unverified, missing-MFA, revoked and unassigned identities", async () => {
  const f = await fixture();
  const app = express();
  app.use(express.json());
  const claims: Record<string, any> = {
    mfa: {
      uid: "gm",
      email_verified: true,
      firebase: { sign_in_second_factor: "totp" },
    },
    plain: { uid: "gm", email_verified: true },
    unverified: {
      uid: "gm",
      email_verified: false,
      firebase: { sign_in_second_factor: "totp" },
    },
    unknown: {
      uid: "unknown",
      email_verified: true,
      firebase: { sign_in_second_factor: "totp" },
    },
    viewer: {
      uid: "viewer",
      email_verified: true,
      firebase: { sign_in_second_factor: "totp" },
    },
  };
  app.use(
    "/api",
    createCloudRouter(f.pool, async (t) => {
      if (!claims[t]) throw Error("revoked");
      return { auth_time: Math.floor(Date.now() / 1000), ...claims[t] };
    }),
  );
  app.use((e: any, _req: any, res: any, _next: any) =>
    res
      .status(e instanceof HttpError ? e.status : 500)
      .json({ error: e.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const url = "http://127.0.0.1:" + (server.address() as any).port;
  try {
    for (const [token, status] of [
      ["", 401],
      ["revoked", 401],
      ["plain", 403],
      ["unverified", 403],
      ["unknown", 403],
      ["mfa", 200],
    ]) {
      const r = await fetch(url + "/api/workspace", {
        headers: token ? { Authorization: "Bearer " + token } : {},
      });
      assert.equal(r.status, status, String(token));
    }
    const denied = await fetch(url + "/api/channels", {
      method: "POST",
      headers: {
        Authorization: "Bearer viewer",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Attack",
        active: true,
        aliases: [],
        role: "General Manager",
      }),
    });
    assert.equal(denied.status, 403);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await f.db.close();
  }
});

test("signed live events deduplicate, ignore older records and update tomorrow without manual entry", async () => {
  const f = await fixture();
  try {
    const row = {
      externalId: "auto1",
      unitNumber: "101",
      checkInDate: "2026-10-16",
      checkOutDate: "2026-10-18",
      bookingDate: "2026-10-15",
      status: "Confirmed",
      channel: "Expedia",
      dailyRateAED: 500,
      commissionRatePercent: 18,
      currency: "AED",
      updatedAt: "2026-10-15T09:00:00Z",
    };
    const event = { eventId: "evt1", reservations: [row] };
    const first = await applyReservationEvent(
      f.pool,
      "a",
      "pms-a",
      event,
      new Date("2026-10-15T12:00:00Z"),
    );
    assert.equal(first.status, "applied");
    assert.equal(
      (
        await applyReservationEvent(
          f.pool,
          "a",
          "pms-a",
          event,
          new Date("2026-10-15T12:00:00Z"),
        )
      ).replayed,
      true,
    );
    const old = await applyReservationEvent(
      f.pool,
      "a",
      "pms-a",
      {
        eventId: "evt-old",
        reservations: [
          { ...row, status: "Canceled", updatedAt: "2026-10-15T08:00:00Z" },
        ],
      },
      new Date("2026-10-15T12:00:00Z"),
    );
    assert.equal(old.status, "ignored");
    let ws = await lockedWorkspace(f.client as any, "a");
    assert.equal(ws.data.reservations[0].data.status, "Confirmed");
    await applyReservationEvent(
      f.pool,
      "a",
      "pms-a",
      {
        eventId: "evt2",
        reservations: [
          { ...row, status: "Canceled", updatedAt: "2026-10-15T10:00:00Z" },
        ],
      },
      new Date("2026-10-15T12:00:00Z"),
    );
    ws = await lockedWorkspace(f.client as any, "a");
    assert.equal(ws.data.reservations.length, 1);
    assert.equal(ws.data.reservations[0].data.status, "Canceled");
    const review = await applyReservationEvent(
      f.pool,
      "a",
      "pms-a",
      {
        eventId: "evt3",
        reservations: [
          { ...row, unitNumber: "unknown", updatedAt: "2026-10-15T11:00:00Z" },
        ],
      },
      new Date("2026-10-15T12:00:00Z"),
    );
    assert.equal(review.status, "review_required");
  } finally {
    await f.db.close();
  }
});
test("webhook signature checks raw bytes, timestamp expiry and tampering", () => {
  const raw = Buffer.from('{"eventId":"1"}'),
    stamp = String(Math.floor(Date.now() / 1000)),
    secret = "x".repeat(40);
  const signature =
    "sha256=" +
    createHmac("sha256", secret)
      .update(stamp + ".")
      .update(raw)
      .digest("hex");
  assert.equal(verifyWebhook(raw, stamp, signature, secret), true);
  assert.equal(
    verifyWebhook(Buffer.from("{}"), stamp, signature, secret),
    false,
  );
  assert.equal(
    verifyWebhook(raw, stamp, signature, secret, Date.now() + 600000),
    false,
  );
});
