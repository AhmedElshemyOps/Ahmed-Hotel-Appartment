import type {
  GeoProfile,
  MarketDataset,
  MarketQuery,
  Match,
  Benchmark,
  PriceDecision,
  CompetitorOffer,
  PricingPolicy,
  RentalRate,
} from "./model";
import { querySchema, addDays, nightsBetween } from "./model";
export const FORMULA_VERSION = "market-v1.0-provisional";
const INSUFFICIENT =
  "Insufficient reliable market evidence for an automated pricing recommendation.";
const round = (n: number) => Math.round(n * 100) / 100;
const key = (s: string | null) =>
  s?.normalize("NFKC").trim().toLowerCase() || "";
export function haversine(
  a: { latitude: number | null; longitude: number | null },
  b: { latitude: number | null; longitude: number | null },
): number | null {
  if (
    a.latitude === null ||
    a.longitude === null ||
    b.latitude === null ||
    b.longitude === null
  )
    return null;
  const rad = Math.PI / 180,
    dlat = (b.latitude - a.latitude) * rad,
    dlon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(dlon / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function quantile(values: number[], q: number) {
  if (!values.length) return null;
  const a = [...values].sort((a, b) => a - b),
    p = (a.length - 1) * q,
    l = Math.floor(p);
  return a[l] + (a[Math.ceil(p)] - a[l]) * (p - l);
}
export function matchOffers(
  dataset: MarketDataset,
  unit: GeoProfile,
  query: MarketQuery,
  date: string,
  now: Date,
): Match[] {
  const checkout = addDays(date, query.stayNights);
  return dataset.offers
    .filter(
      (o) =>
        o.propertyId === unit.propertyId &&
        o.checkIn === date &&
        o.checkOut === checkout,
    )
    .flatMap((offer) => {
      const competitor = dataset.competitors.find(
          (c) => c.id === offer.listingId && c.propertyId === unit.propertyId,
        ),
        source = dataset.sources.find((s) => s.id === offer.sourceId);
      if (!competitor) return [];
      const reasons: string[] = [],
        l = unit.location,
        c = competitor.location,
        u = unit.characteristics,
        v = competitor.characteristics;
      const distanceMeters = haversine(l, c);
      if (
        !source ||
        source.revokedAt ||
        Date.parse(source.expiresAt) <= now.valueOf() ||
        !source.analysisAllowed ||
        !source.storageAllowed ||
        !source.derivativesAllowed
      )
        reasons.push("Source authorization unavailable, expired or revoked");
      if (Date.parse(offer.observedAt) > now.valueOf() + 60000)
        reasons.push("Observation is future-dated");
      if (
        source &&
        now.valueOf() - Date.parse(offer.observedAt) >
          source.maxAgeHours * 3600000
      )
        reasons.push("Observation is stale");
      if (
        dataset.demo
          ? offer.verification !== "synthetic"
          : offer.verification !== "verified"
      )
        reasons.push(
          "Observation verification does not match this environment",
        );
      if (
        !dataset.demo &&
        (l.status !== "verified" ||
          !["verified", "approximate"].includes(c.status))
      )
        reasons.push(
          "Managed location is unverified or competitor coordinates unavailable",
        );
      if (
        !dataset.demo &&
        l.verifiedAt &&
        now.valueOf() - Date.parse(l.verifiedAt) > 365 * 86400000
      )
        reasons.push("Managed location verification is older than one year");
      if (distanceMeters === null) reasons.push("Coordinates unavailable");
      if (l.country !== c.country || key(l.city) !== key(c.city))
        reasons.push("Different city/country market");
      const sameBuilding = Boolean(
        l.buildingReference &&
        c.buildingReference &&
        key(l.buildingReference) === key(c.buildingReference) &&
        key(l.city) === key(c.city),
      );
      const sameCommunity = key(l.community) === key(c.community),
        sameDistrict = key(l.district) === key(c.district);
      const level = sameBuilding ? 1 : sameCommunity ? 2 : sameDistrict ? 3 : 4;
      if (query.scope === "building" && !sameBuilding)
        reasons.push("Outside chosen building");
      if (query.scope === "community" && !sameCommunity)
        reasons.push("Outside chosen community");
      if (query.scope === "district" && !sameDistrict)
        reasons.push("Outside chosen district");
      if (
        query.scope !== "city" &&
        distanceMeters !== null &&
        distanceMeters + (l.accuracyMeters || 0) + (c.accuracyMeters || 0) >
          query.radiusMeters
      )
        reasons.push("Outside chosen radius");
      if (c.accuracyMeters === null || c.accuracyMeters > 500)
        reasons.push("Competitor location accuracy is insufficient");
      if (u.bedrooms !== v.bedrooms)
        reasons.push("Bedroom type mismatch (studio is zero bedrooms)");
      if (u.category !== v.category)
        reasons.push("Accommodation category mismatch");
      if (u.rentalModel !== v.rentalModel)
        reasons.push("Rental-model mismatch");
      if (u.rentalModel !== "short_term")
        reasons.push("Long-term pricing is not supported by this version");
      if (query.guests > v.capacity || Math.abs(u.capacity - v.capacity) > 1)
        reasons.push("Guest capacity mismatch");
      if (offer.guests !== query.guests)
        reasons.push("Offer quoted for different guest count");
      if (offer.available !== true)
        reasons.push("Availability is not verified available");
      if (offer.minimumStay > query.stayNights)
        reasons.push("Minimum stay is not satisfied");
      if (
        offer.cancellation !== query.cancellation ||
        offer.quoteContext !== query.quoteContext
      )
        reasons.push("Booking conditions or quote context differ");
      if (offer.currency !== "AED")
        reasons.push("Currency conversion has not been verified");
      if (
        !offer.allFeesKnown ||
        offer.guestTotal === null ||
        offer.guestTotal <= 0
      )
        reasons.push("Guest-facing total/fees incomplete");
      if (!competitor.physicalKey || !competitor.identityEvidence)
        reasons.push("Physical property identity is not verified");
      const weights = {
        location: 30,
        capacityBathrooms: 20,
        area: 10,
        amenities: 10,
        quality: 10,
        reviews: 10,
        reliability: 10,
      };
      const common = u.amenities.length
        ? u.amenities.filter((x) => v.amenities.includes(x)).length /
          u.amenities.length
        : 0.5;
      const score = round(
        (sameBuilding
          ? 30
          : sameCommunity
            ? 26
            : sameDistrict
              ? 20
              : query.scope === "city"
                ? 8
                : 12) +
          Math.max(
            0,
            20 -
              5 * Math.abs(u.bathrooms - v.bathrooms) -
              5 * Math.abs(u.capacity - v.capacity),
          ) +
          (u.areaSqm && v.areaSqm
            ? Math.max(
                0,
                10 - (10 * Math.abs(u.areaSqm - v.areaSqm)) / u.areaSqm,
              )
            : 4) +
          10 * common +
          (u.furnishing && u.furnishing === v.furnishing ? 5 : 2) +
          (u.view && u.view === v.view ? 5 : 2) +
          (u.reviewScore !== null && v.reviewScore !== null
            ? Math.max(0, 10 - Math.abs(u.reviewScore - v.reviewScore) * 3)
            : 4) +
          (c.status === "verified" ? 10 : 5),
      );
      if (score < 55) reasons.push("Provisional comparable score below 55/100");
      return [
        {
          offer,
          competitor,
          included: reasons.length === 0,
          reasons,
          score,
          distanceMeters,
          level,
          physicalKey: competitor.physicalKey,
          weights,
        },
      ];
    });
}
export function benchmark(
  matches: Match[],
  ourGuestNight: number | null,
): Benchmark {
  const eligible = matches.filter((m) => m.included);
  // Latest observation per platform listing/conditions, then one median per verified physical unit.
  const latest = new Map<string, Match>();
  for (const m of eligible) {
    const k = m.competitor.sourceId + ":" + m.competitor.externalListingId;
    const old = latest.get(k);
    if (
      !old ||
      Date.parse(old.offer.observedAt) < Date.parse(m.offer.observedAt)
    )
      latest.set(k, m);
  }
  const physical = new Map<string, number[]>();
  for (const m of latest.values()) {
    const k = m.physicalKey;
    physical.set(k, [
      ...(physical.get(k) || []),
      m.offer.guestTotal! / nightsBetween(m.offer.checkIn, m.offer.checkOut),
    ]);
  }
  const values = [...physical.values()].map((v) => quantile(v, 0.5)!);
  const median = quantile(values, 0.5),
    p25 = quantile(values, 0.25),
    p75 = quantile(values, 0.75);
  const trends: Benchmark["matchedTrend"] = [];
  for (const m of latest.values()) {
    const history = matches
      .filter(
        (o) =>
          (o.included ||
            o.reasons.every((r) => r === "Observation is stale")) &&
          o.competitor.externalListingId === m.competitor.externalListingId &&
          o.competitor.sourceId === m.competitor.sourceId &&
          JSON.stringify(o.competitor.characteristics) ===
            JSON.stringify(m.competitor.characteristics) &&
          Date.parse(m.offer.observedAt) - Date.parse(o.offer.observedAt) <=
            7 * 86400000 &&
          o.offer.checkIn === m.offer.checkIn &&
          o.offer.checkOut === m.offer.checkOut &&
          o.offer.guests === m.offer.guests &&
          o.offer.cancellation === m.offer.cancellation &&
          o.offer.quoteContext === m.offer.quoteContext &&
          o.offer.observedAt !== m.offer.observedAt,
      )
      .sort((a, b) => a.offer.observedAt.localeCompare(b.offer.observedAt));
    const previous = history[0];
    if (previous && previous.offer.guestTotal! > 0)
      trends.push({
        physicalKey: m.physicalKey,
        listingId: m.competitor.id,
        changePercent: round(
          ((m.offer.guestTotal! - previous.offer.guestTotal!) /
            previous.offer.guestTotal!) *
            100,
        ),
        from: previous.offer.observedAt,
        to: m.offer.observedAt,
      });
  }
  const platforms = new Map<string, number[]>();
  for (const m of latest.values())
    platforms.set(m.competitor.platform, [
      ...(platforms.get(m.competitor.platform) || []),
      m.offer.guestTotal! / nightsBetween(m.offer.checkIn, m.offer.checkOut),
    ]);
  const nearest = [...physical.keys()]
    .sort(
      (a, b) =>
        Math.min(
          ...[...latest.values()]
            .filter((m) => m.physicalKey === a)
            .map((m) => m.distanceMeters ?? Infinity),
        ) -
        Math.min(
          ...[...latest.values()]
            .filter((m) => m.physicalKey === b)
            .map((m) => m.distanceMeters ?? Infinity),
        ),
    )
    .slice(0, 3);
  const closestMedian = quantile(
    nearest.map((k) => quantile(physical.get(k)!, 0.5)!),
    0.5,
  );
  const dates = [...latest.values()]
    .map((m) => m.offer.observedAt)
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  return {
    uniqueProperties: values.length,
    sourceOffers: latest.size,
    median,
    mean: values.length
      ? round(values.reduce((a, b) => a + b, 0) / values.length)
      : null,
    minimum: values.length ? Math.min(...values) : null,
    maximum: values.length ? Math.max(...values) : null,
    p25,
    p75,
    iqr: p25 !== null && p75 !== null ? p75 - p25 : null,
    dispersion:
      median && p25 !== null && p75 !== null ? (p75 - p25) / median : null,
    ourPercentile:
      ourGuestNight !== null && values.length
        ? (values.filter((v) => v <= ourGuestNight).length / values.length) *
          100
        : null,
    differenceMedian:
      median !== null && ourGuestNight !== null ? ourGuestNight - median : null,
    closestMedian,
    differenceClosest:
      closestMedian !== null && ourGuestNight !== null
        ? ourGuestNight - closestMedian
        : null,
    newestObservation: dates.at(-1) || null,
    oldestObservation: dates[0] || null,
    matchedTrend: trends,
    platforms: [...platforms].map(([platform, v]) => ({
      platform,
      median: quantile(v, 0.5)!,
      count: v.length,
    })),
  };
}
function quoteRoomRate(
  rates: RentalRate[],
  policy: PricingPolicy,
  date: string,
  nights: number,
) {
  const selected = Array.from({ length: nights }, (_, i) =>
    rates.find((r) => r.date === addDays(date, i)),
  );
  if (
    selected.some(
      (r) => !r || r.available !== true || r.minimumStay > nights,
    ) ||
    policy.minimumStay > nights
  )
    return null;
  return selected.reduce((s, r) => s + r!.roomRate, 0) / nights;
}
export function analyzeMarket(
  dataset: MarketDataset,
  input: MarketQuery,
  now = new Date(),
): PriceDecision[] {
  const query = querySchema.parse(input),
    unit = dataset.profiles.find((p) => p.unitId === query.unitId);
  if (!unit)
    throw Error("Register the unit location and characteristics first.");
  if (query.guests > unit.characteristics.capacity)
    throw Error("Requested guests exceed this unit capacity.");
  if (query.start < now.toISOString().slice(0, 10))
    throw Error("Select future/current dates.");
  const policy = dataset.policies.find((p) => p.unitId === unit.unitId),
    rates = dataset.rates.filter((r) => r.unitId === unit.unitId);
  return Array.from({ length: query.days }, (_, i) => {
    const date = addDays(query.start, i),
      matches = matchOffers(dataset, unit, query, date, now);
    const duplicateGroups = new Map<string, Match[]>();
    for (const m of matches) {
      const k =
        m.competitor.sourceId +
        ":" +
        m.competitor.externalListingId +
        ":" +
        Date.parse(m.offer.observedAt);
      duplicateGroups.set(k, [...(duplicateGroups.get(k) || []), m]);
    }
    for (const group of duplicateGroups.values())
      if (new Set(group.map((m) => m.offer.guestTotal)).size > 1)
        for (const m of group) {
          m.included = false;
          m.reasons.push(
            "Conflicting simultaneous price observations require source review",
          );
        }
    matches.sort(
      (a, b) =>
        Number(b.included) - Number(a.included) ||
        a.level - b.level ||
        b.score - a.score ||
        (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity),
    );
    const currentRate = policy
      ? quoteRoomRate(rates, policy, date, query.stayNights)
      : null;
    const ourGuestNight =
      policy && currentRate !== null
        ? ((currentRate * query.stayNights + policy.cleaningFee) *
            (1 + policy.servicePercent / 100) *
            (1 + policy.taxPercent / 100) +
            policy.additionalGuestFee) /
          query.stayNights
        : null;
    const market = benchmark(matches, ourGuestNight),
      limitations = [
        "Advertised asking prices are not achieved bookings or competitor occupancy.",
        "Scores and movement rules are provisional, not a calibrated demand model.",
        "Revenue effects assume the same occupied nights; demand response is unknown.",
        "No verified local-event or seasonal-demand feed is connected.",
      ],
      explanation: string[] = [];
    let recommendedRate: number | null = null,
      confidence: PriceDecision["confidence"] = "insufficient";
    if (
      !policy ||
      currentRate === null ||
      query.cancellation !== policy.cancellation
    )
      explanation.push(
        "Approved policy, matching own booking conditions, or complete available rate schedule is missing.",
      );
    else if (!dataset.demo && unit.location.status !== "verified")
      explanation.push(
        "Verify the managed unit location before recommending prices.",
      );
    else if (
      market.uniqueProperties < 5 ||
      market.median === null ||
      market.dispersion === null ||
      market.dispersion > 0.5
    )
      explanation.push(INSUFFICIENT);
    else if (
      policy.operatingCostPerNight === null ||
      policy.minimumContribution === null
    )
      explanation.push(
        "Operating-cost and contribution guardrails are missing.",
      );
    else {
      // Convert the SAME guest-facing fee basis to our room-rate basis before proposing a price.
      const equivalentRoom =
        (market.median * query.stayNights - policy.additionalGuestFee) /
          ((1 + policy.servicePercent / 100) * (1 + policy.taxPercent / 100)) /
          query.stayNights -
        policy.cleaningFee / query.stayNights;
      const lead = nightsBetween(now.toISOString().slice(0, 10), date),
        forecast = rates.find((r) => r.date === date)?.occupancyForecast;
      let movement = (equivalentRoom - currentRate) * 0.25;
      if (forecast !== null && forecast !== undefined && lead < 14) {
        if (forecast > 0.85) movement = Math.max(0, movement);
        if (forecast < 0.35) movement = Math.min(0, movement);
        explanation.push(
          "Short lead-time directional gate uses the evidenced own-property occupancy forecast, not competitor occupancy.",
        );
      } else
        limitations.push(
          "Own occupancy forecast/booking-pace evidence unavailable; no demand adjustment applied.",
        );
      const maxMove = (currentRate * policy.maxChangePercent) / 100;
      const costFloor =
        (policy.operatingCostPerNight + policy.minimumContribution) /
        (1 - policy.commissionPercent / 100);
      const floor = Math.max(policy.minimumRate, costFloor);
      const candidate = round(
        Math.min(
          policy.maximumRate,
          Math.max(
            floor,
            currentRate + Math.max(-maxMove, Math.min(maxMove, movement)),
          ),
        ),
      );
      if (
        floor > policy.maximumRate ||
        Math.abs(candidate - currentRate) > maxMove + 0.02
      )
        explanation.push(
          "Owner limits, cost floor and maximum movement conflict. Explicit policy review is required.",
        );
      else {
        recommendedRate = candidate;
        confidence =
          market.uniqueProperties >= 10
            ? "provisional_moderate"
            : "provisional_low";
        explanation.push(
          "Moves 25% toward the fee-normalized comparable median, capped by the approved movement limit, owner bounds and cost floor.",
          "This is an internal proposal. Approval does not publish rates.",
        );
      }
    }
    if (matches.some((m) => m.included && m.level > 2))
      limitations.push(
        "Comparables include broader geographic markets because the selected scope permits them; no boundary equivalence is assumed.",
      );
    const delta =
      recommendedRate !== null && currentRate !== null
        ? round((recommendedRate - currentRate) * query.stayNights)
        : null;
    return {
      date,
      checkOut: addDays(date, query.stayNights),
      currentRate,
      ourGuestNight,
      market,
      recommendedRate,
      adjustmentPercent:
        recommendedRate !== null && currentRate
          ? round(((recommendedRate - currentRate) / currentRate) * 100)
          : null,
      conditionalRoomRevenueDelta: delta,
      conditionalNetDelta:
        delta !== null && policy
          ? round(delta * (1 - policy.commissionPercent / 100))
          : null,
      confidence,
      explanation,
      limitations,
      matches,
      evidenceIds: [
        ...new Set(matches.filter((m) => m.included).map((m) => m.offer.id)),
      ].sort(),
      policyVersion: policy?.version || null,
      formulaVersion: FORMULA_VERSION,
      position:
        ourGuestNight === null || market.p25 === null || market.p75 === null
          ? "unavailable"
          : ourGuestNight < market.p25
            ? "below_interquartile"
            : ourGuestNight > market.p75
              ? "above_interquartile"
              : "within_interquartile",
      status: recommendedRate === null ? "withheld" : "requires_approval",
    };
  });
}
export function scenario(
  decision: PriceDecision,
  percent: number,
  nights: number,
  commissionPercent: number,
) {
  if (
    !Number.isFinite(percent) ||
    percent < -50 ||
    percent > 50 ||
    !Number.isInteger(nights) ||
    nights < 1 ||
    nights > 90
  )
    throw Error("Scenario must use ±50% and 1–90 occupied nights.");
  if (decision.currentRate === null)
    return {
      roomRevenueDelta: null,
      netDelta: null,
      limitation: "Current rate is unavailable.",
    };
  const delta = ((decision.currentRate * percent) / 100) * nights;
  return {
    roomRevenueDelta: round(delta),
    netDelta: round(delta * (1 - commissionPercent / 100)),
    limitation:
      "Hypothetical fixed occupied nights; not a forecast. No rates changed.",
  };
}
export function managementAnswer(question: string, decisions: PriceDecision[]) {
  const q = question.trim();
  if (!q || q.length > 2000)
    throw Error("Enter a question up to 2,000 characters.");
  const supported = decisions.filter((d) => d.recommendedRate !== null),
    top = [...supported]
      .sort(
        (a, b) => (b.conditionalNetDelta || 0) - (a.conditionalNetDelta || 0),
      )
      .slice(0, 5);
  const evidence = [...new Set(top.flatMap((d) => d.evidenceIds))];
  let answer: string;
  if (/operator|management compan|who advert/i.test(q)) {
    const operators = new Map<string, string>();
    for (const d of decisions)
      for (const m of d.matches)
        if (
          m.included &&
          m.competitor.operatorName &&
          m.competitor.operatorEvidence
        ) {
          operators.set(
            m.competitor.operatorName,
            m.competitor.operatorEvidence,
          );
          evidence.push(m.offer.id);
        }
    answer = operators.size
      ? [...operators]
          .map(
            ([name, url]) => name + " — disclosed identity reference: " + url,
          )
          .join("\n")
      : "No verified operator identities are available in the selected evidence.";
  } else if (/trend|changed|last seven|last 7|increased|decreased/i.test(q)) {
    const observations = decisions.flatMap((d) =>
      d.market.matchedTrend.map(
        (t) =>
          d.date +
          ": same listing " +
          t.listingId +
          " changed asking price " +
          t.changePercent +
          "% between " +
          t.from +
          " and " +
          t.to +
          ".",
      ),
    );
    answer = observations.length
      ? observations.slice(0, 10).join("\n")
      : "No matched same-listing, same-date and same-condition observations establish a price trend.";
  } else if (/cheaper|below|above|too high|competitive/i.test(q)) {
    answer =
      decisions
        .filter((d) => d.market.differenceMedian !== null)
        .slice(0, 10)
        .map(
          (d) =>
            d.date +
            ": our guest-facing nightly total differs from comparable median by AED " +
            d.market.differenceMedian!.toFixed(2) +
            ". " +
            d.market.uniqueProperties +
            " unique comparable properties.",
        )
        .join("\n") || INSUFFICIENT;
  } else if (
    /occupancy|realized|weak contribution|districts|forecast|event/i.test(q)
  ) {
    answer =
      "The selected asking-price observations do not establish this outcome. Reconciled property performance, historical booking pace, district-wide coverage or verified event evidence is required.";
  } else
    answer = !supported.length
      ? INSUFFICIENT
      : top
          .map(
            (d) =>
              `${d.date}: consider AED ${d.recommendedRate!.toFixed(2)} room rate; comparable guest-facing median AED ${d.market.median!.toFixed(2)} from ${d.market.uniqueProperties} physical properties (${d.confidence}).`,
          )
          .join("\n");
  return {
    question: q,
    answer,
    evidenceIds: [...new Set(evidence)],
    limitations: [
      "Deterministic answer limited to the selected apartment, dates and evidence.",
      "No unrestricted web research, causal claim, demand forecast or price execution occurred.",
    ],
  };
}

export function approvedRoomRate(
  decision: PriceDecision,
  policy: PricingPolicy,
  override: number | null,
) {
  if (
    decision.recommendedRate === null ||
    decision.currentRate === null ||
    policy.operatingCostPerNight === null ||
    policy.minimumContribution === null
  )
    throw Error(
      "Recommendation is not supported by the required policy and evidence.",
    );
  const value = override ?? decision.recommendedRate;
  const floor = Math.max(
    policy.minimumRate,
    (policy.operatingCostPerNight + policy.minimumContribution) /
      (1 - policy.commissionPercent / 100),
  );
  if (
    !Number.isFinite(value) ||
    value < floor ||
    value > policy.maximumRate ||
    Math.abs(value - decision.currentRate) >
      (decision.currentRate * policy.maxChangePercent) / 100 + 0.02
  )
    throw Error("Approved rate violates owner, cost or movement guardrails.");
  return Math.round(value * 100) / 100;
}

export function mapRepresentatives(matches: Match[]) {
  const groups = new Map<string, Match[]>();
  for (const match of matches) {
    const identity = match.physicalKey || "listing:" + match.competitor.id;
    groups.set(identity, [...(groups.get(identity) || []), match]);
  }
  return [...groups.values()]
    .map((group) => {
      const ordered = [...group].sort(
        (a, b) =>
          Number(b.included) - Number(a.included) ||
          Date.parse(b.offer.observedAt) - Date.parse(a.offer.observedAt) ||
          b.score - a.score,
      );
      return {
        match: ordered[0],
        sourceListings: new Set(
          group.map(
            (m) => m.competitor.sourceId + ":" + m.competitor.externalListingId,
          ),
        ).size,
      };
    })
    .sort((a, b) => Number(a.match.included) - Number(b.match.included));
}
