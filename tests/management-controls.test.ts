import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { marketFixture } from "./helpers/market";
import { createCloudRouter } from "../server/cloud";
import { companySession } from "../server/auth/session";
import { HttpError } from "../server/auth/permissions";
import { uploadsRouter } from "../server/features/management-controls/uploads";
import { inspectFile } from "../server/integrations/storage/private-files";
import { checkedReadinessEvidence } from "../server/features/readiness/private-evidence";
import {
  DEFAULT_OPERATING_POLICY,
  operatingPolicySchema,
  priorities,
  reportSnapshot,
} from "../src/features/management-controls/model";
import {
  serviceTasks,
  DEFAULT_GUEST_SERVICE,
} from "../src/features/guest-service/guestService";
import {
  initialReadiness,
  emptyListing,
} from "../src/features/readiness/model";
import type { Reservation } from "../src/shared/types";
const reservation = {
  id: "SIMULATED-reservation",
  unitId: "u0",
  checkInDate: "2026-11-01",
  checkOutDate: "2026-11-03",
  bookingDate: "2026-10-01",
  status: "Confirmed",
  dailyRateAED: 100,
  commissionRatePercent: 10,
} as Reservation;
const claims = (token: string) =>
  Promise.resolve({
    uid: token === "stale" ? "gm" : token,
    email: token.startsWith("new")
      ? `${token}@example.test`
      : "gm@example.test",
    email_verified: true,
    auth_time: Math.floor(Date.now() / 1000) - (token === "stale" ? 700 : 0),
    firebase: { sign_in_second_factor: "totp" },
  });
async function serve(app: any) {
  app.use((e: any, _q: any, r: any, _n: any) =>
    r
      .status(e instanceof HttpError ? e.status : 500)
      .json({ error: e.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  return { server, base: `http://127.0.0.1:${(server.address() as any).port}` };
}

test("per-apartment deadlines cross midnight, months and years without changing completion identities", () => {
  const custom = {
    ...DEFAULT_OPERATING_POLICY,
    checkIn: "00:30",
    checkOut: "23:45",
    contactOffsets: { prearrival: -2 },
  };
  const settings = {
    ...DEFAULT_GUEST_SERVICE,
    rules: [
      {
        ...DEFAULT_GUEST_SERVICE.rules[0],
        id: "prearrival",
        anchor: "arrival" as const,
        offsetHours: -24,
      },
    ],
  };
  const standard = serviceTasks(
    [reservation],
    settings,
    new Date("2026-10-01"),
  );
  const changed = serviceTasks(
    [reservation],
    settings,
    new Date("2026-10-01"),
    { u0: custom },
  );
  assert.equal(changed[0].dueAt, "2026-10-31T18:30:00.000Z");
  assert.equal(changed[0].id, standard[0].id);
  const next = { ...reservation, checkInDate: "2027-01-01" };
  assert.equal(
    serviceTasks([next], settings, new Date(), { u0: custom })[0].dueAt,
    "2026-12-31T18:30:00.000Z",
  );
  assert.equal(
    operatingPolicySchema.safeParse({ ...custom, checkIn: "24:00" }).success,
    false,
  );
  assert.equal(
    operatingPolicySchema.safeParse({ ...custom, timeZone: "Europe/London" })
      .success,
    false,
  );
  const completed = {
    ...settings,
    completed: { [changed[0].id]: { at: "2026-10-01", by: "gm" } },
  };
  assert.equal(
    serviceTasks([reservation], completed, new Date(), { u0: custom })[0]
      .status,
    "completed",
  );
  assert.equal(
    serviceTasks(
      [{ ...reservation, status: "Canceled" }],
      settings,
      new Date(),
      { u0: custom },
    ).length,
    0,
  );
});
test("priority entries retain source revisions, responsibility and stable IDs; report snapshots compare matching methods", () => {
  const state = initialReadiness();
  state.tasks = [
    {
      id: "t",
      label: "SIMULATED overdue task",
      responsibleUid: "revenue",
      dueOn: "2026-01-01",
      status: "open",
    },
  ];
  state.listings = [emptyListing("Expedia")];
  const list = priorities(
    [{ id: "u0", unitNumber: "101", revision: 3, state }],
    "2026-10-15",
    "gm",
    [
      {
        id: "log",
        area: "accounting",
        status: "failed",
        recordedAt: "2026-10-15",
      },
    ],
    [{ id: "proposal", unitId: "u0", createdAt: "2026-10-15" }],
  );
  assert.equal(list.length, 4);
  assert.ok(
    list.some(
      (p) =>
        p.responsibleUid === "revenue" && p.evidence.includes("revision 3"),
    ),
  );
  assert.equal(new Set(list.map((p) => p.id)).size, list.length);
  const snapshot = reportSnapshot(
    "MONTHLY",
    "2026-11-15",
    [reservation],
    7,
    "2026-11-15T00:00:00Z",
  );
  assert.equal(snapshot.current.roomRevenue, 200);
  assert.equal(snapshot.current.afterCommission, 180);
  assert.equal(snapshot.prior.roomRevenue, 0);
  assert.equal(snapshot.previous.start, "2026-10-01");
  const text = JSON.stringify(snapshot);
  reservation.dailyRateAED = 999;
  assert.equal(JSON.stringify(snapshot), text);
  reservation.dailyRateAED = 100;
  assert.throws(() => reportSnapshot("DAILY", "2026-02-30", [], 0, ""));
});
test("GM controls enforce scope, MFA, revision locking, immutable reports, invitation seats and immediate access removal", async () => {
  const f = await marketFixture({ ingest: false }),
    app = express();
  app.use(express.json());
  app.use("/api", createCloudRouter(f.pool, claims));
  const { server, base } = await serve(app);
  const call = (p: string, uid = "gm", body?: unknown) =>
    fetch(base + "/api" + p, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${uid}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const invitation = (n: number) => ({
    email: `new${n}@example.test`,
    displayName: `SIMULATED Staff ${n}`,
    role: "Read-Only Viewer",
    capabilities: ["operations"],
  });
  try {
    assert.equal((await call("/management", "revenue")).status, 403);
    let snapshot = await (await call("/management")).json();
    assert.equal(snapshot.apartments.length, 40);
    const readiness = initialReadiness();
    readiness.tasks = [
      {
        id: "priority-task",
        label: "SIMULATED source review",
        responsibleUid: "revenue",
        dueOn: "2026-01-01",
        status: "open",
      },
    ];
    await f.db.query(
      "INSERT INTO readiness_units(organization_id,unit_id,revision,data) VALUES('a','u0',4,$1)",
      [readiness],
    );
    const evidence = await call("/management/evidence/readiness/u0");
    assert.equal(evidence.status, 200);
    assert.equal(((await evidence.json()) as any).revision, 4);
    assert.equal(
      (await call("/management/evidence/readiness/u0", "other")).status,
      404,
    );
    snapshot = await (await call("/management")).json();
    assert.ok(
      snapshot.priorities.some(
        (p: any) => p.source.id === "u0" && p.evidence.includes("revision 4"),
      ),
    );

    const body = {
      unitId: "u0",
      revision: snapshot.revision,
      policy: { ...DEFAULT_OPERATING_POLICY, checkIn: "17:15" },
    };
    assert.equal(
      (await call("/management/settings", "stale", body)).status,
      401,
    );
    assert.equal(
      (await call("/management/settings", "other", body)).status,
      404,
    );
    assert.equal((await call("/management/settings", "gm", body)).status, 200);
    assert.equal((await call("/management/settings", "gm", body)).status, 409);
    assert.equal(
      (
        await call("/management/settings", "gm", {
          ...body,
          revision: body.revision + 1,
          policy: { ...body.policy, contactOffsets: { unknown: 2 } },
        })
      ).status,
      422,
    );
    const ws = (
      await f.db.query<any>(
        "SELECT data FROM workspaces WHERE organization_id='a'",
      )
    ).rows[0].data;
    ws.reservations = [
      {
        source: "SIMULATED",
        externalId: "r",
        version: 1,
        lastBatch: null,
        data: reservation,
      },
    ];
    await f.db.query<any>(
      "UPDATE workspaces SET data=$1 WHERE organization_id='a'",
      [ws],
    );
    const report = await (
      await call("/management/reports", "gm", {
        type: "MONTHLY",
        date: "2026-11-15",
      })
    ).json();
    assert.equal(report.snapshot.current.roomRevenue, 200);
    ws.reservations[0].data.dailyRateAED = 999;
    await f.db.query<any>(
      "UPDATE workspaces SET data=$1 WHERE organization_id='a'",
      [ws],
    );
    assert.equal(
      (await (await call(`/management/reports/${report.id}`)).json()).snapshot
        .current.roomRevenue,
      200,
    );
    assert.equal(
      (await call(`/management/reports/${report.id}`, "other")).status,
      404,
    );
    await assert.rejects(
      f.db.query<any>(
        "UPDATE management_reports SET source_hash='bad' WHERE id=$1",
        [report.id],
      ),
    );
    assert.equal(
      (await call("/management/invitations", "stale", invitation(1))).status,
      401,
    );
    assert.equal(
      (
        await call("/management/invitations", "gm", {
          ...invitation(1),
          role: "General Manager",
        })
      ).status,
      422,
    );
    const first = await (
      await call("/management/invitations", "gm", invitation(1))
    ).json();
    assert.ok(first.token);
    assert.equal(
      (await call("/management/invitations", "gm", invitation(1))).status,
      409,
    );
    assert.equal(
      (await call("/team/accept", "new2", { token: first.token })).status,
      403,
    );
    assert.equal(
      (await call("/team/accept", "new1", { token: first.token })).status,
      200,
    );
    assert.equal(
      (await call("/team/accept", "new1", { token: first.token })).status,
      410,
    );
    assert.equal((await call("/workspace", "new1")).status, 200);
    assert.equal(
      (
        await call("/management/members/permissions", "new1", {
          uid: "revenue",
          role: "Finance Manager",
          capabilities: [],
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call("/management/members/permissions", "gm", {
          uid: "gm",
          role: "Finance Manager",
          capabilities: [],
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await call("/management/members/permissions", "gm", {
          uid: "new1",
          role: "Revenue Manager",
          capabilities: ["operations"],
        })
      ).status,
      200,
    );
    assert.equal(
      ((await (await call("/workspace", "new1")).json()) as any).actor.role,
      "Revenue Manager",
    );

    assert.equal(
      (
        await f.db.query<any>(
          "SELECT capability FROM readiness_grants WHERE uid='new1'",
        )
      ).rows[0].capability,
      "operations",
    );
    const tokens = [];
    for (let i = 2; i <= 7; i++) {
      const r = await call("/management/invitations", "gm", invitation(i));
      assert.equal(r.status, 200);
      tokens.push(await r.json());
    }
    assert.equal(
      (await call("/management/invitations", "gm", invitation(8))).status,
      409,
    );
    snapshot = await (await call("/management")).json();
    assert.equal(JSON.stringify(snapshot).includes(first.token), false);
    assert.equal(
      (await call(`/management/invitations/${tokens[0].id}/revoke`, "gm", {}))
        .status,
      200,
    );
    assert.equal(
      (await call("/team/accept", "new2", { token: tokens[0].token })).status,
      410,
    );
    await f.db.query<any>(
      "UPDATE team_invitations SET expires_at=now()-interval '1 minute' WHERE id=$1",
      [tokens[1].id],
    );
    assert.equal(
      (await call("/team/accept", "new3", { token: tokens[1].token })).status,
      410,
    );
    assert.equal(
      (await call("/management/members/remove", "gm", { uid: "gm" })).status,
      422,
    );
    assert.equal(
      (await call("/management/members/remove", "gm", { uid: "other" })).status,
      404,
    );
    assert.equal(
      (await call("/management/members/remove", "gm", { uid: "new1" })).status,
      200,
    );
    assert.equal((await call("/workspace", "new1")).status, 403);
    assert.equal(
      (
        await f.db.query<any>(
          "SELECT count(*)::int AS n FROM memberships WHERE organization_id='a' AND role='General Manager'",
        )
      ).rows[0].n,
      1,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await f.db.close();
    reservation.dailyRateAED = 100;
  }
});
test("private uploads inspect bytes, quarantine scanner failures, block cross-company downloads and invalidate deleted evidence", async () => {
  const f = await marketFixture({ ingest: false }),
    objects = new Map<string, Buffer>();
  let scan: "clean" | "infected" | "unavailable" = "clean";
  const store = {
    put: async (k: string, b: Buffer) => {
      objects.set(k, b);
    },
    get: async (k: string) => {
      const b = objects.get(k);
      if (!b) throw Error("missing");
      return b;
    },
    remove: async (k: string) => {
      objects.delete(k);
    },
  };
  const app = express();
  app.use(express.json({ limit: "3mb" }));
  app.use(companySession(f.pool, claims));
  app.use(
    "/files",
    uploadsRouter(f.pool, {
      store,
      scanner: async () => {
        if (scan === "unavailable") throw Error("SIMULATED scanner outage");
        return scan;
      },
    }),
  );
  const { server, base } = await serve(app);
  const call = (p: string, uid = "gm", body?: unknown) =>
    fetch(base + p, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${uid}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const pdf = Buffer.from(
    "%PDF-1.4\nSIMULATED scanner fixture; not a financial record.\n%%EOF",
  );
  const packet = {
    unitId: "u0",
    category: "document",
    name: "SIMULATED-document.pdf",
    base64: pdf.toString("base64"),
  };
  try {
    assert.equal((await call("/files", "viewer", packet)).status, 403);
    assert.equal((await call("/files", "other", packet)).status, 404);
    assert.equal(
      (
        await call("/files", "gm", {
          ...packet,
          base64: Buffer.from("<script>bad</script>").toString("base64"),
        })
      ).status,
      422,
    );
    const clean = await (await call("/files", "gm", packet)).json();
    assert.equal(clean.status, "clean");
    assert.equal(
      (await call(`/files/${clean.id}/download`, "other")).status,
      404,
    );
    assert.equal(
      (await call(`/files/${clean.id}/download`, "viewer")).status,
      403,
    );
    const download = await call(`/files/${clean.id}/download`);
    assert.equal(download.status, 200);
    assert.match(download.headers.get("content-disposition")!, /^attachment/);
    const state = initialReadiness();
    state.documents = [
      {
        id: "d",
        requirementId: "r",
        category: "permit",
        authority: "SIMULATED",
        reference: "TEST",
        issuedOn: "2026-01-01",
        expiresOn: "2099-12-31",
        renewalOn: "2099-01-01",
        responsibleUid: "gm",
        evidenceUrl: `/api/files/${clean.id}/download`,
        notes: "",
        status: "verified",
        verifiedBy: "gm",
        verifiedAt: new Date().toISOString(),
      },
    ];
    assert.equal(
      (await checkedReadinessEvidence(await f.pool.connect(), "a", "u0", state))
        .documents[0].status,
      "verified",
    );
    assert.equal(
      (await call(`/files/${clean.id}/delete`, "gm", {})).status,
      200,
    );
    assert.equal((await call(`/files/${clean.id}/download`)).status, 409);
    assert.equal(
      (await checkedReadinessEvidence(await f.pool.connect(), "a", "u0", state))
        .documents[0].status,
      "unverified",
    );
    scan = "unavailable";
    const quarantined = await (await call("/files", "gm", packet)).json();
    assert.equal(quarantined.status, "quarantined");
    assert.equal((await call(`/files/${quarantined.id}/download`)).status, 409);
    scan = "clean";
    assert.equal(
      (await call(`/files/${quarantined.id}/rescan`, "gm", {})).status,
      200,
    );
    assert.equal((await call(`/files/${quarantined.id}/download`)).status, 200);
    scan = "infected";
    const rejected = await (await call("/files", "gm", packet)).json();
    assert.equal(rejected.status, "rejected");
    assert.equal((await call(`/files/${rejected.id}/download`)).status, 409);
    const image = await sharp({
      create: { width: 24, height: 20, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    const inspected = await inspectFile(image, "photo");
    assert.equal(inspected.width, 24);
    assert.equal(inspected.mime, "image/jpeg");
    await assert.rejects(inspectFile(Buffer.from("not an image"), "photo"));
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await f.db.close();
  }
});
test("staging checks do not expose secrets or claim actual MFA and restore acceptance", () => {
  const marker = "SIMULATED-DO-NOT-PRINT";
  const output = execFileSync(
    process.execPath,
    ["--import", "tsx", "scripts/staging-check.ts"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        APP_ENV: "staging",
        APP_MODE: "cloud",
        NODE_ENV: "production",
        STAGING_PROJECT_ID: "practice",
        STAGING_FIREBASE_PROJECT_ID: "practice",
        PRODUCTION_PROJECT_ID: "production",
        STAGING_DATABASE_URL: marker,
        STAGING_PRIVATE_BUCKET: marker,
        GOOGLE_CLOUD_PROJECT: "practice",
        DATABASE_URL: marker,
        PRIVATE_UPLOAD_BUCKET: marker,
        FIREBASE_AUTH_DOMAIN: "practice.firebaseapp.com",
        FIREBASE_WEB_API_KEY: marker,
      },
    },
  );
  assert.equal(output.includes(marker), false);
  const report = JSON.parse(output);
  assert.equal(report.readyToVerify, true);
  assert.ok(
    report.notVerified.includes("Real MFA and invited-account onboarding"),
  );
});
