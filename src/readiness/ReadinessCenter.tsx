import { readinessReport } from "./report";
import React, { useEffect, useState } from "react";
import type { Apartment } from "../types";
import {
  initialReadiness,
  emptyListing,
  type ReadinessState,
  type Capability,
} from "./model";
import { assess, listingIssues } from "./engine";
import { businessDate } from "../services/guestService";
type Api = (path: string, body?: unknown) => Promise<any>;
const box = "rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3";
const input = "w-full rounded border border-slate-600 bg-slate-950 p-2";
const button =
  "rounded bg-sky-700 px-3 py-2 hover:bg-sky-600 disabled:opacity-40";
function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        aria-label={label}
        className={input}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      {label}
      <select
        aria-label={label}
        className={input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
export function ReadinessCenter({
  api,
  apartments = [],
  role = "General Manager",
}: {
  api?: Api;
  apartments?: Apartment[];
  role?: string;
}) {
  const [snapshot, setSnapshot] = useState<any>(null),
    [unitId, setUnitId] = useState(""),
    [draft, setDraft] = useState<ReadinessState>(initialReadiness),
    [tab, setTab] = useState("PRO & Compliance Center"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(""),
    [history, setHistory] = useState<any[]>([]),
    [member, setMember] = useState(""),
    [caps, setCaps] = useState<Capability[]>([]),
    [channel, setChannel] = useState("Airbnb");
  const gm = role === "General Manager";
  async function refresh() {
    if (api) {
      const s = await api("/readiness");
      setSnapshot(s);
    } else
      setSnapshot(
        (prev: any) =>
          prev ?? {
            capabilities: ["compliance", "operations", "distribution"],
            members: [{ uid: "synthetic-gm", role: "General Manager" }],
            grants: [],
            units: apartments.map((u, i) => {
              const state = initialReadiness();
              if (i % 3 === 0)
                state.restriction =
                  "SYNTHETIC: permit evidence awaiting review";
              return {
                id: u.id,
                unitNumber: u.unitNumber,
                type: u.type,
                revision: 0,
                state,
                assessment: assess(state, businessDate()),
              };
            }),
          },
      );
  }
  useEffect(() => {
    let live = true;
    setSnapshot(null);
    setDraft(initialReadiness());
    setUnitId("");
    (async () => {
      try {
        if (api) {
          const s = await api("/readiness");
          if (live) setSnapshot(s);
        } else if (live)
          setSnapshot({
            capabilities: ["compliance", "operations", "distribution"],
            members: [{ uid: "synthetic-gm", role: "General Manager" }],
            grants: [],
            units: apartments.map((u, i) => {
              const state = initialReadiness();
              if (i % 3 === 0)
                state.restriction =
                  "SYNTHETIC: permit evidence awaiting review";
              return {
                id: u.id,
                unitNumber: u.unitNumber,
                type: u.type,
                revision: 0,
                state,
                assessment: assess(state, businessDate()),
              };
            }),
          });
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    })();
    return () => {
      live = false;
    };
  }, [api]);
  useEffect(() => {
    if (snapshot && !unitId && snapshot.units.length)
      setUnitId(snapshot.units[0].id);
  }, [snapshot, unitId]);
  const unit = snapshot?.units.find((u: any) => u.id === unitId);
  useEffect(() => {
    if (unit) {
      setDraft(structuredClone(unit.state));
      setHistory([]);
      setMessage("");
    }
  }, [unit]);
  const summary = assess(draft, businessDate());
  function patch<K extends keyof ReadinessState>(
    key: K,
    value: ReadinessState[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
    setMessage("Unsaved changes");
  }
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
  async function save(section: string, data: unknown) {
    if (!unit) return;
    if (api) {
      await api("/readiness/" + encodeURIComponent(unitId), {
        revision: unit.revision,
        section,
        data,
      });
      await refresh();
    } else {
      if (
        section === "activation" &&
        (data as any).status === "Active / Rentable" &&
        !assess(unit.state, businessDate()).canActivate
      )
        throw Error("Activation blocked. Resolve all readiness gaps.");
      let state: ReadinessState = structuredClone(unit.state);
      if (section === "configuration") Object.assign(state, data);
      if (section === "compliance")
        state.documents = structuredClone(data as ReadinessState["documents"]);
      if (section === "operations" || section === "distribution")
        Object.assign(state, structuredClone(data));
      const now = new Date().toISOString();
      if (section === "compliance")
        state.documents = state.documents.map((d) => ({
          ...d,
          verifiedBy: d.status === "verified" ? "synthetic-gm" : "",
          verifiedAt: d.status === "verified" ? now : "",
        }));
      if (section === "operations")
        for (const checks of [state.operations, state.commercial])
          for (const c of checks) {
            c.checkedBy = c.passed ? "synthetic-gm" : "";
            c.checkedAt = c.passed ? now : "";
          }
      if (section === "distribution")
        for (const l of state.listings)
          if (
            ["Ready for Submission", "Submitted", "Published"].includes(
              l.status,
            )
          ) {
            if (listingIssues(state, l).length)
              throw Error("Resolve listing quality gaps.");
            if (
              l.status === "Published" &&
              (!l.confirmationUrl || !l.confirmationReference)
            )
              throw Error("Publication confirmation is required.");
            l.reviewedBy = "synthetic-gm";
            l.reviewedAt = now;
          }
      if (section === "activation") state.status = (data as any).status;
      setSnapshot((s: any) => ({
        ...s,
        units: s.units.map((u: any) =>
          u.id === unitId
            ? {
                ...u,
                state,
                revision: u.revision + 1,
                assessment: assess(state, businessDate()),
              }
            : u,
        ),
      }));
    }
    setMessage("Saved. Readiness recalculated.");
  }
  const rights = snapshot?.capabilities ?? [];
  if (!snapshot)
    return (
      <section className="p-6" role={error ? "alert" : undefined}>
        {error || "Loading readiness records…"}
      </section>
    );
  return (
    <section className="p-4 space-y-4 text-slate-100">
      <h1 className="text-2xl font-bold">Property Readiness & Activation</h1>
      <p className={box}>
        {api
          ? "Company records • access controlled • changes audited"
          : "SYNTHETIC DEMONSTRATION — no real permits, documents, guests or OTA publications. Changes remain in this browser session."}{" "}
        Evidence references are links to records held in your authorized
        repository. File upload, antivirus scanning, external reminders and OTA
        publishing are not connected.
      </p>
      {error && (
        <p role="alert" className="bg-red-950 p-3">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["Apartments", snapshot.units.length],
          [
            "Activation blocked",
            snapshot.units.filter((u: any) => !u.assessment.canActivate).length,
          ],
          [
            "Document alerts",
            snapshot.units.reduce(
              (n: number, u: any) => n + u.assessment.alerts.length,
              0,
            ),
          ],
          [
            "Overdue tasks",
            snapshot.units.reduce(
              (n: number, u: any) => n + u.assessment.overdueTasks.length,
              0,
            ),
          ],
        ].map(([label, value]) => (
          <div className={box} key={label}>
            <p>{label}</p>
            <strong className="text-2xl">{value}</strong>
          </div>
        ))}
      </div>
      <label className="block">
        Apartment
        <select
          aria-label="Apartment"
          className={input}
          value={unitId}
          onChange={(e) => setUnitId(e.target.value)}
        >
          {snapshot.units.map((u: any) => (
            <option key={u.id} value={u.id}>
              {u.unitNumber} · {u.type} · {u.assessment.effectiveStatus}
            </option>
          ))}
        </select>
      </label>
      {!unit && (
        <p>
          Add real apartment units in Property units before recording readiness.
        </p>
      )}
      <nav className="flex flex-wrap gap-2">
        {[
          "PRO & Compliance Center",
          "Property Activation Center",
          "OTA Listing Readiness",
          "General Manager Briefing",
          "Team responsibilities",
        ].map((t) => (
          <button
            className={button + (tab === t ? " ring-2 ring-sky-300" : "")}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      {unit && tab === "PRO & Compliance Center" && (
        <>
          {gm && (
            <details className={box}>
              <summary>Jurisdiction rules and renewal reminders</summary>
              <p>
                Configure requirements after authorized review of official
                sources. These are company rules, not a complete legal checklist
                supplied by this app.
              </p>
              <Field
                label="Jurisdiction"
                value={draft.jurisdiction}
                onChange={(v) => patch("jurisdiction", v)}
              />
              <Select
                label="Rental model"
                value={draft.rentalModel}
                options={[
                  "holiday-home",
                  "serviced-apartment",
                  "hotel-apartment",
                ]}
                onChange={(v) => patch("rentalModel", v as any)}
              />
              <label>
                <input
                  type="checkbox"
                  checked={draft.rulesReviewed}
                  onChange={(e) => patch("rulesReviewed", e.target.checked)}
                />{" "}
                Authorized jurisdiction review completed
              </label>
              <Field
                label="Unresolved legal restriction"
                value={draft.restriction}
                onChange={(v) => patch("restriction", v)}
              />
              <Field
                label="Reminder days before expiry (comma separated)"
                value={draft.reminderDays.join(",")}
                onChange={(v) =>
                  patch("reminderDays", v.split(",").map(Number))
                }
              />
              {draft.requirements.map((r, i) => (
                <fieldset className={box} key={r.id}>
                  <legend>Requirement {i + 1}</legend>
                  {(
                    [
                      "label",
                      "authority",
                      "sourceUrl",
                      "reviewedOn",
                      "validUntil",
                    ] as const
                  ).map((k) => (
                    <Field
                      key={k}
                      label={
                        {
                          label: "Requirement name",
                          authority: "Issuing authority",
                          sourceUrl: "Official source URL",
                          reviewedOn: "Reviewed on",
                          validUntil: "Review valid until",
                        }[k]
                      }
                      value={r[k]}
                      type={
                        k === "reviewedOn" || k === "validUntil"
                          ? "date"
                          : "text"
                      }
                      onChange={(v) =>
                        patch(
                          "requirements",
                          draft.requirements.map((p, j) =>
                            j === i ? { ...p, [k]: v } : p,
                          ),
                        )
                      }
                    />
                  ))}
                  <label>
                    <input
                      type="checkbox"
                      checked={r.mandatory}
                      onChange={(e) =>
                        patch(
                          "requirements",
                          draft.requirements.map((p, j) =>
                            j === i ? { ...p, mandatory: e.target.checked } : p,
                          ),
                        )
                      }
                    />{" "}
                    Mandatory activation gate
                  </label>
                </fieldset>
              ))}
              <button
                className={button}
                onClick={() =>
                  patch("requirements", [
                    ...draft.requirements,
                    {
                      id: crypto.randomUUID(),
                      label: "",
                      authority: "",
                      sourceUrl: "",
                      reviewedOn: businessDate(),
                      validUntil: businessDate(),
                      mandatory: true,
                    },
                  ])
                }
              >
                Add requirement
              </button>{" "}
              <button
                className={button}
                disabled={busy}
                onClick={() =>
                  run(() =>
                    save(
                      "configuration",
                      Object.fromEntries(
                        [
                          "jurisdiction",
                          "rentalModel",
                          "rulesReviewed",
                          "requirements",
                          "reminderDays",
                          "restriction",
                        ].map((k) => [k, (draft as any)[k]]),
                      ),
                    ),
                  )
                }
              >
                Save jurisdiction rules
              </button>
            </details>
          )}
          {rights.includes("compliance") ? (
            <div className={box}>
              <h2 className="text-xl">Compliance documents</h2>
              <p>
                Unverified records never satisfy mandatory legal gates. Only the
                GM can verify evidence after a recent MFA sign-in.
              </p>
              {draft.documents.map((d, i) => (
                <fieldset className={box} key={d.id}>
                  <legend>
                    Document {i + 1} · {d.status}
                  </legend>
                  <Select
                    label="Requirement"
                    value={d.requirementId}
                    options={draft.requirements.map((r) => r.id)}
                    onChange={(v) =>
                      patch(
                        "documents",
                        draft.documents.map((p, j) =>
                          j === i ? { ...p, requirementId: v } : p,
                        ),
                      )
                    }
                  />
                  <p>
                    {
                      draft.requirements.find((r) => r.id === d.requirementId)
                        ?.label
                    }
                  </p>
                  <div className="grid gap-3 md:grid-cols-3">
                    {(
                      [
                        "category",
                        "authority",
                        "reference",
                        "issuedOn",
                        "expiresOn",
                        "renewalOn",
                        "responsibleUid",
                        "evidenceUrl",
                        "notes",
                      ] as const
                    ).map((k) => (
                      <Field
                        key={k}
                        label={
                          {
                            category: "Category",
                            authority: "Authority",
                            reference: "Reference number",
                            issuedOn: "Issue date",
                            expiresOn: "Expiry date",
                            renewalOn: "Renewal deadline",
                            responsibleUid: "Responsible team UID",
                            evidenceUrl: "Private evidence HTTPS link",
                            notes: "Notes",
                          }[k]
                        }
                        value={d[k]}
                        type={k.endsWith("On") ? "date" : "text"}
                        onChange={(v) =>
                          patch(
                            "documents",
                            draft.documents.map((p, j) =>
                              j === i ? { ...p, [k]: v } : p,
                            ),
                          )
                        }
                      />
                    ))}
                  </div>
                  <Select
                    label="Verification status"
                    value={d.status}
                    options={
                      gm
                        ? ["unverified", "verified", "rejected", "revoked"]
                        : [
                            "unverified",
                            "rejected",
                            "revoked",
                            ...(d.status === "verified" ? ["verified"] : []),
                          ]
                    }
                    onChange={(v) =>
                      patch(
                        "documents",
                        draft.documents.map((p, j) =>
                          j === i ? { ...p, status: v as any } : p,
                        ),
                      )
                    }
                  />
                  <p>
                    Verified by: {d.verifiedBy || "No reviewer"} ·{" "}
                    {d.verifiedAt || "Not verified"}
                  </p>
                </fieldset>
              ))}
              <button
                className={button}
                disabled={!draft.requirements.length}
                onClick={() =>
                  patch("documents", [
                    ...draft.documents,
                    {
                      id: crypto.randomUUID(),
                      requirementId: draft.requirements[0].id,
                      category: "",
                      authority: "",
                      reference: "",
                      issuedOn: businessDate(),
                      expiresOn: businessDate(),
                      renewalOn: businessDate(),
                      responsibleUid: snapshot.members[0]?.uid || "",
                      evidenceUrl: "",
                      notes: "",
                      status: "unverified",
                      verifiedBy: "",
                      verifiedAt: "",
                    },
                  ])
                }
              >
                Add document record
              </button>{" "}
              <button
                className={button}
                disabled={busy}
                onClick={() => run(() => save("compliance", draft.documents))}
              >
                Save compliance records
              </button>
            </div>
          ) : (
            <p>
              Compliance evidence is restricted to assigned compliance staff.
            </p>
          )}
          <h2>Expiry and renewal alerts</h2>
          {summary.alerts.map((a) => (
            <p className={box} key={a.documentId}>
              {a.reason} · {a.reference} · {a.daysRemaining} days remaining ·
              Responsible: {a.responsibleUid}
            </p>
          ))}
        </>
      )}
      {unit && tab === "Property Activation Center" && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["Legal readiness", summary.legal],
              ["Operational readiness", summary.operational],
              ["Commercial readiness", summary.commercial],
            ].map(([label, gaps]) => (
              <div className={box} key={label as string}>
                <h2>{label}</h2>
                {(gaps as string[]).length ? (
                  (gaps as string[]).map((g) => <p key={g}>Blocked: {g}</p>)
                ) : (
                  <p>Evidence gates passed</p>
                )}
              </div>
            ))}
          </div>
          {rights.includes("operations") && (
            <div className={box}>
              <h2>Operational and commercial checks</h2>
              {(["operations", "commercial"] as const).map((key) => (
                <div key={key}>
                  {draft[key].map((c, i) => (
                    <fieldset
                      className="grid gap-2 md:grid-cols-2 py-2"
                      key={c.id}
                    >
                      <label>
                        <input
                          type="checkbox"
                          checked={c.passed}
                          onChange={(e) =>
                            patch(
                              key,
                              draft[key].map((p, j) =>
                                i === j
                                  ? { ...p, passed: e.target.checked }
                                  : p,
                              ),
                            )
                          }
                        />{" "}
                        {c.label}
                      </label>
                      <Field
                        label={c.label + " evidence URL"}
                        value={c.evidenceUrl || ""}
                        onChange={(v) =>
                          patch(
                            key,
                            draft[key].map((p, j) =>
                              i === j
                                ? { ...p, evidenceUrl: v || undefined }
                                : p,
                            ),
                          )
                        }
                      />
                    </fieldset>
                  ))}
                </div>
              ))}
              <button
                className={button}
                disabled={busy}
                onClick={() =>
                  run(() =>
                    save("operations", {
                      operations: draft.operations,
                      commercial: draft.commercial,
                      tasks: draft.tasks,
                    }),
                  )
                }
              >
                Save readiness checks and tasks
              </button>
              <h3>Assigned tasks</h3>
              {draft.tasks.map((t, i) => (
                <div className={box} key={t.id}>
                  {(["label", "responsibleUid", "dueOn"] as const).map((k) => (
                    <Field
                      key={k}
                      label={
                        k === "label"
                          ? "Task"
                          : k === "responsibleUid"
                            ? "Assigned team UID"
                            : "Due date"
                      }
                      type={k === "dueOn" ? "date" : "text"}
                      value={t[k]}
                      onChange={(v) =>
                        patch(
                          "tasks",
                          draft.tasks.map((p, j) =>
                            j === i ? { ...p, [k]: v } : p,
                          ),
                        )
                      }
                    />
                  ))}
                  <Select
                    label="Task status"
                    value={t.status}
                    options={["open", "done"]}
                    onChange={(v) =>
                      patch(
                        "tasks",
                        draft.tasks.map((p, j) =>
                          j === i ? { ...p, status: v as any } : p,
                        ),
                      )
                    }
                  />
                </div>
              ))}
              <button
                className={button}
                onClick={() =>
                  patch("tasks", [
                    ...draft.tasks,
                    {
                      id: crypto.randomUUID(),
                      label: "",
                      responsibleUid: "",
                      dueOn: businessDate(),
                      status: "open",
                    },
                  ])
                }
              >
                Add assigned task
              </button>
            </div>
          )}
          {gm && (
            <div className={box}>
              <p>
                Recorded status: {unit.state.status}. Effective status:{" "}
                {unit.assessment.effectiveStatus}. Expiry or failed gates
                suspend effective rentability, including after a previously
                approved activation.
              </p>
              <Select
                label="Requested property status"
                value={draft.status}
                options={[
                  "Draft",
                  "Compliance Pending",
                  "Operational Preparation",
                  "OTA Preparation",
                  "Ready for Activation",
                  "Active / Rentable",
                  "Suspended",
                  "Offboarding",
                ]}
                onChange={(v) => patch("status", v as any)}
              />
              <Field
                label="Approval or status-change reason"
                value={reason}
                onChange={setReason}
              />
              <button
                className={button}
                disabled={busy || reason.trim().length < 5}
                onClick={() =>
                  run(() =>
                    save("activation", { status: draft.status, reason }),
                  )
                }
              >
                Record GM status decision
              </button>
              <p>
                Save evidence first. The server checks the current saved records
                and rejects stale decisions.
              </p>
            </div>
          )}
          <button
            className={button}
            onClick={() =>
              run(async () => {
                if (api)
                  setHistory(
                    (
                      await api(
                        "/readiness/" + encodeURIComponent(unitId) + "/history",
                      )
                    ).history,
                  );
                else
                  setHistory([
                    {
                      revision: unit.revision,
                      action: "Synthetic session only",
                      actor_uid: "synthetic-gm",
                    },
                  ]);
              })
            }
          >
            View approval history
          </button>
          {history.map((h) => (
            <p key={h.revision}>
              Revision {h.revision} · {h.action} · {h.actor_uid} ·{" "}
              {h.created_at}
            </p>
          ))}
        </>
      )}
      {unit &&
        tab === "OTA Listing Readiness" &&
        rights.includes("distribution") && (
          <>
            <div className={box}>
              <h2 className="text-xl">
                Verified amenities and media references
              </h2>
              <p>
                GM review is required for verified amenities and approved media.
                Resolution and file metadata are recorded declarations, not
                inspected bytes. Keep confidential documents outside listing
                media.
              </p>
              <Field
                label="Verified amenities (comma separated)"
                value={draft.verifiedAmenities.join(",")}
                onChange={(v) =>
                  patch(
                    "verifiedAmenities",
                    v
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  )
                }
              />
              {draft.media.map((m, i) => (
                <fieldset className={box} key={m.id}>
                  <legend>
                    {m.kind} · {m.category}
                  </legend>
                  <Select
                    label="Media kind"
                    value={m.kind}
                    options={["photo", "video"]}
                    onChange={(v) =>
                      patch(
                        "media",
                        draft.media.map((p, j) =>
                          j === i
                            ? {
                                ...p,
                                kind: v as any,
                                mime:
                                  v === "photo" ? "image/jpeg" : "video/mp4",
                                durationSeconds: v === "photo" ? 0 : 1,
                              }
                            : p,
                        ),
                      )
                    }
                  />
                  {(
                    [
                      "category",
                      "evidenceUrl",
                      "width",
                      "height",
                      "bytes",
                      "durationSeconds",
                      "creator",
                      "usagePermission",
                    ] as const
                  ).map((k) => (
                    <Field
                      key={k}
                      label={k}
                      value={m[k]}
                      type={
                        [
                          "width",
                          "height",
                          "bytes",
                          "durationSeconds",
                        ].includes(k)
                          ? "number"
                          : "text"
                      }
                      onChange={(v) =>
                        patch(
                          "media",
                          draft.media.map((p, j) =>
                            j === i
                              ? {
                                  ...p,
                                  [k]: [
                                    "width",
                                    "height",
                                    "bytes",
                                    "durationSeconds",
                                  ].includes(k)
                                    ? Number(v)
                                    : v,
                                }
                              : p,
                          ),
                        )
                      }
                    />
                  ))}
                  <Select
                    label="File type"
                    value={m.mime}
                    options={
                      m.kind === "photo"
                        ? ["image/jpeg", "image/png", "image/webp"]
                        : ["video/mp4", "video/webm"]
                    }
                    onChange={(v) =>
                      patch(
                        "media",
                        draft.media.map((p, j) =>
                          j === i ? { ...p, mime: v as any } : p,
                        ),
                      )
                    }
                  />
                  <label>
                    <input
                      type="checkbox"
                      checked={m.approved}
                      onChange={(e) =>
                        patch(
                          "media",
                          draft.media.map((p, j) =>
                            j === i ? { ...p, approved: e.target.checked } : p,
                          ),
                        )
                      }
                    />{" "}
                    GM-approved media reference
                  </label>
                </fieldset>
              ))}
              <button
                className={button}
                onClick={() =>
                  patch("media", [
                    ...draft.media,
                    {
                      id: crypto.randomUUID(),
                      kind: "photo",
                      category: "cover",
                      evidenceUrl: "",
                      width: 1200,
                      height: 800,
                      bytes: 1,
                      mime: "image/jpeg",
                      durationSeconds: 0,
                      creator: "",
                      usagePermission: "",
                      approved: false,
                    },
                  ])
                }
              >
                Add media reference
              </button>
            </div>
            <div className={box}>
              <Field
                label="Channel name"
                value={channel}
                onChange={setChannel}
              />
              <button
                className={button}
                disabled={
                  !channel.trim() ||
                  draft.listings.some(
                    (l) =>
                      l.channel.toLowerCase() === channel.trim().toLowerCase(),
                  )
                }
                onClick={() =>
                  patch("listings", [
                    ...draft.listings,
                    emptyListing(channel.trim()),
                  ])
                }
              >
                Add channel checklist
              </button>
            </div>
            {draft.listings.map((l, i) => (
              <fieldset className={box} key={l.channel}>
                <legend className="text-xl">{l.channel}</legend>
                <p>
                  Checklist is configurable company policy; verify current
                  channel rules before submission.
                </p>
                {(
                  [
                    "title",
                    "description",
                    "houseRules",
                    "checkIn",
                    "checkOut",
                    "cancellation",
                    "minimumStay",
                    "guestCapacity",
                    "cleaningFee",
                    "additionalGuestFee",
                    "minimumWidth",
                    "confirmationUrl",
                    "confirmationReference",
                  ] as const
                ).map((k) => (
                  <Field
                    key={k}
                    label={l.channel + " " + k}
                    value={l[k] ?? ""}
                    type={typeof l[k] === "number" ? "number" : "text"}
                    onChange={(v) =>
                      patch(
                        "listings",
                        draft.listings.map((p, j) =>
                          j === i
                            ? {
                                ...p,
                                [k]:
                                  typeof p[k] === "number"
                                    ? Number(v)
                                    : k === "confirmationUrl"
                                      ? v || undefined
                                      : v,
                              }
                            : p,
                        ),
                      )
                    }
                  />
                ))}
                <Field
                  label={l.channel + " advertised amenities"}
                  value={l.amenities.join(",")}
                  onChange={(v) =>
                    patch(
                      "listings",
                      draft.listings.map((p, j) =>
                        j === i
                          ? {
                              ...p,
                              amenities: v
                                .split(",")
                                .map((x) => x.trim())
                                .filter(Boolean),
                            }
                          : p,
                      ),
                    )
                  }
                />
                <Field
                  label={l.channel + " required photo categories"}
                  value={l.requiredPhotos.join(",")}
                  onChange={(v) =>
                    patch(
                      "listings",
                      draft.listings.map((p, j) =>
                        j === i
                          ? {
                              ...p,
                              requiredPhotos: v
                                .split(",")
                                .map((x) => x.trim())
                                .filter(Boolean),
                            }
                          : p,
                      ),
                    )
                  }
                />
                <label>
                  <input
                    type="checkbox"
                    checked={l.acceptsVideo}
                    onChange={(e) =>
                      patch(
                        "listings",
                        draft.listings.map((p, j) =>
                          j === i
                            ? { ...p, acceptsVideo: e.target.checked }
                            : p,
                        ),
                      )
                    }
                  />{" "}
                  Verified channel video support
                </label>
                {l.acceptsVideo && (
                  <Field
                    label="Video rule source URL"
                    value={l.videoRuleSource || ""}
                    onChange={(v) =>
                      patch(
                        "listings",
                        draft.listings.map((p, j) =>
                          j === i
                            ? { ...p, videoRuleSource: v || undefined }
                            : p,
                        ),
                      )
                    }
                  />
                )}
                <Select
                  label={l.channel + " status"}
                  value={l.status}
                  options={[
                    "Not Started",
                    "Content Incomplete",
                    "Pending Review",
                    "Ready for Submission",
                    "Submitted",
                    "Published",
                    "Rejected",
                    "Suspended",
                    "Requires Update",
                  ]}
                  onChange={(v) =>
                    patch(
                      "listings",
                      draft.listings.map((p, j) =>
                        j === i ? { ...p, status: v as any } : p,
                      ),
                    )
                  }
                />
                <h3>Listing quality assistant</h3>
                {listingIssues(draft, l).map((g) => (
                  <p key={g}>Needs attention: {g}</p>
                ))}
                <p>
                  Suggested photo order: {l.requiredPhotos.join(" → ")}.
                  Suggestions use recorded facts only; no invented amenities or
                  automatic publication.
                </p>
              </fieldset>
            ))}
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                run(() =>
                  save("distribution", {
                    verifiedAmenities: draft.verifiedAmenities,
                    media: draft.media,
                    listings: draft.listings,
                  }),
                )
              }
            >
              Save OTA readiness
            </button>
          </>
        )}
      {tab === "General Manager Briefing" && gm && (
        <button
          className={button}
          disabled={busy}
          onClick={() =>
            run(async () => {
              const result = api
                ? await api("/readiness/reports", {})
                : {
                    html: readinessReport(
                      snapshot.units.map((u: any) => ({
                        ...u,
                        state: u.state,
                      })),
                      businessDate(),
                      "SYNTHETIC DEMO",
                    ),
                  };
              const url = URL.createObjectURL(
                new Blob([result.html], { type: "text/html" }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = api
                ? "Internal-Readiness-Review.html"
                : "SYNTHETIC-Readiness-Review.html";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              setMessage(
                "Internal draft downloaded. No owner release or external sending occurred.",
              );
            })
          }
        >
          Download internal readiness review
        </button>
      )}
      {tab === "General Manager Briefing" && (
        <div className={box}>
          <h2 className="text-xl">
            Evidence-based readiness briefing · {businessDate()}
          </h2>
          <p>
            Current saved records only. Unsaved edits and unsupported financial
            estimates are excluded. Counts are not predictive performance
            scores.
          </p>
          {snapshot.units.map((u: any) => (
            <article className={box} key={u.id}>
              <h3>
                Apartment {u.unitNumber} · {u.assessment.effectiveStatus}
              </h3>
              <p>
                Legal blockers: {u.assessment.legal.length} · Operational:{" "}
                {u.assessment.operational.length} · Commercial:{" "}
                {u.assessment.commercial.length}
              </p>
              {u.assessment.legal.map((g: string) => (
                <p key={g}>{g}</p>
              ))}
              {u.assessment.alerts.map((a: any) => (
                <p key={a.documentId}>
                  {a.reason} · {a.daysRemaining} days · Assigned:{" "}
                  {a.responsibleUid}
                </p>
              ))}
              {u.assessment.overdueTasks.map((t: any) => (
                <p key={t.id}>
                  Overdue: {t.label} · {t.responsibleUid} · {t.dueOn}
                </p>
              ))}
              <p>
                Evidence reference: apartment {u.id}, revision {u.revision}
              </p>
            </article>
          ))}
        </div>
      )}
      {tab === "Team responsibilities" && gm && (
        <div className={box}>
          <p>
            Responsibilities add readiness permissions to existing individual
            accounts. They do not create accounts or increase the ten-user
            limit.
          </p>
          <Select
            label="Team member"
            value={member}
            options={["", ...snapshot.members.map((m: any) => m.uid)]}
            onChange={setMember}
          />
          {(["compliance", "operations", "distribution"] as Capability[]).map(
            (c) => (
              <label className="block" key={c}>
                <input
                  type="checkbox"
                  checked={caps.includes(c)}
                  onChange={(e) =>
                    setCaps((v) =>
                      e.target.checked ? [...v, c] : v.filter((x) => x !== c),
                    )
                  }
                />{" "}
                {c}
              </label>
            ),
          )}
          <button
            className={button}
            disabled={busy || !member}
            onClick={() =>
              run(async () => {
                if (api) {
                  await api("/readiness/grants", {
                    uid: member,
                    capabilities: caps,
                  });
                  await refresh();
                }
                setMessage("Responsibilities saved.");
              })
            }
          >
            Save team responsibilities
          </button>
          {snapshot.grants.map((g: any) => (
            <p key={g.uid + g.capability}>
              {g.uid} · {g.capability}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
