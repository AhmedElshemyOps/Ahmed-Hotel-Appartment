import { z } from "zod";
const text = z.string().trim().min(1).max(180);
const amount = z
  .number()
  .finite()
  .nonnegative()
  .max(10000000)
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
    "Use monetary amounts with at most two decimal places",
  );
const nullableText = z.string().max(500).nullable();
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      Number.isFinite(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "Invalid calendar date",
  );
export const instant = z.string().datetime({ offset: true });
export const publicUrl = z
  .string()
  .url()
  .max(1000)
  .refine((s) => {
    const u = new URL(s);
    return u.protocol === "https:" && !u.username && !u.password;
  }, "Use a public HTTPS reference");
export const locationSchema = z
  .object({
    latitude: z.number().min(-85).max(85).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    accuracyMeters: z.number().nonnegative().max(100000).nullable(),
    address: nullableText,
    buildingName: nullableText,
    buildingReference: nullableText,
    community: text,
    district: text,
    city: text,
    emirate: nullableText,
    country: z.string().length(2),
    postalCode: nullableText,
    status: z.enum(["unverified", "verified", "approximate", "synthetic"]),
    provider: nullableText,
    verifiedAt: instant.nullable(),
    evidenceUrl: publicUrl.nullable(),
  })
  .refine(
    (v) => (v.latitude === null) === (v.longitude === null),
    "Latitude and longitude must both be present or both unavailable",
  )
  .refine(
    (v) =>
      v.status !== "verified" ||
      (v.latitude !== null &&
        v.accuracyMeters !== null &&
        v.verifiedAt !== null &&
        v.evidenceUrl !== null),
    "Verification requires coordinates, accuracy, timestamp and evidence",
  );
export const characteristicsSchema = z.object({
  category: z.enum(["entire_unit", "private_room", "hotel_room"]),
  rentalModel: z.enum(["short_term", "long_term"]),
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z.number().min(0.5).max(20),
  capacity: z.number().int().min(1).max(50),
  areaSqm: z.number().positive().max(10000).nullable(),
  floor: z.number().int().min(-10).max(200).nullable(),
  furnishing: nullableText,
  condition: nullableText,
  view: nullableText,
  reviewScore: z.number().min(0).max(10).nullable(),
  reviewCount: z.number().int().nonnegative().nullable(),
  licenseStatus: nullableText,
  amenities: z.array(text).max(50),
  accessibility: z.array(text).max(20),
  attractionDistances: z
    .array(
      z.object({
        name: text,
        distanceMeters: z.number().nonnegative(),
        evidenceUrl: publicUrl,
      }),
    )
    .max(20),
});
export const profileSchema = z.object({
  unitId: text,
  propertyId: z.string().uuid(),
  unitNumber: text,
  location: locationSchema,
  characteristics: characteristicsSchema,
});
export type GeoProfile = z.infer<typeof profileSchema>;
export const propertySchema = z.object({
  id: z.string().uuid().optional(),
  name: text,
});
export const policySchema = z
  .object({
    unitId: text,
    minimumRate: amount,
    maximumRate: amount,
    targetRate: amount.nullable(),
    maxChangePercent: z.number().min(0).max(20),
    minimumStay: z.number().int().min(1).max(90),
    cleaningFee: amount,
    servicePercent: z.number().min(0).max(50),
    taxPercent: z.number().min(0).max(50),
    commissionPercent: z.number().min(0).max(50),
    operatingCostPerNight: amount.nullable(),
    minimumContribution: amount.nullable(),
    cancellation: z.enum(["flexible", "nonrefundable"]),
    ownerApprovalReference: text,
    weekendPolicy: nullableText,
    seasonalPolicy: nullableText,
    additionalGuestFee: amount,
  })
  .refine(
    (v) => v.maximumRate >= v.minimumRate,
    "Maximum cannot be below minimum",
  )
  .refine(
    (v) =>
      v.targetRate === null ||
      (v.targetRate >= v.minimumRate && v.targetRate <= v.maximumRate),
    "Target must be within approved limits",
  );
export type PricingPolicy = z.infer<typeof policySchema> & {
  version: number;
  approvedAt: string;
  approvedBy: string;
};
export const rateSchema = z
  .object({
    unitId: text,
    date: isoDate,
    roomRate: amount,
    available: z.boolean().nullable(),
    minimumStay: z.number().int().min(1).max(90),
    occupancyForecast: z.number().min(0).max(1).nullable(),
    forecastEvidence: publicUrl.nullable(),
  })
  .refine(
    (v) => v.occupancyForecast === null || v.forecastEvidence !== null,
    "Forecast requires evidence",
  );
export type RentalRate = z.infer<typeof rateSchema> & {
  version: number;
  recordedAt: string;
};
export const sourceSchema = z.object({
  id: z.string().uuid().optional(),
  name: text,
  provider: text,
  permissionReference: publicUrl,
  expiresAt: instant,
  maxAgeHours: z.number().min(1).max(72),
  analysisAllowed: z.literal(true),
  storageAllowed: z.literal(true),
  exportAllowed: z.boolean(),
  derivativesAllowed: z.literal(true),
});
export type MarketSource = z.infer<typeof sourceSchema> & {
  id: string;
  authorizedBy: string;
  authorizedAt: string;
  revokedAt: string | null;
};
export const competitorSchema = z
  .object({
    externalListingId: text,
    physicalKey: text,
    identityEvidence: publicUrl,
    title: text,
    url: publicUrl,
    platform: text,
    operatorName: nullableText,
    operatorEvidence: publicUrl.nullable(),
    location: locationSchema,
    characteristics: characteristicsSchema,
  })
  .refine(
    (v) => v.operatorName === null || v.operatorEvidence !== null,
    "Operator identity requires evidence",
  );
export type Competitor = z.infer<typeof competitorSchema> & {
  id: string;
  sourceId: string;
  propertyId: string;
};
export const offerSchema = z
  .object({
    observationId: text,
    listingId: text,
    checkIn: isoDate,
    checkOut: isoDate,
    guests: z.number().int().min(1).max(50),
    available: z.boolean().nullable(),
    minimumStay: z.number().int().min(1).max(90),
    cancellation: z.enum(["flexible", "nonrefundable", "unknown"]),
    quoteContext: text,
    currency: z.string().length(3),
    roomTotal: amount.nullable(),
    cleaningFee: amount.nullable(),
    serviceFee: amount.nullable(),
    taxes: amount.nullable(),
    guestTotal: amount.nullable(),
    allFeesKnown: z.boolean(),
    observedAt: instant,
    verification: z.enum(["verified", "unverified", "synthetic"]),
    sourceUrl: publicUrl,
  })
  .refine((v) => v.checkOut > v.checkIn, "Checkout must be after check-in")
  .refine(
    (v) =>
      !v.allFeesKnown ||
      ([v.roomTotal, v.cleaningFee, v.serviceFee, v.taxes, v.guestTotal].every(
        (n) => n !== null,
      ) &&
        Math.abs(
          v.roomTotal! +
            v.cleaningFee! +
            v.serviceFee! +
            v.taxes! -
            v.guestTotal!,
        ) <= 0.02),
    "Complete totals must reconcile to explicit fee components",
  );
export type CompetitorOffer = z.infer<typeof offerSchema> & {
  id: string;
  sourceId: string;
  propertyId: string;
  listingId: string;
};
export const querySchema = z.object({
  unitId: text,
  start: isoDate,
  days: z.number().int().min(1).max(90),
  stayNights: z.number().int().min(1).max(30),
  guests: z.number().int().min(1).max(50),
  radiusMeters: z.number().min(100).max(50000),
  scope: z.enum(["building", "community", "district", "nearby", "city"]),
  cancellation: z.enum(["flexible", "nonrefundable"]),
  quoteContext: text,
});
export type MarketQuery = z.infer<typeof querySchema>;
export type MarketDataset = {
  properties: { id: string; name: string }[];
  profiles: GeoProfile[];
  policies: PricingPolicy[];
  rates: RentalRate[];
  sources: MarketSource[];
  competitors: Competitor[];
  offers: CompetitorOffer[];
  demo: boolean;
  generatedAt: string;
};
export type Match = {
  offer: CompetitorOffer;
  competitor: Competitor;
  included: boolean;
  reasons: string[];
  score: number;
  distanceMeters: number | null;
  level: number;
  physicalKey: string;
  weights: Record<string, number>;
};
export type PriceDecision = {
  date: string;
  checkOut: string;
  currentRate: number | null;
  ourGuestNight: number | null;
  market: Benchmark;
  recommendedRate: number | null;
  adjustmentPercent: number | null;
  conditionalRoomRevenueDelta: number | null;
  conditionalNetDelta: number | null;
  confidence: "insufficient" | "provisional_low" | "provisional_moderate";
  explanation: string[];
  limitations: string[];
  matches: Match[];
  evidenceIds: string[];
  policyVersion: number | null;
  formulaVersion: string;
  position:
    | "below_interquartile"
    | "within_interquartile"
    | "above_interquartile"
    | "unavailable";
  status: "requires_approval" | "withheld";
};
export type Benchmark = {
  uniqueProperties: number;
  sourceOffers: number;
  median: number | null;
  mean: number | null;
  minimum: number | null;
  maximum: number | null;
  p25: number | null;
  p75: number | null;
  iqr: number | null;
  dispersion: number | null;
  ourPercentile: number | null;
  differenceMedian: number | null;
  closestMedian: number | null;
  differenceClosest: number | null;
  newestObservation: string | null;
  oldestObservation: string | null;
  matchedTrend: {
    physicalKey: string;
    listingId: string;
    changePercent: number;
    from: string;
    to: string;
  }[];
  platforms: { platform: string; median: number; count: number }[];
};
export const addDays = (date: string, n: number) =>
  new Date(Date.parse(isoDate.parse(date) + "T00:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
export const nightsBetween = (a: string, b: string) =>
  (Date.parse(isoDate.parse(b)) - Date.parse(isoDate.parse(a))) / 86400000;
