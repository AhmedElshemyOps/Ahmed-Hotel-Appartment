import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { randomUUID, createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { transaction, lockedWorkspace, HttpError, type Actor } from "../cloud";
import {
  connectionSchema,
  accountingDate,
  packetSchema,
  type AccountingDocument,
  type DimensionMapping,
} from "../../src/accounting/model";
import { financialAnalysis } from "../../src/accounting/engine";
import { parseAccountingCsv } from "./csv";
const hash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
const route =
  (fn: (q: Request, r: Response) => Promise<unknown>) =>
  (q: Request, r: Response, n: NextFunction) => {
    fn(q, r).catch((e) =>
      n(
        e instanceof z.ZodError
          ? new HttpError(
              422,
              e.issues
                .map((v) => v.message)
                .join("; ")
                .slice(0, 2000),
            )
          : e,
      ),
    );
  };
async function access(db: PoolClient, a: Actor) {
  const m = (
    await db.query(
      "SELECT role FROM memberships WHERE organization_id=$1 AND uid=$2 FOR SHARE",
      [a.organization_id, a.uid],
    )
  ).rows[0];
  if (
    !m ||
    m.role !== a.role ||
    !["General Manager", "Finance Manager"].includes(m.role)
  )
    throw new HttpError(
      403,
      "Accounting access requires a current GM or Finance Manager seat.",
    );
}
function fresh(res: Response, gm = false) {
  if (gm && res.locals.actor.role !== "General Manager")
    throw new HttpError(403, "General Manager approval required.");
  if (!res.locals.authTime || Date.now() / 1000 - res.locals.authTime > 600)
    throw new HttpError(
      401,
      "A recent MFA sign-in within ten minutes is required.",
    );
}
async function connection(db: PoolClient, a: Actor, id: string) {
  await access(db, a);
  const r = (
    await db.query(
      "SELECT * FROM accounting_connections WHERE organization_id=$1 AND id=$2 FOR UPDATE",
      [a.organization_id, id],
    )
  ).rows[0];
  if (!r) throw new HttpError(404, "Accounting connection not found.");
  return r;
}
async function log(
  db: PoolClient,
  a: Actor,
  id: string,
  operation: string,
  status: string,
  message: string,
  details: unknown = {},
) {
  const key = randomUUID();
  await db.query(
    "INSERT INTO accounting_sync_logs(id,organization_id,connection_id,actor_uid,operation,status,message,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [key, a.organization_id, id, a.uid, operation, status, message, details],
  );
  await db.query(
    "INSERT INTO audit_events(organization_id,actor_uid,action,target,details) VALUES($1,$2,$3,$4,$5)",
    [
      a.organization_id,
      a.uid,
      "accounting." + operation,
      key,
      { connectionId: id, status, ...(details as object) },
    ],
  );
}
export async function loadAccounting(db: PoolClient, a: Actor, id: string) {
  await connection(db, a, id);
  const documents = (
    await db.query(
      "SELECT * FROM accounting_documents WHERE organization_id=$1 AND connection_id=$2 ORDER BY posting_date,external_id LIMIT 5001",
      [a.organization_id, id],
    )
  ).rows;
  const lines = (
    await db.query(
      "SELECT * FROM accounting_lines WHERE organization_id=$1 AND connection_id=$2 ORDER BY external_id LIMIT 50001",
      [a.organization_id, id],
    )
  ).rows;
  if (documents.length > 5000 || lines.length > 50000)
    throw new HttpError(
      422,
      "Accounting pilot limit reached. Add server pagination before expanding this ledger; no results are silently truncated.",
    );
  return documents.map((d) => ({
    externalId: d.external_id,
    companyId: "",
    type: d.document_type,
    number: d.number,
    postingDate:
      d.posting_date instanceof Date
        ? d.posting_date.toISOString().slice(0, 10)
        : String(d.posting_date).slice(0, 10),
    currency: d.currency,
    status: d.status,
    sourceUpdatedAt: new Date(d.source_updated_at).toISOString(),
    partnerName: d.partner_name,
    total: Number(d.total),
    outstanding: Number(d.outstanding),
    lines: lines
      .filter((l) => l.document_id === d.external_id)
      .map((l) => ({
        externalLineId: l.external_id,
        accountCode: l.account_code,
        accountClass: l.account_class,
        dimensionKey: l.dimension_key,
        debit: Number(l.debit),
        credit: Number(l.credit),
        description: l.description,
      })),
  })) as AccountingDocument[];
}
export function accountingRouter(pool: Pool) {
  const router = Router();
  router.param("id", (_req, res, next, id) => {
    res.locals.accountingConnectionId = id;
    if (!z.string().uuid().safeParse(id).success) {
      next(new HttpError(404, "Accounting connection not found."));
      return;
    }
    next();
  });
  router.get(
    "/",
    route(async (_q, res) => {
      const a = res.locals.actor as Actor;
      res.json(
        await transaction(pool, async (db) => {
          await access(db, a);
          return {
            connections: (
              await db.query(
                "SELECT id,config,revision,status,updated_at FROM accounting_connections WHERE organization_id=$1 ORDER BY updated_at DESC",
                [a.organization_id],
              )
            ).rows.map((r) => ({
              ...r,
              config: {
                ...r.config,
                credentialSecretRef: undefined,
                hasCredentialReference: !!r.config.credentialSecretRef,
              },
            })),
          };
        }),
      );
    }),
  );
  router.post(
    "/connections",
    route(async (req, res) => {
      fresh(res, true);
      const body = z
          .object({
            id: z.string().uuid().optional(),
            revision: z.number().int().optional(),
            config: connectionSchema,
          })
          .strict()
          .parse(req.body),
        a = res.locals.actor as Actor;
      res.json(
        await transaction(pool, async (db) => {
          await access(db, a);
          const id = body.id ?? randomUUID();
          if (body.id) {
            const old = await connection(db, a, id);
            if (old.revision !== body.revision)
              throw new HttpError(
                409,
                "Connection changed. Refresh before saving.",
              );
            const sameIdentity = ["provider", "companyId", "endpoint"].every(
              (k) => old.config[k] === (body.config as any)[k],
            );
            if (
              !sameIdentity &&
              (
                await db.query(
                  "SELECT id FROM accounting_imports WHERE organization_id=$1 AND connection_id=$2 LIMIT 1",
                  [a.organization_id, id],
                )
              ).rows.length
            )
              throw new HttpError(
                409,
                "Imported ledgers cannot be reassigned to another source/company. Create a separate connection.",
              );
            await db.query(
              "UPDATE accounting_connections SET config=$3,revision=revision+1,updated_at=now() WHERE organization_id=$1 AND id=$2",
              [a.organization_id, id, body.config],
            );
          } else
            await db.query(
              "INSERT INTO accounting_connections(organization_id,id,config) VALUES($1,$2,$3)",
              [a.organization_id, id, body.config],
            );
          await log(
            db,
            a,
            id,
            "configure",
            "disconnected",
            "Configuration saved. No external requests or credential access occurred.",
          );
          return { id, status: "disconnected" };
        }),
      );
    }),
  );
  router.post(
    "/:id/sync",
    route(async (req, res) => {
      fresh(res, true);
      const a = res.locals.actor as Actor;
      z.object({}).strict().parse(req.body);
      res.json(
        await transaction(pool, async (db) => {
          await connection(db, a, req.params.id);
          const message =
            "Live Odoo connection is disabled pending administrator approval, hosting/version discovery, API entitlement, read-only credentials and authorized connector tests. CSV import remains available.";
          await log(db, a, req.params.id, "sync", "blocked", message);
          return { status: "blocked", message };
        }),
      );
    }),
  );
  router.post(
    "/:id/mappings",
    route(async (req, res) => {
      fresh(res);
      const mappings = z
        .object({
          mappings: z
            .array(
              z
                .object({
                  dimensionKey: z.string().trim().min(1).max(180),
                  unitId: z.string().nullable(),
                  building: z.string().trim().max(180),
                })
                .strict(),
            )
            .max(2000),
        })
        .strict()
        .parse(req.body).mappings;
      const a = res.locals.actor as Actor;
      await transaction(pool, async (db) => {
        await connection(db, a, req.params.id);
        const ws = await lockedWorkspace(db, a.organization_id);
        if (
          new Set(mappings.map((m) => m.dimensionKey)).size !== mappings.length
        )
          throw new HttpError(422, "Duplicate accounting dimensions.");
        for (const m of mappings) {
          if (m.unitId && !ws.data.apartments.some((u) => u.id === m.unitId))
            throw new HttpError(
              422,
              "Mapping must reference a registered apartment in this company.",
            );
          if (!m.unitId && !m.building)
            throw new HttpError(
              422,
              "Map to an apartment or an identified building.",
            );
        }
        await db.query(
          "DELETE FROM accounting_mappings WHERE organization_id=$1 AND connection_id=$2",
          [a.organization_id, req.params.id],
        );
        for (const m of mappings)
          await db.query(
            "INSERT INTO accounting_mappings VALUES($1,$2,$3,$4,$5,$6)",
            [
              a.organization_id,
              req.params.id,
              m.dimensionKey,
              m.unitId,
              m.building,
              a.uid,
            ],
          );
        await log(
          db,
          a,
          req.params.id,
          "mappings",
          "saved",
          "Accounting dimension mappings reviewed.",
          { mappings },
        );
      });
      res.json({ saved: true });
    }),
  );
  router.post(
    "/:id/imports/preview",
    route(async (req, res) => {
      fresh(res);
      const body = z
          .object({
            csv: z.string().max(1500000),
            fileName: z.string().trim().min(1).max(180),
            periodStart: accountingDate,
            periodEnd: accountingDate,
            coverage: z.enum(["partial", "period-export"]),
          })
          .strict()
          .parse(req.body),
        a = res.locals.actor as Actor;
      res.json(
        await transaction(pool, async (db) => {
          const c = await connection(db, a, req.params.id);
          let packet;
          try {
            packet = parseAccountingCsv(body.csv, {
              companyId: c.config.companyId,
              periodStart: body.periodStart,
              periodEnd: body.periodEnd,
              simulated: false,
              coverage: body.coverage,
            });
          } catch (e) {
            await log(
              db,
              a,
              req.params.id,
              "preview",
              "error",
              "CSV validation failed. No accounting rows accepted.",
            );
            return { error: (e as Error).message, status: "invalid" };
          }
          if (
            packet.documents.some(
              (d) => Date.parse(d.sourceUpdatedAt) > Date.now() + 300000,
            )
          )
            throw new HttpError(
              422,
              "Source update timestamp is in the future.",
            );
          const id = randomUUID();
          await db.query(
            "INSERT INTO accounting_imports(id,organization_id,connection_id,connection_revision,actor_uid,file_name,file_hash,packet,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
            [
              id,
              a.organization_id,
              req.params.id,
              c.revision,
              a.uid,
              body.fileName,
              hash(body.csv),
              packet,
              "preview",
            ],
          );
          await log(
            db,
            a,
            req.params.id,
            "preview",
            "review_required",
            "CSV packet validated. Explicit review and commit required.",
            { importId: id, documents: packet.documents.length },
          );
          return {
            id,
            packet,
            analysis: financialAnalysis(
              packet.documents,
              [],
              packet.periodStart,
              packet.periodEnd,
            ),
            status: "review_required",
          };
        }),
      );
    }),
  );
  router.post(
    "/:id/imports/:batch/commit",
    route(async (req, res) => {
      fresh(res);
      z.object({ reviewConfirmed: z.literal(true) })
        .strict()
        .parse(req.body);
      const a = res.locals.actor as Actor;
      res.json(
        await transaction(pool, async (db) => {
          const c = await connection(db, a, req.params.id),
            batch = (
              await db.query(
                "SELECT * FROM accounting_imports WHERE organization_id=$1 AND connection_id=$2 AND id=$3 FOR UPDATE",
                [a.organization_id, req.params.id, req.params.batch],
              )
            ).rows[0];
          if (!batch) throw new HttpError(404, "Import not found.");
          if (batch.status === "committed")
            return { status: "committed", replayed: true };
          if (
            batch.connection_revision !== c.revision ||
            Date.now() - new Date(batch.created_at).valueOf() > 1800000
          )
            throw new HttpError(
              409,
              "Import preview is stale. Preview the CSV again.",
            );
          const packet = packetSchema.parse(batch.packet);
          if (packet.simulated)
            throw new HttpError(
              422,
              "Simulated records cannot enter cloud accounting.",
            );
          let inserted = 0,
            updated = 0,
            unchanged = 0;
          for (const d of packet.documents) {
            if (d.companyId !== c.config.companyId)
              throw new HttpError(422, "Wrong accounting company.");
            const old = (
                await db.query(
                  "SELECT source_updated_at,source_hash FROM accounting_documents WHERE organization_id=$1 AND connection_id=$2 AND external_id=$3",
                  [a.organization_id, req.params.id, d.externalId],
                )
              ).rows[0],
              sourceHash = hash(d);
            if (old && old.source_hash === sourceHash) {
              unchanged++;
              continue;
            }
            if (
              old &&
              Date.parse(d.sourceUpdatedAt) <=
                new Date(old.source_updated_at).valueOf()
            )
              throw new HttpError(
                409,
                "Source update is older than or conflicts with accepted document " +
                  d.number +
                  ".",
              );
            for (const line of d.lines)
              if (
                (
                  await db.query(
                    "SELECT document_id FROM accounting_lines WHERE organization_id=$1 AND connection_id=$2 AND external_id=$3 AND document_id<>$4",
                    [
                      a.organization_id,
                      req.params.id,
                      line.externalLineId,
                      d.externalId,
                    ],
                  )
                ).rows.length
              )
                throw new HttpError(
                  409,
                  "Source ledger line already belongs to another document.",
                );
            await db.query(
              "INSERT INTO accounting_documents(organization_id,connection_id,external_id,source_updated_at,source_hash,document_type,number,posting_date,currency,status,partner_name,total,outstanding,last_import) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(organization_id,connection_id,external_id) DO UPDATE SET source_updated_at=EXCLUDED.source_updated_at,source_hash=EXCLUDED.source_hash,document_type=EXCLUDED.document_type,number=EXCLUDED.number,posting_date=EXCLUDED.posting_date,currency=EXCLUDED.currency,status=EXCLUDED.status,partner_name=EXCLUDED.partner_name,total=EXCLUDED.total,outstanding=EXCLUDED.outstanding,last_import=EXCLUDED.last_import",
              [
                a.organization_id,
                req.params.id,
                d.externalId,
                d.sourceUpdatedAt,
                sourceHash,
                d.type,
                d.number,
                d.postingDate,
                d.currency,
                d.status,
                d.partnerName,
                d.total,
                d.outstanding,
                batch.id,
              ],
            );
            await db.query(
              "DELETE FROM accounting_lines WHERE organization_id=$1 AND connection_id=$2 AND document_id=$3",
              [a.organization_id, req.params.id, d.externalId],
            );
            for (const l of d.lines)
              await db.query(
                "INSERT INTO accounting_lines VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
                [
                  a.organization_id,
                  req.params.id,
                  l.externalLineId,
                  d.externalId,
                  l.accountCode,
                  l.accountClass,
                  l.dimensionKey,
                  l.debit,
                  l.credit,
                  l.description,
                ],
              );
            await db.query(
              "INSERT INTO accounting_document_history(organization_id,connection_id,external_id,source_hash,snapshot,import_id) VALUES($1,$2,$3,$4,$5,$6)",
              [
                a.organization_id,
                req.params.id,
                d.externalId,
                sourceHash,
                d,
                batch.id,
              ],
            );
            old ? updated++ : inserted++;
          }
          await db.query(
            "UPDATE accounting_imports SET status='committed',committed_at=now() WHERE id=$1",
            [batch.id],
          );
          await log(
            db,
            a,
            req.params.id,
            "import",
            "committed",
            "Reviewed CSV imported. No external accounting write occurred.",
            { inserted, updated, unchanged, importId: batch.id },
          );
          return { status: "committed", inserted, updated, unchanged };
        }),
      );
    }),
  );
  router.get(
    "/:id",
    route(async (req, res) => {
      const range = z
        .object({ start: accountingDate, end: accountingDate })
        .parse(req.query);
      if (range.start > range.end)
        throw new HttpError(422, "Invalid date range.");
      const a = res.locals.actor as Actor;
      res.json(
        await transaction(pool, async (db) => {
          const c = await connection(db, a, req.params.id),
            documents = await loadAccounting(db, a, req.params.id),
            mappings = (
              await db.query(
                "SELECT dimension_key,unit_id,building,reviewed_by FROM accounting_mappings WHERE organization_id=$1 AND connection_id=$2",
                [a.organization_id, req.params.id],
              )
            ).rows.map((m) => ({
              dimensionKey: m.dimension_key,
              unitId: m.unit_id,
              building: m.building,
              reviewedBy: m.reviewed_by,
            })) as DimensionMapping[];
          const latest =
            (
              await db.query(
                "SELECT file_name,file_hash,committed_at,packet->>'coverage' AS coverage,packet->>'periodStart' AS period_start,packet->>'periodEnd' AS period_end FROM accounting_imports WHERE organization_id=$1 AND connection_id=$2 AND status='committed' ORDER BY committed_at DESC LIMIT 1",
                [a.organization_id, req.params.id],
              )
            ).rows[0] ?? null;
          return {
            status: c.status,
            documents: documents
              .filter(
                (d) =>
                  d.postingDate >= range.start && d.postingDate <= range.end,
              )
              .map((d) => ({ ...d, companyId: c.config.companyId })),
            mappings,
            analysis: financialAnalysis(
              documents,
              mappings,
              range.start,
              range.end,
            ),
            latestImport: latest,
            logs: (
              await db.query(
                "SELECT operation,status,message,details,created_at FROM accounting_sync_logs WHERE organization_id=$1 AND connection_id=$2 ORDER BY created_at DESC LIMIT 100",
                [a.organization_id, req.params.id],
              )
            ).rows,
          };
        }),
      );
    }),
  );
  router.use(
    (error: unknown, req: Request, res: Response, next: NextFunction) => {
      const a = res.locals.actor as Actor;
      const id = res.locals.accountingConnectionId;
      if (!a || !id) {
        next(error);
        return;
      }
      transaction(pool, async (db) => {
        await connection(db, a, id);
        await log(
          db,
          a,
          id,
          "request",
          "error",
          "Accounting request rejected; no partial accounting changes were accepted.",
          { status: error instanceof HttpError ? error.status : 422 },
        );
      })
        .catch(() => {})
        .finally(() => next(error));
    },
  );
  return router;
}
