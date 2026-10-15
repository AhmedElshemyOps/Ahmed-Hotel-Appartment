import { createHmac, timingSafeEqual } from "node:crypto";
import type { Pool } from "pg";
import type { Request, Response } from "express";
import { transaction } from "../../db/transaction";
import { lockedWorkspace } from "../../db/workspace";
import { HttpError } from "../../auth/permissions";
import {
  fingerprint,
  previewPms,
  type Mapping,
  type StoredReservation,
} from "./import";

export function verifyWebhook(
  raw: Buffer,
  timestamp: string,
  signature: string,
  secret: string,
  now = Date.now(),
) {
  if (
    !/^\d{10}$/.test(timestamp) ||
    Math.abs(now - Number(timestamp) * 1000) > 300000 ||
    !/^sha256=[a-f0-9]{64}$/.test(signature)
  )
    return false;
  const expected = createHmac("sha256", secret)
    .update(timestamp + ".")
    .update(raw)
    .digest("hex");
  return timingSafeEqual(
    Buffer.from(signature.slice(7), "hex"),
    Buffer.from(expected, "hex"),
  );
}
export type IncomingReservation = {
  externalId: string;
  unitNumber: string;
  checkInDate: string;
  checkOutDate: string;
  bookingDate: string;
  status: string;
  channel: string;
  dailyRateAED: number;
  commissionRatePercent: number;
  currency: string;
  updatedAt: string;
};
const columns = [
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
export async function applyReservationEvent(
  pool: Pool,
  org: string,
  source: string,
  event: { eventId: string; reservations: IncomingReservation[] },
  now = new Date(),
) {
  if (
    !event ||
    typeof event.eventId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,120}$/.test(event.eventId) ||
    !Array.isArray(event.reservations) ||
    !event.reservations.length ||
    event.reservations.length > 500
  )
    throw new HttpError(
      422,
      "Provide an event ID and 1–500 normalized reservations.",
    );
  for (const r of event.reservations)
    if (
      !r ||
      typeof r.updatedAt !== "string" ||
      !/^\d{4}-\d\d-\d\dT/.test(r.updatedAt) ||
      !Number.isFinite(Date.parse(r.updatedAt)) ||
      Date.parse(r.updatedAt) > now.valueOf() + 300000 ||
      columns.some((c) => r[c] === undefined)
    )
      throw new HttpError(
        422,
        "Every reservation needs documented fields and a valid source updatedAt timestamp.",
      );
  return transaction(pool, async (db) => {
    const workspace = await lockedWorkspace(db, org);
    const hash = fingerprint(event);
    const previous = await db.query(
      "SELECT payload_hash,status,details FROM integration_events WHERE organization_id=$1 AND source=$2 AND event_id=$3",
      [org, source, event.eventId],
    );
    if (previous.rows.length) {
      if (previous.rows[0].payload_hash !== hash)
        throw new HttpError(409, "Event ID was reused with different data.");
      return {
        status: previous.rows[0].status,
        ...previous.rows[0].details,
        replayed: true,
      };
    }
    const retained = event.reservations.filter((r) => {
      const old = workspace.data.reservations.find(
        (x) => x.source === source && x.externalId === r.externalId,
      ) as (StoredReservation & { sourceUpdatedAt?: string }) | undefined;
      return (
        !old?.sourceUpdatedAt ||
        Date.parse(r.updatedAt) > Date.parse(old.sourceUpdatedAt)
      );
    });
    const csv =
      columns.join(",") +
      "\n" +
      retained
        .map((r) =>
          columns
            .map((c) => '"' + String(r[c]).replace(/"/g, '""') + '"')
            .join(","),
        )
        .join("\n");
    const preview = retained.length
      ? previewPms(
          csv,
          Object.fromEntries(columns.map((c) => [c, c])) as Mapping,
          source,
          workspace.data.apartments,
          workspace.data.channels,
          workspace.data.reservations,
          true,
        )
      : {
          errors: [],
          changes: [],
          summary: { insert: 0, update: 0, unchanged: 0 },
        };
    const status = preview.errors.length
      ? "review_required"
      : retained.length
        ? "applied"
        : "ignored";
    const details = {
      summary: preview.summary,
      errors: preview.errors,
      ignoredOlder: event.reservations.length - retained.length,
    };
    if (!preview.errors.length && retained.length) {
      const records = new Map(
        workspace.data.reservations.map((r) => [
          r.source + ":" + r.externalId,
          r,
        ]),
      );
      for (const change of preview.changes) {
        const incoming = retained.find(
          (r) => r.externalId === change.after.externalId,
        )!;
        records.set(change.key, {
          ...change.after,
          lastBatch: "event:" + event.eventId,
          sourceUpdatedAt: incoming.updatedAt,
        } as StoredReservation);
      }
      workspace.data.reservations = [...records.values()];
      await db.query(
        "UPDATE workspaces SET data=$2,revision=revision+1 WHERE organization_id=$1",
        [org, workspace.data],
      );
    }
    await db.query(
      "INSERT INTO integration_events(organization_id,source,event_id,payload_hash,status,details) VALUES($1,$2,$3,$4,$5,$6)",
      [org, source, event.eventId, hash, status, details],
    );
    await db.query(
      "INSERT INTO audit_events(organization_id,actor_uid,action,target,details) VALUES($1,$2,$3,$4,$5)",
      [
        org,
        "integration:" + source,
        "reservation.event",
        event.eventId,
        details,
      ],
    );
    return { status, ...details };
  });
}
export function reservationWebhook(pool: Pool) {
  return async (req: Request, res: Response, next: any) => {
    try {
      const secret = process.env.PMS_WEBHOOK_SECRET,
        org = process.env.PMS_ORGANIZATION_ID,
        source = process.env.PMS_SOURCE_ID;
      if (!secret || secret.length < 32 || !org || !source)
        throw new HttpError(
          503,
          "Automatic reservation intake is not configured.",
        );
      if (
        !verifyWebhook(
          (req as any).rawBody || Buffer.alloc(0),
          String(req.headers["x-ahq-timestamp"] || ""),
          String(req.headers["x-ahq-signature"] || ""),
          secret,
        )
      )
        throw new HttpError(401, "Invalid webhook authentication.");
      const result = await applyReservationEvent(pool, org, source, req.body);
      res.status(result.status === "review_required" ? 202 : 200).json(result);
    } catch (e) {
      next(e);
    }
  };
}
