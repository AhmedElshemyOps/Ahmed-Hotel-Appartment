import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import type { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { transaction, HttpError, type Actor, lockedWorkspace } from "../cloud";
import { fingerprint } from "../pms";
import {
  propertySchema,
  sourceSchema,
  querySchema,
  instant,
  isoDate,
  publicUrl,
  type MarketQuery,
  type PriceDecision,
} from "../../src/market/model";
import {
  analyzeMarket,
  managementAnswer,
  scenario,
} from "../../src/market/engine";
import {
  propertyAccess,
  loadDataset,
  saveProfile,
  savePolicy,
  saveRates,
  validatePacket,
  ingestPacket,
  activeSource,
  bump,
  marketAudit,
  assertUnit,
} from "./repository";
const route =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch((e) =>
      next(
        e instanceof z.ZodError
          ? new HttpError(
              422,
              e.issues
                .map((i) => i.path.join(".") + ": " + i.message)
                .join("; ")
                .slice(0, 2000),
            )
          : e,
      ),
    );
  };
const actor = (res: Response) => res.locals.actor as Actor;
const freshGM = (res: Response) => {
  if (actor(res).role !== "General Manager")
    throw new HttpError(
      403,
      "Only the General Manager may approve this operation.",
    );
  if (!res.locals.authTime || Date.now() / 1000 - res.locals.authTime > 600)
    throw new HttpError(
      401,
      "Recent MFA sign-in within ten minutes is required. Sign out and sign in again.",
    );
};
async function expected(
  db: PoolClient,
  a: Actor,
  id: string,
  revision: unknown,
) {
  const p = await propertyAccess(db, a, id, true);
  if (revision !== p.revision)
    throw new HttpError(409, "Market property changed. Refresh before saving.");
  return p;
}
export async function createRecommendation(
  db: PoolClient,
  a: Actor,
  propertyId: string,
  input: unknown,
  date: string,
) {
  const property = await propertyAccess(db, a, propertyId, true),
    query = querySchema.parse(input),
    dataset = await loadDataset(db, a.organization_id, propertyId);
  const result = analyzeMarket(dataset, query).find((d) => d.date === date);
  if (!result || result.recommendedRate === null)
    throw new HttpError(
      422,
      "No supported recommendation exists for this date.",
    );
  const id = randomUUID();
  await db.query(
    "INSERT INTO market_recommendations(organization_id,id,property_id,unit_id,property_revision,query,snapshot,evidence_hash,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [
      a.organization_id,
      id,
      propertyId,
      query.unitId,
      property.revision,
      query,
      result,
      fingerprint(result.evidenceIds),
      a.uid,
    ],
  );
  await marketAudit(db, a, "recommendation.create", id, {
    date,
    evidenceIds: result.evidenceIds,
  });
  return { id, ...result };
}
export async function decideRecommendation(
  db: PoolClient,
  a: Actor,
  propertyId: string,
  id: string,
  input: unknown,
) {
  if (a.role !== "General Manager")
    throw new HttpError(
      403,
      "Only the General Manager may decide pricing proposals.",
    );
  const property = await propertyAccess(db, a, propertyId, true, true),
    v = z
      .object({
        decision: z.enum(["approved", "rejected", "revision_requested"]),
        reason: z.string().trim().min(5).max(1000),
        approvedRate: z.number().finite().nonnegative().nullable(),
      })
      .parse(input);
  const rec = (
    await db.query(
      "SELECT * FROM market_recommendations WHERE organization_id=$1 AND property_id=$2 AND id=$3",
      [a.organization_id, propertyId, id],
    )
  ).rows[0];
  if (!rec) throw new HttpError(404, "Recommendation not found.");
  if (
    (
      await db.query(
        "SELECT id FROM market_decisions WHERE organization_id=$1 AND recommendation_id=$2",
        [a.organization_id, id],
      )
    ).rows.length
  )
    throw new HttpError(
      409,
      "This recommendation already has an immutable decision. Create a revision.",
    );
  if (v.decision === "approved") {
    if (property.revision !== rec.property_revision)
      throw new HttpError(
        409,
        "Evidence, rates or policy changed. Generate a fresh recommendation.",
      );
    const dataset = await loadDataset(db, a.organization_id, propertyId),
      snapshot = rec.snapshot as PriceDecision,
      current = analyzeMarket(dataset, rec.query as MarketQuery).find(
        (d) => d.date === snapshot.date,
      );
    const policy = dataset.policies.find((p) => p.unitId === rec.unit_id);
    if (
      !current ||
      current.recommendedRate === null ||
      fingerprint(current.evidenceIds) !== rec.evidence_hash ||
      current.recommendedRate !== snapshot.recommendedRate
    )
      throw new HttpError(
        409,
        "Recommendation is stale or no longer supported. Re-analyze.",
      );
    const approved = v.approvedRate ?? current.recommendedRate;
    const floor = policy
      ? Math.max(
          policy.minimumRate,
          (policy.operatingCostPerNight! + policy.minimumContribution!) /
            (1 - policy.commissionPercent / 100),
        )
      : Infinity;
    if (
      !policy ||
      approved < floor ||
      approved > policy.maximumRate ||
      Math.abs(approved - current.currentRate!) >
        (current.currentRate! * policy.maxChangePercent) / 100 + 0.02
    )
      throw new HttpError(
        422,
        "Approved rate violates owner, cost or movement guardrails. Revise the policy through its separate approval workflow.",
      );
    v.approvedRate = approved;
  }
  const decisionId = randomUUID();
  await db.query(
    "INSERT INTO market_decisions(organization_id,id,property_id,recommendation_id,decision,approved_rate,reason,actor_uid) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      a.organization_id,
      decisionId,
      propertyId,
      id,
      v.decision,
      v.decision === "approved" ? v.approvedRate : null,
      v.reason,
      a.uid,
    ],
  );
  await marketAudit(db, a, "recommendation." + v.decision, id, {
    approvedRate: v.approvedRate,
    reason: v.reason,
  });
  return { id: decisionId, ...v, published: false };
}
export function marketRouter(pool: Pool) {
  const router = Router();
  router.get(
    "/properties",
    route(async (_req, res) => {
      const a = actor(res);
      const data = await pool.query(
        `SELECT p.id,p.name,p.revision FROM market_properties p JOIN memberships m ON m.organization_id=p.organization_id AND m.uid=$2 WHERE p.organization_id=$1 AND (m.role='General Manager' OR EXISTS(SELECT 1 FROM market_property_grants g WHERE g.organization_id=p.organization_id AND g.property_id=p.id AND g.uid=$2)) ORDER BY p.name`,
        [a.organization_id, a.uid],
      );
      res.json({ properties: data.rows });
    }),
  );
  router.post(
    "/properties",
    route(async (req, res) => {
      freshGM(res);
      const a = actor(res),
        v = propertySchema.parse(req.body);
      const id = randomUUID();
      await transaction(pool, async (db) => {
        const m = await db.query(
          "SELECT uid FROM memberships WHERE uid=$1 AND organization_id=$2 AND role='General Manager' FOR SHARE",
          [a.uid, a.organization_id],
        );
        if (!m.rows.length)
          throw new HttpError(403, "General Manager membership changed.");
        await db.query(
          "INSERT INTO market_properties(organization_id,id,name) VALUES($1,$2,$3)",
          [a.organization_id, id, v.name],
        );
        await marketAudit(db, a, "property.create", id);
      });
      res.status(201).json({ id });
    }),
  );
  router.get(
    "/properties/:propertyId",
    route(async (req, res) => {
      const a = actor(res);
      res.json(
        await transaction(pool, async (db) => {
          const property = await propertyAccess(db, a, req.params.propertyId);
          const dataset = await loadDataset(db, a.organization_id, property.id);
          const recommendations = await db.query(
            "SELECT r.*,d.decision,d.approved_rate,d.reason AS decision_reason FROM market_recommendations r LEFT JOIN market_decisions d ON d.organization_id=r.organization_id AND d.recommendation_id=r.id WHERE r.organization_id=$1 AND r.property_id=$2 ORDER BY r.created_at DESC LIMIT 100",
            [a.organization_id, property.id],
          );
          const jobs = await db.query(
            "SELECT id,source_id,kind,status,attempts,result,created_at FROM market_research_jobs WHERE organization_id=$1 AND property_id=$2 ORDER BY created_at DESC LIMIT 30",
            [a.organization_id, property.id],
          );
          const outcomes = await db.query(
            "SELECT * FROM market_outcomes WHERE organization_id=$1 AND property_id=$2 ORDER BY created_at DESC LIMIT 50",
            [a.organization_id, property.id],
          );
          const workspace =
            a.role === "General Manager"
              ? await lockedWorkspace(db, a.organization_id)
              : null;
          return {
            property,
            dataset,
            recommendations: recommendations.rows,
            jobs: jobs.rows,
            outcomes: outcomes.rows,
            registeredUnits:
              workspace?.data.apartments.map((u) => ({
                id: u.id,
                unitNumber: u.unitNumber,
                type: u.type,
              })) || [],
          };
        }),
      );
    }),
  );
  router.post(
    "/properties/:propertyId/grants",
    route(async (req, res) => {
      freshGM(res);
      const a = actor(res),
        v = z
          .object({
            uid: z.string().min(1).max(128),
            capability: z.enum(["read", "research", "revoke"]),
          })
          .parse(req.body);
      await transaction(pool, async (db) => {
        await propertyAccess(db, a, req.params.propertyId, true, true);
        if (
          !(
            await db.query(
              "SELECT uid FROM memberships WHERE uid=$1 AND organization_id=$2",
              [v.uid, a.organization_id],
            )
          ).rows.length
        )
          throw new HttpError(422, "Choose a member of this organization.");
        await db.query(
          "DELETE FROM market_property_grants WHERE organization_id=$1 AND property_id=$2 AND uid=$3",
          [a.organization_id, req.params.propertyId, v.uid],
        );
        if (v.capability !== "revoke")
          await db.query(
            "INSERT INTO market_property_grants VALUES($1,$2,$3,$4)",
            [a.organization_id, req.params.propertyId, v.uid, v.capability],
          );
        await marketAudit(db, a, "property.grant", req.params.propertyId, v);
      });
      res.json({ ok: true });
    }),
  );
  router.post(
    "/properties/:propertyId/profile",
    route(async (req, res) => {
      const a = actor(res);
      await transaction(pool, async (db) => {
        await expected(db, a, req.params.propertyId, req.body.revision);
        if (req.body.profile?.propertyId !== req.params.propertyId)
          throw new HttpError(422, "Profile property mismatch.");
        await saveProfile(db, a, req.body.profile);
      });
      res.json({ ok: true });
    }),
  );
  router.post(
    "/properties/:propertyId/access-notes",
    route(async (req, res) => {
      freshGM(res);
      const a = actor(res),
        v = z
          .object({ unitId: z.string(), instructions: z.string().max(3000) })
          .parse(req.body);
      await transaction(pool, async (db) => {
        await propertyAccess(db, a, req.params.propertyId, true, true);
        const u = await db.query(
          "SELECT unit_id FROM market_units WHERE organization_id=$1 AND property_id=$2 AND unit_id=$3",
          [a.organization_id, req.params.propertyId, v.unitId],
        );
        if (!u.rows.length) throw new HttpError(404, "Unit not found.");
        await db.query(
          "INSERT INTO market_access_notes VALUES($1,$2,$3) ON CONFLICT(organization_id,unit_id) DO UPDATE SET instructions=EXCLUDED.instructions",
          [a.organization_id, v.unitId, v.instructions],
        );
        await marketAudit(db, a, "access-notes.save", v.unitId);
      });
      res.json({ ok: true });
    }),
  );
  router.get(
    "/properties/:propertyId/access-notes/:unitId",
    route(async (req, res) => {
      const a = actor(res);
      if (a.role !== "General Manager")
        throw new HttpError(
          403,
          "Access instructions are restricted to the General Manager in this release.",
        );
      res.json(
        await transaction(pool, async (db) => {
          await propertyAccess(db, a, req.params.propertyId, false, true);
          return (
            (
              await db.query(
                "SELECT n.instructions FROM market_access_notes n JOIN market_units u ON u.organization_id=n.organization_id AND u.unit_id=n.unit_id WHERE n.organization_id=$1 AND u.property_id=$2 AND n.unit_id=$3",
                [a.organization_id, req.params.propertyId, req.params.unitId],
              )
            ).rows[0] || { instructions: null }
          );
        }),
      );
    }),
  );
  router.post(
    "/properties/:propertyId/policy",
    route(async (req, res) => {
      freshGM(res);
      const a = actor(res);
      const version = await transaction(pool, async (db) => {
        await expected(db, a, req.params.propertyId, req.body.revision);
        return savePolicy(db, a, req.params.propertyId, req.body.policy);
      });
      res.json({ version });
    }),
  );
  router.post(
    "/properties/:propertyId/rates",
    route(async (req, res) => {
      const a = actor(res);
      await transaction(pool, async (db) => {
        await expected(db, a, req.params.propertyId, req.body.revision);
        await saveRates(db, a, req.params.propertyId, req.body.rates);
      });
      res.json({ ok: true, channelPricesChanged: false });
    }),
  );
  router.post(
    "/properties/:propertyId/sources",
    route(async (req, res) => {
      freshGM(res);
      const a = actor(res),
        v = sourceSchema.parse(req.body.source);
      if (new Date(v.expiresAt).valueOf() <= Date.now())
        throw new HttpError(422, "Permission has expired.");
      const id = randomUUID();
      await transaction(pool, async (db) => {
        await expected(db, a, req.params.propertyId, req.body.revision);
        await propertyAccess(db, a, req.params.propertyId, true, true);
        await db.query(
          "INSERT INTO market_sources(organization_id,id,property_id,name,provider,permission_reference,expires_at,max_age_hours,analysis_allowed,storage_allowed,export_allowed,derivatives_allowed,authorized_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,true,true,$9,true,$10)",
          [
            a.organization_id,
            id,
            req.params.propertyId,
            v.name,
            v.provider,
            v.permissionReference,
            v.expiresAt,
            v.maxAgeHours,
            v.exportAllowed,
            a.uid,
          ],
        );
        await bump(db, a.organization_id, req.params.propertyId);
        await marketAudit(db, a, "source.authorize", id, {
          reference: v.permissionReference,
        });
      });
      res.json({ id });
    }),
  );
  router.post(
    "/properties/:propertyId/sources/:sourceId/revoke",
    route(async (req, res) => {
      freshGM(res);
      const a = actor(res);
      await transaction(pool, async (db) => {
        await propertyAccess(db, a, req.params.propertyId, true, true);
        await db.query(
          "UPDATE market_sources SET revoked_at=now() WHERE organization_id=$1 AND property_id=$2 AND id=$3",
          [a.organization_id, req.params.propertyId, req.params.sourceId],
        );
        await bump(db, a.organization_id, req.params.propertyId);
        await marketAudit(db, a, "source.revoke", req.params.sourceId);
      });
      res.json({ ok: true });
    }),
  );
  router.post(
    "/properties/:propertyId/ingestion/preview",
    route(async (req, res) => {
      const a = actor(res);
      const result = await transaction(pool, async (db) => {
        const property = await propertyAccess(
          db,
          a,
          req.params.propertyId,
          true,
        );
        await activeSource(
          db,
          a.organization_id,
          property.id,
          req.body.sourceId,
        );
        const payload = validatePacket(req.body.packet),
          id = randomUUID();
        await db.query(
          "INSERT INTO market_research_jobs(organization_id,id,property_id,source_id,kind,status,created_by,payload,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            a.organization_id,
            id,
            property.id,
            req.body.sourceId,
            "authorized_feed",
            "preview",
            a.uid,
            payload,
            { revision: property.revision, hash: fingerprint(payload) },
          ],
        );
        await marketAudit(db, a, "ingestion.preview", id, {
          count: payload.offers.length,
        });
        return {
          id,
          listings: payload.competitors.length,
          offers: payload.offers.length,
          packet: payload,
        };
      });
      res.json(result);
    }),
  );
  router.get(
    "/properties/:propertyId/ingestion/:jobId",
    route(async (req, res) => {
      const a = actor(res);
      res.json(
        await transaction(pool, async (db) => {
          await propertyAccess(db, a, req.params.propertyId, true);
          const job = (
            await db.query(
              "SELECT id,source_id,payload,status FROM market_research_jobs WHERE organization_id=$1 AND property_id=$2 AND id=$3 AND kind='authorized_feed'",
              [a.organization_id, req.params.propertyId, req.params.jobId],
            )
          ).rows[0];
          if (!job) throw new HttpError(404, "Source preview not found.");
          await activeSource(
            db,
            a.organization_id,
            req.params.propertyId,
            job.source_id,
          );
          return {
            id: job.id,
            status: job.status,
            packet: job.payload,
            listings: job.payload.competitors.length,
            offers: job.payload.offers.length,
          };
        }),
      );
    }),
  );
  router.post(
    "/properties/:propertyId/ingestion/:jobId/commit",
    route(async (req, res) => {
      freshGM(res);
      const a = actor(res);
      res.json(
        await transaction(pool, async (db) => {
          const p = await propertyAccess(
            db,
            a,
            req.params.propertyId,
            true,
            true,
          );
          const job = (
            await db.query(
              "SELECT * FROM market_research_jobs WHERE organization_id=$1 AND property_id=$2 AND id=$3 FOR UPDATE",
              [a.organization_id, p.id, req.params.jobId],
            )
          ).rows[0];
          if (!job) throw new HttpError(404, "Preview not found.");
          if (job.status === "completed") return job.result;
          if (
            job.status !== "preview" ||
            job.result.revision !== p.revision ||
            Date.now() - new Date(job.created_at).valueOf() > 1800000
          )
            throw new HttpError(
              409,
              "Preview is stale. Validate the feed again.",
            );
          const result = await ingestPacket(
            db,
            a,
            p.id,
            job.source_id,
            job.payload,
          );
          await db.query(
            "UPDATE market_research_jobs SET status='completed',result=$3,updated_at=now() WHERE organization_id=$1 AND id=$2",
            [a.organization_id, job.id, result],
          );
          return result;
        }),
      );
    }),
  );
  router.post(
    "/properties/:propertyId/research",
    route(async (req, res) => {
      const a = actor(res),
        id = randomUUID();
      await transaction(pool, async (db) => {
        await propertyAccess(db, a, req.params.propertyId, true);
        await activeSource(
          db,
          a.organization_id,
          req.params.propertyId,
          req.body.sourceId,
        );
        const query = querySchema.parse(req.body.query);
        await assertUnit(
          db,
          a.organization_id,
          req.params.propertyId,
          query.unitId,
        );
        await db.query(
          "INSERT INTO market_research_jobs(organization_id,id,property_id,source_id,kind,status,created_by,payload,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            a.organization_id,
            id,
            req.params.propertyId,
            req.body.sourceId,
            "provider_collection",
            "queued",
            a.uid,
            query,
            {},
          ],
        );
        await marketAudit(db, a, "research.queue", id);
      });
      res.status(202).json({
        id,
        status: "queued",
        note: "Only installed, authorized provider connectors can run this job.",
      });
    }),
  );
  router.post(
    "/properties/:propertyId/analyze",
    route(async (req, res) => {
      const a = actor(res);
      res.json(
        await transaction(pool, async (db) => {
          await propertyAccess(db, a, req.params.propertyId);
          const dataset = await loadDataset(
            db,
            a.organization_id,
            req.params.propertyId,
          );
          return {
            decisions: analyzeMarket(
              dataset,
              querySchema.parse(req.body.query),
            ),
            generatedAt: new Date().toISOString(),
            demo: false,
          };
        }),
      );
    }),
  );
  router.post(
    "/properties/:propertyId/recommendations",
    route(async (req, res) =>
      res.json(
        await transaction(pool, (db) =>
          createRecommendation(
            db,
            actor(res),
            req.params.propertyId,
            req.body.query,
            isoDate.parse(req.body.date),
          ),
        ),
      ),
    ),
  );
  router.post(
    "/properties/:propertyId/recommendations/:id/decision",
    route(async (req, res) => {
      freshGM(res);
      res.json(
        await transaction(pool, (db) =>
          decideRecommendation(
            db,
            actor(res),
            req.params.propertyId,
            req.params.id,
            req.body,
          ),
        ),
      );
    }),
  );
  router.post(
    "/properties/:propertyId/assistant",
    route(async (req, res) => {
      const a = actor(res);
      res.json(
        await transaction(pool, async (db) => {
          await propertyAccess(db, a, req.params.propertyId);
          const d = await loadDataset(
            db,
            a.organization_id,
            req.params.propertyId,
          );
          return managementAnswer(
            z.string().min(1).max(2000).parse(req.body.question),
            analyzeMarket(d, querySchema.parse(req.body.query)),
          );
        }),
      );
    }),
  );
  router.post(
    "/properties/:propertyId/scenario",
    route(async (req, res) =>
      res.json(
        await transaction(pool, async (db) => {
          const a = actor(res);
          await propertyAccess(db, a, req.params.propertyId);
          const dataset = await loadDataset(
              db,
              a.organization_id,
              req.params.propertyId,
            ),
            q = querySchema.parse(req.body.query),
            decision = analyzeMarket(dataset, q).find(
              (d) => d.date === req.body.date,
            );
          if (!decision)
            throw new HttpError(422, "Date is outside this analysis.");
          return scenario(
            decision,
            z.number().parse(req.body.percent),
            z.number().int().parse(req.body.nights),
            dataset.policies.find((p) => p.unitId === q.unitId)
              ?.commissionPercent || 0,
          );
        }),
      ),
    ),
  );
  router.post(
    "/properties/:propertyId/outcomes",
    route(async (req, res) => {
      const a = actor(res),
        v = z
          .object({
            recommendationId: z.string().uuid(),
            observedFrom: isoDate,
            observedTo: isoDate,
            actualRoomRevenue: z.number().nonnegative().nullable(),
            occupiedNights: z.number().int().nonnegative().nullable(),
            evidenceReference: publicUrl,
            limitations: z.string().min(5).max(1000),
          })
          .parse(req.body);
      if (v.observedTo < v.observedFrom)
        throw new HttpError(422, "Outcome dates are reversed.");
      await transaction(pool, async (db) => {
        await propertyAccess(db, a, req.params.propertyId, true);
        if (
          !(
            await db.query(
              "SELECT id FROM market_decisions WHERE organization_id=$1 AND property_id=$2 AND recommendation_id=$3 AND decision=$4",
              [
                a.organization_id,
                req.params.propertyId,
                v.recommendationId,
                "approved",
              ],
            )
          ).rows.length
        )
          throw new HttpError(422, "An approved recommendation is required.");
        await db.query(
          "INSERT INTO market_outcomes(organization_id,id,property_id,recommendation_id,observed_from,observed_to,actual_room_revenue,occupied_nights,evidence_reference,limitations,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
          [
            a.organization_id,
            randomUUID(),
            req.params.propertyId,
            v.recommendationId,
            v.observedFrom,
            v.observedTo,
            v.actualRoomRevenue,
            v.occupiedNights,
            v.evidenceReference,
            v.limitations,
            a.uid,
          ],
        );
        await marketAudit(db, a, "outcome.append", v.recommendationId);
      });
      res.json({ ok: true, causationEstablished: false });
    }),
  );
  router.post(
    "/properties/:propertyId/reports",
    route(async (req, res) => {
      const a = actor(res),
        type = z.enum(["daily", "weekly", "monthly"]).parse(req.body.type);
      res.json(
        await transaction(pool, async (db) => {
          const p = await propertyAccess(db, a, req.params.propertyId, true);
          const dataset = await loadDataset(db, a.organization_id, p.id),
            query = querySchema.parse(req.body.query),
            decisions = analyzeMarket(dataset, query);
          const used = new Set(
            decisions.flatMap((d) => d.matches.map((m) => m.offer.sourceId)),
          );
          for (const sourceId of used)
            await activeSource(db, a.organization_id, p.id, sourceId);
          if (dataset.sources.some((s) => used.has(s.id) && !s.exportAllowed))
            throw new HttpError(
              403,
              "A source license does not permit export.",
            );
          const id = randomUUID(),
            snapshot = {
              id,
              type,
              property: p.name,
              query,
              createdAt: new Date().toISOString(),
              classification:
                "Internal review draft — not an audited owner statement",
              decisions,
              limitations: [
                "Competitor asking prices; no realized competitor revenue.",
                "Property performance and forecasts are unavailable unless explicitly connected.",
                "No price has been published.",
              ],
            };
          await db.query(
            "INSERT INTO market_reports(organization_id,id,property_id,report_type,snapshot,created_by) VALUES($1,$2,$3,$4,$5,$6)",
            [a.organization_id, id, p.id, type, snapshot, a.uid],
          );
          await marketAudit(db, a, "report.snapshot", id);
          return snapshot;
        }),
      );
    }),
  );
  return router;
}
