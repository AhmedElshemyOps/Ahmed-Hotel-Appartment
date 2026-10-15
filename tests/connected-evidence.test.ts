import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { randomUUID } from "node:crypto";
import { marketFixture } from "./helpers/market";
import { createCloudRouter } from "../server/cloud";
import { companySession } from "../server/auth/session";
import { connectedEvidenceRouter } from "../server/features/connected-evidence/routes";
import { HttpError } from "../server/auth/permissions";
import { accountingDemo } from "../src/features/accounting/demo";
import {
  reconcile,
  type AccountingLink,
} from "../src/features/connected-evidence/reconciliation";
import { collectReadOnly } from "../server/integrations/accounting/adapters";
import { applyReservationEvent } from "../server/integrations/pms/webhook";
import { recoverReservationWindow } from "../server/integrations/pms/recovery";
import {
  serviceTasks,
  DEFAULT_GUEST_SERVICE,
} from "../src/features/guest-service/guestService";
import { lockedWorkspace } from "../server/db/workspace";
import type { StoredReservation } from "../src/shared/api/contracts";
const booking = {
  source: "SIMULATED-pms",
  externalId: "SIM-BOOK-1",
  version: 1,
  lastBatch: null,
  data: {
    id: "SIM-ID",
    unitId: "u0",
    checkInDate: "2026-09-01",
    checkOutDate: "2026-09-03",
    bookingDate: "2026-08-01",
    status: "Confirmed",
    dailyRateAED: 5000,
    totalRoomRevenueAED: 10000,
    commissionRatePercent: 10,
    isDemo: true,
    guestName: "SECRET SIMULATED GUEST",
  },
} as StoredReservation;
const claims = async (token: string) => ({
  uid: token === "stale" ? "gm" : token,
  email: token === "owner" ? "owner@example.test" : "gm@example.test",
  email_verified: token !== "unverified",
  auth_time: Math.floor(Date.now() / 1000) - (token === "stale" ? 700 : 0),
  firebase: { sign_in_second_factor: token === "nomfa" ? undefined : "totp" },
});
async function fixture() {
  const f = await marketFixture({ ingest: false });
  const ws = await lockedWorkspace(f.client as any, "a");
  ws.data.reservations = [structuredClone(booking)];
  await f.db.query("UPDATE workspaces SET data=$2 WHERE organization_id=$1", [
    "a",
    ws.data,
  ]);
  await f.db.query(
    "INSERT INTO memberships VALUES('finance','a',4,'Finance Manager')",
  );
  const id = randomUUID(),
    imp = randomUUID(),
    docs = accountingDemo([{ id: "u0", unitNumber: "101" } as any]).documents;
  await f.db.query(
    "INSERT INTO accounting_connections(organization_id,id,config) VALUES($1,$2,$3)",
    [
      "a",
      id,
      { label: "SIMULATED CSV", companyId: "SYNTHETIC-ONLY", provider: "csv" },
    ],
  );
  await f.db.query(
    "INSERT INTO accounting_imports(id,organization_id,connection_id,connection_revision,actor_uid,file_name,file_hash,packet,status) VALUES($1,'a',$2,1,'gm','SIMULATED.csv','hash',$3,'committed')",
    [imp, id, { simulated: true }],
  );
  for (const d of docs) {
    await f.db.query(
      "INSERT INTO accounting_documents(organization_id,connection_id,external_id,source_updated_at,source_hash,document_type,number,posting_date,currency,status,partner_name,total,outstanding,last_import) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
      [
        "a",
        id,
        d.externalId,
        d.sourceUpdatedAt,
        "SIMHASH",
        d.type,
        d.number,
        d.postingDate,
        d.currency,
        d.status,
        d.partnerName,
        d.total,
        d.outstanding,
        imp,
      ],
    );
  }
  const app = express();
  app.use(express.json());
  app.use(
    "/admin-test",
    companySession(f.pool, claims),
    connectedEvidenceRouter(f.pool, async (email) => ({
      uid: "owner",
      email,
      emailVerified: true,
      disabled: false,
    })),
  );
  app.use("/api", createCloudRouter(f.pool, claims));
  app.use((e: any, _q: any, r: any, _n: any) =>
    r
      .status(e instanceof HttpError ? e.status : 500)
      .json({ error: e.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const request = async (path: string, token = "gm", body?: unknown) => {
    const r = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json() };
  };
  const close = async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await f.db.close();
  };
  return { ...f, id, docs, request, close };
}
test("reconciliation is explicit, never approves zero differences, flags source changes and cancelled/draft documents", () => {
  const docs = accountingDemo([
    { id: "u0", unitNumber: "101" } as any,
  ]).documents;
  const l: AccountingLink = {
    documentId: docs[0].externalId,
    reservationSource: booking.source,
    reservationExternalId: booking.externalId,
    purpose: "invoice",
    evidenceNote: "SIMULATED finance review",
    reviewedBy: "finance",
    reviewedDocumentUpdatedAt: docs[0].sourceUpdatedAt,
    reviewedReservationVersion: 1,
  };
  const result = reconcile([booking], docs, [l]);
  assert.equal(result.rows[0].grossDifferenceAED, 500);
  assert.equal(result.rows[0].reviewStatus, "review_required");
  assert.equal(result.unlinkedDocuments.length, 3);
  const changed = reconcile([{ ...booking, version: 2 }], docs, [l]);
  assert.match(changed.rows[0].issues.join(" "), /changed since/);
  const cancelled = reconcile(
    [{ ...booking, data: { ...booking.data, status: "Canceled" } }],
    docs,
    [l],
  );
  assert.equal(cancelled.rows[0].expectedRoomAED, 0);
  const draft = reconcile([booking], [{ ...docs[0], status: "draft" }], [l]);
  assert.equal(draft.rows[0].invoicedAED, 0);
  assert.match(draft.rows[0].issues.join(" "), /excluded/);
  assert.throws(() => reconcile([booking], docs, [l, l]), /twice/);
  const noEvidence = reconcile([booking], docs, []);
  assert.match(noEvidence.rows[0].issues.join(" "), /No Finance-reviewed/);
});
test("Finance links require current role, fresh MFA, scoped sources and single allocation, and unlink is audited", async () => {
  const f = await fixture();
  try {
    const path = "/api/connected-evidence/reconciliation";
    const body = {
      connectionId: f.id,
      documentId: f.docs[0].externalId,
      reservationSource: booking.source,
      reservationExternalId: booking.externalId,
      purpose: "invoice",
      evidenceNote: "SIMULATED reference confirmed by Finance",
    };
    assert.equal((await f.request(path + "/link", "viewer", body)).status, 403);
    assert.equal(
      (await f.request(path + "/link", "revenue", body)).status,
      403,
    );
    assert.equal((await f.request(path + "/link", "stale", body)).status, 401);
    assert.equal((await f.request(path + "/link", "other", body)).status, 404);
    assert.equal(
      (
        await f.request(path + "/link", "finance", {
          ...body,
          purpose: "settlement",
        })
      ).status,
      422,
    );
    assert.equal(
      (await f.request(path + "/link", "finance", body)).status,
      200,
    );
    assert.equal(
      (await f.request(path + "/link", "finance", body)).status,
      409,
    );
    const result = await f.request(path + "/" + f.id, "finance");
    assert.equal(result.status, 200);
    assert.equal(result.data.rows[0].evidence.length, 1);
    assert.equal(result.data.rows[0].grossDifferenceAED, 500);
    assert.equal(
      (
        await f.request(path + "/unlink", "finance", {
          connectionId: f.id,
          documentId: body.documentId,
          reason: "SIMULATED allocation correction",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await f.db.query(
          "SELECT * FROM audit_events WHERE action IN ('reconciliation.link','reconciliation.unlink')",
        )
      ).rows.length,
      2,
    );
  } finally {
    await f.close();
  }
});
test("owner portal separates identities and apartments, requires MFA, exposes sanitized approved snapshots and revokes immediately", async () => {
  const f = await fixture();
  try {
    assert.equal(
      (
        await f.request("/admin-test/owners/grant", "gm", {
          email: "owner@example.test",
          unitId: "u0",
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.request("/api/owner/reports", "owner")).data.reports.length,
      0,
    );
    const preview = await f.request(
      "/api/connected-evidence/owners/preview",
      "gm",
      { unitId: "u0", type: "MONTHLY", date: "2026-09-30" },
    );
    assert.equal(preview.status, 200);
    assert.equal(preview.data.revision, 0);
    assert.equal(
      (
        await f.request("/api/connected-evidence/owners/release", "gm", {
          unitId: "u0",
          type: "MONTHLY",
          date: "2026-09-30",
          expectedRevision: 99,
          confirm: true,
        })
      ).status,
      409,
    );
    const released = await f.request(
      "/api/connected-evidence/owners/release",
      "gm",
      {
        unitId: "u0",
        type: "MONTHLY",
        date: "2026-09-30",
        expectedRevision: 0,
        confirm: true,
      },
    );
    assert.equal(released.status, 201);
    // Another apartment and another company may both have approved releases.
    assert.equal(
      (
        await f.request("/api/connected-evidence/owners/release", "gm", {
          unitId: "u1",
          type: "MONTHLY",
          date: "2026-09-30",
          expectedRevision: 0,
          confirm: true,
        })
      ).status,
      201,
    );
    const otherWorkspace = await lockedWorkspace(f.client as any, "b");
    otherWorkspace.data.apartments = [
      { id: "u0", unitNumber: "PRIVATE OTHER COMPANY" } as any,
    ];
    await f.db.query("UPDATE workspaces SET data=$2 WHERE organization_id=$1", [
      "b",
      otherWorkspace.data,
    ]);
    assert.equal(
      (
        await f.request("/api/connected-evidence/owners/release", "other", {
          unitId: "u0",
          type: "MONTHLY",
          date: "2026-09-30",
          expectedRevision: 0,
          confirm: true,
        })
      ).status,
      201,
    );
    const owner = await f.request("/api/owner/reports", "owner");
    assert.equal(owner.status, 200);
    assert.equal(owner.data.reports.length, 1);
    assert.equal(owner.data.reports[0].snapshot.dataMode, "synthetic");
    const serialized = JSON.stringify(owner.data);
    for (const forbidden of [
      "PRIVATE OTHER COMPANY",
      "SECRET SIMULATED GUEST",
      "SIM-BOOK-1",
      "SIM-ID",
      "approved_by",
      "source_hash",
      "sources",
    ])
      assert.ok(!serialized.includes(forbidden), forbidden);
    assert.equal(
      (await f.request("/api/owner/reports", "someone-else")).data.reports
        .length,
      0,
    );
    assert.equal((await f.request("/api/owner/reports", "nomfa")).status, 403);
    assert.equal((await f.request("/api/owner/reports", "gm")).status, 403);
    assert.equal((await f.request("/api/workspace", "owner")).status, 403);
    assert.equal(
      (
        await f.request("/api/connected-evidence/owners/release", "other", {
          unitId: "not-authorized-unit",
          type: "MONTHLY",
          date: "2026-09-30",
          expectedRevision: 0,
          confirm: true,
        })
      ).status,
      404,
    );
    await assert.rejects(
      f.db.query("UPDATE owner_report_releases SET snapshot='{}' WHERE id=$1", [
        released.data.id,
      ]),
      /immutable/,
    );
    await f.request("/api/connected-evidence/owners/revoke", "gm", {
      email: "owner@example.test",
      unitId: "u0",
    });
    assert.equal(
      (await f.request("/api/owner/reports", "owner")).data.reports.length,
      0,
    );
  } finally {
    await f.close();
  }
});
test("withdrawing an owner release is permanent and historical content stays immutable", async () => {
  const f = await fixture();
  try {
    await f.request("/admin-test/owners/grant", "gm", {
      email: "owner@example.test",
      unitId: "u0",
    });
    const r = await f.request("/api/connected-evidence/owners/release", "gm", {
      unitId: "u0",
      type: "MONTHLY",
      date: "2026-09-30",
      expectedRevision: 0,
      confirm: true,
    });
    assert.equal(
      (
        await f.request("/api/connected-evidence/owners/withdraw", "gm", {
          id: r.data.id,
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.request("/api/owner/reports", "owner")).data.reports.length,
      0,
    );
    await assert.rejects(
      f.db.query(
        "UPDATE owner_report_releases SET withdrawn=false WHERE id=$1",
        [r.data.id],
      ),
      /immutable/,
    );
  } finally {
    await f.close();
  }
});
test("management questions return scoped versioned facts, inspectable evidence, and refuse unsupported questions", async () => {
  const f = await fixture();
  try {
    const q = "/api/connected-evidence/questions";
    assert.equal(
      (await f.request(q, "viewer", { topic: "finance", connectionId: f.id }))
        .status,
      403,
    );
    assert.equal(
      (await f.request(q, "gm", { topic: "predict_profit" })).status,
      422,
    );
    const a = await f.request(q, "gm", {
      topic: "finance",
      connectionId: f.id,
    });
    assert.equal(a.status, 200);
    assert.equal(a.data.facts.length, 4);
    assert.ok(a.data.facts.every((x: any) => x.references.length));
    assert.equal(a.data.liveVerified, false);
    assert.equal(
      (await f.request(q, "other", { topic: "finance", connectionId: f.id }))
        .status,
      404,
    );
    const empty = await f.request(q, "other", { topic: "tomorrow_operations" });
    assert.equal(empty.data.facts.length, 0);
    assert.match(empty.data.limitations.join(" "), /missing evidence/);
    const ev = await f.request("/api/connected-evidence/evidence", "gm", {
      kind: "reservation",
      id: booking.data.id,
    });
    assert.equal(ev.status, 200);
    assert.equal(ev.data.version, 1);
    assert.equal(
      (
        await f.request("/api/connected-evidence/evidence", "other", {
          kind: "reservation",
          id: booking.data.id,
        })
      ).status,
      404,
    );
  } finally {
    await f.close();
  }
});
test("Odoo collector rejects company leakage, repeated pages, invalid windows and cancelled work without invoking writes", async () => {
  const docs = accountingDemo([
    { id: "u0", unitNumber: "101" } as any,
  ]).documents;
  const packet = {
    companyId: "SYNTHETIC-ONLY",
    simulated: true,
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    coverage: "partial" as const,
    documents: docs,
  };
  const query = {
      companyId: "SYNTHETIC-ONLY",
      from: "2026-09-01",
      to: "2026-09-30",
    },
    signal = new AbortController().signal;
  const adapter = {
    provider: "SIMULATED Odoo contract fixture",
    discover: async () => ({
      version: "SIMULATED",
      companies: [{ id: "SYNTHETIC-ONLY", name: "Synthetic test company" }],
      capabilities: ["read"],
    }),
    readOnly: true as const,
    readPage: async () => ({ packet }),
  };
  assert.equal((await collectReadOnly(adapter, query, signal)).length, 1);
  await assert.rejects(
    collectReadOnly(
      { ...adapter, readPage: async () => ({ packet, nextCursor: "same" }) },
      query,
      signal,
    ),
    /repeated/,
  );
  await assert.rejects(
    collectReadOnly(adapter, { ...query, companyId: "different" }, signal),
    /outside/,
  );
  await assert.rejects(
    collectReadOnly(adapter, { ...query, from: "2026-02-30" }, signal),
    /valid/,
  );
  const c = new AbortController();
  c.abort();
  await assert.rejects(collectReadOnly(adapter, query, c.signal), /cancelled/);
});
test("PMS recovery handles missed updates, retries and cancellation without duplicate bookings or operations tasks", async () => {
  const f = await marketFixture({ ingest: false });
  try {
    const stamp = "2026-10-01T10:00:00Z";
    const incoming = {
      externalId: "SIM-RECOVERY",
      unitNumber: "101",
      checkInDate: "2026-11-01",
      checkOutDate: "2026-11-03",
      bookingDate: "2026-10-01",
      status: "Confirmed",
      channel: "Expedia",
      dailyRateAED: 100,
      commissionRatePercent: 10,
      currency: "AED",
      updatedAt: stamp,
    };
    const window = { from: "2026-10-01T00:00:00Z", to: "2026-10-02T00:00:00Z" },
      signal = new AbortController().signal;
    let reads = 0;
    const adapter = {
      provider: "SIMULATED recovery fixture",
      readOnly: true as const,
      readUpdates: async () => {
        reads++;
        return { reservations: [incoming] };
      },
    };
    await recoverReservationWindow(
      f.pool,
      "a",
      "synthetic-pms",
      adapter,
      window,
      signal,
    );
    await recoverReservationWindow(
      f.pool,
      "a",
      "synthetic-pms",
      adapter,
      window,
      signal,
    );
    let ws = await lockedWorkspace(f.client as any, "a");
    assert.equal(ws.data.reservations.length, 1);
    assert.ok(
      serviceTasks(
        ws.data.reservations.map((r) => r.data),
        DEFAULT_GUEST_SERVICE,
        new Date("2026-10-01"),
      ).length,
    );
    await assert.rejects(
      applyReservationEvent(f.pool, "a", "synthetic-pms", {
        eventId: "same-time-conflict",
        reservations: [{ ...incoming, dailyRateAED: 999 }],
      }),
      /same source timestamp/,
    );
    await assert.rejects(
      applyReservationEvent(f.pool, "a", "synthetic-pms", {
        eventId: "duplicate",
        reservations: [incoming, incoming],
      }),
      /Duplicate reservation/,
    );
    await recoverReservationWindow(
      f.pool,
      "a",
      "synthetic-pms",
      {
        ...adapter,
        readUpdates: async () => ({
          reservations: [
            {
              ...incoming,
              status: "Canceled",
              updatedAt: "2026-10-01T11:00:00Z",
            },
          ],
        }),
      },
      window,
      signal,
    );
    ws = await lockedWorkspace(f.client as any, "a");
    assert.equal(ws.data.reservations[0].data.status, "Canceled");
    assert.equal(
      serviceTasks(
        ws.data.reservations.map((r) => r.data),
        DEFAULT_GUEST_SERVICE,
        new Date("2026-10-01"),
      ).length,
      0,
    );
    await assert.rejects(
      recoverReservationWindow(
        f.pool,
        "a",
        "synthetic-pms",
        {
          ...adapter,
          readUpdates: async () => ({ reservations: [], nextCursor: "same" }),
        },
        window,
        signal,
      ),
      /pagination/,
    );
    await assert.rejects(
      recoverReservationWindow(
        f.pool,
        "a",
        "synthetic-pms",
        {
          ...adapter,
          readUpdates: async () => ({
            reservations: [{ ...incoming, updatedAt: "2026-09-01T00:00:00Z" }],
          }),
        },
        window,
        signal,
      ),
      /window/,
    );
    const requiresMapping = {
      ...adapter,
      readUpdates: async () => ({
        reservations: [
          { ...incoming, externalId: "SIM-NEW-UNIT", unitNumber: "999" },
        ],
      }),
    };
    await assert.rejects(
      recoverReservationWindow(
        f.pool,
        "a",
        "synthetic-pms",
        requiresMapping,
        window,
        signal,
      ),
      /validation review/,
    );
    ws = await lockedWorkspace(f.client as any, "a");
    ws.data.apartments.push({ id: "u999", unitNumber: "999" } as any);
    await f.db.query(
      "UPDATE workspaces SET data=$2,revision=revision+1 WHERE organization_id=$1",
      ["a", ws.data],
    );
    // Retain the old failed attempt; a reviewed new attempt can recover it.
    const recovered = await recoverReservationWindow(
      f.pool,
      "a",
      "synthetic-pms",
      requiresMapping,
      { ...window, attemptId: "after-mapping-review" },
      signal,
    );
    assert.equal(recovered.status, "completed");
    ws = await lockedWorkspace(f.client as any, "a");
    assert.equal(ws.data.reservations.length, 2);
    assert.equal(reads, 2);
  } finally {
    await f.db.close();
  }
});
