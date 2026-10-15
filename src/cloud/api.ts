import type { Auth } from "firebase/auth";
export class CloudApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function cloudApi(auth: Auth, path: string, body?: unknown) {
  const user = auth.currentUser;
  if (!user) throw Error("Sign in to continue.");
  const token = await user.getIdToken();
  const response = await fetch("/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const json = await response.json();
  if (!response.ok)
    throw new CloudApiError(response.status, json.error || "Request failed.");
  return json;
}
