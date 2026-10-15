import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { marketDemo } from "../../src/market/demo";
import { businessDate } from "../../src/services/guestService";
import { addDays, type MarketQuery } from "../../src/market/model";
import type { Apartment } from "../../src/types";
import { lockedWorkspace, transaction, type Actor } from "../../server/cloud";
import {
  saveProfile,
  savePolicy,
  saveRates,
  ingestPacket,
} from "../../server/market/repository";
export const apartments = Array.from({ length: 40 }, (_, i) => ({
  id: "u" + i,
  unitNumber: String(101 + i),
  type: (["Studio", "One-bedroom", "Two-bedroom", "Three-bedroom"] as const)[
    i % 4
  ],
})) as Apartment[];
export function queryFor(unitId = "u0"): MarketQuery {
  return {
    unitId,
    start: addDays(businessDate(), 1),
    days: 7,
    stayNights: 1,
    guests: 2,
    radiusMeters: 2000,
    scope: "community",
    cancellation: "flexible",
    quoteContext: "public-web-AE-2-adults",
  };
}
export async function marketFixture({ ingest = true } = {}) {
  const db = new PGlite();
  const root = new URL("../../migrations/", import.meta.url);
  for (const file of (await readdir(root))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(new URL(file, root), "utf8"));
  await db.exec(
    "BEGIN;INSERT INTO organizations VALUES('a','Company A','gm');INSERT INTO organizations VALUES('b','Company B','other');INSERT INTO memberships VALUES('gm','a',1,'General Manager'),('revenue','a',2,'Revenue Manager'),('viewer','a',3,'Read-Only Viewer'),('other','b',1,'General Manager');COMMIT;",
  );
  const client = {
    query: (sql: string, params?: any[]) => db.query(sql, params),
    release: () => {},
  };
  const pool = {
    connect: async () => client,
    query: client.query,
  } as unknown as Pool;
  const gm: Actor = {
      uid: "gm",
      organization_id: "a",
      role: "General Manager",
    },
    revenue: Actor = {
      uid: "revenue",
      organization_id: "a",
      role: "Revenue Manager",
    },
    viewer: Actor = {
      uid: "viewer",
      organization_id: "a",
      role: "Read-Only Viewer",
    };
  const demo = marketDemo(apartments),
    propertyId = demo.properties[0].id,
    sourceId = demo.sources[0].id;
  await db.query(
    "INSERT INTO market_properties(organization_id,id,name) VALUES($1,$2,$3)",
    ["a", propertyId, "Test licensed market"],
  );
  await transaction(pool, async (db) => {
    const ws = await lockedWorkspace(db, "a");
    ws.data.apartments = apartments;
    await db.query("UPDATE workspaces SET data=$2 WHERE organization_id=$1", [
      "a",
      ws.data,
    ]);
  });
  const profile = structuredClone(demo.profiles[0]);
  profile.location = {
    ...profile.location,
    status: "verified",
    verifiedAt: new Date().toISOString(),
    evidenceUrl: "https://evidence.example.test/managed",
  };
  await transaction(pool, (db) => saveProfile(db, gm, profile));
  await transaction(pool, (db) =>
    savePolicy(db, gm, propertyId, demo.policies[0]),
  );
  await transaction(pool, (db) =>
    saveRates(
      db,
      gm,
      propertyId,
      demo.rates.filter((r) => r.unitId === "u0").slice(0, 30),
    ),
  );
  await db.query(
    "INSERT INTO market_sources(organization_id,id,property_id,name,provider,permission_reference,expires_at,max_age_hours,analysis_allowed,storage_allowed,export_allowed,derivatives_allowed,authorized_by) VALUES($1,$2,$3,$4,$5,$6,$7,24,true,true,true,true,$8)",
    [
      "a",
      sourceId,
      propertyId,
      "Test source",
      "test-contract",
      "https://license.example.test/contract",
      new Date(Date.now() + 365 * 86400000),
      "gm",
    ],
  );
  const packet = {
    competitors: demo.competitors
      .filter(
        (c) => c.propertyId === propertyId && c.characteristics.bedrooms === 0,
      )
      .map((c) => ({
        ...c,
        location: {
          ...c.location,
          status: "verified" as const,
          verifiedAt: new Date().toISOString(),
          evidenceUrl: "https://evidence.example.test/competitor",
        },
      })),
    offers: demo.offers
      .filter(
        (o) =>
          o.propertyId === propertyId &&
          demo.competitors.find((c) => c.id === o.listingId)?.characteristics
            .bedrooms === 0 &&
          o.checkIn < addDays(queryFor().start, 7),
      )
      .map((o) => ({ ...o, verification: "verified" as const })),
  };
  if (ingest)
    await transaction(pool, (db) =>
      ingestPacket(db, gm, propertyId, sourceId, packet),
    );
  return {
    db,
    pool,
    client,
    gm,
    revenue,
    viewer,
    demo,
    profile,
    propertyId,
    sourceId,
    packet,
  };
}
