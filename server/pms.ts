import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import type { Apartment, Reservation } from "../src/types";
import {
  channelKey,
  type DistributionChannel,
} from "../src/services/distribution";

export const FIELDS = [
  "externalId",
  "unitNumber",
  "checkInDate",
  "checkOutDate",
  "bookingDate",
  "status",
  "channel",
  "dailyRateAED",
  "commissionRatePercent",
  "currency",
] as const;
export type Mapping = Record<(typeof FIELDS)[number], string>;
export type StoredReservation = {
  externalId: string;
  source: string;
  version: number;
  data: Reservation;
  lastBatch: string | null;
  sourceUpdatedAt?: string;
};
export type Change = {
  key: string;
  before: StoredReservation | null;
  after: StoredReservation;
  operation: "insert" | "update" | "unchanged";
};
export type Preview = {
  changes: Change[];
  errors: { row: number; message: string }[];
  summary: Record<"insert" | "update" | "unchanged", number>;
};
export const fingerprint = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
export function csvRows(csv: string) {
  if (typeof csv !== "string" || Buffer.byteLength(csv) > 2_000_000)
    throw Error("Choose a CSV file smaller than 2 MB.");
  const rows: string[][] = parse(csv, {
    bom: true,
    skip_empty_lines: true,
    max_record_size: 20000,
    relax_column_count: false,
  });
  const headers = (rows.shift() || []).map((s) => s.trim());
  if (
    !headers.length ||
    headers.some((h) => !h) ||
    new Set(headers).size !== headers.length
  )
    throw Error("CSV headers must be nonempty and unique.");
  if (!rows.length || rows.length > 5000)
    throw Error("Provide between 1 and 5,000 rows. Split larger exports.");
  return { headers, rows };
}
function date(s: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    !Number.isFinite(Date.parse(s)) ||
    new Date(s).toISOString().slice(0, 10) !== s
  )
    throw Error("Dates must be valid YYYY-MM-DD values.");
  return s;
}
function amount(s: string, max: number) {
  if (!/^\d+(\.\d{1,4})?$/.test(s))
    throw Error(
      "Amounts must be nonnegative plain numbers; no currency symbols or grouping separators.",
    );
  const n = Number(s);
  if (!Number.isFinite(n) || n > max)
    throw Error("Amount is outside the allowed range.");
  return n;
}
export function previewPms(
  csv: string,
  mapping: Mapping,
  source: string,
  apartments: Apartment[],
  channels: DistributionChannel[],
  current: StoredReservation[],
  allowLiveUpdates = false,
): Preview {
  if (typeof source !== "string" || !/^[a-z0-9][a-z0-9_-]{0,59}$/.test(source))
    throw Error(
      "Source account must be a stable lowercase ID, for example lodgify-company-a.",
    );
  const { headers, rows } = csvRows(csv);
  if (
    !mapping ||
    FIELDS.some(
      (f) => typeof mapping[f] !== "string" || !headers.includes(mapping[f]),
    ) ||
    new Set(FIELDS.map((f) => mapping[f])).size !== FIELDS.length
  )
    throw Error("Map every required field to a different column.");
  const changes: Change[] = [],
    errors: Preview["errors"] = [],
    seen = new Set<string>();
  const byKey = new Map(current.map((r) => [r.source + ":" + r.externalId, r]));
  for (const [i, row] of rows.entries()) {
    try {
      const get = (f: (typeof FIELDS)[number]) =>
        row[headers.indexOf(mapping[f])].trim();
      const externalId = get("externalId");
      if (!externalId || externalId.length > 120)
        throw Error("A stable reservation ID of 1–120 characters is required.");
      const key = source + ":" + externalId;
      if (seen.has(key)) throw Error("Duplicate reservation ID in this file.");
      seen.add(key);
      const unit = apartments.find((a) => a.unitNumber === get("unitNumber"));
      if (!unit)
        throw Error("Unknown unit. Add the actual unit before importing.");
      const channel = channels.find((c) =>
        [c.name, ...c.aliases].some(
          (n) => channelKey(n) === channelKey(get("channel")),
        ),
      );
      const before = byKey.get(key) || null;
      if (
        !channel ||
        (!channel.active && before?.data.channel !== channel.name)
      )
        throw Error(
          "Unknown or archived channel. Add a channel or source alias in Revenue Intelligence.",
        );
      const checkInDate = date(get("checkInDate")),
        checkOutDate = date(get("checkOutDate"));
      if (checkOutDate <= checkInDate)
        throw Error("Check-out must be after check-in.");
      const status = get("status");
      if (!["Confirmed", "In-House", "Completed", "Canceled"].includes(status))
        throw Error(
          "Status must be Confirmed, In-House, Completed or Canceled; map source values before upload.",
        );
      if (get("currency") !== "AED")
        throw Error(
          "Only explicit AED amounts are supported. Convert with an approved FX policy first.",
        );
      const dailyRateAED = amount(get("dailyRateAED"), 1_000_000),
        commissionRatePercent = amount(get("commissionRatePercent"), 100);
      const nights =
        (Date.parse(checkOutDate) - Date.parse(checkInDate)) / 86400000;
      const totalRoomRevenueAED = Math.round(nights * dailyRateAED * 100) / 100;
      const data: Reservation = {
        id: before?.data.id || "PMS-" + fingerprint(key).slice(0, 24),
        unitId: unit.id,
        guestName: "Guest details withheld",
        guestCategory: "Leisure",
        channel: channel.name,
        bookingDate: date(get("bookingDate")),
        checkInDate,
        checkOutDate,
        nights,
        dailyRateAED,
        totalRoomRevenueAED,
        commissionRatePercent,
        netRevenueAED:
          Math.round(
            totalRoomRevenueAED * (1 - commissionRatePercent / 100) * 100,
          ) / 100,
        status: status as Reservation["status"],
        isDemo: false,
      };
      const operation = !before
        ? "insert"
        : fingerprint(before.data) === fingerprint(data)
          ? "unchanged"
          : "update";
      if (
        before?.sourceUpdatedAt &&
        operation === "update" &&
        !allowLiveUpdates
      )
        throw Error(
          "This reservation is owned by automatic synchronization. Correct it in the source system.",
        );
      changes.push({
        key,
        before,
        after: {
          externalId,
          source,
          version: (before?.version || 0) + (operation === "unchanged" ? 0 : 1),
          data,
          lastBatch: null,
        },
        operation,
      });
    } catch (e) {
      errors.push({ row: i + 2, message: (e as Error).message });
    }
  }
  // Reject overlapping active reservations, including stays omitted from the update file.
  const prospective = new Map(byKey);
  changes.forEach((c) => prospective.set(c.key, c.after));
  const stays = [...prospective.entries()]
    .filter(([, r]) => r.data.status !== "Canceled")
    .sort((a, b) => a[1].data.checkInDate.localeCompare(b[1].data.checkInDate));
  const unitEnds = new Map<string, string>();
  for (const [, { data: r }] of stays) {
    if ((unitEnds.get(r.unitId) || "") > r.checkInDate) {
      errors.push({
        row: 0,
        message:
          "Overlapping reservations for a unit. Resolve duplicates or conflicts before approval.",
      });
      break;
    }
    unitEnds.set(r.unitId, r.checkOutDate);
  }
  return {
    changes,
    errors,
    summary: {
      insert: changes.filter((c) => c.operation === "insert").length,
      update: changes.filter((c) => c.operation === "update").length,
      unchanged: changes.filter((c) => c.operation === "unchanged").length,
    },
  };
}
