import { HttpError } from "./permissions";
export async function verifiedClaims(
  token: string,
  verify: (token: string) => Promise<any>,
) {
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
  return claims;
}
