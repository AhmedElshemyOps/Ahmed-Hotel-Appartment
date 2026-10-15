import type { PoolClient } from "pg";
import { DEFAULT_CHANNELS } from "../../src/features/revenue/distribution";
import { DEFAULT_GUEST_SERVICE } from "../../src/features/guest-service/guestService";
import type { Workspace } from "../../src/shared/api/contracts";
export type { Workspace } from "../../src/shared/api/contracts";
const initial = (): Workspace => ({
  channels: DEFAULT_CHANNELS,
  apartments: [],
  reservations: [],
  guestService: DEFAULT_GUEST_SERVICE,
});
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
