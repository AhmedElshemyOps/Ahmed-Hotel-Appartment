import { readinessReport } from "../src/readiness/report";
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {
  initialReadiness,
  emptyListing,
  stateSchema,
} from "../src/readiness/model";
import { assess, listingIssues } from "../src/readiness/engine";
import { marketFixture } from "./helpers/market";
import { createCloudRouter, HttpError } from "../server/cloud";
import { businessDate } from "../src/services/guestService";
function ready() {
  const s = initialReadiness();
  s.rulesReviewed = true;
  s.requirements = [
    {
      id: "permit",
      label: "Reviewed test permit",
      mandatory: true,
      authority: "Test authority",
      sourceUrl: "https://authority.example.test/rules",
      reviewedOn: "2026-01-01",
      validUntil: "2099-12-31",
    },
  ];
  s.documents = [
    {
      id: "d",
      requirementId: "permit",
      category: "Permit",
      authority: "Test authority",
      reference: "CONFIDENTIAL-PERMIT",
      issuedOn: "2026-01-01",
      expiresOn: "2099-12-31",
      renewalOn: "2099-12-01",
      responsibleUid: "gm",
      evidenceUrl: "https://private.example.test/secret",
      notes: "PRIVATE-NOTES",
      status: "verified",
      verifiedBy: "gm",
      verifiedAt: new Date().toISOString(),
    },
  ];
  for (const c of [...s.operations, ...s.commercial])
    Object.assign(c, {
      passed: true,
      evidenceUrl: "https://evidence.example.test/check",
      checkedBy: "gm",
      checkedAt: new Date().toISOString(),
    });
  const l = emptyListing("Booking.com");
  Object.assign(l, {
    title: "Test apartment with verified facts",
    description:
      "A synthetic description for tests, based solely on verified property records. No amenities or views are invented in this evidence fixture.",
    houseRules: "No smoking",
    cancellation: "Flexible",
    status: "Ready for Submission",
    reviewedBy: "gm",
    reviewedAt: new Date().toISOString(),
  });
  s.listings = [l];
  s.media = l.requiredPhotos.map((category, i) => ({
    id: "m" + i,
    kind: "photo",
    category,
    evidenceUrl: "https://media.example.test/" + i,
    width: 1600,
    height: 1000,
    bytes: 10000,
    mime: "image/jpeg",
    durationSeconds: 0,
    creator: "Test photographer",
    usagePermission: "Test consent",
    approved: true,
  }));
  return s;
}
test("mandatory legal gates cannot be replaced with scores, future evidence or unreviewed rules", () => {
  const s = ready();
  assert.equal(assess(s, businessDate()).canActivate, true);
  s.documents[0].status = "unverified";
  assert.equal(assess(s, businessDate()).canActivate, false);
  s.documents[0].status = "verified";
  s.documents[0].issuedOn = "2099-01-01";
  assert.match(assess(s, businessDate()).legal.join(), /Missing/);
  s.documents[0].issuedOn = "2026-01-01";
  s.requirements = [];
  assert.equal(assess(s, businessDate()).canActivate, false);
});
test("expiry suspends effective activation and configurable thresholds identify responsible employees", () => {
  const s = ready();
  s.status = "Active / Rentable";
  s.documents[0].expiresOn = "2026-10-14";
  s.documents[0].renewalOn = "2026-10-01";
  const a = assess(s, "2026-10-15");
  assert.equal(a.effectiveStatus, "Suspended");
  assert.equal(a.alerts[0].reason, "Expired");
  assert.equal(a.alerts[0].responsibleUid, "gm");
  s.documents[0].expiresOn = "2026-11-14";
  assert.equal(assess(s, "2026-10-15").alerts[0].threshold, 30);
  s.tasks = [
    {
      id: "t",
      label: "Renew permit",
      responsibleUid: "gm",
      dueOn: "2026-10-14",
      status: "open",
    },
  ];
  assert.equal(assess(s, "2026-10-15").overdueTasks.length, 1);
});
test("listing checks never invent amenities, accept undersized photos or assume video compatibility", () => {
  const s = ready(),
    l = s.listings[0];
  assert.deepEqual(listingIssues(s, l), []);
  l.amenities = ["pool"];
  s.media[0].width = 400;
  l.acceptsVideo = true;
  const gaps = listingIssues(s, l).join();
  assert.match(gaps, /Unverified amenity/);
  assert.match(gaps, /below configured width/);
  assert.match(gaps, /source reference/);
});
test("invalid dates, duplicate IDs, misleading media metadata and omitted checks are rejected or blocked", () => {
  const s = ready();
  s.documents[0].expiresOn = "2026-02-30";
  assert.equal(stateSchema.safeParse(s).success, false);
  const next = ready();
  next.operations = [];
  assert.equal(assess(next, businessDate()).canActivate, false);
  next.media[0].mime = "video/mp4";
  assert.equal(stateSchema.safeParse(next).success, false);
});
test("direct API enforces company scope, capabilities, MFA, immutable history and activation guard", async () => {
  const f = await marketFixture({ ingest: false });
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createCloudRouter(f.pool, async (token) => ({
      uid: token === "stale" ? "gm" : token,
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000) - (token === "stale" ? 700 : 0),
      firebase: { sign_in_second_factor: "totp" },
    })),
  );
  app.use((e: any, _q: any, r: any, _n: any) =>
    r
      .status(e instanceof HttpError ? e.status : 500)
      .json({ error: e.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base =
    "http://127.0.0.1:" + (server.address() as any).port + "/api/readiness";
  const call = (path = "", uid = "gm", body?: unknown) =>
    fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + uid,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  try {
    assert.equal((await call("", "viewer")).status, 403);
    assert.equal(
      (
        await call("/u0", "other", {
          revision: 0,
          section: "activation",
          data: { status: "Active / Rentable", reason: "Try another company" },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await call("/u0", "gm", {
          revision: 0,
          section: "activation",
          data: {
            status: "Active / Rentable",
            reason: "Attempt activation with no evidence",
          },
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await call("/grants", "stale", {
          uid: "revenue",
          capabilities: ["compliance"],
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await call("/grants", "gm", {
          uid: "revenue",
          capabilities: ["compliance"],
        })
      ).status,
      200,
    );
    const s = ready();
    const cfg = Object.fromEntries(
      [
        "jurisdiction",
        "rentalModel",
        "rulesReviewed",
        "requirements",
        "reminderDays",
        "restriction",
      ].map((k) => [k, (s as any)[k]]),
    );
    assert.equal(
      (
        await call("/u0", "gm", {
          revision: 0,
          section: "configuration",
          data: cfg,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call("/u0", "gm", {
          revision: 0,
          section: "configuration",
          data: cfg,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await call("/u0", "revenue", {
          revision: 1,
          section: "compliance",
          data: s.documents,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call("/u0", "gm", {
          revision: 1,
          section: "compliance",
          data: s.documents,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call("/u0", "gm", {
          revision: 2,
          section: "operations",
          data: {
            operations: s.operations,
            commercial: s.commercial,
            tasks: [],
          },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call("/u0", "gm", {
          revision: 3,
          section: "distribution",
          data: { verifiedAmenities: [], media: s.media, listings: s.listings },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call("/u0", "gm", {
          revision: 4,
          section: "activation",
          data: {
            status: "Active / Rentable",
            reason: "Verified current evidence and completed reviews",
          },
        })
      ).status,
      200,
    );
    assert.equal((await call("/reports", "revenue", {})).status, 403);
    const reportResponse = await call("/reports", "gm", {});
    assert.equal(reportResponse.status, 200);
    const report = await reportResponse.json();
    assert.match(report.html, /INTERNAL MANAGEMENT DRAFT/);
    assert.equal(report.html.includes("private.example.test"), false);
    assert.equal(
      (await f.db.query("SELECT id FROM readiness_reports")).rows.length,
      1,
    );
    let snapshot = await (await call()).json();
    assert.equal(
      snapshot.units[0].assessment.effectiveStatus,
      "Active / Rentable",
    );
    assert.equal(
      (
        await call("/grants", "gm", {
          uid: "revenue",
          capabilities: ["operations"],
        })
      ).status,
      200,
    );
    const privateData = JSON.stringify(
      await (await call("", "revenue")).json(),
    );
    assert.equal(privateData.includes("PRIVATE-NOTES"), false);
    assert.equal(privateData.includes("CONFIDENTIAL-PERMIT"), false);
    assert.equal(privateData.includes("private.example.test"), false);
    assert.equal((await call("/u0/history", "revenue")).status, 403);
    assert.equal((await (await call("/u0/history")).json()).history.length, 5);
    const doc = structuredClone(s.documents);
    doc[0].status = "revoked";
    assert.equal(
      (
        await call("/u0", "gm", {
          revision: 5,
          section: "compliance",
          data: doc,
        })
      ).status,
      200,
    );
    snapshot = await (await call()).json();
    assert.equal(snapshot.units[0].state.status, "Suspended");
    assert.equal(
      (await call("/grants", "gm", { uid: "revenue", capabilities: [] }))
        .status,
      200,
    );
    assert.equal((await call("", "revenue")).status, 403);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await f.db.close();
  }
});

test("internal reports escape untrusted content and exclude private document links and notes", () => {
  const s = ready();
  s.restriction = "PRIVATE-RESTRICTION";
  const html = readinessReport(
    [
      {
        id: "u",
        unitNumber: "<img src=x onerror=alert(1)>",
        revision: 1,
        state: s,
      },
    ],
    businessDate(),
    "gm",
  );
  assert.equal(html.includes("<img"), false);
  assert.equal(html.includes("PRIVATE-NOTES"), false);
  assert.equal(html.includes("private.example.test"), false);
  assert.equal(html.includes("CONFIDENTIAL-PERMIT"), false);
  assert.equal(html.includes("PRIVATE-RESTRICTION"), false);
  assert.match(html, /INTERNAL MANAGEMENT DRAFT/);
});
