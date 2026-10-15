import type { PoolClient } from "pg";
import type { TeamMember } from "../../src/shared/team/members";
export async function companyMembers(
  db: PoolClient,
  organizationId: string,
): Promise<TeamMember[]> {
  return (
    await db.query(
      `SELECT m.uid,m.role,m.seat,COALESCE(p.display_name,'') AS "displayName"
     FROM memberships m LEFT JOIN member_profiles p
       ON p.organization_id=m.organization_id AND p.uid=m.uid
     WHERE m.organization_id=$1 ORDER BY m.seat`,
      [organizationId],
    )
  ).rows as TeamMember[];
}
