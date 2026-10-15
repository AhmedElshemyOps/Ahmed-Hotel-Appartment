import React, { useState } from "react";
import type { TeamMember } from "../../shared/team/members";
export function MemberPermissions({
  member,
  grants,
  api,
  onSaved,
}: {
  member: TeamMember;
  grants: string[];
  api: (p: string, b?: unknown) => Promise<any>;
  onSaved: () => Promise<void>;
}) {
  const [role, setRole] = useState(member.role),
    [caps, setCaps] = useState(grants),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <details>
      <summary>Edit role and responsibilities</summary>
      <label>
        Role for {member.displayName || member.role}
        <select
          aria-label={`Role for ${member.displayName || member.role}`}
          value={role}
          className="bg-slate-950 p-2"
          onChange={(e) => setRole(e.target.value)}
        >
          {["Read-Only Viewer", "Revenue Manager", "Finance Manager"].map(
            (r) => (
              <option key={r}>{r}</option>
            ),
          )}
        </select>
      </label>
      {["compliance", "operations", "distribution"].map((c) => (
        <label className="block" key={c}>
          <input
            type="checkbox"
            checked={caps.includes(c)}
            onChange={(e) =>
              setCaps(
                e.target.checked ? [...caps, c] : caps.filter((v) => v !== c),
              )
            }
          />
          {c}
        </label>
      ))}
      <p>
        Readiness responsibilities add access to that workflow. They do not
        grant General Manager approval powers or market-property grants.
      </p>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await api("/management/members/permissions", {
              uid: member.uid,
              role,
              capabilities: caps,
            });
            await onSaved();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Save access for {member.displayName || member.role}
      </button>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
