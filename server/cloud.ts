import { accountingRouter } from "./accounting/routes";
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { Pool, type PoolClient } from "pg";
import { initializeApp, getApps, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { randomUUID } from "node:crypto";
import { readinessRouter } from "./readiness/routes";
import { marketRouter } from "./market/routes";
import { googleRouter } from "./market/google";
import type { Apartment, UserRole } from "../src/types";
import {
  DEFAULT_CHANNELS,
  validateChannel,
  type DistributionChannel,
} from "../src/services/distribution";
import {
  fingerprint,
  previewPms,
  type Preview,
  type StoredReservation,
} from "./pms";
import {
  DEFAULT_GUEST_SERVICE,
  serviceTasks,
  validateServiceSettings,
  type GuestService,
} from "../src/services/guestService";

export type Workspace = {
  channels: DistributionChannel[];
  apartments: Apartment[];
  reservations: StoredReservation[];
  guestService?: GuestService;
};
export type Actor = { uid: string; organization_id: string; role: UserRole };
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function authorize(
  actor: Actor,
  action: "read" | "channel" | "import" | "unit",
) {
  const roles =
    action === "read"
      ? [
          "General Manager",
          "Finance Manager",
          "Revenue Manager",
          "Read-Only Viewer",
        ]
      : action === "unit"
        ? ["General Manager"]
        : ["General Manager", "Finance Manager", "Revenue Manager"];
  if (!roles.includes(actor.role))
    throw new HttpError(403, "Your role does not permit this action.");
}
const route =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
const initial = (): Workspace => ({
  channels: DEFAULT_CHANNELS,
  apartments: [],
  reservations: [],
  guestService: DEFAULT_GUEST_SERVICE,
});
export async function transaction<T>(
  pool: Pool,
  fn: (db: PoolClient) => Promise<T>,
) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const value = await fn(db);
    await db.query("COMMIT");
    return value;
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
}
export async function lockedWorkspace(db: PoolClient, org: string) {
  await db.query(
    "INSERT INTO workspaces(organization_id,data) VALUES($1,$2) ON CONFLICT DO NOTHING",
    [org, initial()],
  );
  const { rows } = await db.query(
    "SELECT revision,data FROM workspaces WHERE organization_id=$1 FOR UPDATE",
    [org],
  );
  return rows[0] as { revision: number; data: Workspace };
}
async function save(db: PoolClient, org: string, data: Workspace) {
  await db.query(
    "UPDATE workspaces SET data=$2, revision=revision+1 WHERE organization_id=$1",
    [org, data],
  );
}
async function audit(
  db: PoolClient,
  actor: Actor,
  action: string,
  target: string,
  details: unknown = {},
) {
  await db.query(
    "INSERT INTO audit_events(organization_id,actor_uid,action,target,details) VALUES($1,$2,$3,$4,$5)",
    [actor.organization_id, actor.uid, action, target, details],
  );
}
export async function commitBatch(
  pool: Pool,
  actor: Actor,
  id: string,
  rollback = false,
) {
  authorize(actor, "import");
  return transaction(pool, async (db) => {
    // Membership lock serializes privilege changes with the mutation.
    await liveMembership(db, actor);
    const workspace = await lockedWorkspace(db, actor.organization_id);
    const { rows } = await db.query(
      "SELECT * FROM import_batches WHERE id=$1 AND organization_id=$2 FOR UPDATE",
      [id, actor.organization_id],
    );
    const batch = rows[0];
    if (!batch) throw new HttpError(404, "Import not found.");
    const preview = batch.preview as Preview;
    if (!rollback && batch.status === "committed")
      return { status: "committed" };
    if (rollback && batch.status === "rolled_back")
      return { status: "rolled_back" };
    if (rollback ? batch.status !== "committed" : batch.status !== "preview")
      throw new HttpError(409, "Import is no longer in the required state.");
    if (
      !rollback &&
      (batch.revision !== workspace.revision ||
        Date.now() - new Date(batch.created_at).valueOf() > 1800000)
    )
      throw new HttpError(
        409,
        "Preview expired or company data changed. Preview the file again.",
      );
    if (!rollback && preview.errors.length)
      throw new HttpError(
        422,
        "Resolve every validation issue before approval.",
      );
    const records = new Map(
      workspace.data.reservations.map((r) => [
        r.source + ":" + r.externalId,
        r,
      ]),
    );
    for (const change of preview.changes.filter(
      (c) => c.operation !== "unchanged",
    )) {
      if (rollback) {
        const expected = { ...change.after, lastBatch: id };
        if (fingerprint(records.get(change.key)) !== fingerprint(expected))
          throw new HttpError(
            409,
            "A reservation was updated after this import. Roll back newer changes first.",
          );
        if (change.before) records.set(change.key, change.before);
        else records.delete(change.key);
      } else records.set(change.key, { ...change.after, lastBatch: id });
    }
    // Rollback can reintroduce an older stay that now overlaps a later independent booking.
    const active = [...records.values()]
      .filter((r) => r.data.status !== "Canceled")
      .sort((a, b) => a.data.checkInDate.localeCompare(b.data.checkInDate));
    const ends = new Map<string, string>();
    for (const r of active) {
      if ((ends.get(r.data.unitId) || "") > r.data.checkInDate)
        throw new HttpError(
          409,
          "Reversal would create overlapping stays. Resolve the newer booking first.",
        );
      ends.set(r.data.unitId, r.data.checkOutDate);
    }
    workspace.data.reservations = [...records.values()];
    await save(db, actor.organization_id, workspace.data);
    await db.query(
      rollback
        ? "UPDATE import_batches SET status='rolled_back',rolled_back_at=now() WHERE id=$1"
        : "UPDATE import_batches SET status='committed',committed_at=now() WHERE id=$1",
      [id],
    );
    await audit(
      db,
      actor,
      rollback ? "import.rollback" : "import.commit",
      id,
      preview.summary,
    );
    return { status: rollback ? "rolled_back" : "committed" };
  });
}
async function liveMembership(db: PoolClient, actor: Actor) {
  const { rows } = await db.query(
    "SELECT uid FROM memberships WHERE uid=$1 AND organization_id=$2 AND role=$3 FOR SHARE",
    [actor.uid, actor.organization_id, actor.role],
  );
  if (!rows.length)
    throw new HttpError(403, "Membership changed. Sign in again.");
}
export function createCloudRouter(
  pool: Pool,
  verify: (token: string) => Promise<any> = (token) =>
    getAuth().verifyIdToken(token, true),
) {
  const router = Router();
  router.use((req: Request, res: Response, next: NextFunction) => {
    (async () => {
      const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
      if (!token)
        throw new HttpError(401, "Sign in with your company account.");
      let claims;
      try {
        claims = await verify(token);
      } catch {
        throw new HttpError(401, "Session expired. Sign in again.");
      }
      if (
        !Number.isFinite(claims.auth_time) ||
        Date.now() / 1000 - claims.auth_time > 43200 ||
        claims.auth_time > Date.now() / 1000 + 300
      )
        throw new HttpError(
          401,
          "Session age limit reached. Sign out and sign in again.",
        );
      if (!claims.email_verified || !claims.firebase?.sign_in_second_factor)
        throw new HttpError(
          403,
          "Verified email and multi-factor authentication are required.",
        );
      const { rows } = await pool.query(
        "SELECT uid,organization_id,role FROM memberships WHERE uid=$1",
        [claims.uid],
      );
      if (!rows.length)
        throw new HttpError(
          403,
          "This account has not been assigned a company seat.",
        );
      res.locals.actor = rows[0] as Actor;
      res.locals.authTime = claims.auth_time;
      authorize(res.locals.actor, "read");
      res.set("Cache-Control", "no-store");
      next();
    })().catch(next);
  });
  router.use("/market/google", googleRouter(pool));
  router.use("/market", marketRouter(pool));
  router.use("/readiness", readinessRouter(pool));
  router.use("/accounting", accountingRouter(pool));
  router.get(
    "/workspace",
    route(async (_req, res) => {
      const actor = res.locals.actor as Actor;
      const workspace = await transaction(pool, (db) =>
        lockedWorkspace(db, actor.organization_id),
      );
      const history = await pool.query(
        "SELECT id,source,file_name,status,created_at,committed_at,preview->'summary' AS summary FROM import_batches WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 50",
        [actor.organization_id],
      );
      workspace.data.guestService ||= structuredClone(DEFAULT_GUEST_SERVICE);
      const sync = await pool.query(
        "SELECT source,event_id,status,received_at,details FROM integration_events WHERE organization_id=$1 ORDER BY received_at DESC LIMIT 10",
        [actor.organization_id],
      );
      const lastSuccess = await pool.query(
        "SELECT max(received_at) AS at FROM integration_events WHERE organization_id=$1 AND status='applied'",
        [actor.organization_id],
      );
      res.json({
        ...workspace,
        actor,
        history: history.rows,
        sync: {
          events: sync.rows,
          lastSuccess: lastSuccess.rows[0]?.at || null,
          configured:
            process.env.PMS_ORGANIZATION_ID === actor.organization_id &&
            Boolean(process.env.PMS_WEBHOOK_SECRET),
          source:
            process.env.PMS_ORGANIZATION_ID === actor.organization_id
              ? process.env.PMS_SOURCE_ID
              : null,
        },
        serverTime: new Date().toISOString(),
      });
    }),
  );
  router.post(
    "/guest-service/settings",
    route(async (req, res) => {
      const actor = res.locals.actor as Actor;
      if (actor.role !== "General Manager")
        throw new HttpError(
          403,
          "Only the General Manager can change service policy.",
        );
      await transaction(pool, async (db) => {
        await liveMembership(db, actor);
        const { data, revision } = await lockedWorkspace(
          db,
          actor.organization_id,
        );
        if (req.body.revision !== revision)
          throw new HttpError(
            409,
            "Company data changed. Refresh before saving.",
          );
        try {
          data.guestService = validateServiceSettings(
            req.body.settings,
            data.guestService || structuredClone(DEFAULT_GUEST_SERVICE),
          );
        } catch (e) {
          throw new HttpError(422, (e as Error).message);
        }
        await save(db, actor.organization_id, data);
        await audit(db, actor, "guest-service.settings", "policy", {
          ruleCount: data.guestService.rules.length,
          templateCount: data.guestService.templates.length,
        });
      });
      res.json({ ok: true });
    }),
  );
  router.post(
    "/guest-service/complete",
    route(async (req, res) => {
      const actor = res.locals.actor as Actor;
      authorize(actor, "import");
      await transaction(pool, async (db) => {
        await liveMembership(db, actor);
        const { data } = await lockedWorkspace(db, actor.organization_id);
        data.guestService ||= structuredClone(DEFAULT_GUEST_SERVICE);
        const task = serviceTasks(
          data.reservations.map((r) => r.data),
          data.guestService,
        ).find((t) => t.id === req.body.taskId);
        if (!task) throw new HttpError(404, "Active service task not found.");
        if (!data.guestService.completed[task.id]) {
          data.guestService.completed[task.id] = {
            at: new Date().toISOString(),
            by: actor.uid,
          };
          await save(db, actor.organization_id, data);
          await audit(db, actor, "guest-service.complete", task.id);
        }
      });
      res.json({ ok: true });
    }),
  );
  router.post(
    "/channels",
    route(async (req, res) => {
      const actor = res.locals.actor as Actor;
      authorize(actor, "channel");
      const channel = await transaction(pool, async (db) => {
        await liveMembership(db, actor);
        const { data, revision } = await lockedWorkspace(
          db,
          actor.organization_id,
        );
        if (req.body.revision !== revision)
          throw new HttpError(
            409,
            "Company data changed. Refresh before saving.",
          );
        if (!req.body.id && data.channels.length >= 100)
          throw new HttpError(
            422,
            "Channel directory limit is 100. Archive or edit an existing channel.",
          );
        const id = req.body.id || randomUUID();
        let value;
        try {
          value = validateChannel(req.body, data.channels, id);
        } catch (e) {
          throw new HttpError(422, (e as Error).message);
        }
        const previous = data.channels.find((c) => c.id === id);
        if (req.body.id && !previous)
          throw new HttpError(404, "Channel not found.");
        if (previous && previous.name !== value.name)
          data.reservations.forEach((r) => {
            if (r.data.channel === previous.name) r.data.channel = value.name;
          });
        data.channels = [...data.channels.filter((c) => c.id !== id), value];
        await save(db, actor.organization_id, data);
        await audit(db, actor, "channel.save", id, {
          before: previous || null,
          after: value,
        });
        return value;
      });
      res.json(channel);
    }),
  );
  router.post(
    "/units",
    route(async (req, res) => {
      const actor = res.locals.actor as Actor;
      authorize(actor, "unit");
      const { unitNumber, type } = req.body;
      if (
        typeof unitNumber !== "string" ||
        !unitNumber.trim() ||
        unitNumber.length > 60 ||
        !["Studio", "One-bedroom", "Two-bedroom", "Three-bedroom"].includes(
          type,
        )
      )
        throw new HttpError(
          422,
          "Provide a unit number and supported apartment type.",
        );
      await transaction(pool, async (db) => {
        await liveMembership(db, actor);
        const { data } = await lockedWorkspace(db, actor.organization_id);
        if (
          data.apartments.some(
            (a) =>
              a.unitNumber.toLowerCase() === unitNumber.trim().toLowerCase(),
          )
        )
          throw new HttpError(409, "Unit already exists.");
        if (data.apartments.length >= 500)
          throw new HttpError(422, "This pilot supports up to 500 units.");
        const unit: Apartment = {
          id: randomUUID(),
          unitNumber: unitNumber.trim(),
          type,
          floor: 0,
          maxOccupancy: 1,
          floorAreaSqm: 0,
          baseRateAED: 0,
          currentStatus: "Vacant Dirty",
          isDemoUnit: false,
          notes:
            "Inventory identity only; readiness, capacity and rates are not verified.",
        };
        data.apartments.push(unit);
        await save(db, actor.organization_id, data);
        await audit(db, actor, "unit.create", unit.id, {
          unitNumber: unit.unitNumber,
        });
      });
      res.status(201).json({ ok: true });
    }),
  );
  router.post(
    "/imports/preview",
    route(async (req, res) => {
      const actor = res.locals.actor as Actor;
      authorize(actor, "import");
      const { csv, mapping, source, fileName } = req.body;
      if (typeof fileName !== "string" || !fileName || fileName.length > 180)
        throw new HttpError(422, "Provide a file name.");
      const result = await transaction(pool, async (db) => {
        await liveMembership(db, actor);
        const { data, revision } = await lockedWorkspace(
          db,
          actor.organization_id,
        );
        let preview;
        try {
          preview = previewPms(
            csv,
            mapping,
            source,
            data.apartments,
            data.channels,
            data.reservations,
          );
        } catch (e) {
          throw new HttpError(422, (e as Error).message);
        }
        const id = randomUUID();
        await db.query(
          "INSERT INTO import_batches(id,organization_id,actor_uid,source,file_name,file_hash,revision,preview) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            id,
            actor.organization_id,
            actor.uid,
            source,
            fileName,
            fingerprint(csv),
            revision,
            preview,
          ],
        );
        await audit(db, actor, "import.preview", id, {
          hash: fingerprint(csv),
          summary: preview.summary,
          errorCount: preview.errors.length,
        });
        return { id, ...preview };
      });
      res.json(result);
    }),
  );
  router.post(
    "/imports/:id/commit",
    route(async (req, res) =>
      res.json(await commitBatch(pool, res.locals.actor, req.params.id)),
    ),
  );
  router.post(
    "/imports/:id/rollback",
    route(async (req, res) =>
      res.json(await commitBatch(pool, res.locals.actor, req.params.id, true)),
    ),
  );
  return router;
}
export function cloudPool() {
  if (
    !process.env.DATABASE_URL ||
    !process.env.GOOGLE_CLOUD_PROJECT ||
    !process.env.FIREBASE_AUTH_DOMAIN ||
    !process.env.FIREBASE_WEB_API_KEY
  )
    throw Error(
      "Cloud mode requires database, project and Firebase public web configuration.",
    );
  if (!getApps().length)
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
    });
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 10000,
    statement_timeout: 15000,
  });
}
