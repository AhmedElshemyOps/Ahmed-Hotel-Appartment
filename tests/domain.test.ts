import { test } from "node:test";
import assert from "node:assert/strict";
import { previewPms, csvRows, type Mapping } from "../server/integrations/pms/import";
import {
  validateChannel,
  DEFAULT_CHANNELS,
  distributionStats,
} from "../src/features/revenue/distribution";
import type { Apartment } from "../src/shared/types";
const fields = [
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
];
const mapping = Object.fromEntries(fields.map((f) => [f, f])) as Mapping;
const header = fields.join(",");
const row =
  "r1,101,2026-09-30,2026-10-03,2026-09-01,Confirmed,Expedia,100,18,AED";
const units = [{ id: "u1", unitNumber: "101" }] as Apartment[];
const preview = (value: string, current: any[] = []) =>
  previewPms(
    header + "\n" + value,
    mapping,
    "lodgify-a",
    units,
    DEFAULT_CHANNELS,
    current,
  );

test("CSV parses BOM, escaped quotes and multiline cells; duplicate headers rejected", () => {
  assert.deepEqual(csvRows('\uFEFFid,note\n1,"hello\n""world"""').rows, [
    ["1", 'hello\n"world"'],
  ]);
  assert.throws(() => csvRows("id,id\n1,2"), /unique/);
});
test("channel identity normalizes aliases and rejects duplicates or invalid rates-as-metadata", () => {
  const c = validateChannel(
    { name: "TripAdvisor", aliases: ["TA"], active: true },
    DEFAULT_CHANNELS,
    "ta",
  );
  assert.equal(c.name, "TripAdvisor");
  assert.throws(
    () =>
      validateChannel(
        { name: " expedia ", aliases: [], active: true },
        DEFAULT_CHANNELS,
        "new",
      ),
    /already exists/,
  );
  assert.throws(
    () =>
      validateChannel(
        { name: "New", aliases: ["EXPEDIA"], active: true },
        DEFAULT_CHANNELS,
        "new",
      ),
    /already exists/,
  );
});
test("stable source IDs distinguish new, unchanged, updated and canceled rows", () => {
  const first = preview(row);
  assert.equal(first.errors.length, 0);
  assert.equal(first.summary.insert, 1);
  const current = [first.changes[0].after];
  assert.equal(preview(row, current).summary.unchanged, 1);
  const changed = preview(row.replace("Confirmed", "Canceled"), current);
  assert.equal(changed.summary.update, 1);
  assert.equal(changed.changes[0].after.data.status, "Canceled");
});
test("invalid money, currency, missing channels, bad dates and duplicate IDs block import", () => {
  for (const bad of [
    row.replace(",100,", ",-100,"),
    row.replace("AED", "USD"),
    row.replace("Expedia", "Unknown"),
    row.replace("2026-09-30", "2026-09-31"),
    row + "\n" + row,
  ])
    assert.ok(preview(bad).errors.length);
});
test("overlaps block while back-to-back stays and explicit cancellations do not", () => {
  const first = preview(row).changes[0].after;
  assert.ok(preview(row.replace("r1", "r2"), [first]).errors.length);
  assert.equal(
    preview(
      row
        .replace("r1", "r2")
        .replace("2026-09-30", "2026-10-03")
        .replace("2026-10-03,2026-09-01", "2026-10-05,2026-09-01"),
      [first],
    ).errors.length,
    0,
  );
  assert.equal(
    preview(row.replace("r1", "r2").replace("Confirmed", "Canceled"), [first])
      .errors.length,
    0,
  );
});
test("report clips stay nights, retains unknown/archived channels and excludes cancellations", () => {
  const r = preview(row).changes[0].after.data;
  const stats = distributionStats(
    [
      r,
      { ...r, id: "x", channel: "TripAdvisor" },
      { ...r, id: "cancel", status: "Canceled" },
    ],
    [],
    "2026-10-01",
    "2026-10-31",
  );
  assert.equal(stats.length, 2);
  assert.equal(stats[0].grossRevenue, 200);
  assert.equal(stats[0].commissionPaid, 36);
  assert.equal(stats[0].netRevenue, 164);
});

test("next-day plan follows changes/cancellations; SLA task IDs are stable and messages retain missing-data prompts", async () => {
  const {
    nextDayOperations,
    serviceTasks,
    DEFAULT_GUEST_SERVICE,
    renderTemplate,
  } = await import("../src/features/guest-service/guestService");
  const r = preview(row).changes[0].after.data;
  assert.equal(nextDayOperations([r], "2026-10-03").departures.length, 1);
  assert.equal(
    nextDayOperations([{ ...r, status: "Canceled" }], "2026-10-03").departures
      .length,
    0,
  );
  const a = serviceTasks(
    [r],
    DEFAULT_GUEST_SERVICE,
    new Date("2026-09-29T00:00:00Z"),
  );
  const b = serviceTasks(
    [r],
    DEFAULT_GUEST_SERVICE,
    new Date("2026-10-01T00:00:00Z"),
  );
  assert.deepEqual(
    a.map((x) => x.id),
    b.map((x) => x.id),
  );
  assert.ok(b.some((x) => x.status === "overdue"));
  const draft = renderTemplate(DEFAULT_GUEST_SERVICE.templates[0], {
    unitNumber: "101",
  });
  assert.match(draft.body, /guestName required/);
  assert.match(draft.body, /101/);
});

test("SLA policy validation refuses invalid deadlines and client-supplied completion claims", async () => {
  const { DEFAULT_GUEST_SERVICE, validateServiceSettings } =
    await import("../src/features/guest-service/guestService");
  const current = structuredClone(DEFAULT_GUEST_SERVICE),
    input = structuredClone(current);
  input.completed = { forged: { at: "now", by: "attacker" } };
  assert.deepEqual(validateServiceSettings(input, current).completed, {});
  input.rules[0].offsetHours = 999;
  assert.throws(() => validateServiceSettings(input, current), /SLA/);
});
