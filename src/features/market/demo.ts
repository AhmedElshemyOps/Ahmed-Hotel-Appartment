import type { Apartment } from "../../shared/types";
import type {
  MarketDataset,
  GeoProfile,
  PricingPolicy,
  RentalRate,
  Competitor,
  CompetitorOffer,
} from "./model";
import { addDays } from "./model";
import { businessDate } from "../guest-service/guestService";
export function marketDemo(
  apartments: Apartment[],
  now = new Date(),
): MarketDataset {
  const start = addDays(businessDate(now), 1),
    collected = new Date(now.valueOf() - 3600000).toISOString(),
    previous = new Date(now.valueOf() - 6 * 86400000).toISOString();
  const properties = [
    {
      id: "10000000-0000-4000-8000-000000000001",
      name: "Yas Island — SYNTHETIC portfolio",
    },
    {
      id: "10000000-0000-4000-8000-000000000002",
      name: "Dubai — SYNTHETIC portfolio",
    },
  ];
  const sourceId = "20000000-0000-4000-8000-000000000001";
  const profiles: GeoProfile[] = apartments.slice(0, 40).map((u, i) => {
    const market = i < 20 ? 0 : 1,
      base = market === 0 ? [24.49, 54.6] : [25.08, 55.14],
      bedrooms =
        u.type === "Studio"
          ? 0
          : u.type === "One-bedroom"
            ? 1
            : u.type === "Two-bedroom"
              ? 2
              : 3;
    return {
      unitId: u.id,
      propertyId: properties[market].id,
      unitNumber: u.unitNumber,
      location: {
        latitude: base[0] + (i % 5) * 0.0004,
        longitude: base[1] + (i % 4) * 0.0004,
        accuracyMeters: 20,
        address: "Synthetic coordinate example — not an actual managed address",
        buildingName: "SYNTHETIC Tower " + (Math.floor(i / 5) + 1),
        buildingReference: "demo-building-" + Math.floor(i / 5),
        community:
          market === 0
            ? "Yas Island (synthetic positions)"
            : "Demo Marina (synthetic positions)",
        district: market === 0 ? "Yas Island" : "Demo district",
        city: market === 0 ? "Abu Dhabi" : "Dubai",
        emirate: market === 0 ? "Abu Dhabi" : "Dubai",
        country: "AE",
        postalCode: null,
        status: "synthetic",
        provider: "Deterministic fixture",
        verifiedAt: null,
        evidenceUrl: null,
      },
      characteristics: {
        category: "entire_unit",
        rentalModel: "short_term",
        bedrooms,
        bathrooms: Math.max(1, bedrooms),
        capacity: 2 + bedrooms,
        areaSqm: 45 + 35 * bedrooms,
        floor: 1 + (i % 8),
        furnishing: "standard",
        condition: "good",
        view: "community",
        reviewScore: 8.5,
        reviewCount: 40,
        licenseStatus: "Synthetic — not a license claim",
        amenities: ["parking", "pool", "gym", "balcony"],
        accessibility: [],
        attractionDistances: [],
      },
    };
  });
  const policies: PricingPolicy[] = profiles.map((p) => ({
    unitId: p.unitId,
    minimumRate: 300 + 100 * p.characteristics.bedrooms,
    maximumRate: 1200 + 400 * p.characteristics.bedrooms,
    targetRate: 550 + 200 * p.characteristics.bedrooms,
    maxChangePercent: 10,
    minimumStay: 1,
    cleaningFee: 40,
    servicePercent: 0,
    taxPercent: 5,
    commissionPercent: 15,
    operatingCostPerNight: 150 + 40 * p.characteristics.bedrooms,
    minimumContribution: 50,
    cancellation: "flexible",
    ownerApprovalReference: "SYNTHETIC POLICY — no real owner approval",
    weekendPolicy: null,
    seasonalPolicy: null,
    additionalGuestFee: 0,
    version: 1,
    approvedAt: collected,
    approvedBy: "synthetic-gm",
  }));
  const rates: RentalRate[] = profiles.flatMap((p) =>
    Array.from({ length: 120 }, (_, i) => ({
      unitId: p.unitId,
      date: addDays(start, i),
      roomRate: 450 + 180 * p.characteristics.bedrooms + (i % 7 > 4 ? 35 : 0),
      available: true,
      minimumStay: 1,
      occupancyForecast: 0.65,
      forecastEvidence: "https://synthetic.invalid/forecast",
      version: 1,
      recordedAt: collected,
    })),
  );
  const competitors: Competitor[] = [],
    offers: CompetitorOffer[] = [];
  for (let market = 0; market < 2; market++)
    for (let beds = 0; beds < 4; beds++)
      for (let n = 0; n < 8; n++) {
        const template =
          profiles.find((p) => p.propertyId === properties[market].id) ||
          profiles[0];
        if (!template) continue;
        for (
          let platformIndex = 0;
          platformIndex < (n % 4 === 0 ? 2 : 1);
          platformIndex++
        ) {
          const physical = `synthetic-${market}-${beds}-${n}`,
            id = physical + "-" + platformIndex;
          const c: Competitor = {
            id,
            externalListingId: id,
            physicalKey: physical,
            identityEvidence: "https://synthetic.invalid/identity/" + physical,
            sourceId,
            propertyId: properties[market].id,
            title: "SYNTHETIC comparable " + beds + "BR " + n,
            url: "https://synthetic.invalid/listing/" + id,
            platform: platformIndex ? "Vrbo (synthetic)" : "Airbnb (synthetic)",
            operatorName: "SYNTHETIC Operator " + n,
            operatorEvidence: "https://synthetic.invalid/operators/" + n,
            location: {
              ...template.location,
              latitude: template.location.latitude! + 0.0008 * (n + 1),
              longitude: template.location.longitude! + 0.0004 * n,
              buildingName: "SYNTHETIC Competitor Tower " + n,
              buildingReference: "synthetic-competitor-building-" + n,
            },
            characteristics: {
              ...template.characteristics,
              bedrooms: beds,
              bathrooms: Math.max(1, beds),
              capacity: 2 + beds,
              areaSqm: 45 + beds * 35,
              reviewScore: 8 + n * 0.1,
            },
          };
          competitors.push(c);
          for (let i = 0; i < 90; i++)
            for (const age of [0, 1]) {
              const room =
                  500 +
                  beds * 180 +
                  n * 12 +
                  (i % 7 > 4 ? 40 : 0) +
                  (platformIndex ? 10 : 0) -
                  (age ? 20 : 0),
                checkIn = addDays(start, i);
              offers.push({
                id: id + "-" + i + "-" + age,
                observationId: id + "-" + i + "-" + age,
                listingId: id,
                sourceId,
                propertyId: c.propertyId,
                checkIn,
                checkOut: addDays(checkIn, 1),
                guests: 2,
                available: true,
                minimumStay: 1,
                cancellation: "flexible",
                quoteContext: "public-web-AE-2-adults",
                currency: "AED",
                roomTotal: room,
                cleaningFee: 40,
                serviceFee: 20,
                taxes: (room + 60) * 0.05,
                guestTotal: (room + 60) * 1.05,
                allFeesKnown: true,
                observedAt: age ? previous : collected,
                verification: "synthetic",
                sourceUrl: c.url,
              });
            }
        }
      }
  return {
    properties,
    profiles,
    policies,
    rates,
    competitors,
    offers,
    sources: [
      {
        id: sourceId,
        name: "SYNTHETIC licensed-feed example",
        provider: "Synthetic fixture — NO live platform connection",
        permissionReference: "https://synthetic.invalid/permission",
        expiresAt: new Date(now.valueOf() + 86400000 * 365).toISOString(),
        maxAgeHours: 24,
        analysisAllowed: true,
        storageAllowed: true,
        derivativesAllowed: true,
        exportAllowed: true,
        authorizedBy: "synthetic-gm",
        authorizedAt: collected,
        revokedAt: null,
      },
    ],
    demo: true,
    generatedAt: now.toISOString(),
  };
}
