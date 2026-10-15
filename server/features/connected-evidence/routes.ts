import { assess } from "../../../src/features/readiness/engine";
import { checkedReadinessEvidence } from "../readiness/private-evidence";
import { Router, type Response } from "express";
import type { Pool } from "pg";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { getAuth } from "firebase-admin/auth";
import { transaction } from "../../db/transaction";
import { lockedWorkspace } from "../../db/workspace";
import { HttpError } from "../../auth/permissions";
import { verifiedClaims } from "../../auth/identity";
import {
  controlAccess,
  controlAudit,
  endpoint,
  recent,
} from "../management-controls/access";
import { access, loadAccounting } from "../accounting/repository";
import {
  reconcile,
  type AccountingLink,
} from "../../../src/features/connected-evidence/reconciliation";
import { reportSnapshot } from "../../../src/features/management-controls/model";
import {
  serviceTasks,
  DEFAULT_GUEST_SERVICE,
} from "../../../src/features/guest-service/guestService";
import { businessDate } from "../../../src/shared/dates/businessDate";
import { accountingDate } from "../../../src/features/accounting/model";
const uuid = z.string().uuid(),
  reference = z.string().trim().min(1).max(180);
const linkSchema = z
  .object({
    connectionId: uuid,
    documentId: reference,
    reservationSource: reference,
    reservationExternalId: reference,
    purpose: z.enum(["invoice", "refund", "commission", "settlement"]),
    evidenceNote: z.string().trim().min(10).max(1500),
  })
  .strict();
const finance = async (db: any, res: Response) => {
  const a = await controlAccess(db, res, false);
  await access(db, a);
  return a;
};
const linksFor = async (
  db: any,
  org: string,
  id: string,
): Promise<AccountingLink[]> =>
  (
    await db.query(
      `SELECT document_id AS "documentId",reservation_source AS "reservationSource",reservation_external_id AS "reservationExternalId",purpose,evidence_note AS "evidenceNote",reviewed_by AS "reviewedBy",reviewed_document_updated_at AS "reviewedDocumentUpdatedAt",reviewed_reservation_version AS "reviewedReservationVersion" FROM reservation_accounting_links WHERE organization_id=$1 AND connection_id=$2`,
      [org, id],
    )
  ).rows;
export function connectedEvidenceRouter(
  pool: Pool,
  lookupOwner = async (email: string) => {
    const u = await getAuth().getUserByEmail(email);
    return {
      uid: u.uid,
      email: u.email,
      emailVerified: u.emailVerified,
      disabled: u.disabled,
    };
  },
) {
  const r = Router();
  r.get(
    "/connections",
    endpoint(async (_q: any, res: Response) =>
      res.json(
        await transaction(pool, async (db) => {
          const a = await controlAccess(db, res);
          const logs = (
            await db.query(
              "SELECT source,event_id,status,received_at,details FROM integration_events WHERE organization_id=$1 ORDER BY received_at DESC LIMIT 20",
              [a.organization_id],
            )
          ).rows;
          return {
            pms: {
              status: "provider_not_selected",
              liveVerified: false,
              message:
                "No PMS selected. The signed normalized intake endpoint is not a native PMS connector.",
              events: logs,
            },
            odoo: {
              status: "disconnected",
              liveVerified: false,
              readOnly: true,
              message:
                "Hosting, version, API entitlement, company permissions and administrator approval are required. CSV remains available.",
            },
          };
        }),
      ),
    ),
  );
  r.get(
    "/reconciliation/:connectionId",
    endpoint(async (q: any, res: Response) =>
      res.json(
        await transaction(pool, async (db) => {
          const a = await finance(db, res),
            id = uuid.parse(q.params.connectionId),
            docs = await loadAccounting(db, a, id),
            ws = await lockedWorkspace(db, a.organization_id);
          return {
            ...reconcile(
              ws.data.reservations,
              docs,
              await linksFor(db, a.organization_id, id),
            ),
            asOf: new Date().toISOString(),
            revision: ws.revision,
          };
        }),
      ),
    ),
  );
  r.post(
    "/reconciliation/link",
    endpoint(async (q: any, res: Response) => {
      recent(res);
      const input = linkSchema.parse(q.body);
      await transaction(pool, async (db) => {
        const a = await finance(db, res),
          docs = await loadAccounting(db, a, input.connectionId),
          ws = await lockedWorkspace(db, a.organization_id);
        const d = docs.find((d) => d.externalId === input.documentId);
        if (
          !d ||
          !ws.data.reservations.some(
            (v) =>
              v.source === input.reservationSource &&
              v.externalId === input.reservationExternalId,
          )
        )
          throw new HttpError(
            404,
            "Source booking or accounting document not found.",
          );
        const allowed = {
          invoice: ["invoice"],
          refund: ["credit_note"],
          commission: ["supplier_bill", "expense"],
          settlement: ["payment"],
        }[input.purpose];
        if (!allowed.includes(d.type))
          throw new HttpError(
            422,
            "Document type does not support the selected purpose.",
          );
        await db
          .query(
            `INSERT INTO reservation_accounting_links(organization_id,connection_id,document_id,reservation_source,reservation_external_id,purpose,evidence_note,reviewed_by,reviewed_document_updated_at,reviewed_reservation_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING document_id`,
            [
              a.organization_id,
              input.connectionId,
              input.documentId,
              input.reservationSource,
              input.reservationExternalId,
              input.purpose,
              input.evidenceNote,
              a.uid,
              d.sourceUpdatedAt,
              ws.data.reservations.find(
                (v) =>
                  v.source === input.reservationSource &&
                  v.externalId === input.reservationExternalId,
              )!.version,
            ],
          )
          .then((result) => {
            if (!result.rows.length)
              throw new HttpError(
                409,
                "Document is already allocated. Remove the existing link before changing it.",
              );
          });
        await controlAudit(db, a, "reconciliation.link", input.documentId, {
          ...input,
          sourceUpdatedAt: d.sourceUpdatedAt,
          reservationRevision: ws.revision,
        });
      });
      res.json({ ok: true });
    }),
  );
  r.post(
    "/reconciliation/unlink",
    endpoint(async (q: any, res: Response) => {
      recent(res);
      const v = z
        .object({
          connectionId: uuid,
          documentId: reference,
          reason: z.string().trim().min(10).max(1500),
        })
        .strict()
        .parse(q.body);
      await transaction(pool, async (db) => {
        const a = await finance(db, res);
        const old = await db.query(
          "DELETE FROM reservation_accounting_links WHERE organization_id=$1 AND connection_id=$2 AND document_id=$3 RETURNING *",
          [a.organization_id, v.connectionId, v.documentId],
        );
        if (!old.rows.length) throw new HttpError(404, "Link not found.");
        await controlAudit(db, a, "reconciliation.unlink", v.documentId, {
          reason: v.reason,
          previous: old.rows[0],
        });
      });
      res.json({ ok: true });
    }),
  );
  r.post(
    "/evidence",
    endpoint(async (q: any, res: Response) =>
      res.json(
        await transaction(pool, async (db) => {
          const a = await controlAccess(db, res),
            v = z
              .object({
                kind: z.enum([
                  "reservation",
                  "workspace",
                  "readiness",
                  "accounting",
                ]),
                id: reference,
                connectionId: uuid.optional(),
              })
              .strict()
              .parse(q.body);
          const ws = await lockedWorkspace(db, a.organization_id);
          if (v.kind === "reservation") {
            const record = ws.data.reservations.find((r) => r.data.id === v.id);
            if (!record) throw new HttpError(404, "Source record not found.");
            return { kind: v.kind, version: record.version, record };
          }
          if (v.kind === "workspace") {
            if (v.id !== a.organization_id)
              throw new HttpError(404, "Source record not found.");
            return {
              kind: v.kind,
              version: ws.revision,
              record: serviceTasks(
                ws.data.reservations.map((r) => r.data),
                ws.data.guestService || DEFAULT_GUEST_SERVICE,
                new Date(),
                ws.data.operatingSettings,
              ),
            };
          }
          if (v.kind === "readiness") {
            const record = (
              await db.query(
                "SELECT unit_id,revision,data FROM readiness_units WHERE organization_id=$1 AND unit_id=$2",
                [a.organization_id, v.id],
              )
            ).rows[0];
            if (!record) throw new HttpError(404, "Source record not found.");
            record.data = await checkedReadinessEvidence(
              db,
              a.organization_id,
              v.id,
              record.data,
            );
            return { kind: v.kind, version: record.revision, record };
          }
          if (!v.connectionId)
            throw new HttpError(422, "Select an accounting connection.");
          const record = (await loadAccounting(db, a, v.connectionId)).find(
            (d) => d.externalId === v.id,
          );
          if (!record) throw new HttpError(404, "Source record not found.");
          return { kind: v.kind, version: record.sourceUpdatedAt, record };
        }),
      ),
    ),
  );
  r.post(
    "/questions",
    endpoint(async (q: any, res: Response) =>
      res.json(
        await transaction(pool, async (db) => {
          const a = await controlAccess(db, res),
            input = z
              .object({
                topic: z.enum(["tomorrow_operations", "compliance", "finance"]),
                connectionId: uuid.optional(),
              })
              .strict()
              .parse(q.body);
          const ws = await lockedWorkspace(db, a.organization_id),
            today = businessDate(),
            tomorrow = new Date(Date.parse(today + "T00:00:00Z") + 86400000)
              .toISOString()
              .slice(0, 10);
          const facts: {
              text: string;
              references: { kind: string; id: string; version: string }[];
            }[] = [],
            limitations: string[] = [];
          if (input.topic === "tomorrow_operations") {
            const tasks = serviceTasks(
              ws.data.reservations.map((v) => v.data),
              ws.data.guestService || DEFAULT_GUEST_SERVICE,
              new Date(),
              ws.data.operatingSettings,
            );
            for (const v of ws.data.reservations.filter(
              (v) =>
                v.data.status !== "Canceled" &&
                (v.data.checkInDate === tomorrow ||
                  v.data.checkOutDate === tomorrow),
            ))
              facts.push({
                text: `Apartment ${ws.data.apartments.find((u) => u.id === v.data.unitId)?.unitNumber || v.data.unitId}: ${v.data.checkInDate === tomorrow ? "arrival" : "departure"} on ${tomorrow}.`,
                references: [
                  {
                    kind: "reservation",
                    id: v.data.id,
                    version: String(v.version),
                  },
                ],
              });
            for (const t of tasks.filter(
              (t) => businessDate(new Date(t.dueAt)) === tomorrow,
            ))
              facts.push({
                text: `Guest-service task: ${t.title} (${t.status}), due ${t.dueAt}.`,
                references: [
                  {
                    kind: "workspace",
                    id: a.organization_id,
                    version: String(ws.revision),
                  },
                ],
              });
            limitations.push(
              "Recorded bookings only. No native PMS connection is selected; missed external reservations cannot be ruled out. Policy times are not confirmed guest arrival times.",
            );
          } else if (input.topic === "compliance") {
            const rows = (
              await db.query(
                "SELECT unit_id,revision,data FROM readiness_units WHERE organization_id=$1",
                [a.organization_id],
              )
            ).rows;
            for (const v of rows) {
              const state = await checkedReadinessEvidence(
                db,
                a.organization_id,
                v.unit_id,
                v.data,
              );
              const checks = assess(state, today);
              facts.push({
                text: `Apartment ${ws.data.apartments.find((u) => u.id === v.unit_id)?.unitNumber || v.unit_id}: ${checks.effectiveStatus}; ${checks.legal.length} legal check gaps, ${checks.operational.length} operating gaps, ${checks.commercial.length} listing gaps, ${checks.overdueTasks.length} overdue recorded tasks.`,
                references: [
                  {
                    kind: "readiness",
                    id: v.unit_id,
                    version: String(v.revision),
                  },
                ],
              });
            }
            limitations.push(
              "This answer identifies recorded reviews only. It does not assert legal compliance, valid permits or readiness approval.",
            );
          } else {
            if (!input.connectionId)
              throw new HttpError(422, "Select an accounting connection.");
            const docs = await loadAccounting(db, a, input.connectionId);
            for (const d of docs.filter((d) => d.status === "posted"))
              facts.push({
                text: `${d.number}: ${d.type}, AED ${d.total.toFixed(2)}, outstanding AED ${d.outstanding.toFixed(2)}.`,
                references: [
                  {
                    kind: "accounting",
                    id: d.externalId,
                    version: d.sourceUpdatedAt,
                  },
                ],
              });
            limitations.push(
              "Imported source records only. No live Odoo verification. Document totals are not profit or cash-flow forecasts. No accounting write is performed.",
            );
          }
          if (facts.length > 500)
            throw new HttpError(
              422,
              "Too many source facts; use the source workflow to narrow the period.",
            );
          if (!facts.length)
            limitations.push(
              "No supporting records found. This is missing evidence, not proof that there are no issues.",
            );
          return {
            method: "record-backed-v1",
            generatedAt: new Date().toISOString(),
            workspaceRevision: ws.revision,
            topic: input.topic,
            facts,
            limitations,
            liveVerified: false,
          };
        }),
      ),
    ),
  );
  r.get(
    "/owners",
    endpoint(async (_q: any, res: Response) =>
      res.json(
        await transaction(pool, async (db) => {
          const a = await controlAccess(db, res);
          return {
            grants: (
              await db.query(
                "SELECT owner_email,unit_id FROM owner_property_access WHERE organization_id=$1 ORDER BY owner_email,unit_id",
                [a.organization_id],
              )
            ).rows,
            releases: (
              await db.query(
                "SELECT id,unit_id,approved_at,withdrawn,snapshot FROM owner_report_releases WHERE organization_id=$1 ORDER BY approved_at DESC LIMIT 100",
                [a.organization_id],
              )
            ).rows,
          };
        }),
      ),
    ),
  );
  r.post(
    "/owners/grant",
    endpoint(async (q: any, res: Response) => {
      recent(res);
      const v = z
        .object({ email: z.string().email().max(250), unitId: reference })
        .strict()
        .parse(q.body);
      await transaction(pool, (db) => controlAccess(db, res));
      let owner;
      try {
        owner = await lookupOwner(v.email.trim().toLowerCase());
      } catch {
        throw new HttpError(
          422,
          "A verified owner account must be provisioned by the authorized identity administrator first.",
        );
      }
      if (
        !owner.emailVerified ||
        owner.disabled ||
        owner.email?.toLowerCase() !== v.email.toLowerCase()
      )
        throw new HttpError(422, "Owner needs an enabled, verified account.");
      await transaction(pool, async (db) => {
        const a = await controlAccess(db, res),
          ws = await lockedWorkspace(db, a.organization_id);
        if (!ws.data.apartments.some((u) => u.id === v.unitId))
          throw new HttpError(404, "Apartment not found.");
        if (
          (
            await db.query("SELECT uid FROM memberships WHERE uid=$1", [
              owner.uid,
            ])
          ).rows.length
        )
          throw new HttpError(
            422,
            "Use a separate owner identity; staff accounts cannot be granted owner access.",
          );
        await db.query(
          "INSERT INTO owner_property_access(organization_id,owner_uid,owner_email,unit_id,granted_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
          [
            a.organization_id,
            owner.uid,
            owner.email!.toLowerCase(),
            v.unitId,
            a.uid,
          ],
        );
        await controlAudit(db, a, "owner.grant", v.unitId, {
          email: owner.email,
        });
      });
      res.json({ ok: true });
    }),
  );
  r.post(
    "/owners/revoke",
    endpoint(async (q: any, res: Response) => {
      recent(res);
      const v = z
        .object({ email: z.string().email(), unitId: reference })
        .strict()
        .parse(q.body);
      await transaction(pool, async (db) => {
        const a = await controlAccess(db, res);
        await db.query(
          "DELETE FROM owner_property_access WHERE organization_id=$1 AND lower(owner_email)=lower($2) AND unit_id=$3",
          [a.organization_id, v.email, v.unitId],
        );
        await controlAudit(db, a, "owner.revoke", v.unitId, { email: v.email });
      });
      res.json({ ok: true });
    }),
  );
  r.post(
    "/owners/preview",
    endpoint(async (q: any, res: Response) =>
      res.json(
        await transaction(pool, async (db) => {
          const v = z
              .object({
                unitId: reference,
                type: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
                date: accountingDate,
              })
              .strict()
              .parse(q.body),
            a = await controlAccess(db, res),
            ws = await lockedWorkspace(db, a.organization_id),
            unit = ws.data.apartments.find((u) => u.id === v.unitId);
          if (!unit) throw new HttpError(404, "Apartment not found.");
          const source = reportSnapshot(
            v.type,
            v.date,
            ws.data.reservations
              .filter((r) => r.data.unitId === v.unitId)
              .map((r) => r.data),
            ws.revision,
            new Date().toISOString(),
          );
          const metrics = (x: typeof source.current) => ({
            roomRevenue: x.roomRevenue,
            commission: x.commission,
            afterCommission: x.afterCommission,
            occupiedNights: x.occupiedNights,
          });
          return {
            dataMode: ws.data.reservations.some(
              (r) => r.data.unitId === v.unitId && r.data.isDemo,
            )
              ? "synthetic"
              : "company-records",
            revision: ws.revision,
            unitNumber: unit.unitNumber,
            type: v.type,
            date: v.date,
            period: source.period,
            current: metrics(source.current),
            prior: metrics(source.prior),
            limitations:
              source.limitations +
              " Management estimate; not a reconciled owner statement or audited profit.",
          };
        }),
      ),
    ),
  );
  r.post(
    "/owners/release",
    endpoint(async (q: any, res: Response) => {
      recent(res);
      const v = z
        .object({
          unitId: reference,
          type: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
          date: accountingDate,
          expectedRevision: z.number().int().nonnegative(),
          confirm: z.literal(true),
        })
        .strict()
        .parse(q.body);
      const result = await transaction(pool, async (db) => {
        const a = await controlAccess(db, res),
          ws = await lockedWorkspace(db, a.organization_id),
          unit = ws.data.apartments.find((u) => u.id === v.unitId);
        if (!unit) throw new HttpError(404, "Apartment not found.");
        if (v.expectedRevision !== ws.revision)
          throw new HttpError(
            409,
            "Booking records changed. Preview the owner summary again before approval.",
          );
        const source = reportSnapshot(
          v.type,
          v.date,
          ws.data.reservations
            .filter((r) => r.data.unitId === v.unitId)
            .map((r) => r.data),
          ws.revision,
          new Date().toISOString(),
        );
        // Never release source arrays, guest identities, internal notes or other properties.
        const metrics = (x: typeof source.current) => ({
          roomRevenue: x.roomRevenue,
          commission: x.commission,
          afterCommission: x.afterCommission,
          occupiedNights: x.occupiedNights,
        });
        const snapshot = {
          dataMode: ws.data.reservations.some(
            (r) => r.data.unitId === v.unitId && r.data.isDemo,
          )
            ? "synthetic"
            : "company-records",
          unitNumber: unit.unitNumber,
          type: v.type,
          period: source.period,
          previous: source.previous,
          current: metrics(source.current),
          prior: metrics(source.prior),
          methodology: source.methodology,
          recordedAt: source.recordedAt,
          sourceRevision: source.sourceRevision,
          limitations:
            source.limitations +
            " Management estimate; not a reconciled owner statement or audited profit.",
        };
        const id = randomUUID(),
          hash = createHash("sha256")
            .update(JSON.stringify(source))
            .digest("hex");
        await db.query(
          "INSERT INTO owner_report_releases(organization_id,id,unit_id,snapshot,source_hash,approved_by,source_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [a.organization_id, id, v.unitId, snapshot, hash, a.uid, source],
        );
        await controlAudit(db, a, "owner.release", id, {
          unitId: v.unitId,
          sourceHash: hash,
        });
        return { id, snapshot };
      });
      res.status(201).json(result);
    }),
  );
  r.post(
    "/owners/withdraw",
    endpoint(async (q: any, res: Response) => {
      recent(res);
      const v = z.object({ id: uuid }).strict().parse(q.body);
      await transaction(pool, async (db) => {
        const a = await controlAccess(db, res);
        const result = await db.query(
          "UPDATE owner_report_releases SET withdrawn=true WHERE organization_id=$1 AND id=$2 RETURNING id",
          [a.organization_id, v.id],
        );
        if (!result.rows.length) throw new HttpError(404, "Release not found.");
        await controlAudit(db, a, "owner.withdraw", v.id);
      });
      res.json({ ok: true });
    }),
  );
  return r;
}
/** Separate identity route: owners never receive a staff seat or company workspace. */
export function ownerPortalRouter(
  pool: Pool,
  verify: (token: string) => Promise<any>,
) {
  const r = Router();
  r.get(
    "/reports",
    endpoint(async (q: any, res: Response) => {
      const token = q.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
      if (!token) throw new HttpError(401, "Owner sign-in required.");
      const claims = await verifiedClaims(token, verify);
      res.set("Cache-Control", "no-store");
      res.json(
        await transaction(pool, async (db) => {
          if (
            (
              await db.query("SELECT uid FROM memberships WHERE uid=$1", [
                claims.uid,
              ])
            ).rows.length
          )
            throw new HttpError(
              403,
              "Staff identities cannot access the separate owner portal.",
            );
          const rows = (
            await db.query(
              `SELECT r.id,r.snapshot,r.approved_at FROM owner_report_releases r WHERE r.withdrawn=false AND EXISTS(SELECT 1 FROM owner_property_access g WHERE g.organization_id=r.organization_id AND g.unit_id=r.unit_id AND g.owner_uid=$1 AND lower(g.owner_email)=lower($2)) ORDER BY r.approved_at DESC LIMIT 101`,
              [claims.uid, claims.email || ""],
            )
          ).rows;
          if (rows.length > 100)
            throw new HttpError(
              422,
              "Owner report history exceeds the pilot limit; ask management to narrow active releases.",
            );
          return {
            reports: rows,
            message:
              "Only GM-approved releases for your currently authorized apartments are shown.",
          };
        }),
      );
    }),
  );
  return r;
}
