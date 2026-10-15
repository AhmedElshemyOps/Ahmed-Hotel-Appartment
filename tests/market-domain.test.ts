import { test } from "node:test";
import assert from "node:assert/strict";
import { marketDemo } from "../src/features/market/demo";
import {
  analyzeMarket,
  benchmark,
  haversine,
  quantile,
  managementAnswer,
  scenario,
} from "../src/features/market/engine";
import { offerSchema, addDays } from "../src/features/market/model";
import { marketReportHtml } from "../src/features/market/report";
import { apartments, queryFor } from "./helpers/market";
test("integrated demo contains forty clearly synthetic apartments with dated, reproducible evidence", () => {
  const d = marketDemo(apartments);
  assert.equal(d.profiles.length, 40);
  assert.ok(d.demo);
  assert.ok(d.offers.every((o) => o.verification === "synthetic"));
  assert.equal(d.properties.length, 2);
  assert.equal(d.profiles[0].location.status, "synthetic");
  const result = analyzeMarket(d, queryFor());
  assert.equal(result.length, 7);
  assert.equal(result[0].market.uniqueProperties, 8);
  assert.equal(result[0].market.sourceOffers, 10);
  assert.ok(
    result[0].recommendedRate! >= 450 && result[0].recommendedRate! <= 495,
  );
  assert.ok(result[0].market.matchedTrend.length);
  assert.ok(
    result[0].matches.some((m) => m.reasons.some((r) => r.includes("Bedroom"))),
  );
});
test("geography distinguishes community/district from proximity and never expands silently", () => {
  const d = marketDemo(apartments),
    q = queryFor();
  const normal = analyzeMarket(d, q)[0];
  assert.equal(normal.market.uniqueProperties, 8);
  assert.equal(
    analyzeMarket(d, { ...q, scope: "building" })[0].recommendedRate,
    null,
  );
  const changed = structuredClone(d);
  changed.competitors.forEach((c) => {
    c.location.community = "Different community";
  });
  assert.equal(analyzeMarket(changed, q)[0].market.uniqueProperties, 0);
  assert.ok(
    analyzeMarket(changed, { ...q, scope: "district" })[0].market
      .uniqueProperties >= 5,
  );
  assert.ok(
    Math.abs(
      haversine({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })! -
        111195,
    ) < 10,
  );
  assert.equal(
    haversine(
      { latitude: null, longitude: null },
      { latitude: 0, longitude: 0 },
    ),
    null,
  );
});
test("different dates, guest counts, room type, stay duration and booking terms cannot drive a recommendation", () => {
  const d = marketDemo(apartments),
    q = queryFor();
  for (const other of [
    { ...q, stayNights: 3 },
    { ...q, guests: 3 },
    { ...q, cancellation: "nonrefundable" as const },
    { ...q, quoteContext: "members-only" },
  ]) {
    try {
      assert.equal(analyzeMarket(d, other)[0].recommendedRate, null);
    } catch (e) {
      assert.match((e as Error).message, /capacity/);
    }
  }
});
test("missing fees, currency mismatch, unknown availability, expired permission and stale prices are excluded", () => {
  const base = marketDemo(apartments),
    q = queryFor();
  for (const mutate of [
    (d: any) => d.offers.forEach((o: any) => (o.allFeesKnown = false)),
    (d: any) => d.offers.forEach((o: any) => (o.currency = "USD")),
    (d: any) => d.offers.forEach((o: any) => (o.available = null)),
    (d: any) =>
      d.sources.forEach(
        (s: any) => (s.expiresAt = new Date(Date.now() - 1000).toISOString()),
      ),
    (d: any) =>
      d.offers.forEach(
        (o: any) =>
          (o.observedAt = new Date(Date.now() - 100 * 3600000).toISOString()),
      ),
  ]) {
    const d = structuredClone(base);
    mutate(d);
    assert.equal(analyzeMarket(d, q)[0].recommendedRate, null);
  }
});
test("fee reconciliation is strict; unknown totals remain unknown instead of zero", () => {
  const d = marketDemo(apartments),
    o = d.offers[0];
  assert.equal(
    offerSchema.safeParse({ ...o, guestTotal: o.guestTotal! + 100 }).success,
    false,
  );
  assert.equal(
    offerSchema.safeParse({
      ...o,
      guestTotal: null,
      roomTotal: null,
      allFeesKnown: false,
    }).success,
    true,
  );
  assert.equal(quantile([], 0.5), null);
  assert.equal(quantile([1, 2, 3, 1000], 0.5), 2.5);
});
test("cross-platform offers count once per verified physical unit and price spikes do not force excessive moves", () => {
  const d = marketDemo(apartments),
    q = queryFor(),
    r = analyzeMarket(d, q)[0];
  assert.equal(r.market.uniqueProperties, 8);
  assert.equal(r.market.sourceOffers, 10);
  d.offers
    .filter((o) => o.listingId === d.competitors[0].id)
    .forEach((o) => {
      o.roomTotal = 100000;
      o.guestTotal = o.roomTotal + o.cleaningFee! + o.serviceFee! + o.taxes!;
    });
  const after = analyzeMarket(d, q)[0];
  assert.ok(after.recommendedRate === null || after.recommendedRate <= 495);
  assert.ok(after.market.median! < 1000);
});
test("unverified managed location and inconsistent cost/owner limits withhold cloud recommendations", () => {
  const d = marketDemo(apartments);
  d.demo = false;
  d.offers.forEach((o) => (o.verification = "verified"));
  assert.equal(analyzeMarket(d, queryFor())[0].recommendedRate, null);
  const demo = marketDemo(apartments);
  demo.policies[0].operatingCostPerNight = 100000;
  assert.equal(analyzeMarket(demo, queryFor())[0].recommendedRate, null);
  demo.policies[0].operatingCostPerNight = null;
  assert.equal(analyzeMarket(demo, queryFor())[0].recommendedRate, null);
});
test("longer stays need their own quotes; scenario effects are conditional rather than demand forecasts", () => {
  const d = marketDemo(apartments),
    q = queryFor(),
    r = analyzeMarket(d, q)[0];
  assert.equal(
    analyzeMarket(d, { ...q, stayNights: 7 })[0].market.uniqueProperties,
    0,
  );
  const s = scenario(r, 8, 3, 15);
  assert.equal(s.roomRevenueDelta, 108);
  assert.equal(s.netDelta, 91.8);
  assert.match(s.limitation, /not a forecast/);
});
test("management answers cite selected evidence and do not invent occupancy or company identities", () => {
  const d = marketDemo(apartments),
    r = analyzeMarket(d, queryFor());
  assert.match(
    managementAnswer("Which operators advertise here?", r).answer,
    /SYNTHETIC Operator/,
  );
  assert.match(
    managementAnswer("What is competitor occupancy?", r).answer,
    /do not establish/,
  );
  assert.match(
    managementAnswer("How did prices change in the last seven days?", r).answer,
    /same listing/,
  );
  assert.ok(
    managementAnswer("What should I review?", r).evidenceIds.length > 0,
  );
});
test("reports escape hostile listing text and retain synthetic and price-basis disclosure", () => {
  const d = marketDemo(apartments);
  d.competitors[0].title = "<script>alert(1)</script>";
  const q = queryFor(),
    html = marketReportHtml({
      property: "Test <name>",
      type: "Daily",
      query: q,
      decisions: analyzeMarket(d, q),
      demo: true,
      createdAt: new Date().toISOString(),
    });
  assert.match(html, /SYNTHETIC DEMONSTRATION/);
  assert.match(html, /room-only/);
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;script&gt;/);
});

test("map markers prefer eligible current observations over stale history and deduplicate physical units", async () => {
  const { mapRepresentatives } = await import("../src/features/market/engine");
  const d = marketDemo(apartments),
    result = analyzeMarket(d, queryFor())[0],
    markers = mapRepresentatives(result.matches);
  assert.equal(markers.filter((m) => m.match.included).length, 8);
  assert.ok(markers.some((m) => m.match.included && m.sourceListings === 2));
  assert.ok(
    markers
      .filter((m) => m.match.included)
      .every((m) => !m.match.reasons.includes("Observation is stale")),
  );
});
