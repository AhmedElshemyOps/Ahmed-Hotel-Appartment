import { Router, type Response } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { HttpError } from "../../auth/permissions";
import { transaction } from "../../db/transaction";
import { verifiedClaims } from "../../auth/identity";
import { capability } from "../../../src/features/readiness/model";
import { controlAccess, controlAudit, recent, endpoint } from "./access";
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
const roles = z.enum([
  "Finance Manager",
  "Revenue Manager",
  "Read-Only Viewer",
]);
export function teamRouter(pool: Pool) {
  const router = Router();
  router.post(
    "/invitations",
    endpoint(async (q: any, res: Response) => {
      recent(res);
      const v = z
        .object({
          email: z
            .email()
            .max(254)
            .transform((e) => e.toLowerCase()),
          displayName: z
            .string()
            .trim()
            .min(1)
            .max(100)
            .regex(
              /^[^\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]+$/,
            ),
          role: roles,
          capabilities: z.array(capability).max(3),
        })
        .strict()
        .parse(q.body);
      res.json(
        await transaction(pool, async (db) => {
          const a = await controlAccess(db, res);
          await db.query(
            "SELECT pg_advisory_xact_lock(hashtextextended('ahq-team:' || $1,0))",
            [a.organization_id],
          );
          await db.query(
            "UPDATE team_invitations SET status='expired' WHERE organization_id=$1 AND status='pending' AND expires_at<=now()",
            [a.organization_id],
          );
          if (
            (
              await db.query(
                "SELECT id FROM team_invitations WHERE organization_id=$1 AND email=$2 AND status='pending'",
                [a.organization_id, v.email],
              )
            ).rows.length
          )
            throw new HttpError(
              409,
              "This email already has a pending invitation.",
            );
          const used = (
            await db.query(
              "SELECT seat FROM memberships WHERE organization_id=$1 UNION ALL SELECT seat FROM team_invitations WHERE organization_id=$1 AND status='pending'",
              [a.organization_id],
            )
          ).rows.map((r) => r.seat);
          const seat = Array.from({ length: 9 }, (_, i) => i + 2).find(
            (s) => !used.includes(s),
          );
          if (!seat)
            throw new HttpError(
              409,
              "All nine team seats are occupied or reserved.",
            );
          const token = randomBytes(32).toString("base64url"),
            id = randomUUID(),
            expiresAt = new Date(Date.now() + 72 * 3600000).toISOString();
          await db.query(
            "INSERT INTO team_invitations(organization_id,id,token_hash,email,display_name,role,seat,capabilities,status,created_by,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$10)",
            [
              a.organization_id,
              id,
              hash(token),
              v.email,
              v.displayName,
              v.role,
              seat,
              JSON.stringify([...new Set(v.capabilities)]),
              a.uid,
              expiresAt,
            ],
          );
          await controlAudit(db, a, "team.invite", id, { seat, role: v.role });
          return {
            id,
            token,
            expiresAt,
            seat,
            message:
              "Share this one-time invitation through your approved private channel. No email has been sent.",
          };
        }),
      );
    }),
  );
  router.post(
    "/invitations/:id/revoke",
    endpoint(async (q: any, res: Response) => {
      recent(res);
      await transaction(pool, async (db) => {
        const a = await controlAccess(db, res);
        await db.query(
          "SELECT pg_advisory_xact_lock(hashtextextended('ahq-team:' || $1,0))",
          [a.organization_id],
        );
        const r = await db.query(
          "UPDATE team_invitations SET status='revoked' WHERE organization_id=$1 AND id=$2 AND status='pending' RETURNING id",
          [a.organization_id, z.uuid().parse(q.params.id)],
        );
        if (!r.rows.length)
          throw new HttpError(404, "Pending invitation not found.");
        await controlAudit(db, a, "team.invitation-revoke", q.params.id);
      });
      res.json({ ok: true });
    }),
  );
  router.post(
    "/members/permissions",
    endpoint(async (q: any, res: Response) => {
      recent(res);
      const v = z
        .object({
          uid: z.string().min(1),
          role: roles,
          capabilities: z.array(capability).max(3),
        })
        .strict()
        .parse(q.body);
      await transaction(pool, async (db) => {
        const a = await controlAccess(db, res);
        if (v.uid === a.uid)
          throw new HttpError(
            422,
            "General Manager access cannot be changed here.",
          );
        await db.query(
          "SELECT pg_advisory_xact_lock(hashtextextended('ahq-team:' || $1,0))",
          [a.organization_id],
        );
        const target = (
          await db.query(
            "SELECT uid,seat FROM memberships WHERE organization_id=$1 AND uid=$2 FOR UPDATE",
            [a.organization_id, v.uid],
          )
        ).rows[0];
        if (!target) throw new HttpError(404, "Team member not found.");
        if (target.seat === 1)
          throw new HttpError(
            422,
            "General Manager role cannot be changed here.",
          );
        await db.query(
          "UPDATE memberships SET role=$3 WHERE organization_id=$1 AND uid=$2",
          [a.organization_id, v.uid, v.role],
        );
        await db.query(
          "DELETE FROM readiness_grants WHERE organization_id=$1 AND uid=$2",
          [a.organization_id, v.uid],
        );
        for (const cap of new Set(v.capabilities))
          await db.query("INSERT INTO readiness_grants VALUES($1,$2,$3)", [
            a.organization_id,
            v.uid,
            cap,
          ]);
        await controlAudit(db, a, "team.permissions", v.uid, {
          role: v.role,
          capabilities: v.capabilities,
        });
      });
      res.json({ ok: true });
    }),
  );
  router.post(
    "/members/remove",
    endpoint(async (q: any, res: Response) => {
      recent(res);
      const v = z
        .object({ uid: z.string().min(1) })
        .strict()
        .parse(q.body);
      await transaction(pool, async (db) => {
        const a = await controlAccess(db, res);
        if (v.uid === a.uid)
          throw new HttpError(
            422,
            "General Manager access cannot be changed here.",
          );
        await db.query(
          "SELECT pg_advisory_xact_lock(hashtextextended('ahq-team:' || $1,0))",
          [a.organization_id],
        );
        const m = (
          await db.query(
            "SELECT uid,seat FROM memberships WHERE organization_id=$1 AND uid=$2 FOR UPDATE",
            [a.organization_id, v.uid],
          )
        ).rows[0];
        if (!m) throw new HttpError(404, "Member not found.");
        if (m.seat === 1 || v.uid === a.uid)
          throw new HttpError(
            422,
            "The General Manager cannot be removed or replaced by this workflow.",
          );
        await db.query(
          "DELETE FROM market_property_grants WHERE organization_id=$1 AND uid=$2",
          [a.organization_id, v.uid],
        );
        await db.query(
          "DELETE FROM memberships WHERE organization_id=$1 AND uid=$2",
          [a.organization_id, v.uid],
        );
        await controlAudit(db, a, "team.remove", v.uid, { seat: m.seat });
      });
      res.json({ ok: true });
    }),
  );
  return router;
}
// Authenticated identity, verified email and MFA are required before a seat exists.
export function invitationRouter(
  pool: Pool,
  verify: (t: string) => Promise<any> = (t) => getAuth().verifyIdToken(t, true),
) {
  const router = Router();
  router.post(
    "/accept",
    endpoint(async (q: any, res: Response) => {
      const token = q.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
      if (!token) throw new HttpError(401, "Sign in first.");
      const claims = await verifiedClaims(token, verify);
      if (Date.now() / 1000 - claims.auth_time > 600)
        throw new HttpError(401, "Sign in again with MFA within ten minutes.");
      if (typeof claims.email !== "string")
        throw new HttpError(403, "Verified invitation email required.");
      const v = z
        .object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })
        .strict()
        .parse(q.body);
      res.json(
        await transaction(pool, async (db) => {
          const invitation = (
            await db.query(
              "SELECT * FROM team_invitations WHERE token_hash=$1",
              [hash(v.token)],
            )
          ).rows[0];
          if (!invitation) throw new HttpError(404, "Invitation not found.");
          await db.query(
            "SELECT pg_advisory_xact_lock(hashtextextended('ahq-team:' || $1,0))",
            [invitation.organization_id],
          );
          const current = (
            await db.query(
              "SELECT * FROM team_invitations WHERE token_hash=$1 FOR UPDATE",
              [hash(v.token)],
            )
          ).rows[0];
          if (
            current.status !== "pending" ||
            new Date(current.expires_at).valueOf() <= Date.now()
          )
            throw new HttpError(
              410,
              "Invitation expired, revoked or already used.",
            );
          if (claims.email.toLowerCase() !== current.email)
            throw new HttpError(
              403,
              "Sign in using the invited email address.",
            );
          if (
            (
              await db.query("SELECT uid FROM memberships WHERE uid=$1", [
                claims.uid,
              ])
            ).rows.length
          )
            throw new HttpError(
              409,
              "This account already has a company seat.",
            );
          await db.query(
            "INSERT INTO memberships(uid,organization_id,seat,role) VALUES($1,$2,$3,$4)",
            [claims.uid, current.organization_id, current.seat, current.role],
          );
          await db.query(
            "INSERT INTO member_profiles(organization_id,uid,display_name,updated_by) VALUES($1,$2,$3,$4)",
            [
              current.organization_id,
              claims.uid,
              current.display_name,
              current.created_by,
            ],
          );
          for (const c of current.capabilities)
            await db.query("INSERT INTO readiness_grants VALUES($1,$2,$3)", [
              current.organization_id,
              claims.uid,
              c,
            ]);
          await db.query(
            "UPDATE team_invitations SET status='accepted',accepted_by=$2 WHERE token_hash=$1",
            [hash(v.token), claims.uid],
          );
          await controlAudit(
            db,
            {
              uid: claims.uid,
              organization_id: current.organization_id,
              role: current.role,
            },
            "team.accept",
            current.id,
          );
          return { ok: true };
        }),
      );
    }),
  );
  return router;
}
