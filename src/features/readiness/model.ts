import { z } from "zod";
const text = z.string().trim().min(1).max(500);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Invalid date",
  );
const link = z
  .string()
  .url()
  .max(2000)
  .refine(
    (v) =>
      new URL(v).protocol === "https:" &&
      !new URL(v).username &&
      !new URL(v).password,
    "Use an HTTPS evidence reference without credentials",
  );
export const capability = z.enum(["compliance", "operations", "distribution"]);
export type Capability = z.infer<typeof capability>;
export const requirementSchema = z
  .object({
    id: text,
    label: text,
    mandatory: z.boolean(),
    authority: text,
    sourceUrl: link,
    reviewedOn: date,
    validUntil: date,
  })
  .strict();
export const documentSchema = z
  .object({
    id: text,
    requirementId: text,
    category: text,
    authority: text,
    reference: text,
    issuedOn: date,
    expiresOn: date,
    renewalOn: date,
    responsibleUid: text,
    evidenceUrl: link,
    notes: z.string().max(3000),
    status: z.enum(["unverified", "verified", "rejected", "revoked"]),
    verifiedBy: z.string(),
    verifiedAt: z.string(),
  })
  .strict()
  .refine(
    (d) => d.issuedOn <= d.expiresOn && d.renewalOn <= d.expiresOn,
    "Check issue, renewal and expiry dates",
  );
export const checkSchema = z
  .object({
    id: text,
    label: text,
    passed: z.boolean(),
    evidenceUrl: link.optional(),
    checkedBy: z.string(),
    checkedAt: z.string(),
  })
  .strict();
export const mediaSchema = z
  .object({
    id: text,
    kind: z.enum(["photo", "video"]),
    category: text,
    evidenceUrl: link,
    width: z.number().int().min(1).max(50000),
    height: z.number().int().min(1).max(50000),
    bytes: z.number().int().positive().max(500000000),
    mime: z.enum([
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/webm",
    ]),
    durationSeconds: z.number().nonnegative().max(36000),
    creator: text,
    usagePermission: text,
    approved: z.boolean(),
  })
  .strict()
  .refine(
    (m) =>
      m.kind === "photo"
        ? m.mime.startsWith("image/") && m.durationSeconds === 0
        : m.mime.startsWith("video/") && m.durationSeconds > 0,
    "Media type and duration disagree",
  );
export const listingSchema = z
  .object({
    channel: text,
    title: z.string().max(200),
    description: z.string().max(10000),
    amenities: z.array(text).max(100),
    houseRules: z.string().max(3000),
    checkIn: text,
    checkOut: text,
    cancellation: z.string().max(2000),
    minimumStay: z.number().int().min(1).max(365),
    guestCapacity: z.number().int().min(1).max(100),
    cleaningFee: z.number().finite().nonnegative().max(100000),
    additionalGuestFee: z.number().finite().nonnegative().max(100000),
    requiredPhotos: z.array(text).min(1).max(40),
    minimumWidth: z.number().int().min(1).max(10000),
    acceptsVideo: z.boolean(),
    videoRuleSource: link.optional(),
    status: z.enum([
      "Not Started",
      "Content Incomplete",
      "Pending Review",
      "Ready for Submission",
      "Submitted",
      "Published",
      "Rejected",
      "Suspended",
      "Requires Update",
    ]),
    confirmationUrl: link.optional(),
    confirmationReference: z.string().max(500),
    reviewedBy: z.string(),
    reviewedAt: z.string(),
  })
  .strict();
export const stateSchema = z
  .object({
    jurisdiction: text,
    rentalModel: z.enum([
      "holiday-home",
      "serviced-apartment",
      "hotel-apartment",
    ]),
    rulesReviewed: z.boolean(),
    requirements: z.array(requirementSchema).max(100),
    documents: z.array(documentSchema).max(300),
    operations: z.array(checkSchema).max(50),
    commercial: z.array(checkSchema).max(50),
    verifiedAmenities: z.array(text).max(100),
    media: z.array(mediaSchema).max(200),
    listings: z.array(listingSchema).max(30),
    reminderDays: z.array(z.number().int().min(0).max(365)).min(1).max(20),
    tasks: z
      .array(
        z
          .object({
            id: text,
            label: text,
            responsibleUid: text,
            dueOn: date,
            status: z.enum(["open", "done"]),
            evidenceUrl: link.optional(),
          })
          .strict(),
      )
      .max(200),
    status: z.enum([
      "Draft",
      "Compliance Pending",
      "Operational Preparation",
      "OTA Preparation",
      "Ready for Activation",
      "Active / Rentable",
      "Suspended",
      "Offboarding",
    ]),
    restriction: z.string().max(3000),
  })
  .strict()
  .superRefine((s, c) => {
    for (const key of [
      "requirements",
      "documents",
      "operations",
      "commercial",
      "media",
      "tasks",
    ] as const) {
      const ids = s[key].map((v) => v.id);
      if (new Set(ids).size !== ids.length)
        c.addIssue({
          code: "custom",
          path: [key],
          message: "Duplicate identifiers",
        });
    }
    if (
      new Set(s.listings.map((v) => v.channel.toLowerCase())).size !==
      s.listings.length
    )
      c.addIssue({
        code: "custom",
        path: ["listings"],
        message: "Duplicate channel",
      });
  });
export type ReadinessState = z.infer<typeof stateSchema>;
export type Listing = z.infer<typeof listingSchema>;
export const operationLabels = [
  "Furnishing",
  "Housekeeping",
  "Maintenance inspection",
  "Safety inspection",
  "Utilities",
  "Internet",
  "Guest support",
  "Guest access",
];
export const commercialLabels = [
  "Pricing approved",
  "Reservation configuration",
  "OTA content reviewed",
  "Management review",
];
export function initialReadiness(): ReadinessState {
  return {
    jurisdiction: "Abu Dhabi",
    rentalModel: "holiday-home",
    rulesReviewed: false,
    requirements: [],
    documents: [],
    operations: operationLabels.map((label, i) => ({
      id: "op-" + i,
      label,
      passed: false,
      checkedBy: "",
      checkedAt: "",
    })),
    commercial: commercialLabels.map((label, i) => ({
      id: "co-" + i,
      label,
      passed: false,
      checkedBy: "",
      checkedAt: "",
    })),
    verifiedAmenities: [],
    media: [],
    listings: [],
    reminderDays: [90, 60, 30, 14, 7, 0],
    tasks: [],
    status: "Draft",
    restriction: "",
  };
}
export function emptyListing(channel: string): Listing {
  return {
    channel,
    title: "",
    description: "",
    amenities: [],
    houseRules: "",
    checkIn: "15:00",
    checkOut: "11:00",
    cancellation: "",
    minimumStay: 1,
    guestCapacity: 2,
    cleaningFee: 0,
    additionalGuestFee: 0,
    requiredPhotos: ["cover", "living room", "bedroom", "bathroom", "kitchen"],
    minimumWidth: 1200,
    acceptsVideo: false,
    status: "Not Started",
    confirmationReference: "",
    reviewedBy: "",
    reviewedAt: "",
  };
}
