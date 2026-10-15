import type { PoolClient } from "pg";
import type { ReadinessState } from "../../../src/features/readiness/model";
import { HttpError } from "../../auth/permissions";
export const privateFileId = (ref: string) =>
  ref.match(
    /^\/api\/files\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/download$/,
  )?.[1];
export async function checkedReadinessEvidence(
  db: PoolClient,
  org: string,
  unitId: string,
  state: ReadinessState,
  strict = false,
) {
  const next = structuredClone(state);
  const entries = [
    ...next.documents.map((d) => ({ value: d, category: "document" })),
    ...next.media.map((m) => ({ value: m, category: "photo" })),
  ];
  const ids = [
    ...new Set(
      entries
        .map((e) => privateFileId(e.value.evidenceUrl))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const files = ids.length
    ? (
        await db.query(
          "SELECT id,status,retention_until,category,width,height,byte_count,mime FROM protected_files WHERE organization_id=$1 AND unit_id=$2 AND id=ANY($3::uuid[])",
          [org, unitId, ids],
        )
      ).rows
    : [];
  for (const entry of entries) {
    const id = privateFileId(entry.value.evidenceUrl);
    if (!id) continue;
    const file = files.find((f) => f.id === id);
    const usable =
      file &&
      file.status === "clean" &&
      file.category === entry.category &&
      new Date(file.retention_until).valueOf() > Date.now();
    const image =
      entry.category === "photo"
        ? (entry.value as ReadinessState["media"][number])
        : null;
    const matches =
      !image ||
      (usable &&
        image.width === file.width &&
        image.height === file.height &&
        image.bytes === file.byte_count &&
        image.mime === file.mime);
    if (!usable || !matches) {
      if (strict)
        throw new HttpError(
          422,
          "Private evidence must be a clean, unexpired file for this apartment, with matching inspected photo metadata.",
        );
      if (image) image.approved = false;
      else
        (entry.value as ReadinessState["documents"][number]).status =
          "unverified";
    }
  }
  return next;
}
