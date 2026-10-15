export type TeamMember = {
  uid: string;
  role: string;
  seat: number;
  displayName: string;
};
export function memberLabel(member: TeamMember): string {
  return `${member.displayName || "Name not set"} · ${member.role} · Seat ${member.seat}`;
}
export function memberName(members: TeamMember[], uid: string): string {
  if (!uid) return "Unassigned";
  const member = members.find((m) => m.uid === uid);
  return member ? memberLabel(member) : "Former or unavailable team member";
}
// Fictional people, exclusively for the synthetic demonstration.
export const DEMO_MEMBERS: TeamMember[] = [
  {
    uid: "synthetic-gm",
    displayName: "Demo General Manager",
    role: "General Manager",
    seat: 1,
  },
  {
    uid: "synthetic-reservations",
    displayName: "Demo Reservations Lead",
    role: "Revenue Manager",
    seat: 2,
  },
  {
    uid: "synthetic-operations",
    displayName: "Demo Operations Lead",
    role: "Read-Only Viewer",
    seat: 3,
  },
];
