import { EvidenceView } from "../management-controls/EvidenceView";
import React, { useState } from "react";
export function ConnectedEvidenceCenter({
  api,
  gm = false,
}: {
  api?: (path: string, body?: unknown) => Promise<any>;
  gm?: boolean;
}) {
  const [ownerPreview, setOwnerPreview] = useState<any>(null);
  const [evidence, setEvidence] = useState<any>(null);
  const [tab, setTab] = useState("Reconciliation"),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState(""),
    [connections, setConnections] = useState<any[]>([]),
    [bookings, setBookings] = useState<any[]>([]);
  const [documentId, setDocumentId] = useState(""),
    [bookingIndex, setBookingIndex] = useState(""),
    [purpose, setPurpose] = useState("invoice"),
    [note, setNote] = useState("");
  const [topic, setTopic] = useState("tomorrow_operations"),
    [email, setEmail] = useState(""),
    [unitId, setUnitId] = useState(""),
    [units, setUnits] = useState<any[]>([]),
    [date, setDate] = useState(""),
    [period, setPeriod] = useState("MONTHLY");
  const button = "rounded bg-sky-700 px-3 py-2 disabled:opacity-40",
    input = "bg-slate-950 border border-slate-600 p-2 rounded w-full";
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function load() {
    if (!api) return;
    setData(null);
    if (tab === "Reconciliation") {
      const [a, w] = await Promise.all([api("/accounting"), api("/workspace")]);
      setConnections(a.connections || []);
      setBookings(w.data.reservations);
    } else if (tab === "Owners") {
      const [a, w] = await Promise.all([
        api("/connected-evidence/owners"),
        api("/workspace"),
      ]);
      setData(a);
      setUnits(w.data.apartments);
    } else if (tab === "Connections")
      setData(await api("/connected-evidence/connections"));
  }
  return (
    <section className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Connected records and evidence</h2>
      <p>
        Read-only sources and human review. Native PMS and live Odoo are not
        connected.
      </p>
      {!api && (
        <p>
          SYNTHETIC DEMONSTRATION — this workspace requires authenticated
          company records. No simulated financial results are presented here.
        </p>
      )}
      <nav className="flex flex-wrap gap-2">
        {[
          "Reconciliation",
          ...(gm ? ["Connections", "Management questions", "Owners"] : []),
        ].map((t) => (
          <button
            className={button}
            key={t}
            onClick={() => {
              setTab(t);
              setData(null);
              setEvidence(null);
            }}
          >
            {t}
          </button>
        ))}
        <button
          className={button}
          disabled={!api || busy}
          onClick={() => run(load)}
        >
          Load {tab.toLowerCase()} sources
        </button>
      </nav>
      {error && <p role="alert">{error}</p>}
      {tab === "Connections" && data && (
        <>
          <p>{data.pms.message}</p>
          <p>{data.odoo.message}</p>
          <p>
            Recent normalized intake events: {data.pms.events.length}. These are
            not proof of a verified native connection.
          </p>
        </>
      )}
      {tab === "Reconciliation" && (
        <div className="space-y-3">
          <p>
            Load sources, then choose an accounting connection. Links allocate
            one whole document to one booking. Split invoices and shared
            settlements require later Finance-approved allocation rules.
          </p>
          <label>
            Accounting connection
            <select
              aria-label="Reconciliation accounting connection"
              className={input}
              value={connection}
              onChange={(e) => {
                setConnection(e.target.value);
                setData(null);
              }}
            >
              <option value="">Select connection</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.config.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className={button}
            disabled={!api || busy || !connection}
            onClick={() =>
              run(async () =>
                setData(
                  await api!(
                    "/connected-evidence/reconciliation/" + connection,
                  ),
                ),
              )
            }
          >
            Review differences
          </button>
          {data?.rows && (
            <>
              <p>{data.limitations}</p>
              <p>
                Source workspace revision {data.revision} · Loaded {data.asOf}
              </p>
              {data.rows.map((r: any) => (
                <article
                  className="border border-slate-700 p-3"
                  key={JSON.stringify([r.source, r.externalId])}
                >
                  <h3>
                    Booking {r.externalId} · {r.source} · {r.status}
                  </h3>
                  <p>
                    Room estimate AED {r.expectedRoomAED.toFixed(2)} · Invoices
                    AED {r.invoicedAED.toFixed(2)} · Credit notes AED{" "}
                    {r.creditNotesAED.toFixed(2)} · Commission AED{" "}
                    {r.commissionAED.toFixed(2)} · Payments AED{" "}
                    {r.paymentsAED.toFixed(2)}
                  </p>
                  <p>
                    Gross difference AED {r.grossDifferenceAED.toFixed(2)} ·
                    Payment comparison difference AED{" "}
                    {r.settlementDifferenceAED.toFixed(2)} · Review required
                  </p>
                  {r.issues.map((x: string, i: number) => (
                    <p key={i}>{x}</p>
                  ))}
                  {r.evidence.map((e: any) => (
                    <p key={e.documentId}>
                      Source {e.number} · {e.status} · {e.updatedAt} · {e.note}{" "}
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            const reason = window.prompt(
                              "Explain why this accounting link should be removed (at least ten characters).",
                            );
                            if (!reason) return;
                            await api!(
                              "/connected-evidence/reconciliation/unlink",
                              {
                                connectionId: connection,
                                documentId: e.documentId,
                                reason,
                              },
                            );
                            setData(
                              await api!(
                                "/connected-evidence/reconciliation/" +
                                  connection,
                              ),
                            );
                          })
                        }
                      >
                        Remove link
                      </button>
                    </p>
                  ))}
                </article>
              ))}
              <h3>Unallocated documents ({data.unlinkedDocuments.length})</h3>
              <label>
                Accounting document
                <select
                  className={input}
                  value={documentId}
                  onChange={(e) => setDocumentId(e.target.value)}
                >
                  <option value="">Select document</option>
                  {data.unlinkedDocuments.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.number} · {d.type} · {d.status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Booking
                <select
                  className={input}
                  value={bookingIndex}
                  onChange={(e) => setBookingIndex(e.target.value)}
                >
                  <option value="">Select booking</option>
                  {bookings.map((b: any, i: number) => (
                    <option
                      key={JSON.stringify([b.source, b.externalId])}
                      value={i}
                    >
                      {b.externalId} · {b.source}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Purpose
                <select
                  className={input}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                >
                  {["invoice", "refund", "commission", "settlement"].map(
                    (p) => (
                      <option key={p}>{p}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Finance evidence and scope
                <textarea
                  className={input}
                  maxLength={1500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <button
                className={button}
                disabled={
                  busy ||
                  !documentId ||
                  bookingIndex === "" ||
                  note.trim().length < 10
                }
                onClick={() =>
                  run(async () => {
                    const b = bookings[Number(bookingIndex)];
                    await api!("/connected-evidence/reconciliation/link", {
                      connectionId: connection,
                      documentId,
                      reservationSource: b.source,
                      reservationExternalId: b.externalId,
                      purpose,
                      evidenceNote: note,
                    });
                    setData(
                      await api!(
                        "/connected-evidence/reconciliation/" + connection,
                      ),
                    );
                    setDocumentId("");
                    setNote("");
                  })
                }
              >
                Save Finance-reviewed link
              </button>
              {data.orphanLinks.length > 0 && (
                <p role="alert">
                  {data.orphanLinks.length} links refer to missing bookings. Ask
                  Finance to inspect the retained source history.
                </p>
              )}
            </>
          )}
        </div>
      )}
      {tab === "Management questions" && (
        <div className="space-y-3">
          <p>
            Choose a supported question. Answers quote recorded facts and their
            versions; they do not predict missing information or use an
            ungrounded language model.
          </p>
          <select
            aria-label="Management question"
            className={input}
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              setData(null);
            }}
          >
            <option value="tomorrow_operations">
              What is recorded for tomorrow's operations?
            </option>
            <option value="compliance">
              Which apartments have readiness reviews?
            </option>
            <option value="finance">
              Which posted accounting documents are recorded?
            </option>
          </select>
          {topic === "finance" && (
            <>
              <button
                className={button}
                disabled={!api || busy}
                onClick={() =>
                  run(async () => {
                    const a = await api!("/accounting");
                    setConnections(a.connections || []);
                  })
                }
              >
                Load accounting connections
              </button>
              <select
                className={input}
                value={connection}
                onChange={(e) => setConnection(e.target.value)}
              >
                <option value="">Select accounting connection</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.config.label}
                  </option>
                ))}
              </select>
            </>
          )}
          <button
            className={button}
            disabled={!api || busy || (topic === "finance" && !connection)}
            onClick={() =>
              run(async () =>
                setData(
                  await api!("/connected-evidence/questions", {
                    topic,
                    ...(topic === "finance"
                      ? { connectionId: connection }
                      : {}),
                  }),
                ),
              )
            }
          >
            Answer from source records
          </button>
          {data?.facts && (
            <>
              <p>
                Captured {data.generatedAt} · Workspace revision{" "}
                {data.workspaceRevision}
              </p>
              {data.facts.map((f: any, i: number) => (
                <article key={i} className="border border-slate-700 p-3">
                  <p>{f.text}</p>
                  {f.references.map((r: any) => (
                    <p key={r.id}>
                      Evidence: {r.kind} · {r.id} · version {r.version}{" "}
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() =>
                          run(async () =>
                            setEvidence(
                              await api!("/connected-evidence/evidence", {
                                kind: r.kind,
                                id: r.id,
                                ...(r.kind === "accounting"
                                  ? { connectionId: connection }
                                  : {}),
                              }),
                            ),
                          )
                        }
                      >
                        Inspect source
                      </button>
                    </p>
                  ))}
                </article>
              ))}
              {data.limitations.map((l: string) => (
                <p key={l}>{l}</p>
              ))}
              {evidence && (
                <article className="border border-sky-600 p-3">
                  <h3>
                    Current source version — compare with the answer's captured
                    version
                  </h3>
                  <EvidenceView
                    value={evidence}
                    members={[]}
                    apartments={units}
                  />
                </article>
              )}
            </>
          )}
        </div>
      )}
      {tab === "Owners" && (
        <div className="space-y-3">
          <p>
            Owners require a separate administrator-provisioned identity,
            verified email and MFA. They do not consume a team seat. Share the
            app URL ending in #owner after access is granted. Revocation blocks
            future reads; it cannot recall copies already saved.
          </p>
          <label>
            Owner email
            <input
              className={input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Apartment
            <select
              className={input}
              aria-label="Owner apartment"
              value={unitId}
              onChange={(e) => {
                setUnitId(e.target.value);
                setOwnerPreview(null);
              }}
            >
              <option value="">Select apartment</option>
              {units.map((u) => (
                <option value={u.id} key={u.id}>
                  {u.unitNumber}
                </option>
              ))}
            </select>
          </label>
          <button
            className={button}
            disabled={!api || busy || !email || !unitId}
            onClick={() =>
              run(async () => {
                await api!("/connected-evidence/owners/grant", {
                  email,
                  unitId,
                });
                await load();
              })
            }
          >
            Grant owner access
          </button>
          {data?.grants?.map((g: any) => (
            <p key={g.owner_email + g.unit_id}>
              {g.owner_email} ·{" "}
              {units.find((u) => u.id === g.unit_id)?.unitNumber || g.unit_id}{" "}
              <button
                className={button}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api!("/connected-evidence/owners/revoke", {
                      email: g.owner_email,
                      unitId: g.unit_id,
                    });
                    await load();
                  })
                }
              >
                Revoke access
              </button>
            </p>
          ))}
          <h3>Approve an apartment summary for authorized owners</h3>
          <p>
            Approval releases only room-revenue estimates, recorded commission,
            nights and previous-period comparison. This is not a reconciled
            financial statement.
          </p>
          <label>
            Report date
            <input
              className={input}
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setOwnerPreview(null);
              }}
            />
          </label>
          <select
            aria-label="Owner report period"
            className={input}
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              setOwnerPreview(null);
            }}
          >
            {["DAILY", "WEEKLY", "MONTHLY"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <button
            className={button}
            disabled={!api || busy || !unitId || !date}
            onClick={() =>
              run(async () =>
                setOwnerPreview(
                  await api!("/connected-evidence/owners/preview", {
                    unitId,
                    type: period,
                    date,
                  }),
                ),
              )
            }
          >
            Preview owner summary
          </button>
          {ownerPreview && (
            <article className="bg-white text-slate-900 p-4">
              <p>
                Apartment {ownerPreview.unitNumber} ·{" "}
                {ownerPreview.period.start}–{ownerPreview.period.end} · Source
                revision {ownerPreview.revision}
              </p>
              <p>
                Room revenue estimate AED{" "}
                {ownerPreview.current.roomRevenue.toFixed(2)} · Recorded
                commission AED {ownerPreview.current.commission.toFixed(2)} ·
                After commission AED{" "}
                {ownerPreview.current.afterCommission.toFixed(2)} · Occupied
                nights {ownerPreview.current.occupiedNights}
              </p>
              <p>
                Previous period room revenue AED{" "}
                {ownerPreview.prior.roomRevenue.toFixed(2)}
              </p>
              <p>{ownerPreview.limitations}</p>
            </article>
          )}
          <button
            className={button}
            disabled={!api || busy || !ownerPreview}
            onClick={() =>
              run(async () => {
                if (
                  !window.confirm(
                    "Approve and release this apartment summary to all currently authorized owners of this apartment?",
                  )
                )
                  return;
                await api!("/connected-evidence/owners/release", {
                  unitId,
                  type: period,
                  date,
                  expectedRevision: ownerPreview.revision,
                  confirm: true,
                });
                setOwnerPreview(null);
                await load();
              })
            }
          >
            Approve and release summary
          </button>
          {data?.releases?.map((r: any) => (
            <article key={r.id} className="border border-slate-700 p-3">
              <p>
                {r.snapshot.unitNumber} · {r.snapshot.period.start}–
                {r.snapshot.period.end} ·{" "}
                {r.withdrawn ? "Withdrawn" : "Approved"}
              </p>
              <p>
                Room revenue estimate AED{" "}
                {r.snapshot.current.roomRevenue.toFixed(2)} ·{" "}
                {r.snapshot.limitations}
              </p>
              {!r.withdrawn && (
                <button
                  className={button}
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api!("/connected-evidence/owners/withdraw", {
                        id: r.id,
                      });
                      await load();
                    })
                  }
                >
                  Withdraw summary
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
