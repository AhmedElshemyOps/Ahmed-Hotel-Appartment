import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import type { Pool, PoolClient } from "pg";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";
import { z } from "zod";
import { transaction } from "../../db/transaction";
import { HttpError, type Actor } from "../../auth/permissions";
import { propertyAccess, marketAudit, activeSource } from "../../features/market/repository";
import { nextBusinessDate } from "../../../src/features/guest-service/guestService";
import { marketReportHtml } from "../../../src/features/market/report";
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/calendar.events.owned",
];
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function encryptToken(
  value: unknown,
  key = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || "",
) {
  const bytes = Buffer.from(key, "base64");
  if (bytes.length !== 32)
    throw new HttpError(
      503,
      "Google token encryption must be configured with a 32-byte base64 secret.",
    );
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", bytes, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}
export function decryptToken(
  value: string,
  key = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || "",
) {
  try {
    const [version, iv, tag, data] = value.split(".");
    if (version !== "v1") throw Error();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(key, "base64"),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(data, "base64url")),
        decipher.final(),
      ]).toString("utf8"),
    );
  } catch {
    throw new HttpError(
      503,
      "Google connection cannot be decrypted. Administrator review is required.",
    );
  }
}
function configured() {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.GOOGLE_OAUTH_REDIRECT_URI &&
    Buffer.from(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || "", "base64")
      .length === 32,
  );
}
function config() {
  if (!configured())
    throw new HttpError(
      503,
      "Company Google OAuth credentials and encrypted token storage are not configured.",
    );
  const redirect = new URL(process.env.GOOGLE_OAUTH_REDIRECT_URI!);
  if (process.env.NODE_ENV === "production" && redirect.protocol !== "https:")
    throw new HttpError(503, "Production OAuth requires an HTTPS redirect.");
  return {
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    redirect_uri: redirect.toString(),
  };
}
async function googleRequest(
  url: string,
  init: RequestInit,
  request: typeof fetch = fetch,
) {
  const response = await request(url, {
    ...init,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new HttpError(
      response.status === 401 || response.status === 403 ? 409 : 502,
      "Google request failed. Review consent, resource permission and provider availability.",
    );
  return response.status === 204 ? {} : response.json();
}
function fresh(res: Response) {
  if (res.locals.actor.role !== "General Manager")
    throw new HttpError(
      403,
      "Only the General Manager may change Google integrations or publish approved reviews.",
    );
  if (!res.locals.authTime || Date.now() / 1000 - res.locals.authTime > 600)
    throw new HttpError(
      401,
      "Recent MFA sign-in is required. Sign out and sign in again.",
    );
}
const route =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch((e) =>
      next(
        e instanceof z.ZodError
          ? new HttpError(422, "Invalid Google workflow request.")
          : e,
      ),
    );
  };
export function googleRouter(pool: Pool) {
  const r = Router();
  r.get(
    "/status",
    route(async (req, res) => {
      const id = z.string().uuid().parse(req.query.propertyId);
      res.json(
        await transaction(pool, async (db) => {
          await propertyAccess(db, res.locals.actor, id);
          const row = (
            await db.query(
              "SELECT connected_at,disconnected_at,scopes FROM market_google_connections WHERE organization_id=$1 AND property_id=$2",
              [res.locals.actor.organization_id, id],
            )
          ).rows[0];
          return {
            configured: configured(),
            connected: !!row && !row.disconnected_at,
            scopes: row?.scopes || [],
          };
        }),
      );
    }),
  );
  r.post(
    "/connect",
    route(async (req, res) => {
      fresh(res);
      const id = z.string().uuid().parse(req.body.propertyId),
        c = config(),
        state = randomBytes(32).toString("base64url"),
        cookie = randomBytes(32).toString("base64url"),
        verifier = randomBytes(32).toString("base64url");
      await transaction(pool, async (db) => {
        await propertyAccess(db, res.locals.actor, id, true, true);
        await db.query(
          "DELETE FROM market_google_states WHERE organization_id=$1 AND property_id=$2",
          [res.locals.actor.organization_id, id],
        );
        await db.query(
          "INSERT INTO market_google_states VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            hash(state),
            res.locals.actor.organization_id,
            id,
            res.locals.actor.uid,
            hash(cookie),
            encryptToken({ verifier }),
            new Date(Date.now() + 600000),
          ],
        );
        await marketAudit(db, res.locals.actor, "google.consent.start", id);
      });
      res.cookie("ahq_google_binding", cookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600000,
        path: "/integrations/google/callback",
      });
      const params = new URLSearchParams({
        client_id: c.client_id,
        redirect_uri: c.redirect_uri,
        response_type: "code",
        scope: SCOPES.join(" "),
        state,
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        code_challenge_method: "S256",
      });
      res.json({
        url:
          "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString(),
      });
    }),
  );
  r.post(
    "/disconnect",
    route(async (req, res) => {
      fresh(res);
      const id = z.string().uuid().parse(req.body.propertyId);
      let token: string | undefined;
      await transaction(pool, async (db) => {
        await propertyAccess(db, res.locals.actor, id, true, true);
        const row = (
          await db.query(
            "SELECT token_ciphertext FROM market_google_connections WHERE organization_id=$1 AND property_id=$2 FOR UPDATE",
            [res.locals.actor.organization_id, id],
          )
        ).rows[0];
        if (row?.token_ciphertext)
          token = decryptToken(row.token_ciphertext).refresh_token;
        await db.query(
          "UPDATE market_google_connections SET token_ciphertext=NULL,disconnected_at=now() WHERE organization_id=$1 AND property_id=$2",
          [res.locals.actor.organization_id, id],
        );
        await db.query(
          "DELETE FROM market_google_states WHERE organization_id=$1 AND property_id=$2",
          [res.locals.actor.organization_id, id],
        );
        await marketAudit(db, res.locals.actor, "google.disconnect", id);
      });
      let providerRevoked = false;
      if (token) {
        try {
          const response = await fetch("https://oauth2.googleapis.com/revoke", {
            method: "POST",
            body: new URLSearchParams({ token }),
            signal: AbortSignal.timeout(10000),
          });
          providerRevoked = response.ok;
        } catch {}
      }
      res.json({
        disconnected: true,
        providerRevoked,
        message: providerRevoked
          ? "Disconnected and provider token revoked."
          : "Disconnected locally. Review Google account connected-app access if provider revocation could not be confirmed.",
      });
    }),
  );
  r.post(
    "/publish",
    route(async (req, res) => {
      fresh(res);
      const v = z
        .object({
          propertyId: z.string().uuid(),
          recommendationId: z.string().uuid(),
          kind: z.enum(["sheets", "drive", "calendar"]),
        })
        .parse(req.body);
      res.json(
        await transaction(pool, (db) =>
          publishGoogleReview(db, res.locals.actor, v),
        ),
      );
    }),
  );
  return r;
}
export function googleCallback(pool: Pool) {
  return route(async (req, res) => {
    const c = config(),
      state = z.string().min(20).max(200).parse(req.query.state),
      code = z.string().min(1).max(3000).parse(req.query.code);
    const cookie = req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("ahq_google_binding="))
      ?.slice("ahq_google_binding=".length);
    if (!cookie)
      throw new HttpError(
        401,
        "OAuth browser binding is missing. Start consent again.",
      );
    await transaction(pool, async (db) => {
      const s = (
        await db.query(
          "SELECT * FROM market_google_states WHERE state_hash=$1 FOR UPDATE",
          [hash(state)],
        )
      ).rows[0];
      if (
        !s ||
        s.cookie_hash !== hash(cookie) ||
        new Date(s.expires_at).valueOf() < Date.now()
      )
        throw new HttpError(
          401,
          "OAuth state expired or does not match this browser.",
        );
      const actor: Actor = {
        uid: s.actor_uid,
        organization_id: s.organization_id,
        role: "General Manager",
      };
      await propertyAccess(db, actor, s.property_id, true, true);
      const { verifier } = decryptToken(s.verifier_ciphertext);
      const tokens = await googleRequest(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          body: new URLSearchParams({
            ...c,
            code,
            code_verifier: verifier,
            grant_type: "authorization_code",
          }),
        },
      );
      const scopes = String(tokens.scope || "").split(" ");
      if (SCOPES.some((s) => !scopes.includes(s)))
        throw new HttpError(422, "Required Google scopes were not granted.");
      const old = (
        await db.query(
          "SELECT token_ciphertext FROM market_google_connections WHERE organization_id=$1 AND property_id=$2",
          [actor.organization_id, s.property_id],
        )
      ).rows[0];
      if (!tokens.refresh_token && old?.token_ciphertext)
        tokens.refresh_token = decryptToken(old.token_ciphertext).refresh_token;
      if (!tokens.refresh_token)
        throw new HttpError(
          422,
          "Google did not issue offline access. Reconnect with company consent.",
        );
      tokens.expires_at = Date.now() + Number(tokens.expires_in || 3600) * 1000;
      await db.query(
        "INSERT INTO market_google_connections(organization_id,property_id,token_ciphertext,actor_uid,scopes) VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,property_id) DO UPDATE SET token_ciphertext=EXCLUDED.token_ciphertext,actor_uid=EXCLUDED.actor_uid,scopes=EXCLUDED.scopes,connected_at=now(),disconnected_at=NULL",
        [
          actor.organization_id,
          s.property_id,
          encryptToken(tokens),
          actor.uid,
          scopes,
        ],
      );
      await db.query("DELETE FROM market_google_states WHERE state_hash=$1", [
        hash(state),
      ]);
      await marketAudit(db, actor, "google.connected", s.property_id, {
        scopes,
      });
    });
    res.clearCookie("ahq_google_binding", {
      path: "/integrations/google/callback",
    });
    res.redirect("/?google=connected");
  });
}
async function accessToken(
  db: PoolClient,
  org: string,
  propertyId: string,
  request: typeof fetch,
) {
  const row = (
    await db.query(
      "SELECT * FROM market_google_connections WHERE organization_id=$1 AND property_id=$2 FOR UPDATE",
      [org, propertyId],
    )
  ).rows[0];
  if (!row?.token_ciphertext || row.disconnected_at)
    throw new HttpError(409, "Google is not connected for this property.");
  const tokens = decryptToken(row.token_ciphertext);
  if (tokens.expires_at < Date.now() + 60000) {
    const c = config();
    try {
      const fresh = await googleRequest(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          body: new URLSearchParams({
            client_id: c.client_id,
            client_secret: c.client_secret,
            refresh_token: tokens.refresh_token,
            grant_type: "refresh_token",
          }),
        },
        request,
      );
      Object.assign(tokens, fresh, {
        refresh_token: fresh.refresh_token || tokens.refresh_token,
        expires_at: Date.now() + Number(fresh.expires_in || 3600) * 1000,
      });
      await db.query(
        "UPDATE market_google_connections SET token_ciphertext=$3 WHERE organization_id=$1 AND property_id=$2",
        [org, propertyId, encryptToken(tokens)],
      );
    } catch {
      throw new HttpError(
        409,
        "Google authorization needs reconnection. No export has been sent.",
      );
    }
  }
  return tokens.access_token as string;
}
export async function publishGoogleReview(
  db: PoolClient,
  a: Actor,
  v: {
    propertyId: string;
    recommendationId: string;
    kind: "sheets" | "drive" | "calendar";
  },
  request: typeof fetch = fetch,
) {
  const property = await propertyAccess(db, a, v.propertyId, true, true),
    rec = (
      await db.query(
        "SELECT r.*,d.approved_rate,d.decision FROM market_recommendations r JOIN market_decisions d ON d.organization_id=r.organization_id AND d.recommendation_id=r.id WHERE r.organization_id=$1 AND r.property_id=$2 AND r.id=$3 AND d.decision='approved'",
        [a.organization_id, v.propertyId, v.recommendationId],
      )
    ).rows[0];
  if (!rec) throw new HttpError(422, "Choose an approved internal proposal.");
  for (const sourceId of new Set<string>(
    rec.snapshot.matches.map((m: any) => m.offer.sourceId),
  )) {
    const s = await activeSource(db, a.organization_id, v.propertyId, sourceId);
    if (!s.export_allowed)
      throw new HttpError(403, "A source license prohibits this export.");
  }
  await db.query(
    "INSERT INTO market_google_exports(organization_id,property_id,recommendation_id,kind,status) VALUES($1,$2,$3,$4,'pending') ON CONFLICT DO NOTHING",
    [a.organization_id, v.propertyId, v.recommendationId, v.kind],
  );
  const old = (
    await db.query(
      "SELECT * FROM market_google_exports WHERE organization_id=$1 AND property_id=$2 AND recommendation_id=$3 AND kind=$4 FOR UPDATE",
      [a.organization_id, v.propertyId, v.recommendationId, v.kind],
    )
  ).rows[0];
  if (old.status === "completed")
    return {
      url: old.url,
      message: "This approved snapshot was already exported.",
      replayed: true,
    };
  const token = await accessToken(db, a.organization_id, v.propertyId, request),
    headers = {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    operation = hash(
      a.organization_id +
        ":" +
        v.propertyId +
        ":" +
        v.recommendationId +
        ":" +
        v.kind,
    );
  let id: string, url: string;
  if (v.kind === "calendar") {
    id = "a" + operation.slice(0, 40);
    const endpoint =
      "https://www.googleapis.com/calendar/v3/calendars/primary/events";
    const existing = await request(endpoint + "/" + id, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
    if (existing.ok) {
      const event = await existing.json();
      url = event.htmlLink;
    } else {
      if (existing.status !== 404)
        throw new HttpError(
          502,
          "Calendar lookup failed. No retry creation attempted.",
        );
      const day = nextBusinessDate();
      const event = await googleRequest(
        endpoint,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            id,
            summary: "Approved pricing review — " + property.name,
            description:
              "Internal review of " +
              rec.snapshot.date +
              " proposal at AED " +
              rec.approved_rate +
              ". No rental price has been published. Decision " +
              v.recommendationId,
            start: {
              dateTime: day + "T09:00:00+04:00",
              timeZone: "Asia/Dubai",
            },
            end: { dateTime: day + "T09:30:00+04:00", timeZone: "Asia/Dubai" },
          }),
        },
        request,
      );
      url = event.htmlLink;
    }
  } else {
    const find = await googleRequest(
      "https://www.googleapis.com/drive/v3/files?" +
        new URLSearchParams({
          q:
            "trashed = false and appProperties has { key='ahqReview' and value='" +
            operation +
            "' }",
          fields: "files(id,webViewLink)",
        }),
      { headers },
      request,
    );
    if (find.files?.length) {
      id = find.files[0].id;
      url =
        find.files[0].webViewLink ||
        "https://drive.google.com/file/d/" + id + "/view";
    } else if (v.kind === "sheets") {
      const created = await googleRequest(
        "https://www.googleapis.com/drive/v3/files?fields=id,webViewLink",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            name:
              "Ahmed Quality Ops — approved pricing review " +
              rec.snapshot.date,
            mimeType: "application/vnd.google-apps.spreadsheet",
            appProperties: { ahqReview: operation },
          }),
        },
        request,
      );
      id = created.id;
      url =
        created.webViewLink ||
        "https://docs.google.com/spreadsheets/d/" + id + "/edit";
    } else {
      const html = marketReportHtml({
        property: property.name,
        type: "Approved internal pricing review",
        query: rec.query,
        decisions: [
          {
            ...rec.snapshot,
            recommendedRate: Number(rec.approved_rate),
            explanation: [
              ...rec.snapshot.explanation,
              "Management-approved room rate: AED " +
                rec.approved_rate +
                "; original proposed room rate: AED " +
                rec.snapshot.recommendedRate,
            ],
          },
        ],
        demo: false,
        createdAt: new Date().toISOString(),
      });
      const boundary = "ahq" + operation.slice(0, 20),
        body =
          "--" +
          boundary +
          "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
          JSON.stringify({
            name:
              "Ahmed Quality Ops approved review " +
              rec.snapshot.date +
              ".html",
            mimeType: "text/html",
            appProperties: { ahqReview: operation },
          }) +
          "\r\n--" +
          boundary +
          "\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n" +
          html +
          "\r\n--" +
          boundary +
          "--";
      const created = await googleRequest(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "multipart/related; boundary=" + boundary,
          },
          body,
        },
        request,
      );
      id = created.id;
      url =
        created.webViewLink ||
        "https://drive.google.com/file/d/" + id + "/view";
    }
    if (v.kind === "sheets")
      await googleRequest(
        "https://sheets.googleapis.com/v4/spreadsheets/" +
          encodeURIComponent(id!) +
          "/values/A1:E5?valueInputOption=RAW",
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            values: [
              [
                "Date",
                "Current room rate AED",
                "Approved room rate AED",
                "Market guest-night median AED",
                "Classification",
              ],
              [
                rec.snapshot.date,
                rec.snapshot.currentRate,
                Number(rec.approved_rate),
                rec.snapshot.market.median,
                "Approved internal proposal; no channel price published",
              ],
              ["Evidence IDs", rec.snapshot.evidenceIds.join(", "), "", "", ""],
              ["Limits", "Asking prices, not realized revenue", "", "", ""],
            ],
          }),
        },
        request,
      );
  }
  await db.query(
    "UPDATE market_google_exports SET status='completed',provider_id=$5,url=$6,updated_at=now() WHERE organization_id=$1 AND property_id=$2 AND recommendation_id=$3 AND kind=$4",
    [a.organization_id, v.propertyId, v.recommendationId, v.kind, id!, url!],
  );
  await marketAudit(db, a, "google." + v.kind + ".export", v.recommendationId, {
    providerId: id!,
  });
  return {
    url: url!,
    message: "Approved review exported. Rental prices are unchanged.",
  };
}
