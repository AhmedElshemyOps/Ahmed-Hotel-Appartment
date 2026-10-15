import { z } from "zod";
import type { Reservation } from "../../shared/types";
import type { ReadinessState } from "../readiness/model";
import { assess, listingIssues } from "../readiness/engine";
import { reportPeriod, type ReportType } from "../reports/reporting";
export const operatingPolicySchema = z
  .object({
    checkIn: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    checkOut: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    timeZone: z.literal("Asia/Dubai"),
    contactOffsets: z.record(
      z.string().min(1).max(40),
      z.number().int().min(-168).max(168),
    ),
    preferences: z.string().max(1500),
  })
  .strict();
export type OperatingPolicy = z.infer<typeof operatingPolicySchema>;
export const DEFAULT_OPERATING_POLICY: OperatingPolicy = {
  checkIn: "15:00",
  checkOut: "11:00",
  timeZone: "Asia/Dubai",
  contactOffsets: {},
  preferences: "",
};
export type Priority = {
  id: string;
  severity: "urgent" | "attention";
  title: string;
  unitId?: string;
  responsibleUid: string;
  area: "readiness" | "imports" | "accounting" | "market";
  evidence: string;
  recordedAt?: string;
  source: {
    kind: "readiness" | "imports" | "accounting" | "market";
    id: string;
  };
};
export function priorities(
  units: {
    id: string;
    unitNumber: string;
    revision: number;
    state: ReadinessState;
  }[],
  today: string,
  gmUid: string,
  failures: {
    id: string;
    area: "imports" | "accounting";
    status: string;
    recordedAt: string;
  }[] = [],
  pending: { id: string; unitId: string; createdAt: string }[] = [],
): Priority[] {
  const items: Priority[] = [];
  for (const u of units) {
    const a = assess(u.state, today),
      evidence = `Apartment ${u.unitNumber}, revision ${u.revision}`;
    for (const d of a.alerts)
      items.push({
        id: `document:${u.id}:${d.documentId}`,
        source: { kind: "readiness", id: u.id },
        severity: d.daysRemaining < 0 ? "urgent" : "attention",
        title: `${d.reason}: document ${d.documentId} (${d.daysRemaining} days)`,
        unitId: u.id,
        responsibleUid: d.responsibleUid,
        area: "readiness",
        evidence,
      });
    for (const t of a.overdueTasks)
      items.push({
        id: `task:${u.id}:${t.id}`,
        source: { kind: "readiness", id: u.id },
        severity: "urgent",
        title: `Overdue: ${t.label} (${t.dueOn})`,
        unitId: u.id,
        responsibleUid: t.responsibleUid,
        area: "readiness",
        evidence,
      });
    for (const l of u.state.listings) {
      const gaps = listingIssues(u.state, l);
      if (gaps.length)
        items.push({
          id: `listing:${u.id}:${l.channel}`,
          source: { kind: "readiness", id: u.id },
          severity: "attention",
          title: `${l.channel}: ${gaps.length} listing gaps`,
          unitId: u.id,
          responsibleUid: gmUid,
          area: "readiness",
          evidence,
        });
    }
  }
  for (const f of failures)
    items.push({
      id: `${f.area}:${f.id}`,
      source: { kind: f.area, id: f.id },
      severity: "urgent",
      title: `${f.area === "imports" ? "Reservation import" : "Accounting synchronization"}: ${f.status}`,
      responsibleUid: gmUid,
      area: f.area,
      evidence: `Source log ${f.id}`,
      recordedAt: f.recordedAt,
    });
  for (const p of pending)
    items.push({
      id: `approval:${p.id}`,
      source: { kind: "market", id: p.id },
      severity: "attention",
      title: "Pricing proposal awaiting a decision",
      unitId: p.unitId,
      responsibleUid: gmUid,
      area: "market",
      evidence: `Recommendation ${p.id}`,
      recordedAt: p.createdAt,
    });
  return items.sort(
    (a, b) =>
      Number(b.severity === "urgent") - Number(a.severity === "urgent") ||
      a.id.localeCompare(b.id),
  );
}
export const REPORT_METHOD = "stay-night-room-revenue-v1";
export function periodMetrics(
  reservations: Reservation[],
  start: string,
  end: string,
) {
  let roomRevenue = 0,
    commission = 0,
    occupiedNights = 0;
  const sources: unknown[] = [];
  for (const r of reservations) {
    if (r.status === "Canceled") continue;
    const from = Math.max(
      Date.parse(r.checkInDate + "T00:00:00Z"),
      Date.parse(start + "T00:00:00Z"),
    );
    const to = Math.min(
      Date.parse(r.checkOutDate + "T00:00:00Z"),
      Date.parse(end + "T00:00:00Z") + 86400000,
    );
    const nights = Math.max(0, (to - from) / 86400000);
    if (!nights) continue;
    const revenue = nights * r.dailyRateAED;
    roomRevenue += revenue;
    commission += (revenue * r.commissionRatePercent) / 100;
    occupiedNights += nights;
    sources.push({
      id: r.id,
      unitId: r.unitId,
      checkInDate: r.checkInDate,
      checkOutDate: r.checkOutDate,
      status: r.status,
      dailyRateAED: r.dailyRateAED,
      commissionRatePercent: r.commissionRatePercent,
      nights,
    });
  }
  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  return {
    roomRevenue: round(roomRevenue),
    commission: round(commission),
    afterCommission: round(roomRevenue - commission),
    occupiedNights,
    sources,
  };
}
export function reportSnapshot(
  type: ReportType,
  date: string,
  reservations: Reservation[],
  sourceRevision: number,
  recordedAt: string,
) {
  const period = reportPeriod(type, date);
  let previousDate: string;
  if (type === "MONTHLY") {
    const d = new Date(period.start + "T00:00:00Z");
    d.setUTCDate(0);
    previousDate = d.toISOString().slice(0, 10);
  } else
    previousDate = new Date(Date.parse(period.start + "T00:00:00Z") - 86400000)
      .toISOString()
      .slice(0, 10);
  const previous = reportPeriod(type, previousDate);
  const current = periodMetrics(reservations, period.start, period.end),
    prior = periodMetrics(reservations, previous.start, previous.end);
  return {
    methodology: REPORT_METHOD,
    type,
    period,
    previous,
    current,
    prior,
    delta: {
      roomRevenue:
        Math.round((current.roomRevenue - prior.roomRevenue) * 100) / 100,
      occupiedNights: current.occupiedNights - prior.occupiedNights,
    },
    sourceRevision,
    recordedAt,
    limitations:
      "Room revenue by recorded stay nights; excludes cancellations. Commission uses the booking's recorded percentage. After-commission revenue excludes operating expenses, tax and missing costs and is not profit. Current and prior periods use records captured at the same time; this is not a historical booking-pace forecast. Unequal calendar months are not normalized.",
  };
}
