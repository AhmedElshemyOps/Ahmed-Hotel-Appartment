import type { Response } from "express";
import type { PoolClient } from "pg";
import { z } from "zod";
import { HttpError, type Actor } from "../../auth/permissions";
export const endpoint = (fn: any) => (q: any, r: any, n: any) =>
  Promise.resolve(fn(q, r)).catch((e: any) =>
    n(
      e instanceof z.ZodError
        ? new HttpError(422, e.issues.map((v: any) => v.message).join("; "))
        : e,
    ),
  );
export async function controlAccess(db: PoolClient, res: Response, gm = true) {
  const a = res.locals.actor as Actor;
  const m = (
    await db.query(
      "SELECT role FROM memberships WHERE organization_id=$1 AND uid=$2 FOR SHARE",
      [a.organization_id, a.uid],
    )
  ).rows[0];
  if (!m || m.role !== a.role || (gm && m.role !== "General Manager"))
    throw new HttpError(403, "Current General Manager access required.");
  return a;
}
export function recent(res: Response) {
  if (!res.locals.authTime || Date.now() / 1000 - res.locals.authTime > 600)
    throw new HttpError(401, "Sign in again with MFA within ten minutes.");
}
export async function controlAudit(
  db: PoolClient,
  a: Actor,
  action: string,
  target: string,
  details: unknown = {},
) {
  await db.query(
    "INSERT INTO audit_events(organization_id,actor_uid,action,target,details) VALUES($1,$2,$3,$4,$5)",
    [a.organization_id, a.uid, action, target, details],
  );
}
