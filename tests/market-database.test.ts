import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import express from "express";
import { marketFixture, queryFor } from "./helpers/market";
import { transaction } from "../server/db/transaction";
import { createCloudRouter } from "../server/cloud";
import { HttpError } from "../server/auth/permissions";
import {
  loadDataset,
  propertyAccess,
  ingestPacket,
  saveProfile,
} from "../server/features/market/repository";
import {
  createRecommendation,
  decideRecommendation,
} from "../server/features/market/routes";
import { runMarketWorkerOnce } from "../server/features/market/worker";
import { encryptToken, decryptToken } from "../server/integrations/google/routes";

test("normalized registry round-trips characteristics and appends profile correction history", async () => {
  const f = await marketFixture();
  try {
    let data = await loadDataset(f.client as any, "a", f.propertyId);
    assert.equal(data.profiles[0].location.city, "Abu Dhabi");
    assert.deepEqual(data.profiles[0].characteristics.amenities, [
      "balcony",
      "gym",
      "parking",
      "pool",
    ]);
    assert.equal(
      data.profiles[0].location.buildingName,
      f.profile.location.buildingName,
    );
    assert.equal(data.policies[0].version, 1);
    assert.equal(data.rates.length, 30);
    const changed = structuredClone(f.profile);
    changed.characteristics.view = "waterfront";
    await transaction(f.pool, (db) => saveProfile(db, f.gm, changed));
    data = await loadDataset(f.client as any, "a", f.propertyId);
    assert.equal(data.profiles[0].characteristics.view, "waterfront");
    assert.equal(
      (await f.db.query<any>("SELECT * FROM market_profile_history")).rows
        .length,
      2,
    );
  } finally {
    await f.db.close();
  }
});
test("market property grants are deny-by-default and never allow cross-company access", async () => {
  const f = await marketFixture({ ingest: false });
  try {
    await assert.rejects(
      () =>
        transaction(f.pool, (db) =>
          propertyAccess(db, f.revenue, f.propertyId),
        ),
      /not permitted/,
    );
    await f.db.query<any>(
      "INSERT INTO market_property_grants VALUES($1,$2,$3,$4)",
      ["a", f.propertyId, "revenue", "read"],
    );
    await transaction(f.pool, (db) =>
      propertyAccess(db, f.revenue, f.propertyId),
    );
    await assert.rejects(
      () =>
        transaction(f.pool, (db) =>
          propertyAccess(db, f.revenue, f.propertyId, true),
        ),
      /not permitted/,
    );
    await assert.rejects(
      () =>
        transaction(f.pool, (db) =>
          propertyAccess(
            db,
            { uid: "other", organization_id: "b", role: "General Manager" },
            f.propertyId,
          ),
        ),
      /not permitted/,
    );
  } finally {
    await f.db.close();
  }
});
test("authorized observation ingestion deduplicates and refuses to overwrite immutable prices", async () => {
  const f = await marketFixture();
  try {
    const count = Number(
      (await f.db.query<any>("SELECT count(*) AS n FROM market_offers")).rows[0]
        .n,
    );
    const replay = await transaction(f.pool, (db) =>
      ingestPacket(db, f.gm, f.propertyId, f.sourceId, f.packet),
    );
    assert.equal(replay.inserted, 0);
    assert.equal(replay.unchanged, count);
    const corrupted = structuredClone(f.packet);
    corrupted.offers[0].roomTotal! += 100;
    corrupted.offers[0].guestTotal! += 100;
    await assert.rejects(
      () =>
        transaction(f.pool, (db) =>
          ingestPacket(db, f.gm, f.propertyId, f.sourceId, corrupted),
        ),
      /cannot overwrite/,
    );
    assert.equal(
      Number(
        (await f.db.query<any>("SELECT count(*) AS n FROM market_offers"))
          .rows[0].n,
      ),
      count,
    );
  } finally {
    await f.db.close();
  }
});
test("GM decisions are immutable, constrained and blocked by changed evidence or expired licenses", async () => {
  const f = await marketFixture();
  try {
    const rec = await transaction(f.pool, (db) =>
      createRecommendation(
        db,
        f.gm,
        f.propertyId,
        queryFor(),
        queryFor().start,
      ),
    );
    assert.ok(rec.recommendedRate! > 0);
    await assert.rejects(
      () =>
        transaction(f.pool, (db) =>
          decideRecommendation(db, f.revenue, f.propertyId, rec.id, {
            decision: "approved",
            reason: "Try to approve",
            approvedRate: null,
          }),
        ),
      /General Manager/,
    );
    await assert.rejects(
      () =>
        transaction(f.pool, (db) =>
          decideRecommendation(db, f.gm, f.propertyId, rec.id, {
            decision: "approved",
            reason: "Outside allowed bounds",
            approvedRate: 100000,
          }),
        ),
      /guardrails/,
    );
    const approved = await transaction(f.pool, (db) =>
      decideRecommendation(db, f.gm, f.propertyId, rec.id, {
        decision: "approved",
        reason: "Source and policy reviewed",
        approvedRate: null,
      }),
    );
    assert.equal(approved.published, false);
    await assert.rejects(
      () =>
        transaction(f.pool, (db) =>
          decideRecommendation(db, f.gm, f.propertyId, rec.id, {
            decision: "rejected",
            reason: "Attempt to overwrite",
            approvedRate: null,
          }),
        ),
      /immutable/,
    );
    const other = await transaction(f.pool, (db) =>
      createRecommendation(
        db,
        f.gm,
        f.propertyId,
        queryFor(),
        queryFor().start,
      ),
    );
    await f.db.query<any>("UPDATE market_sources SET expires_at=$1", [
      new Date(Date.now() - 1000),
    ]);
    await assert.rejects(
      () =>
        transaction(f.pool, (db) =>
          decideRecommendation(db, f.gm, f.propertyId, other.id, {
            decision: "approved",
            reason: "Now stale permission",
            approvedRate: null,
          }),
        ),
      /stale/,
    );
  } finally {
    await f.db.close();
  }
});
test("worker honestly reports unavailable providers without fabricating research", async () => {
  const f = await marketFixture({ ingest: false });
  try {
    const id = randomUUID();
    await f.db.query<any>(
      "INSERT INTO market_research_jobs(organization_id,id,property_id,source_id,kind,status,created_by,payload) VALUES($1,$2,$3,$4,'provider_collection','queued','gm',$5)",
      ["a", id, f.propertyId, f.sourceId, queryFor()],
    );
    const result = await runMarketWorkerOnce(f.pool);
    assert.equal(result?.missing, true);
    assert.equal(
      (
        await f.db.query<any>(
          "SELECT status FROM market_research_jobs WHERE id=$1",
          [id],
        )
      ).rows[0].status,
      "needs_configuration",
    );
    assert.equal(
      Number(
        (await f.db.query<any>("SELECT count(*) AS n FROM market_offers"))
          .rows[0].n,
      ),
      0,
    );
  } finally {
    await f.db.close();
  }
});
test("Google tokens use authenticated encryption and reject tampering/wrong keys", () => {
  const key = randomBytes(32).toString("base64"),
    value = encryptToken({ refresh_token: "private-token" }, key);
  assert.ok(!value.includes("private-token"));
  assert.equal(decryptToken(value, key).refresh_token, "private-token");
  assert.throws(
    () => decryptToken(value, randomBytes(32).toString("base64")),
    /cannot be decrypted/,
  );
  assert.throws(() => encryptToken({}, "bad"), /32-byte/);
});

test("API property scope, restricted access notes and export license gates apply to direct requests", async () => {
  const f = await marketFixture();
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createCloudRouter(f.pool, async (token) => ({
      uid: token,
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      firebase: { sign_in_second_factor: "totp" },
    })),
  );
  app.use((e: any, _req: any, res: any, _next: any) =>
    res
      .status(e instanceof HttpError ? e.status : 500)
      .json({ error: e.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base =
    "http://127.0.0.1:" + (server.address() as any).port + "/api/market";
  const call = (path: string, uid = "gm", body?: unknown) =>
    fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + uid,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  try {
    assert.equal(
      (await call("/properties/" + f.propertyId, "revenue")).status,
      403,
    );
    assert.equal(
      (await call("/properties/" + f.propertyId, "other")).status,
      403,
    );
    await f.db.query<any>(
      "INSERT INTO market_property_grants VALUES($1,$2,$3,$4)",
      ["a", f.propertyId, "revenue", "research"],
    );
    assert.equal(
      (await call("/properties/" + f.propertyId, "revenue")).status,
      200,
    );
    assert.equal(
      (
        await call(
          "/properties/" + f.propertyId + "/access-notes/u0",
          "revenue",
        )
      ).status,
      403,
    );
    await call("/properties/" + f.propertyId + "/access-notes", "gm", {
      unitId: "u0",
      instructions: "Private entry detail",
    });
    const raw = await (
      await call("/properties/" + f.propertyId, "revenue")
    ).text();
    assert.ok(!raw.includes("Private entry detail"));
    const reviewResponse = await call(
      "/properties/" + f.propertyId + "/ingestion/preview",
      "gm",
      { sourceId: f.sourceId, packet: f.packet },
    );
    assert.equal(reviewResponse.status, 200);
    const review = await reviewResponse.json();
    assert.equal(review.packet.offers.length, f.packet.offers.length);
    assert.equal(
      (
        await call(
          "/properties/" + f.propertyId + "/ingestion/" + review.id,
          "revenue",
        )
      ).status,
      200,
    );
    await f.db.query<any>("UPDATE market_sources SET export_allowed=false");
    assert.equal(
      (
        await call("/properties/" + f.propertyId + "/reports", "revenue", {
          query: queryFor(),
          type: "weekly",
        })
      ).status,
      403,
    );
    await f.db.query<any>(
      "UPDATE market_sources SET export_allowed=true,expires_at=$1",
      [new Date(Date.now() - 1000)],
    );
    assert.equal(
      (
        await call("/properties/" + f.propertyId + "/reports", "revenue", {
          query: queryFor(),
          type: "weekly",
        })
      ).status,
      422,
    );
    assert.equal(
      (await call("/google/status?propertyId=" + f.propertyId, "revenue"))
        .status,
      200,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await f.db.close();
  }
});

test("Google consent binds state to the initiating browser and consumes it once without exposing tokens", async () => {
  const f = await marketFixture({ ingest: false });
  const originalFetch = globalThis.fetch;
  const saved = {
    key: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
    id: process.env.GOOGLE_OAUTH_CLIENT_ID,
    secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirect: process.env.GOOGLE_OAUTH_REDIRECT_URI,
  };
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client";
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-secret";
  process.env.GOOGLE_OAUTH_REDIRECT_URI =
    "http://127.0.0.1/integrations/google/callback";
  const { googleCallback } = await import("../server/integrations/google/routes");
  const app = express();
  app.use(express.json());
  app.get("/integrations/google/callback", googleCallback(f.pool));
  app.use(
    "/api",
    createCloudRouter(f.pool, async () => ({
      uid: "gm",
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      firebase: { sign_in_second_factor: "totp" },
    })),
  );
  app.use((e: any, _req: any, res: any, _next: any) =>
    res
      .status(e instanceof HttpError ? e.status : 500)
      .json({ error: e.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + (server.address() as any).port;
  globalThis.fetch = (async (url: any, init?: any) => {
    if (String(url) === "https://oauth2.googleapis.com/token")
      return new Response(
        JSON.stringify({
          access_token: "test-access",
          refresh_token: "test-refresh",
          scope:
            "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.events.owned",
          expires_in: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    return originalFetch(url, init);
  }) as typeof fetch;
  try {
    const start = await originalFetch(base + "/api/market/google/connect", {
      method: "POST",
      headers: {
        Authorization: "Bearer gm",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ propertyId: f.propertyId }),
    });
    assert.equal(start.status, 200);
    const data = await start.json(),
      state = new URL(data.url).searchParams.get("state");
    assert.ok(state);
    const cookie = start.headers.get("set-cookie")!.split(";")[0];
    assert.equal(
      (
        await originalFetch(
          base + "/integrations/google/callback?state=" + state + "&code=test",
          { redirect: "manual" },
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await originalFetch(
          base + "/integrations/google/callback?state=" + state + "&code=test",
          { headers: { Cookie: cookie }, redirect: "manual" },
        )
      ).status,
      302,
    );
    assert.equal(
      (
        await originalFetch(
          base + "/integrations/google/callback?state=" + state + "&code=test",
          { headers: { Cookie: cookie }, redirect: "manual" },
        )
      ).status,
      401,
    );
    const status = await (
      await originalFetch(
        base + "/api/market/google/status?propertyId=" + f.propertyId,
        { headers: { Authorization: "Bearer gm" } },
      )
    ).text();
    assert.ok(!status.includes("test-refresh"));
    assert.match(status, /"connected":true/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of Object.entries({
      GOOGLE_TOKEN_ENCRYPTION_KEY: saved.key,
      GOOGLE_OAUTH_CLIENT_ID: saved.id,
      GOOGLE_OAUTH_CLIENT_SECRET: saved.secret,
      GOOGLE_OAUTH_REDIRECT_URI: saved.redirect,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await f.db.close();
  }
});

test("approved Google exports use RAW spreadsheet values, replay once and honor source export restrictions", async () => {
  const f = await marketFixture();
  const previous = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const { publishGoogleReview } = await import("../server/integrations/google/routes");
  try {
    const rec = await transaction(f.pool, (db) =>
      createRecommendation(
        db,
        f.gm,
        f.propertyId,
        queryFor(),
        queryFor().start,
      ),
    );
    await transaction(f.pool, (db) =>
      decideRecommendation(db, f.gm, f.propertyId, rec.id, {
        decision: "approved",
        reason: "Reviewed source and owner policy",
        approvedRate: null,
      }),
    );
    await f.db.query<any>(
      "INSERT INTO market_google_connections(organization_id,property_id,token_ciphertext,actor_uid,scopes) VALUES($1,$2,$3,$4,$5)",
      [
        "a",
        f.propertyId,
        encryptToken({
          access_token: "mock-access",
          refresh_token: "mock-refresh",
          expires_at: Date.now() + 3600000,
        }),
        "gm",
        [],
      ],
    );
    const calls: { url: string; body: any }[] = [];
    const mock = (async (url: any, init: any) => {
      calls.push({
        url: String(url),
        body: init?.body ? JSON.parse(init.body) : null,
      });
      if (
        String(url).startsWith("https://www.googleapis.com/drive/v3/files?") &&
        init?.method !== "POST"
      )
        return new Response(JSON.stringify({ files: [] }));
      if (String(url).startsWith("https://www.googleapis.com/drive/v3/files?"))
        return new Response(
          JSON.stringify({
            id: "mock-sheet",
            webViewLink:
              "https://docs.google.com/spreadsheets/d/mock-sheet/edit",
          }),
        );
      if (String(url).includes("sheets.googleapis.com"))
        return new Response(JSON.stringify({ updatedRows: 4 }));
      throw Error("Unexpected network request");
    }) as typeof fetch;
    const first = await transaction(f.pool, (db) =>
      publishGoogleReview(
        db,
        f.gm,
        { propertyId: f.propertyId, recommendationId: rec.id, kind: "sheets" },
        mock,
      ),
    );
    assert.match(first.url!, /mock-sheet/);
    const count = calls.length;
    const replay = await transaction(f.pool, (db) =>
      publishGoogleReview(
        db,
        f.gm,
        { propertyId: f.propertyId, recommendationId: rec.id, kind: "sheets" },
        mock,
      ),
    );
    assert.equal(replay.replayed, true);
    assert.equal(calls.length, count);
    assert.ok(calls.some((c) => c.url.includes("valueInputOption=RAW")));
    await f.db.query<any>("UPDATE market_sources SET export_allowed=false");
    await assert.rejects(
      () =>
        transaction(f.pool, (db) =>
          publishGoogleReview(
            db,
            f.gm,
            {
              propertyId: f.propertyId,
              recommendationId: rec.id,
              kind: "drive",
            },
            mock,
          ),
        ),
      /prohibits/,
    );
    assert.equal(calls.length, count);
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
    else process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = previous;
    await f.db.close();
  }
});

test("revoked research permissions block collection instead of looping or inventing prices", async () => {
  const f = await marketFixture({ ingest: false });
  try {
    const id = randomUUID();
    await f.db.query<any>(
      "INSERT INTO market_research_jobs(organization_id,id,property_id,source_id,kind,status,created_by,payload) VALUES($1,$2,$3,$4,'provider_collection','queued','gm',$5)",
      ["a", id, f.propertyId, f.sourceId, queryFor()],
    );
    await f.db.query<any>("UPDATE market_sources SET revoked_at=now()");
    let called = false;
    const result = await runMarketWorkerOnce(
      f.pool,
      new Map([
        [
          "test-contract",
          {
            collect: async () => {
              called = true;
              return {};
            },
          },
        ],
      ]),
    );
    assert.equal(result?.blocked, true);
    assert.equal(called, false);
    assert.equal(
      (
        await f.db.query<any>(
          "SELECT status FROM market_research_jobs WHERE id=$1",
          [id],
        )
      ).rows[0].status,
      "blocked",
    );
  } finally {
    await f.db.close();
  }
});
