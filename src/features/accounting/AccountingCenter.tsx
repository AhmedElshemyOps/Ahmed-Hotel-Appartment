import { Field } from "../../shared/components/Field";
import React, { useEffect, useState, useRef } from "react";
import type { Apartment } from "../../shared/types";
import type { AccountingConnection, DimensionMapping } from "./model";
import { financialAnalysis } from "./engine";
import { accountingDemo } from "./demo";
const box = "rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3",
  input = "w-full rounded border border-slate-600 bg-slate-950 p-2",
  button = "rounded bg-sky-700 px-3 py-2 hover:bg-sky-600 disabled:opacity-40";
const template =
  "externalId,companyId,type,number,postingDate,currency,status,sourceUpdatedAt,partnerName,total,outstanding,externalLineId,accountCode,accountClass,dimensionKey,debit,credit,description\n";
function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label>
      {label}
      <select
        aria-label={label}
        className={input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option value={o.value} key={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
const options = (values: string[]) =>
  values.map((v) => ({ label: v, value: v }));
export function AccountingCenter({
  api,
  apartments = [],
  role = "General Manager",
}: {
  api?: (path: string, body?: unknown) => Promise<any>;
  apartments?: Apartment[];
  role?: string;
}) {
  const [connections, setConnections] = useState<any[]>([]),
    [id, setId] = useState(""),
    [ledger, setLedger] = useState<any>(null),
    [start, setStart] = useState("2026-09-01"),
    [end, setEnd] = useState("2026-09-30"),
    [tab, setTab] = useState("Financial intelligence"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<any>(null),
    [csv, setCsv] = useState(""),
    [fileName, setFileName] = useState(""),
    [coverage, setCoverage] = useState("partial"),
    [confirmed, setConfirmed] = useState(false),
    [maps, setMaps] = useState<DimensionMapping[]>([]);
  const [cfg, setCfg] = useState<AccountingConnection>({
    label: "",
    provider: "odoo",
    hosting: "unknown",
    version: "",
    protocol: "unknown",
    endpoint: "",
    companyId: "",
    credentialSecretRef: "",
    discoveryNotes: "",
  });
  const requestVersion = useRef(0);
  const gm = role === "General Manager";
  async function loadConnections() {
    if (api) {
      const r = await api("/accounting");
      setConnections(r.connections);
      if (!id && r.connections[0]) setId(r.connections[0].id);
    } else {
      setConnections([
        {
          id: "synthetic",
          config: {
            label: "SYNTHETIC accounting demonstration",
            companyId: "SYNTHETIC-ONLY",
          },
          status: "disconnected",
        },
      ]);
      setId("synthetic");
    }
  }
  async function loadLedger() {
    const request = ++requestVersion.current;
    setPreview(null);
    setConfirmed(false);
    if (!id) return;
    if (api) {
      const r = await api(
        "/accounting/" +
          encodeURIComponent(id) +
          "?start=" +
          start +
          "&end=" +
          end,
      );
      if (request !== requestVersion.current) return;
      setLedger(r);
      setMaps(r.mappings);
    } else {
      const d = accountingDemo(apartments);
      const r = {
        ...d,
        status: "disconnected",
        analysis: financialAnalysis(d.documents, d.mappings, start, end),
        latestImport: null,
        logs: [
          {
            operation: "demo",
            status: "simulated",
            message:
              "Synthetic accounting fixtures. No Odoo account is connected.",
          },
        ],
      };
      if (request !== requestVersion.current) return;
      setLedger(r);
      setMaps(r.mappings);
    }
  }
  useEffect(() => {
    loadConnections().catch((e) => setError(e.message));
  }, [api]);
  useEffect(() => {
    setLedger(null);
    setPreview(null);
    loadLedger().catch((e) => setError(e.message));
  }, [id, start, end, api]);
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
  const selected = connections.find((c) => c.id === id),
    a = ledger?.analysis;
  return (
    <section className="space-y-4 p-4 text-slate-100">
      <h1 className="text-2xl font-bold">
        Odoo Accounting & Financial Intelligence
      </h1>
      <p className={box}>
        {api
          ? "Odoo disconnected — reviewed CSV accounting works independently."
          : "SYNTHETIC ACCOUNTING DEMONSTRATION — no real transactions or financial results."}{" "}
        No accounting write operations or live connection are enabled. API
        access, hosting, version and company permissions remain unverified.
      </p>
      {error && (
        <p role="alert" className="bg-red-950 p-3">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <nav className="flex flex-wrap gap-2">
        {[
          "Financial intelligence",
          "Invoices",
          "Supplier bills",
          "Payments",
          "Expenses",
          "Reconciliation",
          "Apartment mappings",
          "CSV import",
          "Connection setup",
          "Sync logs",
        ].map((t) => (
          <button
            key={t}
            className={button + (tab === t ? " ring-2 ring-sky-300" : "")}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      <div className="grid gap-3 md:grid-cols-3">
        <Select
          label="Accounting source"
          value={id}
          options={[
            { value: "", label: "Select a source" },
            ...connections.map((c) => ({ value: c.id, label: c.config.label })),
          ]}
          onChange={setId}
        />
        <Field
          label="Accounting period start"
          value={start}
          type="date"
          onChange={setStart}
        />
        <Field
          label="Accounting period end"
          value={end}
          type="date"
          onChange={setEnd}
        />
      </div>
      {!id && (
        <p>
          Create a disconnected source in Connection setup, then import an
          authorized accounting export.
        </p>
      )}
      {tab === "Connection setup" && (
        <div className={box}>
          <h2>Server-side connection configuration</h2>
          <p>
            No API request will be sent. Store credentials in the company secret
            manager; enter only its resource reference here. Do not enter
            passwords, API keys, bank details or guest identity documents in
            notes.
          </p>
          {gm && (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                {(
                  [
                    "label",
                    "companyId",
                    "endpoint",
                    "version",
                    "credentialSecretRef",
                    "discoveryNotes",
                  ] as const
                ).map((k) => (
                  <Field
                    key={k}
                    label={
                      {
                        label: "Source label",
                        companyId: "External accounting company ID",
                        endpoint: "Odoo HTTPS base URL (optional)",
                        version: "Verified Odoo version (optional)",
                        credentialSecretRef:
                          "Secret Manager reference (optional)",
                        discoveryNotes: "Discovery notes",
                      }[k]
                    }
                    value={cfg[k]}
                    onChange={(v) => setCfg((c) => ({ ...c, [k]: v }))}
                  />
                ))}
                <Select
                  label="Source provider"
                  value={cfg.provider}
                  options={options(["odoo", "csv"])}
                  onChange={(v) =>
                    setCfg((c) => ({ ...c, provider: v as any }))
                  }
                />
                <Select
                  label="Odoo hosting"
                  value={cfg.hosting}
                  options={options([
                    "unknown",
                    "online",
                    "odoo-sh",
                    "self-hosted",
                  ])}
                  onChange={(v) => setCfg((c) => ({ ...c, hosting: v as any }))}
                />
                <Select
                  label="API protocol after discovery"
                  value={cfg.protocol}
                  options={options(["unknown", "json2", "jsonrpc", "xmlrpc"])}
                  onChange={(v) =>
                    setCfg((c) => ({ ...c, protocol: v as any }))
                  }
                />
              </div>
              <button
                className={button}
                disabled={busy || !api}
                onClick={() =>
                  run(async () => {
                    if (api) {
                      const r = await api("/accounting/connections", {
                        config: cfg,
                      });
                      await loadConnections();
                      setId(r.id);
                      setMessage(
                        "Configuration saved on the server. Odoo remains disconnected.",
                      );
                    }
                  })
                }
              >
                Save disconnected source
              </button>
            </>
          )}
          {selected && (
            <p>
              Selected source: {selected.config.label} · Company:{" "}
              {selected.config.companyId} · Status: disconnected · Read only
            </p>
          )}
          <h3>Required before live operation</h3>
          <ul>
            {[
              "Authorized company administrator approval",
              "Hosting, version, subscription and API entitlement discovery",
              "Dedicated read-only credentials and company accounting permissions",
              "Model/field discovery, account classifications and analytic allocation",
              "Authorized connection tests and reconciliation against company statements",
            ].map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
          <button
            className={button}
            disabled={busy || !id || !gm}
            onClick={() =>
              run(async () => {
                if (api) {
                  const r = await api("/accounting/" + id + "/sync", {});
                  setMessage(r.message);
                  await loadLedger();
                } else
                  setMessage(
                    "Live Odoo connection is disabled in the synthetic demonstration.",
                  );
              })
            }
          >
            Check synchronization readiness
          </button>
        </div>
      )}
      {a && tab === "Financial intelligence" && (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["Recognized revenue", a.revenueAED],
              ["Recognized expenses", a.expenseAED],
              ["Imported contribution", a.contributionAED],
              ["Receivable outstanding", a.receivableOutstandingAED],
            ].map(([label, value]) => (
              <div className={box} key={label}>
                <p>{label}</p>
                <strong>
                  AED{" "}
                  {Number(value).toLocaleString("en-AE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>
              </div>
            ))}
          </div>
          <div className={box}>
            <h2>Evidence-based financial analysis</h2>
            <p>
              Deterministic analysis of posted, balanced imported records. No
              live Odoo model or independent verification is implied.
            </p>
            {a.insights.map((v: any, i: number) => (
              <div key={i}>
                <p>{v.finding}</p>
                <details>
                  <summary>
                    Source document references ({v.evidence.length})
                  </summary>
                  <p className="break-words">
                    {v.evidence.join(", ") || "No accepted source records"}
                  </p>
                </details>
              </div>
            ))}
            {a.limitations.map((v: string) => (
              <p key={v}>{v}</p>
            ))}
          </div>
          <div className={box}>
            <h2>Apartment and building contribution</h2>
            <p>
              Shared building costs are shown separately and have not been
              allocated to apartments.
            </p>
            {a.profitability.map((r: any) => (
              <article key={r.key} className="border-t border-slate-700 py-2">
                <strong>
                  {apartments.find((u) => u.id === r.unitId)?.unitNumber ??
                    r.unitId ??
                    (r.building || "Unallocated")}
                </strong>
                <p>
                  Revenue AED {r.revenueAED.toFixed(2)} · Expenses AED{" "}
                  {r.expenseAED.toFixed(2)} · Contribution AED{" "}
                  {r.contributionAED.toFixed(2)}
                </p>
                <p>
                  {r.building} · Source lines: {r.lineIds.join(", ")}
                </p>
              </article>
            ))}
          </div>
        </>
      )}
      {ledger &&
        ["Invoices", "Supplier bills", "Payments", "Expenses"].includes(
          tab,
        ) && (
          <div className={box}>
            <h2>{tab} · source records</h2>
            <p>
              Figures are imported document totals, not independently
              bank-reconciled amounts. Draft and cancelled records remain
              visible but do not contribute to financial analysis.
            </p>
            {ledger.documents
              .filter((d: any) =>
                (tab === "Invoices"
                  ? ["invoice", "credit_note"]
                  : tab === "Supplier bills"
                    ? ["supplier_bill", "supplier_credit"]
                    : tab === "Payments"
                      ? ["payment"]
                      : ["expense"]
                ).includes(d.type),
              )
              .map((d: any) => (
                <details key={d.externalId} className={box}>
                  <summary>
                    {d.number} · {d.type} · {d.status} · AED{" "}
                    {d.total.toFixed(2)}
                  </summary>
                  <p>
                    {d.postingDate} · {d.partnerName} · Outstanding AED{" "}
                    {d.outstanding.toFixed(2)}
                  </p>
                  <p>
                    Source record {d.externalId} · Updated {d.sourceUpdatedAt}
                  </p>
                  {d.lines.map((l: any) => (
                    <p key={l.externalLineId}>
                      {l.externalLineId} · Account {l.accountCode} (
                      {l.accountClass}) · Dr {l.debit} · Cr {l.credit} ·
                      Dimension {l.dimensionKey || "unallocated"}
                    </p>
                  ))}
                </details>
              ))}
          </div>
        )}
      {a && tab === "Reconciliation" && (
        <div className={box}>
          <h2>Import reconciliation</h2>
          <p>
            Accepted posted balanced documents: {a.recognisedDocuments}.
            Excluded: {a.excludedDocuments}.
          </p>
          <p>
            Payment document totals: AED {a.paymentDocumentTotalsAED.toFixed(2)}
            . These amounts are not added to revenue.
          </p>
          <p>
            Latest accepted file:{" "}
            {ledger.latestImport?.file_name ||
              "None — demonstration or empty ledger"}{" "}
            · Coverage: {ledger.latestImport?.coverage || "Not established"}
          </p>
          <p>
            Partial exports and internally declared period exports do not prove
            complete company accounts or bank reconciliation.
          </p>
          {a.exceptions.map((e: any) => (
            <p key={e.documentId}>
              {e.number}: {e.reason} · Debit/credit difference AED{" "}
              {e.deltaAED.toFixed(2)} · Evidence {e.documentId}
            </p>
          ))}
        </div>
      )}
      {ledger && tab === "Apartment mappings" && (
        <div className={box}>
          <h2>Accounting dimension mappings</h2>
          <p>
            Map the external analytic/property key to a real apartment or an
            identified building. Unallocated lines remain visible. Shared costs
            are not silently spread across units.
          </p>
          {maps.map((m, i) => (
            <fieldset key={i} className="grid gap-2 md:grid-cols-3">
              <Field
                label={"Dimension key " + (i + 1)}
                value={m.dimensionKey}
                onChange={(v) =>
                  setMaps((s) =>
                    s.map((p, j) => (j === i ? { ...p, dimensionKey: v } : p)),
                  )
                }
              />
              <Select
                label={"Apartment mapping " + (i + 1)}
                value={m.unitId || ""}
                options={[
                  { value: "", label: "Building only" },
                  ...apartments.map((u) => ({
                    value: u.id,
                    label: u.unitNumber + " · " + u.type,
                  })),
                ]}
                onChange={(v) =>
                  setMaps((s) =>
                    s.map((p, j) =>
                      j === i ? { ...p, unitId: v || null } : p,
                    ),
                  )
                }
              />
              <Field
                label={"Building name " + (i + 1)}
                value={m.building}
                onChange={(v) =>
                  setMaps((s) =>
                    s.map((p, j) => (j === i ? { ...p, building: v } : p)),
                  )
                }
              />
            </fieldset>
          ))}
          <button
            className={button}
            onClick={() =>
              setMaps((s) => [
                ...s,
                {
                  dimensionKey: "",
                  unitId: null,
                  building: "",
                  reviewedBy: "",
                },
              ])
            }
          >
            Add dimension mapping
          </button>{" "}
          <button
            className={button}
            disabled={busy || !api}
            onClick={() =>
              run(async () => {
                if (api) {
                  await api("/accounting/" + id + "/mappings", {
                    mappings: maps.map(({ reviewedBy, ...m }) => m),
                  });
                  await loadLedger();
                  setMessage("Mappings saved and profitability recalculated.");
                }
              })
            }
          >
            Save accounting mappings
          </button>
        </div>
      )}
      {tab === "CSV import" && (
        <div className={box}>
          <h2>Reviewed accounting journal import</h2>
          <p>
            Use one row per journal line. Repeat identical document metadata on
            every line. Stable document and ledger-line IDs prevent duplicates.
            AED only; exact two-decimal nonnegative debit/credit amounts. Tax
            and balance-sheet lines use the balance classification. Omitted
            documents are not deleted.
          </p>
          <button
            className={button}
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([template], { type: "text/csv" }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = "accounting-journal-headers.csv";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Download blank CSV template
          </button>
          <label className="block">
            Accounting CSV file
            <input
              aria-label="Accounting CSV file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) =>
                run(async () => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 1500000)
                    throw Error("CSV must not exceed 1.5 MB.");
                  setCsv(await f.text());
                  setFileName(f.name);
                  setPreview(null);
                  setConfirmed(false);
                })
              }
            />
          </label>
          <Select
            label="Declared export coverage"
            value={coverage}
            options={options(["partial", "period-export"])}
            onChange={setCoverage}
          />
          <button
            className={button}
            disabled={busy || !api || !id || !csv}
            onClick={() =>
              run(async () => {
                if (api) {
                  const r = await api(
                    "/accounting/" + id + "/imports/preview",
                    {
                      csv,
                      fileName,
                      periodStart: start,
                      periodEnd: end,
                      coverage,
                    },
                  );
                  if (r.status === "invalid") throw Error(r.error);
                  setPreview(r);
                  setConfirmed(false);
                }
              })
            }
          >
            Preview accounting import
          </button>
          {preview && (
            <>
              <h3>Review every source record before accepting</h3>
              <p>
                {preview.packet.documents.length} documents · Company{" "}
                {preview.packet.companyId} · {preview.packet.periodStart} to{" "}
                {preview.packet.periodEnd}
              </p>
              {preview.packet.documents.map((d: any) => (
                <details key={d.externalId} className={box}>
                  <summary>
                    {d.externalId} · {d.type} · {d.status} · {d.currency}{" "}
                    {d.total}
                  </summary>
                  <pre className="overflow-auto whitespace-pre-wrap">
                    {JSON.stringify(d, null, 2)}
                  </pre>
                </details>
              ))}
              <p>
                Excluded from profitability:{" "}
                {preview.analysis.excludedDocuments}. Unbalanced and draft
                records remain exceptions.
              </p>
              <label className="block">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{" "}
                I reviewed the company, period, account classifications and
                source records and am authorized to import them.
              </label>
              <button
                className={button}
                disabled={busy || !confirmed}
                onClick={() =>
                  run(async () => {
                    if (api) {
                      await api(
                        "/accounting/" +
                          id +
                          "/imports/" +
                          preview.id +
                          "/commit",
                        { reviewConfirmed: true },
                      );
                      await loadLedger();
                      setMessage(
                        "Reviewed source records accepted. No accounting system was modified.",
                      );
                    }
                  })
                }
              >
                Accept reviewed accounting import
              </button>
            </>
          )}
        </div>
      )}
      {ledger && tab === "Sync logs" && (
        <div className={box}>
          <h2>Synchronization and audit trail</h2>
          {ledger.logs.map((l: any, i: number) => (
            <article className="border-b border-slate-700 py-2" key={i}>
              <p>
                {l.created_at} · {l.operation} · {l.status}
              </p>
              <p>{l.message}</p>
              <pre className="whitespace-pre-wrap break-words">
                {JSON.stringify(l.details ?? {})}
              </pre>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
