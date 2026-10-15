import type { UserRole } from "../../src/shared/types";
import type { Actor } from "../../src/shared/api/contracts";
export type { Actor } from "../../src/shared/api/contracts";
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
