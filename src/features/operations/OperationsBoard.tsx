import React, { useEffect, useState } from "react";
import type { Workspace, Actor } from "../../shared/api/contracts";
import {
  businessDate,
  nextBusinessDate,
  nextDayOperations,
  serviceTasks,
  renderTemplate,
  DEFAULT_GUEST_SERVICE,
  type GuestService,
} from "../guest-service/guestService";
const box = "bg-slate-900 rounded-xl border border-slate-700 p-4 space-y-3";
const input = "bg-slate-950 border border-slate-600 rounded p-2 w-full";
const button =
  "bg-sky-700 hover:bg-sky-600 disabled:opacity-40 rounded px-3 py-2";
export function OperationsBoard({
  data,
  actor,
  sync,
  api,
  refresh,
  run,
  busy,
  revision,
}: {
  data: Workspace;
  actor: Actor;
  sync: any;
  api: (path: string, body?: unknown) => Promise<any>;
  refresh: () => Promise<void>;
  run: any;
  busy: boolean;
  revision: number;
}) {
  const [date, setDate] = useState(nextBusinessDate()),
    [draft, setDraft] = useState<{ subject: string; body: string } | null>(
      null,
    );
  const [settings, setSettings] = useState<GuestService>(() =>
    structuredClone(data.guestService || DEFAULT_GUEST_SERVICE),
  );
  const [edit, setEdit] = useState(false),
    [newName, setNewName] = useState(""),
    [policyRevision, setPolicyRevision] = useState(revision);
  useEffect(() => {
    if (!edit)
      setSettings(structuredClone(data.guestService || DEFAULT_GUEST_SERVICE));
  }, [data.guestService, edit]);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const operations = valid
    ? nextDayOperations(
        data.reservations.map((r) => r.data),
        date,
      )
    : null;
  const windowStart = valid
    ? new Date(Date.parse(date + "T00:00:00Z") - 7 * 86400000)
        .toISOString()
        .slice(0, 10)
    : "";
  const tasks = valid
    ? serviceTasks(
        data.reservations.map((r) => r.data),
        data.guestService || DEFAULT_GUEST_SERVICE,
        new Date(), data.operatingSettings,
      )
        .filter((t) => {
          const dueDate = businessDate(new Date(t.dueAt));
          return dueDate >= windowStart && dueDate <= date;
        })
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    : [];
  const unit = (id: string) =>
    data.apartments.find((a) => a.id === id)?.unitNumber || "Unmapped unit";
  const stale =
    !sync?.lastSuccess ||
    Date.now() - Date.parse(sync.lastSuccess) > 15 * 60000;
  const preview = (templateId: string, reservationId?: string) => {
    const t = settings.templates.find((t) => t.id === templateId);
    if (!t) return;
    const r = data.reservations.find((r) => r.data.id === reservationId)?.data;
    setDraft(
      renderTemplate(t, {
        companyName: "[company name required]",
        guestName: "[guest name required]",
        unitNumber: r ? unit(r.unitId) : "",
        reservationId: r?.id || "",
        checkInDate: r?.checkInDate || "",
        checkOutDate: r?.checkOutDate || "",
      }),
    );
  };
  return (
    <div className="p-6 space-y-5">
      <div className={box}>
        <h2 className="text-xl font-bold">
          Next-day operations and guest-service SLA
        </h2>
        <div className="flex gap-3">
          <label>
            Operations date
            <input
              className={input}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <button
            className={button}
            onClick={() => setDate(nextBusinessDate())}
          >
            Show tomorrow's operations
          </button>
        </div>
        <p className={stale ? "text-amber-200" : "text-emerald-200"}>
          {sync?.configured
            ? "Automatic intake configured"
            : "No PMS connected"}{" "}
          ·{" "}
          {sync?.lastSuccess
            ? "Last accepted booking update: " +
              new Date(sync.lastSuccess).toLocaleString()
            : "No automatic booking update received"}
          {stale
            ? " · Freshness not confirmed. This is the last recorded plan."
            : ""}
        </p>
        <p className="text-sm text-slate-400">
          The board refreshes every 30 seconds while connected. New bookings,
          changes and cancellations update this schedule after a valid source
          event is accepted. Arrivals are scheduled; guest arrival time and room
          readiness require their own source feeds.
        </p>
      </div>
      {operations && (
        <div className="grid md:grid-cols-3 gap-4">
          {[
            ["Arrivals", operations.arrivals],
            ["Departures", operations.departures],
            ["Staying over", operations.stayovers],
          ].map(([name, rows]) => (
            <section className={box} key={name as string}>
              <h3 className="font-bold">
                {name as string} ({(rows as any[]).length})
              </h3>
              {(rows as any[]).map((r) => (
                <p className="text-sm" key={r.id}>
                  Unit {unit(r.unitId)} · {r.channel} · {r.status}
                </p>
              ))}
              {!(rows as any[]).length && (
                <p className="text-slate-400 text-sm">None recorded</p>
              )}
            </section>
          ))}
        </div>
      )}
      {operations && (
        <section className={box}>
          <h3 className="font-bold">Turnover arrangements</h3>
          {operations.turnovers.map((t) => (
            <p key={t.departureId}>
              Unit {unit(t.unitId)} ·{" "}
              {t.arrivalIds.length
                ? "Same-day arrival: prioritize cleaning and inspection"
                : "Checkout cleaning due"}{" "}
              · Staff assignment and completion not yet verified
            </p>
          ))}
          {!operations.turnovers.length && (
            <p>No checkout turnovers recorded for this date.</p>
          )}
        </section>
      )}
      <section className={box}>
        <h3 className="font-bold">Guest-contact tasks through {date}</h3>
        <p className="text-sm text-slate-400">
          Shows tasks due within the previous seven days through this date.
          Policy defaults use Dubai check-in 15:00 and checkout 11:00. These are
          internal service targets, not contractual guarantees. Completion is
          manually recorded; this app has not sent the message.
        </p>
        {tasks.map((t) => (
          <div
            key={t.id}
            className="border-t border-slate-700 pt-3 flex flex-wrap justify-between gap-3"
          >
            <div>
              <p>
                {t.title} · Unit {unit(t.unitId)}
              </p>
              <p
                className={
                  t.status === "overdue" ? "text-amber-200" : "text-slate-400"
                }
              >
                {new Date(t.dueAt).toLocaleString("en-GB", {
                  timeZone: "Asia/Dubai",
                })}{" "}
                GST · {t.status}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className={button}
                onClick={() => preview(t.templateId, t.reservationId)}
              >
                Prepare message
              </button>
              {actor.role !== "Read-Only Viewer" &&
                t.status !== "completed" && (
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Confirm the team has completed this guest contact? No email will be sent by this action.",
                        )
                      )
                        run(async () => {
                          await api("/guest-service/complete", {
                            taskId: t.id,
                          });
                          await refresh();
                        });
                    }}
                  >
                    Record contact completed
                  </button>
                )}
            </div>
          </div>
        ))}
        {!tasks.length && <p>No tasks recorded in this window.</p>}
      </section>
      <section className={box}>
        <h3 className="font-bold">Message template library</h3>
        <p className="text-sm text-slate-400">
          Drafts only. Fill required placeholders and review guest details
          before using your approved email or messaging service. No passwords,
          access codes or payment details are inserted.
        </p>
        <div className="flex flex-wrap gap-2">
          {settings.templates.map((t) => (
            <button key={t.id} className={button} onClick={() => preview(t.id)}>
              {t.name}
            </button>
          ))}
        </div>
        {actor.role === "General Manager" && (
          <button
            className={button}
            onClick={() => {
              setPolicyRevision(revision);
              setEdit(!edit);
            }}
          >
            {edit ? "Hide editor" : "Edit templates and SLA rules"}
          </button>
        )}
      </section>
      {draft && (
        <section className={box}>
          <h3 className="font-bold">Message draft</h3>
          <label>
            Subject
            <input
              className={input}
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
            />
          </label>
          <label>
            Message
            <textarea
              className={input + " min-h-48"}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
          </label>
          <button
            className={button}
            onClick={() =>
              run(async () => {
                await navigator.clipboard.writeText(
                  "Subject: " + draft.subject + "\n\n" + draft.body,
                );
              })
            }
          >
            Copy draft
          </button>
          <button className={button} onClick={() => setDraft(null)}>
            Close draft
          </button>
        </section>
      )}
      {edit && actor.role === "General Manager" && (
        <section className={box}>
          <h3 className="font-bold">Service-policy editor</h3>
          <p className="text-sm">
            Available placeholders:{" "}
            {
              "{{guestName}}, {{unitNumber}}, {{reservationId}}, {{checkInDate}}, {{checkOutDate}}, {{companyName}}"
            }
            . Changing a rule applies its deadline to existing active stays; a
            changed arrival/departure date creates a fresh contact task.
          </p>
          {settings.templates.map((t, i) => (
            <div
              key={t.id}
              className="border-t border-slate-700 pt-3 space-y-2"
            >
              <label>
                Template name
                <input
                  className={input}
                  value={t.name}
                  maxLength={100}
                  onChange={(e) => {
                    const templates = [...settings.templates];
                    templates[i] = { ...t, name: e.target.value };
                    setSettings({ ...settings, templates });
                  }}
                />
              </label>
              <label>
                Subject
                <input
                  className={input}
                  value={t.subject}
                  maxLength={200}
                  onChange={(e) => {
                    const templates = [...settings.templates];
                    templates[i] = { ...t, subject: e.target.value };
                    setSettings({ ...settings, templates });
                  }}
                />
              </label>
              <label>
                Body
                <textarea
                  className={input}
                  value={t.body}
                  maxLength={6000}
                  onChange={(e) => {
                    const templates = [...settings.templates];
                    templates[i] = { ...t, body: e.target.value };
                    setSettings({ ...settings, templates });
                  }}
                />
              </label>
            </div>
          ))}
          <label>
            New template name
            <input
              className={input}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <button
            className={button}
            disabled={!newName.trim() || settings.templates.length >= 30}
            onClick={() => {
              setSettings({
                ...settings,
                templates: [
                  ...settings.templates,
                  {
                    id: crypto.randomUUID(),
                    name: newName,
                    subject: "Your stay",
                    body: "Hello {{guestName}},\n{{companyName}}",
                  },
                ],
              });
              setNewName("");
            }}
          >
            Add template
          </button>
          <h4 className="font-semibold">Contact deadlines</h4>
          {settings.rules.map((r, i) => (
            <div
              key={r.id}
              className="grid sm:grid-cols-4 gap-3 border-t border-slate-700 pt-3"
            >
              <label>
                Rule name
                <input
                  className={input}
                  value={r.name}
                  onChange={(e) => {
                    const rules = [...settings.rules];
                    rules[i] = { ...r, name: e.target.value };
                    setSettings({ ...settings, rules });
                  }}
                />
              </label>
              <label>
                Anchor
                <select
                  className={input}
                  value={r.anchor}
                  onChange={(e) => {
                    const rules = [...settings.rules];
                    rules[i] = { ...r, anchor: e.target.value as any };
                    setSettings({ ...settings, rules });
                  }}
                >
                  <option value="arrival">Arrival (15:00 GST)</option>
                  <option value="departure">Departure (11:00 GST)</option>
                </select>
              </label>
              <label>
                Hours before (−) / after (+)
                <input
                  className={input}
                  type="number"
                  min={-168}
                  max={168}
                  value={r.offsetHours}
                  onChange={(e) => {
                    const rules = [...settings.rules];
                    rules[i] = { ...r, offsetHours: Number(e.target.value) };
                    setSettings({ ...settings, rules });
                  }}
                />
              </label>
              <label>
                Template
                <select
                  className={input}
                  value={r.templateId}
                  onChange={(e) => {
                    const rules = [...settings.rules];
                    rules[i] = { ...r, templateId: e.target.value };
                    setSettings({ ...settings, rules });
                  }}
                >
                  {settings.templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => {
                    const rules = [...settings.rules];
                    rules[i] = { ...r, enabled: e.target.checked };
                    setSettings({ ...settings, rules });
                  }}
                />{" "}
                Enabled
              </label>
            </div>
          ))}
          <button
            className={button}
            disabled={settings.rules.length >= 20}
            onClick={() =>
              setSettings({
                ...settings,
                rules: [
                  ...settings.rules,
                  {
                    id: crypto.randomUUID(),
                    name: "New contact target",
                    anchor: "arrival",
                    offsetHours: -24,
                    templateId: settings.templates[0].id,
                    enabled: true,
                  },
                ],
              })
            }
          >
            Add SLA rule
          </button>
          <button
            className={button}
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api("/guest-service/settings", {
                  revision: policyRevision,
                  settings,
                });
                await refresh();
                setEdit(false);
              })
            }
          >
            Save service policy
          </button>
        </section>
      )}
      {sync?.events?.some((e: any) => e.status === "review_required") && (
        <section className={box}>
          <h3 className="text-amber-200">Booking updates need review</h3>
          {sync.events
            .filter((e: any) => e.status === "review_required")
            .map((e: any) => (
              <div key={e.event_id}>
                <p>
                  {e.source} · {new Date(e.received_at).toLocaleString()}
                </p>
                {e.details.errors.map((x: any, i: number) => (
                  <p key={i}>{x.message}</p>
                ))}
              </div>
            ))}
        </section>
      )}
    </div>
  );
}
