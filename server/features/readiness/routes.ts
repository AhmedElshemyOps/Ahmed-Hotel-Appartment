import { checkedReadinessEvidence } from "./private-evidence";
import { companyMembers } from "../../db/members";
import { randomUUID } from "node:crypto";
import { readinessReport } from "../../../src/features/readiness/report";
import {
  Router,
  type Response,
  type Request,
  type NextFunction,
} from "express";
import { z } from "zod";
import type { Pool, PoolClient } from "pg";
import { transaction } from "../../db/transaction";
import { lockedWorkspace } from "../../db/workspace";
import { HttpError, type Actor } from "../../auth/permissions";
import {
  initialReadiness,
  stateSchema,
  capability,
  type Capability,
  type ReadinessState,
} from "../../../src/features/readiness/model";
import { assess, listingIssues } from "../../../src/features/readiness/engine";
import { businessDate } from "../../../src/features/guest-service/guestService";
const route =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch((e) =>
      next(
        e instanceof z.ZodError
          ? new HttpError(422, e.issues.map((v) => v.message).join("; "))
          : e,
      ),
    );
  };
async function access(db: PoolClient, a: Actor, cap?: Capability) {
  const member = (
    await db.query(
      "SELECT role FROM memberships WHERE organization_id=$1 AND uid=$2 FOR SHARE",
      [a.organization_id, a.uid],
    )
  ).rows[0];
  if (!member || member.role !== a.role)
    throw new HttpError(403, "Membership changed. Sign in again.");
  if (member.role === "General Manager")
    return ["compliance", "operations", "distribution"] as Capability[];
  const grants = (
    await db.query(
      "SELECT capability FROM readiness_grants WHERE organization_id=$1 AND uid=$2 FOR SHARE",
      [a.organization_id, a.uid],
    )
  ).rows.map((r) => r.capability) as Capability[];
  if (!grants.length || (cap && !grants.includes(cap)))
    throw new HttpError(403, "Readiness responsibility has not been granted.");
  return grants;
}
function gm(res: Response) {
  if (res.locals.actor.role !== "General Manager")
    throw new HttpError(403, "General Manager approval required.");
  if (!res.locals.authTime || Date.now() / 1000 - res.locals.authTime > 600)
    throw new HttpError(401, "Sign in again with MFA within ten minutes.");
}
async function unit(db: PoolClient, a: Actor, id: string) {
  const ws = await lockedWorkspace(db, a.organization_id);
  if (!ws.data.apartments.some((u) => u.id === id))
    throw new HttpError(404, "Apartment not found in your company.");
  await db.query(
    "INSERT INTO readiness_units(organization_id,unit_id,data) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
    [a.organization_id, id, initialReadiness()],
  );
  return (
    await db.query(
      "SELECT revision,data FROM readiness_units WHERE organization_id=$1 AND unit_id=$2 FOR UPDATE",
      [a.organization_id, id],
    )
  ).rows[0] as { revision: number; data: ReadinessState };
}
function redact(s: ReadinessState, caps: Capability[]) {
  if (caps.includes("compliance")) return s;
  return {
    ...s,
    restriction: s.restriction ? "A legal restriction is recorded" : "",
    documents: s.documents.map((d) => ({
      ...d,
      reference: "Restricted",
      evidenceUrl: "https://restricted.invalid",
      notes: "",
      authority: "Restricted",
    })),
  };
}
export function readinessRouter(pool: Pool) {
  const router = Router();
  router.get(
    "/",
    route(async (_req, res) => {
      const a = res.locals.actor as Actor;
      res.json(
        await transaction(pool, async (db) => {
          const caps = await access(db, a);
          const ws = await lockedWorkspace(db, a.organization_id);
          const rows = (
            await db.query(
              "SELECT * FROM readiness_units WHERE organization_id=$1",
              [a.organization_id],
            )
          ).rows;
          return {
            capabilities: caps,
            units: await Promise.all(
              ws.data.apartments.map(async (u) => {
                const row = rows.find((r) => r.unit_id === u.id);
                const state = await checkedReadinessEvidence(
                  db,
                  a.organization_id,
                  u.id,
                  row?.data ?? initialReadiness(),
                );
                return {
                  id: u.id,
                  unitNumber: u.unitNumber,
                  type: u.type,
                  revision: row?.revision ?? 0,
                  state: redact(state, caps),
                  assessment: assess(redact(state, caps), businessDate()),
                };
              }),
            ),
            members: await companyMembers(db, a.organization_id),
            grants:
              a.role === "General Manager"
                ? (
                    await db.query(
                      "SELECT uid,capability FROM readiness_grants WHERE organization_id=$1",
                      [a.organization_id],
                    )
                  ).rows
                : [],
          };
        }),
      );
    }),
  );
  router.post(
    "/reports",
    route(async (req, res) => {
      gm(res);
      const a = res.locals.actor as Actor;
      z.object({}).strict().parse(req.body);
      res.json(
        await transaction(pool, async (db) => {
          await access(db, a);
          const ws = await lockedWorkspace(db, a.organization_id);
          const rows = (
            await db.query(
              "SELECT unit_id,revision,data FROM readiness_units WHERE organization_id=$1",
              [a.organization_id],
            )
          ).rows;
          const units = await Promise.all(
            ws.data.apartments.map(async (u) => {
              const r = rows.find((v) => v.unit_id === u.id);
              return {
                id: u.id,
                unitNumber: u.unitNumber,
                revision: r?.revision ?? 0,
                state: await checkedReadinessEvidence(
                  db,
                  a.organization_id,
                  u.id,
                  r?.data ?? initialReadiness(),
                ),
              };
            }),
          );
          const id = randomUUID(),
            html = readinessReport(
              units,
              businessDate(),
              a.uid,
              await companyMembers(db, a.organization_id),
            );
          await db.query(
            "INSERT INTO readiness_reports(id,organization_id,actor_uid,source_revisions,html) VALUES($1,$2,$3,$4,$5)",
            [
              id,
              a.organization_id,
              a.uid,
              units.map((u) => ({ id: u.id, revision: u.revision })),
              html,
            ],
          );
          await db.query(
            "INSERT INTO audit_events(organization_id,actor_uid,action,target,details) VALUES($1,$2,'readiness.report',$3,$4)",
            [a.organization_id, a.uid, id, { units: units.length }],
          );
          return { id, html };
        }),
      );
    }),
  );
  router.post(
    "/members/name",
    route(async (req, res) => {
      gm(res);
      const body = z
        .object({
          uid: z.string().min(1).max(180),
          displayName: z
            .string()
            .trim()
            .min(1)
            .max(100)
            .refine(
              (v) =>
                !/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(
                  v,
                ),
              "Use a readable employee name without control characters.",
            ),
          expectedDisplayName: z.string().max(100),
        })
        .strict()
        .parse(req.body);
      const a = res.locals.actor as Actor;
      res.json(
        await transaction(pool, async (db) => {
          await access(db, a);
          const target = (
            await db.query(
              "SELECT uid FROM memberships WHERE organization_id=$1 AND uid=$2",
              [a.organization_id, body.uid],
            )
          ).rows[0];
          if (!target)
            throw new HttpError(404, "Team member not found in your company.");
          const current = (await companyMembers(db, a.organization_id)).find(
            (m) => m.uid === body.uid,
          )!;
          if (current.displayName !== body.expectedDisplayName)
            throw new HttpError(
              409,
              "This employee name changed. Refresh the team directory before saving again.",
            );
          const saved = await db.query(
            `INSERT INTO member_profiles(organization_id,uid,display_name,updated_by) VALUES($1,$2,$3,$4)
          ON CONFLICT(organization_id,uid) DO UPDATE SET display_name=EXCLUDED.display_name, updated_by=EXCLUDED.updated_by, updated_at=now()
          WHERE member_profiles.display_name=$5 RETURNING uid`,
            [
              a.organization_id,
              body.uid,
              body.displayName,
              a.uid,
              body.expectedDisplayName,
            ],
          );
          if (!saved.rows.length)
            throw new HttpError(
              409,
              "This employee name changed. Refresh the team directory before saving again.",
            );
          await db.query(
            "INSERT INTO audit_events(organization_id,actor_uid,action,target,details) VALUES($1,$2,'member.name',$3,$4)",
            [
              a.organization_id,
              a.uid,
              body.uid,
              {
                previousName: current.displayName,
                displayName: body.displayName,
              },
            ],
          );
          return { member: { ...current, displayName: body.displayName } };
        }),
      );
    }),
  );
  router.post(
    "/grants",
    route(async (req, res) => {
      gm(res);
      const a = res.locals.actor as Actor;
      const body = z
        .object({
          uid: z.string().min(1),
          capabilities: z.array(capability).max(3),
        })
        .strict()
        .parse(req.body);
      await transaction(pool, async (db) => {
        await access(db, a);
        if (
          !(
            await db.query(
              "SELECT uid FROM memberships WHERE organization_id=$1 AND uid=$2 FOR SHARE",
              [a.organization_id, body.uid],
            )
          ).rows.length
        )
          throw new HttpError(404, "Team member not found.");
        await db.query(
          "DELETE FROM readiness_grants WHERE organization_id=$1 AND uid=$2",
          [a.organization_id, body.uid],
        );
        for (const cap of new Set(body.capabilities))
          await db.query("INSERT INTO readiness_grants VALUES($1,$2,$3)", [
            a.organization_id,
            body.uid,
            cap,
          ]);
        await db.query(
          "INSERT INTO audit_events(organization_id,actor_uid,action,target,details) VALUES($1,$2,'readiness.grants',$3,$4)",
          [a.organization_id, a.uid, body.uid, body.capabilities],
        );
      });
      res.json({ saved: true });
    }),
  );
  router.post(
    "/:id",
    route(async (req, res) => {
      const body = z
        .object({
          revision: z.number().int().nonnegative(),
          section: z.enum([
            "compliance",
            "operations",
            "distribution",
            "configuration",
            "activation",
          ]),
          data: z.unknown(),
        })
        .strict()
        .parse(req.body);
      const a = res.locals.actor as Actor;
      if (["configuration", "activation"].includes(body.section)) gm(res);
      res.json(
        await transaction(pool, async (db) => {
          await access(
            db,
            a,
            ["compliance", "operations", "distribution"].includes(body.section)
              ? (body.section as Capability)
              : undefined,
          );
          const old = await unit(db, a, req.params.id);
          if (old.revision !== body.revision)
            throw new HttpError(
              409,
              "Apartment readiness changed. Refresh before saving.",
            );
          let next = structuredClone(old.data);
          const now = new Date().toISOString();
          const value = body.data as any;
          if (body.section === "configuration") {
            const cfg = z
              .object({
                jurisdiction: stateSchema.shape.jurisdiction,
                rentalModel: stateSchema.shape.rentalModel,
                rulesReviewed: z.boolean(),
                requirements: stateSchema.shape.requirements,
                reminderDays: stateSchema.shape.reminderDays,
                restriction: stateSchema.shape.restriction,
              })
              .strict()
              .parse(value);
            next = { ...next, ...cfg };
          }
          if (body.section === "compliance") {
            const docs = stateSchema.shape.documents.parse(value);
            const memberUids = (
              await db.query(
                "SELECT uid FROM memberships WHERE organization_id=$1",
                [a.organization_id],
              )
            ).rows.map((r) => r.uid);
            for (const d of docs) {
              if (!next.requirements.some((r) => r.id === d.requirementId))
                throw new HttpError(
                  422,
                  "Document must reference a configured requirement.",
                );
              if (!memberUids.includes(d.responsibleUid))
                throw new HttpError(422, "Assign a current team member.");
              const previous = old.data.documents.find((p) => p.id === d.id);
              if (d.status === "verified") {
                const unchanged =
                  previous?.status === "verified" &&
                  JSON.stringify({ ...d, verifiedBy: "", verifiedAt: "" }) ===
                    JSON.stringify({
                      ...previous,
                      verifiedBy: "",
                      verifiedAt: "",
                    });
                if (unchanged) {
                  d.verifiedBy = previous!.verifiedBy;
                  d.verifiedAt = previous!.verifiedAt;
                } else {
                  gm(res);
                  d.verifiedBy = a.uid;
                  d.verifiedAt = now;
                }
              } else {
                d.verifiedBy = "";
                d.verifiedAt = "";
              }
            }
            next.documents = docs;
          }
          if (body.section === "operations") {
            const ops = z
              .object({
                operations: stateSchema.shape.operations,
                commercial: stateSchema.shape.commercial,
                tasks: stateSchema.shape.tasks,
              })
              .strict()
              .parse(value);
            for (const t of ops.tasks)
              if (
                !(
                  await db.query(
                    "SELECT uid FROM memberships WHERE organization_id=$1 AND uid=$2",
                    [a.organization_id, t.responsibleUid],
                  )
                ).rows.length
              )
                throw new HttpError(
                  422,
                  "Task assignee must be a current member.",
                );
            for (const checks of [ops.operations, ops.commercial])
              for (const c of checks) {
                if (c.passed && !c.evidenceUrl)
                  throw new HttpError(422, "Passed checks require evidence.");
                c.checkedBy = c.passed ? a.uid : "";
                c.checkedAt = c.passed ? now : "";
              }
            next = { ...next, ...ops };
          }
          if (body.section === "distribution") {
            const dist = z
              .object({
                verifiedAmenities: stateSchema.shape.verifiedAmenities,
                media: stateSchema.shape.media,
                listings: stateSchema.shape.listings,
              })
              .strict()
              .parse(value);
            if (
              JSON.stringify(dist.verifiedAmenities) !==
                JSON.stringify(next.verifiedAmenities) ||
              dist.media.some(
                (m) =>
                  m.approved &&
                  !next.media.some(
                    (p) =>
                      p.approved && JSON.stringify(p) === JSON.stringify(m),
                  ),
              )
            )
              gm(res);
            next = { ...next, ...dist };
            for (const l of next.listings) {
              const prev = old.data.listings.find(
                (p) => p.channel === l.channel,
              );
              if (
                ["Ready for Submission", "Submitted", "Published"].includes(
                  l.status,
                )
              ) {
                if (listingIssues(next, l).length)
                  throw new HttpError(
                    422,
                    "Resolve listing quality gaps before review.",
                  );
                if (JSON.stringify(l) !== JSON.stringify(prev)) {
                  gm(res);
                  l.reviewedBy = a.uid;
                  l.reviewedAt = now;
                }
                if (
                  l.status === "Published" &&
                  (!l.confirmationUrl || !l.confirmationReference.trim())
                )
                  throw new HttpError(
                    422,
                    "Published status requires confirmation URL and reference.",
                  );
              } else {
                l.reviewedBy = "";
                l.reviewedAt = "";
              }
            }
          }
          if (body.section === "activation") {
            const action = z
              .object({
                status: stateSchema.shape.status,
                reason: z.string().trim().min(5).max(2000),
              })
              .strict()
              .parse(value);
            if (
              action.status === "Active / Rentable" &&
              !assess(next, businessDate()).canActivate
            )
              throw new HttpError(
                422,
                "Activation blocked. Resolve legal, operational and commercial evidence gaps.",
              );
            next.status = action.status;
          }
          next = await checkedReadinessEvidence(
            db,
            a.organization_id,
            req.params.id,
            stateSchema.parse(next),
            true,
          );
          if (
            next.status === "Active / Rentable" &&
            !assess(next, businessDate()).canActivate
          )
            next.status = "Suspended";
          const revision = old.revision + 1;
          await db.query(
            "UPDATE readiness_units SET data=$3,revision=$4 WHERE organization_id=$1 AND unit_id=$2",
            [a.organization_id, req.params.id, next, revision],
          );
          await db.query(
            "INSERT INTO readiness_history(organization_id,unit_id,revision,actor_uid,action,snapshot) VALUES($1,$2,$3,$4,$5,$6)",
            [
              a.organization_id,
              req.params.id,
              revision,
              a.uid,
              body.section,
              {
                state: next,
                requestReason:
                  body.section === "activation" ? value.reason : undefined,
                assessment: assess(next, businessDate()),
              },
            ],
          );
          await db.query(
            "INSERT INTO audit_events(organization_id,actor_uid,action,target,details) VALUES($1,$2,$3,$4,$5)",
            [
              a.organization_id,
              a.uid,
              "readiness." + body.section,
              req.params.id,
              { revision, status: next.status },
            ],
          );
          return { revision, saved: true };
        }),
      );
    }),
  );
  router.get(
    "/:id/history",
    route(async (req, res) => {
      const a = res.locals.actor as Actor;
      res.json(
        await transaction(pool, async (db) => {
          await access(db, a, "compliance");
          return {
            history: (
              await db.query(
                "SELECT revision,actor_uid,action,created_at FROM readiness_history WHERE organization_id=$1 AND unit_id=$2 ORDER BY revision DESC LIMIT 100",
                [a.organization_id, req.params.id],
              )
            ).rows,
          };
        }),
      );
    }),
  );
  return router;
}
