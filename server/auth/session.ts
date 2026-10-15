import { verifiedClaims } from "./identity";
import type { Request, Response, NextFunction } from "express";
import type { Pool } from "pg";
import { authorize, HttpError, type Actor } from "./permissions";
export function companySession(
  pool: Pool,
  verify: (token: string) => Promise<any>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    (async () => {
      const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
      if (!token)
        throw new HttpError(401, "Sign in with your company account.");
      const claims = await verifiedClaims(token, verify);
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
  };
}
