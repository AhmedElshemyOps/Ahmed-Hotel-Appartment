import { Router, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { Pool, PoolClient } from "pg";
import { randomUUID, createHash } from "node:crypto";
import { HttpError, type Actor } from "../../auth/permissions";
import { transaction } from "../../db/transaction";
import { lockedWorkspace } from "../../db/workspace";
import { controlAccess, controlAudit, recent } from "./access";
import {
  inspectFile,
  objectKey,
  privateStore,
  scanFile,
  MAX_UPLOAD_BYTES,
  type FileStore,
  type Scanner,
} from "../../integrations/storage/private-files";
let activeUpload = 0;
const endpoint = (fn: any) => (q: any, r: any, n: any) =>
  Promise.resolve(fn(q, r)).catch((e: any) =>
    n(
      e instanceof z.ZodError
        ? new HttpError(422, "Invalid upload request.")
        : e,
    ),
  );
async function uploadAccess(db: PoolClient, res: Response, category: string) {
  const a = await controlAccess(db, res, false);
  if (a.role !== "General Manager") {
    const cap = category === "photo" ? "distribution" : "compliance";
    if (
      !(
        await db.query(
          "SELECT uid FROM readiness_grants WHERE organization_id=$1 AND uid=$2 AND capability=$3 FOR SHARE",
          [a.organization_id, a.uid, cap],
        )
      ).rows.length
    )
      throw new HttpError(403, "You do not have this evidence responsibility.");
  }
  return a;
}
export function uploadsRouter(
  pool: Pool,
  dependencies: { store?: FileStore; scanner?: Scanner } = {},
) {
  const router = Router();
  const store = () => dependencies.store || privateStore();
  const scanner = dependencies.scanner || scanFile;
  router.get(
    "/",
    endpoint(async (q: any, res: Response) =>
      res.json(
        await transaction(pool, async (db) => {
          await controlAccess(db, res, false);
          const a = res.locals.actor as Actor;
          const caps =
            a.role === "General Manager"
              ? ["document", "photo"]
              : (
                  await db.query(
                    "SELECT capability FROM readiness_grants WHERE organization_id=$1 AND uid=$2",
                    [a.organization_id, a.uid],
                  )
                ).rows.map((r) =>
                  r.capability === "compliance"
                    ? "document"
                    : r.capability === "distribution"
                      ? "photo"
                      : "none",
                );
          const files = (
            await db.query(
              "SELECT id,unit_id,category,name,mime,byte_count,status,scanner,width,height,created_at,retention_until FROM protected_files WHERE organization_id=$1 AND status<>'deleted' ORDER BY created_at DESC LIMIT 1001",
              [a.organization_id],
            )
          ).rows.filter((f) => caps.includes(f.category));
          if (files.length > 1000)
            throw new HttpError(
              422,
              "File-list limit reached; add pagination before expanding.",
            );
          return { files };
        }),
      ),
    ),
  );
  router.post(
    "/",
    rateLimit({
      windowMs: 60000,
      limit: 6,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      keyGenerator: (_req, res) =>
        createHash("sha256")
          .update(res.locals.actor.organization_id + ":" + res.locals.actor.uid)
          .digest("hex"),
    }),
    endpoint(async (q: any, res: Response) => {
      const v = z
        .object({
          unitId: z.string().min(1),
          category: z.enum(["document", "photo"]),
          name: z
            .string()
            .trim()
            .min(1)
            .max(150)
            .regex(/^[^/\\\u0000-\u001f\u007f]+$/),
          base64: z
            .string()
            .min(4)
            .max(Math.ceil(MAX_UPLOAD_BYTES / 3) * 4)
            .regex(
              /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
            ),
        })
        .strict()
        .parse(q.body);
      const a = res.locals.actor as Actor;
      // Check access before decoding, scanning or storing bytes.
      await transaction(pool, async (db) => {
        await uploadAccess(db, res, v.category);
        const ws = await lockedWorkspace(db, a.organization_id);
        if (!ws.data.apartments.some((u) => u.id === v.unitId))
          throw new HttpError(404, "Apartment not found.");
      });
      if (activeUpload >= 1)
        throw new HttpError(
          429,
          "Another file is being inspected on this server. Try again shortly.",
        );
      activeUpload++;
      try {
        const original = Buffer.from(v.base64, "base64");
        let checked;
        try {
          checked = await inspectFile(original, v.category);
        } catch {
          throw new HttpError(
            422,
            "File could not be inspected. Use a PDF or a JPEG/PNG photograph up to 2 MB and 16 megapixels.",
          );
        }
        const id = randomUUID(),
          key = objectKey(a.organization_id, id),
          storage = store();
        // Register quarantine first; a failed storage/scan never creates a downloadable file.
        await transaction(pool, async (db) => {
          await uploadAccess(db, res, v.category);
          await db.query(
            "INSERT INTO protected_files(organization_id,id,unit_id,category,name,mime,byte_count,sha256,object_key,status,uploaded_by,retention_until,width,height) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'quarantined',$10,$11,$12,$13)",
            [
              a.organization_id,
              id,
              v.unitId,
              v.category,
              v.name,
              checked.mime,
              checked.bytes.length,
              createHash("sha256").update(checked.bytes).digest("hex"),
              key,
              a.uid,
              new Date(Date.now() + 365 * 86400000).toISOString(),
              checked.width || null,
              checked.height || null,
            ],
          );
          await controlAudit(db, a, "file.quarantine", id, {
            unitId: v.unitId,
            category: v.category,
          });
        });
        let status = "quarantined",
          scannerStatus = "unavailable";
        try {
          await storage.put(key, checked.bytes);
          const first = await scanner(original);
          const second =
            first === "clean" ? await scanner(checked.bytes) : "infected";
          status =
            first === "clean" && second === "clean" ? "clean" : "rejected";
          scannerStatus = dependencies.scanner
            ? "SIMULATED test scanner"
            : "ClamAV";
        } catch {
          status = "quarantined";
        }
        if (status === "rejected") await storage.remove(key).catch(() => {});
        await transaction(pool, async (db) => {
          const updated = await db.query(
            "UPDATE protected_files SET status=$3,scanner=$4 WHERE organization_id=$1 AND id=$2 AND status='quarantined' RETURNING status",
            [a.organization_id, id, status, scannerStatus],
          );
          if (!updated.rows.length) {
            status = "deleted";
            await storage.remove(key).catch(() => {});
          }
          await controlAudit(db, a, "file.scan", id, {
            status,
            scanner: scannerStatus,
          });
        });
        res.status(status === "clean" ? 201 : 202).json({
          id,
          status,
          message:
            status === "clean"
              ? "File inspected and scanned. Download remains permission-controlled."
              : "File is unavailable: quarantined or rejected. No readiness approval was granted.",
        });
      } finally {
        activeUpload--;
      }
    }),
  );
  router.post(
    "/:id/rescan",
    endpoint(async (q: any, res: Response) => {
      recent(res);
      const f = await transaction(pool, async (db) => {
        const a = await controlAccess(db, res);
        const row = (
          await db.query(
            "SELECT * FROM protected_files WHERE organization_id=$1 AND id=$2",
            [a.organization_id, z.uuid().parse(q.params.id)],
          )
        ).rows[0];
        if (
          !row ||
          row.status !== "quarantined" ||
          new Date(row.retention_until).valueOf() <= Date.now()
        )
          throw new HttpError(
            409,
            "Only an unexpired quarantined file can be scanned again.",
          );
        return row;
      });
      if (activeUpload)
        throw new HttpError(
          429,
          "Another file is being inspected. Try again shortly.",
        );
      activeUpload++;
      try {
        const bytes = await store().get(f.object_key);
        if (createHash("sha256").update(bytes).digest("hex") !== f.sha256)
          throw new HttpError(409, "File integrity check failed.");
        let status = "quarantined";
        try {
          status = (await scanner(bytes)) === "clean" ? "clean" : "rejected";
        } catch {}
        await transaction(pool, async (db) => {
          const a = await controlAccess(db, res);
          const row = (
            await db.query(
              "UPDATE protected_files SET status=$3,scanner=$4 WHERE organization_id=$1 AND id=$2 AND status='quarantined' RETURNING status",
              [
                a.organization_id,
                f.id,
                status,
                dependencies.scanner ? "SIMULATED test scanner" : "ClamAV",
              ],
            )
          ).rows[0];
          if (!row) {
            status = "deleted";
          }
          await controlAudit(db, a, "file.rescan", f.id, { status });
        });
        if (["rejected", "deleted"].includes(status))
          await store().remove(f.object_key);
        res.json({ status });
      } finally {
        activeUpload--;
      }
    }),
  );
  router.post(
    "/retention/purge",
    endpoint(async (_q: any, res: Response) => {
      recent(res);
      const files = await transaction(pool, async (db) => {
        const a = await controlAccess(db, res);
        await db.query(
          "UPDATE protected_files SET status='deleted' WHERE organization_id=$1 AND retention_until<=now() AND status<>'deleted'",
          [a.organization_id],
        );
        const rows = (
          await db.query(
            "SELECT id,object_key FROM protected_files WHERE organization_id=$1 AND status='deleted'",
            [a.organization_id],
          )
        ).rows;
        await controlAudit(db, a, "file.retention-purge", "expired", {
          count: rows.length,
        });
        return rows;
      });
      let removed = 0;
      for (const f of files) {
        await store().remove(f.object_key);
        removed++;
      }
      res.json({ removed });
    }),
  );
  router.get(
    "/:id/download",
    endpoint(async (q: any, res: Response) => {
      const f = await transaction(pool, async (db) => {
        const a = res.locals.actor as Actor;
        const r = (
          await db.query(
            "SELECT * FROM protected_files WHERE organization_id=$1 AND id=$2",
            [a.organization_id, z.uuid().parse(q.params.id)],
          )
        ).rows[0];
        if (!r) throw new HttpError(404, "File not found.");
        await uploadAccess(db, res, r.category);
        if (
          r.status !== "clean" ||
          new Date(r.retention_until).valueOf() <= Date.now()
        )
          throw new HttpError(409, "File is not available for download.");
        await controlAudit(db, a, "file.download", r.id);
        return r;
      });
      const bytes = await store().get(f.object_key);
      if (createHash("sha256").update(bytes).digest("hex") !== f.sha256)
        throw new HttpError(409, "File integrity check failed.");
      await transaction(pool, async (db) => {
        await uploadAccess(db, res, f.category);
        const current = (
          await db.query(
            "SELECT status,retention_until FROM protected_files WHERE organization_id=$1 AND id=$2",
            [res.locals.actor.organization_id, f.id],
          )
        ).rows[0];
        if (
          !current ||
          current.status !== "clean" ||
          new Date(current.retention_until).valueOf() <= Date.now()
        )
          throw new HttpError(409, "File is no longer available.");
      });
      res.set({
        "Content-Type": f.mime,
        "Content-Disposition": `attachment; filename="evidence-${f.id}.${f.category === "photo" ? "jpg" : "pdf"}"`,
        "Cache-Control": "private,no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.send(bytes);
    }),
  );
  router.post(
    "/:id/delete",
    endpoint(async (q: any, res: Response) => {
      recent(res);
      const f = await transaction(pool, async (db) => {
        const a = await controlAccess(db, res);
        const r = (
          await db.query(
            "SELECT object_key FROM protected_files WHERE organization_id=$1 AND id=$2 AND status<>'deleted' FOR UPDATE",
            [a.organization_id, z.uuid().parse(q.params.id)],
          )
        ).rows[0];
        if (!r) throw new HttpError(404, "File not found.");
        await db.query(
          "UPDATE protected_files SET status='deleted' WHERE organization_id=$1 AND id=$2",
          [a.organization_id, q.params.id],
        );
        await controlAudit(db, a, "file.delete", q.params.id);
        return r;
      });
      await store().remove(f.object_key);
      res.json({ ok: true });
    }),
  );
  return router;
}
