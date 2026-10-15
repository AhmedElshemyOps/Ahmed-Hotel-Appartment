import { teamRouter } from "./team";
export { invitationRouter } from "./team";
import { controlAccess, controlAudit, recent, endpoint } from "./access";
import { checkedReadinessEvidence } from "../readiness/private-evidence";
import { Router, type Response } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { randomUUID, createHash } from "node:crypto";
import { HttpError, type Actor } from "../../auth/permissions";
import { transaction } from "../../db/transaction";
import { lockedWorkspace } from "../../db/workspace";
import { companyMembers } from "../../db/members";
import { initialReadiness } from "../../../src/features/readiness/model";
import {
  priorities,
  operatingPolicySchema,
  reportSnapshot,
} from "../../../src/features/management-controls/model";
import { businessDate } from "../../../src/shared/dates/businessDate";
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export function managementRouter(pool: Pool) {
  const router = Router();
  router.get(
    "/",
    endpoint(async (_q: any, res: Response) =>
      res.json(
        await transaction(pool, async (db) => {
          const a = await controlAccess(db, res),
            ws = await lockedWorkspace(db, a.organization_id);
          const ready = (
            await db.query(
              "SELECT unit_id,revision,data FROM readiness_units WHERE organization_id=$1",
              [a.organization_id],
            )
          ).rows;
          const units = await Promise.all(
            ws.data.apartments.map(async (u) => {
              const r = ready.find((v) => v.unit_id === u.id);
              return {
                id: u.id,
                unitNumber: u.unitNumber,
                revision: r?.revision || 0,
                state: await checkedReadinessEvidence(
                  db,
                  a.organization_id,
                  u.id,
                  r?.data || initialReadiness(),
                ),
              };
            }),
          );
          const failures = (
            await db.query(
              `SELECT id::text,'imports' AS area,status,created_at AS "recordedAt" FROM import_batches WHERE organization_id=$1 AND status='preview' AND jsonb_array_length(preview->'errors')>0
 UNION ALL SELECT id::text,'accounting' AS area,status,created_at AS "recordedAt" FROM accounting_sync_logs WHERE organization_id=$1 AND status IN ('error','failed','blocked')`,
              [a.organization_id],
            )
          ).rows;
          const pending = (
            await db.query(
              `SELECT r.id,r.unit_id AS "unitId",r.created_at AS "createdAt" FROM market_recommendations r LEFT JOIN market_decisions d ON d.organization_id=r.organization_id AND d.recommendation_id=r.id WHERE r.organization_id=$1 AND d.id IS NULL`,
              [a.organization_id],
            )
          ).rows;
          const members = await companyMembers(db, a.organization_id);
          return {
            revision: ws.revision,
            apartments: ws.data.apartments.map((u) => ({
              id: u.id,
              unitNumber: u.unitNumber,
            })),
            settings: ws.data.operatingSettings || {},
            ruleIds: (ws.data.guestService?.rules || []).map((r) => ({
              id: r.id,
              name: r.name,
              offsetHours: r.offsetHours,
            })),
            members,
            grants: (
              await db.query(
                "SELECT uid,capability FROM readiness_grants WHERE organization_id=$1",
                [a.organization_id],
              )
            ).rows,
            priorities: priorities(
              units,
              businessDate(),
              a.uid,
              failures,
              pending,
            ),
            asOf: new Date().toISOString(),
            invitations: (
              await db.query(
                "SELECT id,email,display_name,role,seat,status,expires_at FROM team_invitations WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100",
                [a.organization_id],
              )
            ).rows,
            reports: (
              await db.query(
                "SELECT id,report_type,period_start,period_end,methodology,source_hash,created_at FROM management_reports WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100",
                [a.organization_id],
              )
            ).rows,
          };
        }),
      ),
    ),
  );
  router.get(
    "/evidence/:kind/:id",
    endpoint(async (q: any, res: Response) =>
      res.json(
        await transaction(pool, async (db) => {
          const a = await controlAccess(db, res),
            kind = z
              .enum(["readiness", "imports", "accounting", "market"])
              .parse(q.params.kind);
          if (kind === "readiness") {
            const ws = await lockedWorkspace(db, a.organization_id);
            if (!ws.data.apartments.some((u) => u.id === q.params.id))
              throw new HttpError(404, "Apartment not found.");
            const row = (
              await db.query(
                "SELECT unit_id,revision,data FROM readiness_units WHERE organization_id=$1 AND unit_id=$2",
                [a.organization_id, q.params.id],
              )
            ).rows[0];
            if (!row)
              throw new HttpError(404, "Readiness evidence not recorded.");
            const state = await checkedReadinessEvidence(
              db,
              a.organization_id,
              row.unit_id,
              row.data,
            );
            return {
              unitId: row.unit_id,
              revision: row.revision,
              documents: state.documents.map((d) => ({
                id: d.id,
                status: d.status,
                expiresOn: d.expiresOn,
                renewalOn: d.renewalOn,
                responsibleUid: d.responsibleUid,
              })),
              tasks: state.tasks,
              listings: state.listings.map((l) => ({
                channel: l.channel,
                status: l.status,
              })),
            };
          }
          const id = z.uuid().parse(q.params.id);
          const sql =
            kind === "imports"
              ? "SELECT id,source,status,preview->'summary' AS summary,preview->'errors' AS errors,created_at FROM import_batches WHERE organization_id=$1 AND id=$2"
              : kind === "accounting"
                ? "SELECT id,status,operation,message,created_at FROM accounting_sync_logs WHERE organization_id=$1 AND id=$2"
                : "SELECT id,unit_id,query,evidence_hash,created_at FROM market_recommendations WHERE organization_id=$1 AND id=$2";
          const row = (await db.query(sql, [a.organization_id, id])).rows[0];
          if (!row) throw new HttpError(404, "Evidence record not found.");
          return row;
        }),
      ),
    ),
  );
  router.post(
    "/settings",
    endpoint(async (q: any, res: Response) => {
      recent(res);
      const v = z
        .object({
          unitId: z.string().min(1),
          revision: z.number().int().nonnegative(),
          policy: operatingPolicySchema,
        })
        .strict()
        .parse(q.body);
      await transaction(pool, async (db) => {
        const a = await controlAccess(db, res),
          ws = await lockedWorkspace(db, a.organization_id);
        if (ws.revision !== v.revision)
          throw new HttpError(
            409,
            "Company data changed. Refresh before saving.",
          );
        if (!ws.data.apartments.some((u) => u.id === v.unitId))
          throw new HttpError(404, "Apartment not found.");
        const ruleIds = (ws.data.guestService?.rules || []).map((r) => r.id);
        if (
          Object.keys(v.policy.contactOffsets).some((k) => !ruleIds.includes(k))
        )
          throw new HttpError(
            422,
            "Contact offset must reference an existing guest-service rule.",
          );
        ws.data.operatingSettings = {
          ...ws.data.operatingSettings,
          [v.unitId]: v.policy,
        };
        await db.query(
          "UPDATE workspaces SET data=$2,revision=revision+1 WHERE organization_id=$1",
          [a.organization_id, ws.data],
        );
        await controlAudit(db, a, "property.operating-settings", v.unitId, {
          policy: v.policy,
        });
      });
      res.json({ ok: true });
    }),
  );
  router.post(
    "/reports",
    endpoint(async (q: any, res: Response) => {
      const v = z
        .object({
          type: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
          date: z.string(),
        })
        .strict()
        .parse(q.body);
      res.json(
        await transaction(pool, async (db) => {
          const a = await controlAccess(db, res),
            ws = await lockedWorkspace(db, a.organization_id);
          let snapshot: ReturnType<typeof reportSnapshot> & {
            sourceRecords?: unknown[];
          };
          try {
            snapshot = reportSnapshot(
              v.type,
              v.date,
              ws.data.reservations.map((r) => r.data),
              ws.revision,
              new Date().toISOString(),
            );
          } catch {
            throw new HttpError(422, "Choose a valid report date.");
          }
          snapshot = {
            ...snapshot,
            sourceRecords: ws.data.reservations
              .filter((r) =>
                [...snapshot.current.sources, ...snapshot.prior.sources].some(
                  (s: any) => s.id === r.data.id,
                ),
              )
              .map((r) => ({
                source: r.source,
                externalId: r.externalId,
                version: r.version,
                lastBatch: r.lastBatch,
                sourceUpdatedAt: r.sourceUpdatedAt,
              })),
          };
          const id = randomUUID(),
            sourceHash = hash(JSON.stringify(snapshot));
          await db.query(
            "INSERT INTO management_reports(organization_id,id,report_type,period_start,period_end,methodology,source_hash,snapshot,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
            [
              a.organization_id,
              id,
              v.type,
              snapshot.period.start,
              snapshot.period.end,
              snapshot.methodology,
              sourceHash,
              snapshot,
              a.uid,
            ],
          );
          await controlAudit(db, a, "management.report", id, {
            sourceHash,
            sourceRevision: ws.revision,
          });
          return { id, sourceHash, snapshot };
        }),
      );
    }),
  );
  router.get(
    "/reports/:id",
    endpoint(async (q: any, res: Response) =>
      res.json(
        await transaction(pool, async (db) => {
          const a = await controlAccess(db, res);
          const r = (
            await db.query(
              "SELECT id,source_hash,snapshot,created_at FROM management_reports WHERE organization_id=$1 AND id=$2",
              [a.organization_id, z.uuid().parse(q.params.id)],
            )
          ).rows[0];
          if (!r) throw new HttpError(404, "Report not found.");
          return r;
        }),
      ),
    ),
  );
  router.use(teamRouter(pool));
  return router;
}
