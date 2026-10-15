import { EvidenceView } from "./EvidenceView";
import { MemberPermissions } from "./MemberPermissions";
import React, { useState, useEffect } from "react";
import {
  DEFAULT_OPERATING_POLICY,
  operatingPolicySchema,
  reportSnapshot,
  priorities,
  type OperatingPolicy,
} from "./model";
import { DEMO_MEMBERS, memberName } from "../../shared/team/members";
import { initialReadiness, emptyListing } from "../readiness/model";
import { businessDate } from "../../shared/dates/businessDate";
import { ProtectedUploads } from "./ProtectedUploads";
import type { Apartment, Reservation } from "../../shared/types";
const box = "rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3",
  input = "bg-slate-950 border border-slate-600 p-2 rounded",
  button = "rounded bg-sky-700 px-3 py-2 disabled:opacity-40";
export function ManagementCenter({
  api,
  apartments = [],
  reservations = [],
  onNavigate,
}: {
  api?: (p: string, b?: unknown) => Promise<any>;
  apartments?: Apartment[];
  reservations?: Reservation[];
  onNavigate?: (area: string, unitId?: string) => void;
}) {
  const [snapshot, setSnapshot] = useState<any>(null),
    [tab, setTab] = useState("Priorities"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [unitId, setUnitId] = useState(""),
    [policy, setPolicy] = useState<OperatingPolicy>(DEFAULT_OPERATING_POLICY),
    [date, setDate] = useState(businessDate),
    [type, setType] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("WEEKLY"),
    [selectedReport, setSelectedReport] = useState<any>(null),
    [email, setEmail] = useState(""),
    [name, setName] = useState(""),
    [role, setRole] = useState("Read-Only Viewer"),
    [inviteToken, setInviteToken] = useState(""),
    [inviteCaps, setInviteCaps] = useState<string[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<any>(null);
  async function refresh() {
    if (api) setSnapshot(await api("/management"));
    else
      setSnapshot(
        (old: any) =>
          old || {
            revision: 0,
            apartments,
            members: DEMO_MEMBERS,
            settings: {},
            ruleIds: [
              {
                id: "prearrival",
                name: "Pre-arrival contact",
                offsetHours: -24,
              },
            ],
            reports: [],
            invitations: [],
            asOf: new Date().toISOString(),
            priorities: priorities(
              apartments.slice(0, 2).map((a, i) => {
                const state = initialReadiness();
                state.listings = [emptyListing("Airbnb")];
                state.tasks = [
                  {
                    id: "demo-task",
                    label: "SYNTHETIC permit review",
                    responsibleUid: "synthetic-operations",
                    dueOn: "2026-01-01",
                    status: "open",
                  },
                ];
                return {
                  id: a.id,
                  unitNumber: a.unitNumber,
                  revision: i,
                  state,
                };
              }),
              businessDate(),
              "synthetic-gm",
              [
                {
                  id: "synthetic-import",
                  area: "imports",
                  status: "invalid CSV (SYNTHETIC)",
                  recordedAt: new Date().toISOString(),
                },
              ],
              [
                {
                  id: "synthetic-proposal",
                  unitId: apartments[0]?.id || "",
                  createdAt: new Date().toISOString(),
                },
              ],
            ),
          },
      );
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [api]);
  useEffect(() => {
    if (snapshot && !unitId && snapshot.apartments.length)
      setUnitId(snapshot.apartments[0].id);
  }, [snapshot, unitId]);
  useEffect(() => {
    setPolicy(
      snapshot?.settings[unitId] || structuredClone(DEFAULT_OPERATING_POLICY),
    );
  }, [unitId, snapshot?.settings]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!snapshot)
    return <p role="status">{error || "Loading management controls…"}</p>;
  const saved = api ? snapshot.reports : reports;
  return (
    <section className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">Management Centre</h2>
      <p>
        {api
          ? "Company records"
          : "SYNTHETIC DEMONSTRATION — no invitations, live files or cloud services are connected."}{" "}
        · Last loaded {snapshot.asOf}
      </p>
      <nav className="flex flex-wrap gap-2">
        {[
          "Priorities",
          "Property settings",
          "Report history",
          "Staff access",
          "Private files",
          "Staging",
        ].map((t) => (
          <button key={t} className={button} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
        <button className={button} disabled={busy} onClick={() => run(refresh)}>
          Refresh management data
        </button>
      </nav>
      {error && (
        <p role="alert" className="text-amber-200">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {tab === "Priorities" && (
        <div className={box}>
          <h3>General Manager priority list</h3>
          <p>
            Recorded evidence only. Counts show open recorded items, not
            predicted losses. Unassigned portfolio issues are assigned to the GM
            for triage. Import errors remain visible until the source workflow
            is resolved.
          </p>
          {evidence && (
            <article className="border border-sky-700 p-3">
              <h4>Source evidence — current recorded version</h4>
              <EvidenceView
                value={evidence}
                members={snapshot.members}
                apartments={snapshot.apartments}
              />
            </article>
          )}
          {!snapshot.priorities.length && (
            <p>No priority items in the currently recorded sources.</p>
          )}
          {snapshot.priorities.map((p: any) => (
            <article key={p.id} className="border-b border-slate-700 py-3">
              <strong>
                {p.severity === "urgent" ? "Urgent" : "Needs attention"}:{" "}
                {p.title}
              </strong>
              <p>
                Responsible: {memberName(snapshot.members, p.responsibleUid)}
              </p>
              <p>
                Evidence: {p.evidence}
                {p.recordedAt ? ` · ${p.recordedAt}` : ""}
              </p>
              <button
                className={button}
                disabled={busy}
                onClick={() =>
                  run(async () =>
                    setEvidence(
                      api
                        ? await api(
                            `/management/evidence/${p.source.kind}/${encodeURIComponent(p.source.id)}`,
                          )
                        : {
                            synthetic: true,
                            reference: p.evidence,
                            priority: p.id,
                          },
                    ),
                  )
                }
              >
                Inspect evidence
              </button>{" "}
              <button
                className={button}
                onClick={() => onNavigate?.(p.area, p.unitId)}
              >
                Open source record
              </button>
            </article>
          ))}
        </div>
      )}
      {(tab === "Property settings" || tab === "Private files") && (
        <label>
          Property apartment
          <select
            aria-label="Property apartment"
            className={input}
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
          >
            {snapshot.apartments.map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.unitNumber}
              </option>
            ))}
          </select>
        </label>
      )}
      {tab === "Property settings" && (
        <div className={box}>
          <h3>Property-specific operating policy</h3>
          <p>
            Current supported business timezone: Asia/Dubai (GST, UTC+04:00).
            These are policy times, not verified guest arrival times. Existing
            contact task IDs and completion history remain unchanged.
          </p>
          {(["checkIn", "checkOut"] as const).map((k) => (
            <label className="block" key={k}>
              {k === "checkIn" ? "Check-in time" : "Check-out time"}
              <input
                aria-label={
                  k === "checkIn" ? "Check-in time" : "Check-out time"
                }
                className={input}
                type="time"
                value={policy[k]}
                onChange={(e) => setPolicy({ ...policy, [k]: e.target.value })}
              />
            </label>
          ))}
          {snapshot.ruleIds.map((r: any) => (
            <label key={r.id} className="block">
              {r.name} — hours before/after
              <input
                aria-label={`${r.name} offset hours`}
                type="number"
                min="-168"
                max="168"
                className={input}
                value={policy.contactOffsets[r.id] ?? r.offsetHours}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    contactOffsets: {
                      ...policy.contactOffsets,
                      [r.id]: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          ))}
          <label className="block">
            Operating preferences
            <textarea
              aria-label="Operating preferences"
              className={input + " w-full"}
              maxLength={1500}
              value={policy.preferences}
              onChange={(e) =>
                setPolicy({ ...policy, preferences: e.target.value })
              }
            />
          </label>
          <button
            className={button}
            disabled={busy || !unitId}
            onClick={() =>
              run(async () => {
                const validated = operatingPolicySchema.parse(policy);
                if (api) {
                  await api("/management/settings", {
                    unitId,
                    revision: snapshot.revision,
                    policy: validated,
                  });
                  await refresh();
                } else
                  setSnapshot({
                    ...snapshot,
                    settings: {
                      ...snapshot.settings,
                      [unitId]: structuredClone(validated),
                    },
                  });
                setMessage(
                  api
                    ? "Property policy saved. Operations uses the new deadlines."
                    : "Synthetic property policy saved in this module only; company operations are unchanged.",
                );
              })
            }
          >
            Save property policy
          </button>
        </div>
      )}
      {tab === "Report history" && (
        <div className={box}>
          <h3>Saved report versions and previous-period comparison</h3>
          <label>
            Report period
            <select
              aria-label="Report period"
              className={input}
              value={type}
              onChange={(e) => setType(e.target.value as any)}
            >
              {["DAILY", "WEEKLY", "MONTHLY"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Report version date
            <input
              aria-label="Report version date"
              className={input}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <button
            className={button}
            disabled={busy || !date}
            onClick={() =>
              run(async () => {
                const demoVersion = api
                  ? null
                  : reportSnapshot(
                      type,
                      date,
                      reservations,
                      0,
                      new Date().toISOString(),
                    );
                const report = api
                  ? await api("/management/reports", { type, date })
                  : {
                      id: crypto.randomUUID(),
                      snapshot: demoVersion,
                      sourceHash: "SYNTHETIC",
                      report_type: type,
                      period_start: demoVersion!.period.start,
                      created_at: new Date().toISOString(),
                    };
                setSelectedReport(report);
                if (api) await refresh();
                else setReports((v) => [report, ...v]);
              })
            }
          >
            Save report version
          </button>
          {saved.map((r: any) => (
            <button
              className={button + " block"}
              key={r.id}
              disabled={busy}
              onClick={() =>
                run(async () =>
                  setSelectedReport(
                    api ? await api(`/management/reports/${r.id}`) : r,
                  ),
                )
              }
            >
              Open {r.report_type} {String(r.period_start).slice(0, 10)} ·{" "}
              {r.id.slice(0, 8)}
            </button>
          ))}
          {selectedReport && (
            <article className="bg-white text-slate-900 rounded p-5 space-y-3">
              <h4>Saved management report · {selectedReport.id.slice(0, 8)}</h4>
              <p>
                {selectedReport.snapshot.period.start} to{" "}
                {selectedReport.snapshot.period.end} compared with{" "}
                {selectedReport.snapshot.previous.start} to{" "}
                {selectedReport.snapshot.previous.end}
              </p>
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Selected period</th>
                    <th>Previous period</th>
                    <th>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    "roomRevenue",
                    "commission",
                    "afterCommission",
                    "occupiedNights",
                  ].map((k) => (
                    <tr key={k}>
                      <td>
                        {
                          (
                            {
                              roomRevenue: "Room revenue (AED)",
                              commission: "Recorded commission (AED)",
                              afterCommission: "After commission (AED)",
                              occupiedNights: "Occupied nights",
                            } as any
                          )[k]
                        }
                      </td>
                      <td>
                        {new Intl.NumberFormat("en-AE", {
                          minimumFractionDigits: k === "occupiedNights" ? 0 : 2,
                          maximumFractionDigits: 2,
                        }).format(selectedReport.snapshot.current[k])}
                      </td>
                      <td>
                        {new Intl.NumberFormat("en-AE", {
                          minimumFractionDigits: k === "occupiedNights" ? 0 : 2,
                          maximumFractionDigits: 2,
                        }).format(selectedReport.snapshot.prior[k])}
                      </td>
                      <td>
                        {new Intl.NumberFormat("en-AE", {
                          signDisplay: "exceptZero",
                          maximumFractionDigits: 2,
                        }).format(
                          selectedReport.snapshot.current[k] -
                            selectedReport.snapshot.prior[k],
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>{selectedReport.snapshot.limitations}</p>
              <p>
                Method: {selectedReport.snapshot.methodology} · Source revision{" "}
                {selectedReport.snapshot.sourceRevision} · Captured{" "}
                {selectedReport.snapshot.recordedAt}
              </p>
              <details>
                <summary>Source reservations and applied nights</summary>
                {selectedReport.snapshot.current.sources.map((s: any) => (
                  <p key={s.id}>
                    {s.id} · {s.checkInDate}–{s.checkOutDate} · {s.nights}{" "}
                    nights · AED {s.dailyRateAED} per night
                  </p>
                ))}
              </details>
            </article>
          )}
        </div>
      )}
      {tab === "Staff access" && (
        <div className={box}>
          <h3>Invitations and access removal</h3>
          <p>
            One General Manager plus nine team seats. Pending invitations
            reserve a seat for 72 hours. Nothing is emailed automatically; share
            invitation links privately. Acceptance requires the invited verified
            email, authenticator MFA and a recent sign-in.
          </p>
          {!api ? (
            <p>
              Staff invitations and access changes are disconnected in this
              synthetic demonstration.
            </p>
          ) : (
            <>
              <label className="block">
                Invited email
                <input
                  aria-label="Invited email"
                  className={input}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="block">
                Employee name
                <input
                  aria-label="Invited employee name"
                  className={input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Staff role
                <select
                  aria-label="Staff role"
                  className={input}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {[
                    "Read-Only Viewer",
                    "Revenue Manager",
                    "Finance Manager",
                  ].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <fieldset>
                <legend>
                  Readiness responsibilities for the invited employee
                </legend>
                {["compliance", "operations", "distribution"].map((c) => (
                  <label className="block" key={c}>
                    <input
                      type="checkbox"
                      checked={inviteCaps.includes(c)}
                      onChange={(e) =>
                        setInviteCaps(
                          e.target.checked
                            ? [...inviteCaps, c]
                            : inviteCaps.filter((v) => v !== c),
                        )
                      }
                    />
                    {c}
                  </label>
                ))}
              </fieldset>
              <button
                className={button}
                disabled={busy || !email || !name}
                onClick={() =>
                  run(async () => {
                    const result = await api("/management/invitations", {
                      email,
                      displayName: name,
                      role,
                      capabilities: inviteCaps,
                    });
                    setInviteToken(result.token);
                    await refresh();
                    setMessage(result.message);
                  })
                }
              >
                Create private invitation
              </button>
              {inviteToken && (
                <label className="block">
                  Private invitation link — shown only now
                  <input
                    aria-label="Private invitation link"
                    readOnly
                    className={input + " w-full"}
                    value={`${window.location.origin}/#invite=${inviteToken}`}
                  />
                </label>
              )}
              {snapshot.invitations.map((i: any) => (
                <p key={i.id}>
                  {i.display_name} · {i.email} · Seat {i.seat} · {i.status} ·
                  expires {new Date(i.expires_at).toLocaleString()}
                  {i.status === "pending" && (
                    <button
                      disabled={busy}
                      className={button}
                      onClick={() =>
                        run(async () => {
                          await api(
                            `/management/invitations/${i.id}/revoke`,
                            {},
                          );
                          await refresh();
                        })
                      }
                    >
                      Revoke invitation
                    </button>
                  )}
                </p>
              ))}
              {snapshot.members
                .filter((m: any) => m.seat !== 1)
                .map((m: any) => (
                  <div className="border border-slate-700 p-3" key={m.uid}>
                    <p>{memberName(snapshot.members, m.uid)}</p>
                    <MemberPermissions
                      key={
                        m.uid +
                        ":" +
                        m.role +
                        ":" +
                        JSON.stringify(
                          snapshot.grants?.filter((g: any) => g.uid === m.uid),
                        )
                      }
                      member={m}
                      grants={(snapshot.grants || [])
                        .filter((g: any) => g.uid === m.uid)
                        .map((g: any) => g.capability)}
                      api={api}
                      onSaved={refresh}
                    />
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          if (
                            !window.confirm(
                              `Remove company access for ${m.displayName || m.role}? Saved assignments will remain and need reassignment.`,
                            )
                          )
                            return;
                          await api("/management/members/remove", {
                            uid: m.uid,
                          });
                          await refresh();
                        })
                      }
                    >
                      Remove access
                    </button>
                  </div>
                ))}
              <p>
                Assign readiness responsibilities in Compliance, Activation &
                OTA → Team responsibilities. Removal prevents future company
                requests; it does not erase source history or delete the
                person's global identity account.
              </p>
            </>
          )}
        </div>
      )}
      {tab === "Private files" && (
        <ProtectedUploads api={api} unitId={unitId} gm />
      )}
      {tab === "Staging" && (
        <div className={box}>
          <h3>Secure rehearsal acceptance</h3>
          <p>
            Not verified live. Use a separate cloud project, database, identity
            configuration and private bucket with synthetic rehearsal records.
            Do not import production guests or reuse production credentials.
          </p>
          <p>
            The repository contains staging configuration validation and a
            guarded backup/restore rehearsal command. Real MFA, invitations,
            role removal, scanner health, company isolation and restore evidence
            must pass before production acceptance. No cloud resource is
            provisioned from this screen.
          </p>
        </div>
      )}
    </section>
  );
}
