import { parse } from "csv-parse/sync";
import {
  documentSchema,
  packetSchema,
  type AccountingDocument,
  type AccountingPacket,
} from "../../../src/features/accounting/model";
export const CSV_COLUMNS = [
  "externalId",
  "companyId",
  "type",
  "number",
  "postingDate",
  "currency",
  "status",
  "sourceUpdatedAt",
  "partnerName",
  "total",
  "outstanding",
  "externalLineId",
  "accountCode",
  "accountClass",
  "dimensionKey",
  "debit",
  "credit",
  "description",
] as const;
export function parseAccountingCsv(
  csv: string,
  meta: Pick<
    AccountingPacket,
    "companyId" | "periodStart" | "periodEnd" | "simulated" | "coverage"
  >,
) {
  if (typeof csv !== "string" || Buffer.byteLength(csv) > 1500000)
    throw Error("CSV is missing or exceeds 1.5 MB.");
  const rows = parse(csv, {
    columns: (header: string[]) => {
      if (
        header.length !== CSV_COLUMNS.length ||
        new Set(header).size !== header.length ||
        CSV_COLUMNS.some((k) => !header.includes(k))
      )
        throw Error("Use exact unique accounting template headers.");
      return header;
    },
    bom: true,
    skip_empty_lines: true,
    relax_column_count: false,
    max_record_size: 20000,
  }) as Record<string, string>[];
  if (!rows.length || rows.length > 10000)
    throw Error("CSV needs 1–10000 rows.");
  if (
    Object.keys(rows[0]).length !== CSV_COLUMNS.length ||
    CSV_COLUMNS.some((k) => !(k in rows[0]))
  )
    throw Error("Use the accounting journal-line CSV template headers.");
  const docs = new Map<string, AccountingDocument>();
  const metadata = new Map<string, string>();
  const num = (s: string) => {
    if (!/^\d+(\.\d{1,2})?$/.test(s))
      throw Error(
        "Amounts must be nonnegative numbers with at most two decimal places; no commas or formulas.",
      );
    return Number(s);
  };
  for (const [i, row] of rows.entries()) {
    try {
      const {
        externalLineId,
        accountCode,
        accountClass,
        dimensionKey,
        debit,
        credit,
        description,
        ...raw
      } = row;
      const values = {
        ...raw,
        total: num(row.total),
        outstanding: num(row.outstanding),
      };
      const encoded = JSON.stringify(values);
      if (
        metadata.has(row.externalId) &&
        metadata.get(row.externalId) !== encoded
      )
        throw Error("Conflicting document metadata across lines.");
      metadata.set(row.externalId, encoded);
      const line = {
        externalLineId,
        accountCode,
        accountClass,
        dimensionKey,
        debit: num(debit),
        credit: num(credit),
        description,
      };
      const existing = docs.get(row.externalId);
      if (existing) existing.lines.push(line as any);
      else
        docs.set(row.externalId, {
          ...values,
          lines: [line],
        } as AccountingDocument);
    } catch (e) {
      throw Error("CSV row " + (i + 2) + ": " + (e as Error).message);
    }
  }
  return packetSchema.parse({
    ...meta,
    documents: [...docs.values()].map((d) => documentSchema.parse(d)),
  });
}
