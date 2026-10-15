import React from "react";
import { memberLabel, type TeamMember } from "../team/members";
export function MemberSelect({
  label,
  value,
  members,
  onChange,
}: {
  label: string;
  value: string;
  members: TeamMember[];
  onChange: (uid: string) => void;
}) {
  const unavailable = value && !members.some((m) => m.uid === value);
  return (
    <label className="block text-sm">
      {label}
      <select
        aria-label={label}
        className="w-full rounded border border-slate-600 bg-slate-950 p-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select a team member</option>
        {unavailable && (
          <option value={value} disabled>
            Former or unavailable team member — please reassign
          </option>
        )}
        {[...members]
          .sort((a, b) => a.seat - b.seat)
          .map((m) => (
            <option key={m.uid} value={m.uid}>
              {memberLabel(m)}
            </option>
          ))}
      </select>
    </label>
  );
}
