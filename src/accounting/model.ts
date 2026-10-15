import { z } from "zod";
export const accountingDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Invalid accounting date",
  );
const id = z.string().trim().min(1).max(180);
export const money = z
  .number()
  .finite()
  .nonnegative()
  .max(100000000)
  .refine(
    (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001,
    "Use at most two decimal places",
  );
export const lineSchema = z
  .object({
    externalLineId: id,
    accountCode: id,
    accountClass: z.enum(["revenue", "expense", "balance"]),
    dimensionKey: z.string().trim().max(180),
    debit: money,
    credit: money,
    description: z.string().max(1000),
  })
  .strict()
  .refine(
    (l) => !(l.debit > 0 && l.credit > 0),
    "A line cannot have both debit and credit",
  );
export const documentSchema = z
  .object({
    externalId: id,
    companyId: id,
    type: z.enum([
      "invoice",
      "supplier_bill",
      "payment",
      "expense",
      "journal",
      "credit_note",
      "supplier_credit",
    ]),
    number: id,
    postingDate: accountingDate,
    currency: z.literal("AED"),
    status: z.enum(["draft", "posted", "cancelled"]),
    sourceUpdatedAt: z.string().datetime({ offset: true }),
    partnerName: z.string().max(250),
    total: money,
    outstanding: money,
    lines: z.array(lineSchema).min(2).max(2000),
  })
  .strict()
  .refine(
    (d) => d.outstanding <= d.total,
    "Outstanding cannot exceed document total",
  )
  .refine(
    (d) =>
      new Set(d.lines.map((l) => l.externalLineId)).size === d.lines.length,
    "Duplicate ledger line IDs",
  );
export type AccountingDocument = z.infer<typeof documentSchema>;
export const packetSchema = z
  .object({
    companyId: id,
    simulated: z.boolean(),
    periodStart: accountingDate,
    periodEnd: accountingDate,
    coverage: z.enum(["partial", "period-export"]),
    documents: z.array(documentSchema).min(1).max(2000),
  })
  .strict()
  .superRefine((p, c) => {
    if (p.periodStart > p.periodEnd)
      c.addIssue({ code: "custom", message: "Period start exceeds end" });
    const docs = new Set<string>(),
      lines = new Set<string>();
    for (const d of p.documents) {
      if (d.companyId !== p.companyId)
        c.addIssue({ code: "custom", message: "Mixed accounting companies" });
      if (d.postingDate < p.periodStart || d.postingDate > p.periodEnd)
        c.addIssue({
          code: "custom",
          message: "Document lies outside declared export period",
        });
      if (docs.has(d.externalId))
        c.addIssue({ code: "custom", message: "Duplicate document ID" });
      docs.add(d.externalId);
      for (const l of d.lines) {
        if (lines.has(l.externalLineId))
          c.addIssue({
            code: "custom",
            message:
              "Ledger line appears in multiple documents; do not import the same expense twice",
          });
        lines.add(l.externalLineId);
      }
    }
  });
export type AccountingPacket = z.infer<typeof packetSchema>;
export const connectionSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    provider: z.enum(["odoo", "csv"]),
    hosting: z.enum(["unknown", "online", "odoo-sh", "self-hosted"]),
    version: z.string().trim().max(80),
    protocol: z.enum(["unknown", "json2", "jsonrpc", "xmlrpc"]),
    endpoint: z
      .string()
      .max(1000)
      .refine(
        (v) =>
          !v ||
          (() => {
            try {
              const u = new URL(v);
              return (
                u.protocol === "https:" &&
                !u.username &&
                !u.password &&
                !u.search &&
                !u.hash &&
                u.pathname === "/"
              );
            } catch {
              return false;
            }
          })(),
        "Use the HTTPS base URL without credentials, paths or query parameters",
      ),
    companyId: id,
    credentialSecretRef: z
      .string()
      .max(500)
      .refine(
        (v) =>
          !v ||
          /^projects\/[a-zA-Z0-9_-]+\/secrets\/[a-zA-Z0-9_-]+\/versions\/(latest|[0-9]+)$/.test(
            v,
          ),
        "Use a Secret Manager resource reference, never the credential",
      ),
    discoveryNotes: z.string().max(3000),
  })
  .strict();
export type AccountingConnection = z.infer<typeof connectionSchema>;
export type DimensionMapping = {
  dimensionKey: string;
  unitId: string | null;
  building: string;
  reviewedBy: string;
};
export const cents = (v: number) => Math.round(v * 100);
