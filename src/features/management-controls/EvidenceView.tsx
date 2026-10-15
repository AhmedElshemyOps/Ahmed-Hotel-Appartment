import React from "react";
import { memberName, type TeamMember } from "../../shared/team/members";
const labels: Record<string, string> = {
  unitId: "Apartment",
  unit_id: "Apartment",
  revision: "Saved revision",
  created_at: "Recorded at",
  createdAt: "Recorded at",
  responsibleUid: "Responsible employee",
  expiresOn: "Expiry date",
  renewalOn: "Renewal deadline",
  dueOn: "Due date",
  evidence_hash: "Evidence fingerprint",
  recordedAt: "Recorded at",
  source: "Source system",
  id: "Source reference",
};
export function EvidenceView({
  value,
  members,
  apartments,
}: {
  value: any;
  members: TeamMember[];
  apartments: { id: string; unitNumber: string }[];
}) {
  const show = (v: any, key = "", depth = 0): React.ReactNode => {
    if (v === null || v === undefined) return "Not recorded";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (typeof v !== "object") {
      if (key === "responsibleUid") return memberName(members, String(v));
      if (key === "unitId" || key === "unit_id")
        return (
          apartments.find((u) => u.id === v)?.unitNumber ||
          "Unavailable apartment"
        );
      return String(v);
    }
    if (depth > 4) return "Further detail available in the source workflow";
    if (Array.isArray(v))
      return v.length ? (
        <ul className="space-y-2">
          {v.map((row, i) => (
            <li key={i} className="border-l border-slate-600 pl-3">
              {show(row, "", depth + 1)}
            </li>
          ))}
        </ul>
      ) : (
        "None recorded"
      );
    return (
      <dl className="space-y-1">
        {Object.entries(v).map(([k, item]) => (
          <div key={k}>
            <dt className="font-medium inline">
              {labels[k] ||
                k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ")}
              :{" "}
            </dt>
            <dd className="inline break-words">{show(item, k, depth + 1)}</dd>
          </div>
        ))}
      </dl>
    );
  };
  return <div>{show(value)}</div>;
}
