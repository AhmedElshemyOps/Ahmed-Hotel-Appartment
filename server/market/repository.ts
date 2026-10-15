import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { HttpError, type Actor, lockedWorkspace } from "../cloud";
import { fingerprint } from "../pms";
import {
  profileSchema,
  policySchema,
  rateSchema,
  competitorSchema,
  offerSchema,
  sourceSchema,
  type GeoProfile,
  type MarketDataset,
  type MarketSource,
  type Competitor,
  type CompetitorOffer,
  type PricingPolicy,
  type RentalRate,
} from "../../src/market/model";
import { z } from "zod";
export const packetSchema = z.object({
  competitors: z.array(competitorSchema).min(1).max(200),
  offers: z.array(offerSchema).min(1).max(500),
});
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const date = (v: unknown) => iso(v).slice(0, 10);
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
export async function propertyAccess(
  db: PoolClient,
  actor: Actor,
  propertyId: string,
  write = false,
  gmOnly = false,
) {
  if (!z.string().uuid().safeParse(propertyId).success)
    throw new HttpError(422, "Invalid market property identifier.");
  const membership = await db.query(
    "SELECT role FROM memberships WHERE uid=$1 AND organization_id=$2 FOR SHARE",
    [actor.uid, actor.organization_id],
  );
  if (membership.rows[0]?.role !== actor.role)
    throw new HttpError(403, "Membership changed. Sign in again.");
  const result = await db.query(
    `SELECT p.* FROM market_properties p WHERE p.organization_id=$1 AND p.id=$2 AND ($3='General Manager' OR EXISTS(SELECT 1 FROM market_property_grants g WHERE g.organization_id=p.organization_id AND g.property_id=p.id AND g.uid=$4 AND ($5=false OR g.capability='research'))) FOR UPDATE`,
    [actor.organization_id, propertyId, actor.role, actor.uid, write],
  );
  if (
    !result.rows.length ||
    (gmOnly && actor.role !== "General Manager") ||
    (write &&
      !["General Manager", "Revenue Manager", "Finance Manager"].includes(
        actor.role,
      ))
  )
    throw new HttpError(
      403,
      "This market property or action is not permitted.",
    );
  return result.rows[0] as { id: string; revision: number; name: string };
}
export async function marketAudit(
  db: PoolClient,
  actor: Actor,
  action: string,
  target: string,
  details: unknown = {},
) {
  await db.query(
    "INSERT INTO audit_events(organization_id,actor_uid,action,target,details) VALUES($1,$2,$3,$4,$5)",
    [actor.organization_id, actor.uid, "market." + action, target, details],
  );
}
export async function bump(db: PoolClient, org: string, propertyId: string) {
  await db.query(
    "UPDATE market_properties SET revision=revision+1 WHERE organization_id=$1 AND id=$2",
    [org, propertyId],
  );
}
export async function createLocation(
  db: PoolClient,
  org: string,
  propertyId: string,
  l: GeoProfile["location"],
) {
  const area = randomUUID(),
    location = randomUUID(),
    building = randomUUID();
  await db.query(
    "INSERT INTO market_areas(organization_id,id,property_id,country,city,emirate,district,community) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      org,
      area,
      propertyId,
      l.country,
      l.city,
      l.emirate,
      l.district,
      l.community,
    ],
  );
  await db.query(
    "INSERT INTO market_locations(organization_id,id,property_id,area_id,latitude,longitude,accuracy_meters,address,postal_code,verification_status,provider,verified_at,evidence_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
    [
      org,
      location,
      propertyId,
      area,
      l.latitude,
      l.longitude,
      l.accuracyMeters,
      l.address,
      l.postalCode,
      l.status,
      l.provider,
      l.verifiedAt,
      l.evidenceUrl,
    ],
  );
  await db.query(
    "INSERT INTO market_buildings(organization_id,id,property_id,location_id,name,external_reference) VALUES($1,$2,$3,$4,$5,$6)",
    [org, building, propertyId, location, l.buildingName, l.buildingReference],
  );
  return { location, building };
}
async function features(
  db: PoolClient,
  org: string,
  id: string,
  c: GeoProfile["characteristics"],
  listing = false,
) {
  const table = listing ? "market_listing_features" : "market_unit_features",
    column = listing ? "listing_id" : "unit_id";
  if (!listing)
    await db.query(
      `DELETE FROM ${table} WHERE organization_id=$1 AND ${column}=$2`,
      [org, id],
    );
  for (const [kind, values] of [
    ["amenity", c.amenities],
    ["accessibility", c.accessibility],
  ] as const)
    for (const value of new Set(values))
      await db.query(
        `INSERT INTO ${table}(organization_id,${column},kind,value) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [org, id, kind, value],
      );
}
export async function saveProfile(
  db: PoolClient,
  actor: Actor,
  input: unknown,
) {
  const v = profileSchema.parse(input);
  if (v.location.verifiedAt && Date.parse(v.location.verifiedAt) > Date.now())
    throw new HttpError(422, "Location verification cannot be future-dated.");
  await propertyAccess(db, actor, v.propertyId, true, true);
  if (v.location.status === "synthetic")
    throw new HttpError(422, "Synthetic locations cannot enter cloud storage.");
  const workspace = await lockedWorkspace(db, actor.organization_id);
  const actual = workspace.data.apartments.find((a) => a.id === v.unitId);
  if (!actual || actual.unitNumber !== v.unitNumber)
    throw new HttpError(
      422,
      "Choose a registered real unit and its actual unit number.",
    );
  const old = await db.query(
    "SELECT property_id FROM market_units WHERE organization_id=$1 AND unit_id=$2",
    [actor.organization_id, v.unitId],
  );
  if (old.rows.length && old.rows[0].property_id !== v.propertyId)
    throw new HttpError(
      409,
      "A registered unit cannot be moved between properties through this form.",
    );
  const { building } = await createLocation(
      db,
      actor.organization_id,
      v.propertyId,
      v.location,
    ),
    c = v.characteristics;
  await db.query(
    `INSERT INTO market_units(organization_id,unit_id,property_id,building_id,unit_number,category,rental_model,bedrooms,bathrooms,capacity,area_sqm,floor_number,furnishing,condition,view,review_score,review_count,license_status)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
 ON CONFLICT(organization_id,unit_id) DO UPDATE SET building_id=EXCLUDED.building_id,category=EXCLUDED.category,rental_model=EXCLUDED.rental_model,bedrooms=EXCLUDED.bedrooms,bathrooms=EXCLUDED.bathrooms,capacity=EXCLUDED.capacity,area_sqm=EXCLUDED.area_sqm,floor_number=EXCLUDED.floor_number,furnishing=EXCLUDED.furnishing,condition=EXCLUDED.condition,view=EXCLUDED.view,review_score=EXCLUDED.review_score,review_count=EXCLUDED.review_count,license_status=EXCLUDED.license_status,updated_at=now()`,
    [
      actor.organization_id,
      v.unitId,
      v.propertyId,
      building,
      v.unitNumber,
      c.category,
      c.rentalModel,
      c.bedrooms,
      c.bathrooms,
      c.capacity,
      c.areaSqm,
      c.floor,
      c.furnishing,
      c.condition,
      c.view,
      c.reviewScore,
      c.reviewCount,
      c.licenseStatus,
    ],
  );
  await features(db, actor.organization_id, v.unitId, c);
  await db.query(
    "DELETE FROM market_unit_attractions WHERE organization_id=$1 AND unit_id=$2",
    [actor.organization_id, v.unitId],
  );
  for (const a of c.attractionDistances)
    await db.query(
      "INSERT INTO market_unit_attractions VALUES($1,$2,$3,$4,$5)",
      [
        actor.organization_id,
        v.unitId,
        a.name,
        a.distanceMeters,
        a.evidenceUrl,
      ],
    );
  await db.query(
    "INSERT INTO market_profile_history VALUES($1,$2,$3,$4,$5,$6,now())",
    [actor.organization_id, randomUUID(), v.unitId, v.propertyId, v, actor.uid],
  );
  await bump(db, actor.organization_id, v.propertyId);
  await marketAudit(db, actor, "profile.save", v.unitId, {
    propertyId: v.propertyId,
    hash: fingerprint(v),
  });
  return v;
}
export async function savePolicy(
  db: PoolClient,
  actor: Actor,
  propertyId: string,
  input: unknown,
) {
  const v = policySchema.parse(input);
  await propertyAccess(db, actor, propertyId, true, true);
  await assertUnit(db, actor.organization_id, propertyId, v.unitId);
  const version = Number(
    (
      await db.query(
        "SELECT coalesce(max(version),0)+1 AS v FROM market_policies WHERE organization_id=$1 AND unit_id=$2",
        [actor.organization_id, v.unitId],
      )
    ).rows[0].v,
  );
  await db.query(
    `INSERT INTO market_policies(organization_id,unit_id,version,minimum_rate,maximum_rate,target_rate,max_change_percent,minimum_stay,cleaning_fee,service_percent,tax_percent,commission_percent,operating_cost,minimum_contribution,cancellation,owner_approval_reference,weekend_policy,seasonal_policy,additional_guest_fee,approved_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
    [
      actor.organization_id,
      v.unitId,
      version,
      v.minimumRate,
      v.maximumRate,
      v.targetRate,
      v.maxChangePercent,
      v.minimumStay,
      v.cleaningFee,
      v.servicePercent,
      v.taxPercent,
      v.commissionPercent,
      v.operatingCostPerNight,
      v.minimumContribution,
      v.cancellation,
      v.ownerApprovalReference,
      v.weekendPolicy,
      v.seasonalPolicy,
      v.additionalGuestFee,
      actor.uid,
    ],
  );
  await bump(db, actor.organization_id, propertyId);
  await marketAudit(db, actor, "policy.append", v.unitId, { version });
  return version;
}
export async function assertUnit(
  db: PoolClient,
  org: string,
  propertyId: string,
  unitId: string,
) {
  if (
    !(
      await db.query(
        "SELECT unit_id FROM market_units WHERE organization_id=$1 AND property_id=$2 AND unit_id=$3",
        [org, propertyId, unitId],
      )
    ).rows.length
  )
    throw new HttpError(404, "Market unit not found in this property.");
}
export async function saveRates(
  db: PoolClient,
  actor: Actor,
  propertyId: string,
  input: unknown,
) {
  await propertyAccess(db, actor, propertyId, true);
  const rates = z.array(rateSchema).min(1).max(120).parse(input),
    seen = new Set<string>();
  for (const r of rates) {
    if (seen.has(r.unitId + ":" + r.date))
      throw new HttpError(422, "Duplicate rate dates in this batch.");
    seen.add(r.unitId + ":" + r.date);
    await assertUnit(db, actor.organization_id, propertyId, r.unitId);
    const v = Number(
      (
        await db.query(
          "SELECT coalesce(max(version),0)+1 AS v FROM market_rates WHERE organization_id=$1 AND unit_id=$2 AND date=$3",
          [actor.organization_id, r.unitId, r.date],
        )
      ).rows[0].v,
    );
    await db.query(
      "INSERT INTO market_rates(organization_id,unit_id,date,version,room_rate,available,minimum_stay,occupancy_forecast,forecast_evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        actor.organization_id,
        r.unitId,
        r.date,
        v,
        r.roomRate,
        r.available,
        r.minimumStay,
        r.occupancyForecast,
        r.forecastEvidence,
      ],
    );
  }
  await bump(db, actor.organization_id, propertyId);
  await marketAudit(db, actor, "rates.append", propertyId, {
    count: rates.length,
  });
}
export async function activeSource(
  db: PoolClient,
  org: string,
  propertyId: string,
  sourceId: string,
) {
  const row = (
    await db.query(
      "SELECT * FROM market_sources WHERE organization_id=$1 AND property_id=$2 AND id=$3",
      [org, propertyId, sourceId],
    )
  ).rows[0];
  if (
    !row ||
    row.revoked_at ||
    new Date(row.expires_at).valueOf() <= Date.now()
  )
    throw new HttpError(
      422,
      "Source authorization is unavailable, revoked or expired.",
    );
  return row;
}
export function validatePacket(input: unknown) {
  const p = packetSchema.parse(input);
  if (
    new Set(p.competitors.map((c) => c.externalListingId)).size !==
    p.competitors.length
  )
    throw new HttpError(422, "Duplicate listing identifiers.");
  if (new Set(p.offers.map((o) => o.observationId)).size !== p.offers.length)
    throw new HttpError(422, "Duplicate observation identifiers.");
  for (const o of p.offers) {
    if (!p.competitors.some((c) => c.externalListingId === o.listingId))
      throw new HttpError(
        422,
        "Every offer must reference a supplied listing.",
      );
    if (
      o.verification === "synthetic" ||
      new Date(o.observedAt).valueOf() > Date.now() + 60000
    )
      throw new HttpError(
        422,
        "Synthetic or future-dated observations cannot enter cloud storage.",
      );
  }
  for (const c of p.competitors)
    if (c.location.status === "synthetic")
      throw new HttpError(
        422,
        "Synthetic competitor coordinates cannot enter cloud storage.",
      );
  return p;
}
export async function ingestPacket(
  db: PoolClient,
  actor: Actor,
  propertyId: string,
  sourceId: string,
  input: unknown,
) {
  await propertyAccess(db, actor, propertyId, true, true);
  await activeSource(db, actor.organization_id, propertyId, sourceId);
  const p = validatePacket(input),
    mapping = new Map<string, string>();
  for (const c of p.competitors) {
    const hash = fingerprint(c),
      previous = (
        await db.query(
          "SELECT id FROM market_listings WHERE organization_id=$1 AND source_id=$2 AND external_listing_id=$3 AND metadata_hash=$4",
          [actor.organization_id, sourceId, c.externalListingId, hash],
        )
      ).rows[0];
    if (previous) {
      mapping.set(c.externalListingId, previous.id);
      continue;
    }
    let physical = (
      await db.query(
        "SELECT id FROM market_physical_properties WHERE organization_id=$1 AND property_id=$2 AND physical_key=$3",
        [actor.organization_id, propertyId, c.physicalKey],
      )
    ).rows[0]?.id;
    if (!physical) {
      physical = randomUUID();
      await db.query(
        "INSERT INTO market_physical_properties VALUES($1,$2,$3,$4,$5)",
        [
          actor.organization_id,
          physical,
          propertyId,
          c.physicalKey,
          c.identityEvidence,
        ],
      );
    }
    const { location, building } = await createLocation(
      db,
      actor.organization_id,
      propertyId,
      c.location,
    );
    let operator: string | null = null;
    if (c.operatorName && c.operatorEvidence) {
      operator = randomUUID();
      await db.query("INSERT INTO market_operators VALUES($1,$2,$3,$4)", [
        actor.organization_id,
        operator,
        c.operatorName,
        c.operatorEvidence,
      ]);
    }
    const id = randomUUID(),
      v = c.characteristics;
    await db.query(
      `INSERT INTO market_listings(organization_id,id,property_id,source_id,physical_id,location_id,building_id,operator_id,external_listing_id,metadata_hash,title,url,platform,category,rental_model,bedrooms,bathrooms,capacity,area_sqm,floor_number,furnishing,condition,view,review_score,review_count,license_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
      [
        actor.organization_id,
        id,
        propertyId,
        sourceId,
        physical,
        location,
        building,
        operator,
        c.externalListingId,
        hash,
        c.title,
        c.url,
        c.platform,
        v.category,
        v.rentalModel,
        v.bedrooms,
        v.bathrooms,
        v.capacity,
        v.areaSqm,
        v.floor,
        v.furnishing,
        v.condition,
        v.view,
        v.reviewScore,
        v.reviewCount,
        v.licenseStatus,
      ],
    );
    await features(db, actor.organization_id, id, v, true);
    mapping.set(c.externalListingId, id);
  }
  let inserted = 0,
    unchanged = 0;
  for (const o of p.offers) {
    const hash = fingerprint(o),
      old = (
        await db.query(
          "SELECT payload_hash FROM market_offers WHERE organization_id=$1 AND source_id=$2 AND observation_id=$3",
          [actor.organization_id, sourceId, o.observationId],
        )
      ).rows[0];
    if (old) {
      if (old.payload_hash !== hash)
        throw new HttpError(
          409,
          "An observation ID cannot overwrite existing evidence. Issue a new observation ID.",
        );
      unchanged++;
      continue;
    }
    await db.query(
      `INSERT INTO market_offers(organization_id,id,property_id,source_id,listing_id,observation_id,payload_hash,check_in,check_out,guests,available,minimum_stay,cancellation,quote_context,currency,room_total,cleaning_fee,service_fee,taxes,guest_total,all_fees_known,observed_at,verification,source_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
      [
        actor.organization_id,
        randomUUID(),
        propertyId,
        sourceId,
        mapping.get(o.listingId),
        o.observationId,
        hash,
        o.checkIn,
        o.checkOut,
        o.guests,
        o.available,
        o.minimumStay,
        o.cancellation,
        o.quoteContext,
        o.currency,
        o.roomTotal,
        o.cleaningFee,
        o.serviceFee,
        o.taxes,
        o.guestTotal,
        o.allFeesKnown,
        o.observedAt,
        o.verification,
        o.sourceUrl,
      ],
    );
    inserted++;
  }
  if (inserted) await bump(db, actor.organization_id, propertyId);
  await marketAudit(db, actor, "observations.append", propertyId, {
    sourceId,
    inserted,
    unchanged,
  });
  return { inserted, unchanged };
}
function loc(r: any): GeoProfile["location"] {
  return {
    latitude: num(r.latitude),
    longitude: num(r.longitude),
    accuracyMeters: num(r.accuracy_meters),
    address: r.address,
    buildingName: r.building_name,
    buildingReference: r.building_reference,
    community: r.community,
    district: r.district,
    city: r.city,
    emirate: r.emirate,
    country: r.country,
    postalCode: r.postal_code,
    status: r.verification_status,
    provider: r.provider,
    verifiedAt: r.verified_at ? iso(r.verified_at) : null,
    evidenceUrl: r.evidence_url,
  };
}
function chars(
  r: any,
  features: any[],
  attractions: any[] = [],
): GeoProfile["characteristics"] {
  return {
    category: r.category,
    rentalModel: r.rental_model,
    bedrooms: r.bedrooms,
    bathrooms: r.bathrooms,
    capacity: r.capacity,
    areaSqm: num(r.area_sqm),
    floor: r.floor_number,
    furnishing: r.furnishing,
    condition: r.condition,
    view: r.view,
    reviewScore: num(r.review_score),
    reviewCount: r.review_count,
    licenseStatus: r.license_status,
    amenities: features
      .filter((f) => f.kind === "amenity")
      .map((f) => f.value)
      .sort(),
    accessibility: features
      .filter((f) => f.kind === "accessibility")
      .map((f) => f.value)
      .sort(),
    attractionDistances: attractions.map((a) => ({
      name: a.name,
      distanceMeters: a.distance_meters,
      evidenceUrl: a.evidence_url,
    })),
  };
}
const geoJoin = `JOIN market_buildings b ON b.organization_id=u.organization_id AND b.id=u.building_id JOIN market_locations l ON l.organization_id=b.organization_id AND l.id=b.location_id JOIN market_areas a ON a.organization_id=l.organization_id AND a.id=l.area_id`;
export async function loadDataset(
  db: PoolClient,
  org: string,
  propertyId: string,
): Promise<MarketDataset> {
  const profiles = (
    await db.query(
      `SELECT u.*,b.name AS building_name,b.external_reference AS building_reference,l.*,a.*,u.unit_id,u.property_id FROM market_units u ${geoJoin} WHERE u.organization_id=$1 AND u.property_id=$2 ORDER BY u.unit_number`,
      [org, propertyId],
    )
  ).rows;
  const uf = (
    await db.query(
      "SELECT f.* FROM market_unit_features f JOIN market_units u ON u.organization_id=f.organization_id AND u.unit_id=f.unit_id WHERE u.organization_id=$1 AND u.property_id=$2",
      [org, propertyId],
    )
  ).rows;
  const attractions = (
    await db.query(
      "SELECT f.* FROM market_unit_attractions f JOIN market_units u ON u.organization_id=f.organization_id AND u.unit_id=f.unit_id WHERE u.organization_id=$1 AND u.property_id=$2",
      [org, propertyId],
    )
  ).rows;
  const policies = (
    await db.query(
      "SELECT DISTINCT ON(p.unit_id) p.* FROM market_policies p JOIN market_units u ON u.organization_id=p.organization_id AND u.unit_id=p.unit_id WHERE p.organization_id=$1 AND u.property_id=$2 ORDER BY p.unit_id,p.version DESC",
      [org, propertyId],
    )
  ).rows;
  const rates = (
    await db.query(
      "SELECT DISTINCT ON(r.unit_id,r.date) r.* FROM market_rates r JOIN market_units u ON u.organization_id=r.organization_id AND u.unit_id=r.unit_id WHERE r.organization_id=$1 AND u.property_id=$2 ORDER BY r.unit_id,r.date,r.version DESC",
      [org, propertyId],
    )
  ).rows;
  const sources = (
    await db.query(
      "SELECT * FROM market_sources WHERE organization_id=$1 AND property_id=$2",
      [org, propertyId],
    )
  ).rows;
  const listings = (
    await db.query(
      `SELECT u.*,b.name AS building_name,b.external_reference AS building_reference,l.*,a.*,p.physical_key,p.identity_evidence,op.name AS operator_name,op.evidence_url AS operator_evidence,u.id AS listing_id,u.property_id,u.source_id FROM market_listings u ${geoJoin} JOIN market_physical_properties p ON p.organization_id=u.organization_id AND p.id=u.physical_id LEFT JOIN market_operators op ON op.organization_id=u.organization_id AND op.id=u.operator_id WHERE u.organization_id=$1 AND u.property_id=$2`,
      [org, propertyId],
    )
  ).rows;
  const lf = (
    await db.query(
      "SELECT f.* FROM market_listing_features f JOIN market_listings l ON l.organization_id=f.organization_id AND l.id=f.listing_id WHERE l.organization_id=$1 AND l.property_id=$2",
      [org, propertyId],
    )
  ).rows;
  const offers = (
    await db.query(
      "SELECT * FROM market_offers WHERE organization_id=$1 AND property_id=$2 ORDER BY observed_at,id LIMIT 5001",
      [org, propertyId],
    )
  ).rows;
  if (offers.length > 5000)
    throw new HttpError(
      422,
      "Market evidence exceeds the pilot query limit. Add date-window pagination before increasing coverage.",
    );
  return {
    properties: (
      await db.query(
        "SELECT id,name FROM market_properties WHERE organization_id=$1 AND id=$2",
        [org, propertyId],
      )
    ).rows,
    profiles: profiles.map((r) => ({
      unitId: r.unit_id,
      propertyId: r.property_id,
      unitNumber: r.unit_number,
      location: loc(r),
      characteristics: chars(
        r,
        uf.filter((f) => f.unit_id === r.unit_id),
        attractions.filter((f) => f.unit_id === r.unit_id),
      ),
    })),
    policies: policies.map((r) => ({
      unitId: r.unit_id,
      version: r.version,
      minimumRate: Number(r.minimum_rate),
      maximumRate: Number(r.maximum_rate),
      targetRate: num(r.target_rate),
      maxChangePercent: r.max_change_percent,
      minimumStay: r.minimum_stay,
      cleaningFee: Number(r.cleaning_fee),
      servicePercent: r.service_percent,
      taxPercent: r.tax_percent,
      commissionPercent: r.commission_percent,
      operatingCostPerNight: num(r.operating_cost),
      minimumContribution: num(r.minimum_contribution),
      cancellation: r.cancellation,
      ownerApprovalReference: r.owner_approval_reference,
      weekendPolicy: r.weekend_policy,
      seasonalPolicy: r.seasonal_policy,
      additionalGuestFee: Number(r.additional_guest_fee),
      approvedAt: iso(r.approved_at),
      approvedBy: r.approved_by,
    })),
    rates: rates.map((r) => ({
      unitId: r.unit_id,
      date: date(r.date),
      version: r.version,
      roomRate: Number(r.room_rate),
      available: r.available,
      minimumStay: r.minimum_stay,
      occupancyForecast: num(r.occupancy_forecast),
      forecastEvidence: r.forecast_evidence,
      recordedAt: iso(r.recorded_at),
    })),
    sources: sources.map(
      (r) =>
        ({
          id: r.id,
          name: r.name,
          provider: r.provider,
          permissionReference: r.permission_reference,
          expiresAt: iso(r.expires_at),
          maxAgeHours: r.max_age_hours,
          analysisAllowed: r.analysis_allowed,
          storageAllowed: r.storage_allowed,
          exportAllowed: r.export_allowed,
          derivativesAllowed: r.derivatives_allowed,
          authorizedBy: r.authorized_by,
          authorizedAt: iso(r.authorized_at),
          revokedAt: r.revoked_at ? iso(r.revoked_at) : null,
        }) as MarketSource,
    ),
    competitors: listings.map(
      (r) =>
        ({
          id: r.listing_id,
          sourceId: r.source_id,
          propertyId: r.property_id,
          externalListingId: r.external_listing_id,
          physicalKey: r.physical_key,
          identityEvidence: r.identity_evidence,
          title: r.title,
          url: r.url,
          platform: r.platform,
          operatorName: r.operator_name || null,
          operatorEvidence: r.operator_evidence || null,
          location: loc(r),
          characteristics: chars(
            r,
            lf.filter((f) => f.listing_id === r.listing_id),
          ),
        }) as Competitor,
    ),
    offers: offers.map(
      (r) =>
        ({
          id: r.id,
          sourceId: r.source_id,
          propertyId: r.property_id,
          listingId: r.listing_id,
          observationId: r.observation_id,
          checkIn: date(r.check_in),
          checkOut: date(r.check_out),
          guests: r.guests,
          available: r.available,
          minimumStay: r.minimum_stay,
          cancellation: r.cancellation,
          quoteContext: r.quote_context,
          currency: r.currency,
          roomTotal: num(r.room_total),
          cleaningFee: num(r.cleaning_fee),
          serviceFee: num(r.service_fee),
          taxes: num(r.taxes),
          guestTotal: num(r.guest_total),
          allFeesKnown: r.all_fees_known,
          observedAt: iso(r.observed_at),
          verification: r.verification,
          sourceUrl: r.source_url,
        }) as CompetitorOffer,
    ),
    demo: false,
    generatedAt: new Date().toISOString(),
  };
}
