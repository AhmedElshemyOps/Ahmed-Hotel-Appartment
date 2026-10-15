import React, { useEffect, useMemo, useState, useCallback } from "react";
import type { Apartment, UserRole } from "../../shared/types";
import type {
  MarketDataset,
  MarketQuery,
  PriceDecision,
  GeoProfile,
} from "./model";
import { addDays } from "./model";
import { marketDemo } from "./demo";
import {
  analyzeMarket,
  managementAnswer,
  scenario,
  approvedRoomRate,
} from "./engine";
import { businessDate } from "../guest-service/guestService";
import { MarketMap } from "./MarketMap";
import { RegistryEditor } from "./RegistryEditor";
import { marketReportHtml, downloadText } from "./report";
const box = "bg-slate-900 rounded-xl border border-slate-700 p-4 space-y-3";
const input = "w-full bg-slate-950 border border-slate-600 rounded p-2";
const button =
  "px-3 py-2 rounded bg-sky-700 hover:bg-sky-600 disabled:opacity-40";
const money = (n: number | null | undefined) =>
  n === null || n === undefined ? "Unavailable" : "AED " + n.toFixed(2);
type Api = (path: string, body?: unknown) => Promise<any>;
type Snapshot = {
  property: { id: string; name: string; revision: number };
  dataset: MarketDataset;
  registeredUnits: { id: string; unitNumber: string; type: string }[];
  recommendations: any[];
  jobs: any[];
  outcomes: any[];
};
export function MarketWorkspace({
  apartments,
  api,
  role = "General Manager",
}: {
  apartments?: Apartment[];
  api?: Api;
  role?: UserRole;
}) {
  const demo = useMemo(
    () => (apartments ? marketDemo(apartments) : null),
    [apartments],
  );
  const [properties, setProperties] = useState<{ id: string; name: string }[]>(
      [],
    ),
    [propertyId, setPropertyId] = useState(""),
    [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = async () => {
    if (api && propertyId)
      setSnapshot(await api("/market/properties/" + propertyId));
  };
  useEffect(() => {
    if (!api) return;
    let live = true;
    api("/market/properties")
      .then((r) => {
        if (live) {
          setProperties(r.properties);
          setPropertyId(r.properties[0]?.id || "");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [api]);
  useEffect(() => {
    if (!api || !propertyId) return;
    let live = true;
    setSnapshot(null);
    api("/market/properties/" + propertyId)
      .then((r) => {
        if (live) setSnapshot(r);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [propertyId, api]);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (demo) return <MarketDashboard dataset={demo} role="General Manager" />;
  return (
    <div className="p-6 space-y-4 text-slate-100">
      <header>
        <h2 className="text-2xl font-bold">
          Geographic Market & Revenue Intelligence
        </h2>
        <p className="text-sm text-slate-400">
          Real property registry · permitted evidence only · no live rate
          publishing
        </p>
      </header>
      {error && (
        <p role="alert" className="text-amber-200">
          {error}
        </p>
      )}
      <section className={box}>
        <label>
          Authorized market property
          <select
            className={input}
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
          >
            <option value="">Choose property</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {role === "General Manager" && (
          <form
            className="flex gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const result = await api!("/market/properties", { name });
                const list = await api!("/market/properties");
                setProperties(list.properties);
                setPropertyId(result.id);
                setName("");
              });
            }}
          >
            <input
              className={input}
              aria-label="New market property name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className={button} disabled={busy}>
              Create market property
            </button>
          </form>
        )}
        {!properties.length && (
          <p>
            No authorized properties are registered. The GM registers actual
            units and grants team access before market analysis.
          </p>
        )}
      </section>
      {snapshot && (
        <MarketDashboard
          key={snapshot.property.id}
          dataset={snapshot.dataset}
          role={role}
          snapshot={snapshot}
          api={api}
          reload={load}
        />
      )}
    </div>
  );
}
function MarketDashboard({
  dataset,
  role,
  snapshot,
  api,
  reload,
}: {
  dataset: MarketDataset;
  role: UserRole;
  snapshot?: Snapshot;
  api?: Api;
  reload?: () => Promise<void>;
}) {
  const [propertyId, setPropertyId] = useState(dataset.properties[0]?.id || ""),
    [unitId, setUnitId] = useState(
      dataset.profiles.find((p) => p.propertyId === dataset.properties[0]?.id)
        ?.unitId || "",
    );
  const [start, setStart] = useState(addDays(businessDate(), 1)),
    [days, setDays] = useState(7),
    [nights, setNights] = useState(1),
    [guests, setGuests] = useState(2),
    [radius, setRadius] = useState(2000),
    [scope, setScope] = useState<MarketQuery["scope"]>("community"),
    [cancel, setCancel] = useState<MarketQuery["cancellation"]>("flexible"),
    [context, setContext] = useState("public-web-AE-2-adults");
  const [decisions, setDecisions] = useState<PriceDecision[]>([]),
    [activeDate, setActiveDate] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("overview"),
    [point, setPoint] = useState<{
      latitude: number;
      longitude: number;
    } | null>(null);
  const [records, setRecords] = useState<any[]>([]),
    [question, setQuestion] = useState(
      "Which recommendations should I review?",
    ),
    [answer, setAnswer] = useState<any>(null),
    [percent, setPercent] = useState(8),
    [scenarioResult, setScenario] = useState<any>(null);
  const [reason, setReason] = useState(""),
    [override, setOverride] = useState(""),
    [reportType, setReportType] = useState("daily");
  const [outcome, setOutcome] = useState({
    id: "",
    from: businessDate(),
    to: businessDate(),
    revenue: "",
    nights: "",
    evidence: "",
    limitations: "",
  });
  const units = dataset.profiles.filter((p) => p.propertyId === propertyId),
    selected = units.find((p) => p.unitId === unitId) || units[0];
  const query: MarketQuery = {
    unitId: selected?.unitId || unitId,
    start,
    days,
    stayNights: nights,
    guests,
    radiusMeters: radius,
    scope,
    cancellation: cancel,
    quoteContext: context,
  };
  const base = "/market/properties/" + propertyId;
  const canWrite = role !== "Read-Only Viewer";
  const gm = role === "General Manager";
  const run = async (fn: () => Promise<unknown>) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const analyze = async () => {
    setDecisions([]);
    setAnswer(null);
    setScenario(null);
    const d = dataset.demo
      ? analyzeMarket(dataset, query)
      : (await api!(base + "/analyze", { query })).decisions;
    setDecisions(d);
    setActiveDate(d[0]?.date || "");
  };
  useEffect(() => {
    setDecisions([]);
    setAnswer(null);
    setScenario(null);
  }, [
    unitId,
    propertyId,
    start,
    days,
    nights,
    guests,
    radius,
    scope,
    cancel,
    context,
  ]);
  useEffect(() => {
    setDecisions([]);
    setAnswer(null);
    setScenario(null);
    if (dataset.demo) setRecords([]);
  }, [dataset.generatedAt]);
  const current = decisions.find((d) => d.date === activeDate) || decisions[0];
  const matches = current?.matches || [];
  const onPoint = useCallback(
    (latitude: number, longitude: number) => setPoint({ latitude, longitude }),
    [],
  );
  const allRecords = dataset.demo ? records : snapshot?.recommendations || [];
  const propertyName =
    dataset.properties.find((p) => p.id === propertyId)?.name ||
    snapshot?.property.name ||
    "Property";
  const currency = dataset.demo
    ? "SYNTHETIC DEMONSTRATION — no real market prices"
    : "CLOUD MARKET WORKSPACE — permitted evidence only";
  const approve = async (id: string, decision: string) => {
    if (reason.trim().length < 5)
      throw Error("Add a management reason of at least five characters.");
    if (dataset.demo) {
      const r = records.find((r) => r.id === id);
      if (!r || r.decision)
        throw Error("Create a new recommendation to revise a decision.");
      const policy = dataset.policies.find((p) => p.unitId === query.unitId);
      const rate =
        decision === "approved"
          ? approvedRoomRate(
              r.snapshot,
              policy!,
              override ? Number(override) : null,
            )
          : null;
      setRecords((old) =>
        old.map((r) =>
          r.id === id
            ? { ...r, decision, approved_rate: rate, decision_reason: reason }
            : r,
        ),
      );
    } else {
      await api!(base + "/recommendations/" + id + "/decision", {
        decision,
        reason,
        approvedRate: override ? Number(override) : null,
      });
      await reload!();
    }
    setOverride("");
    setReason("");
  };
  return (
    <div className="space-y-5 text-slate-100">
      <div className="p-4 bg-amber-950 border border-amber-700 rounded">
        <strong>{currency}</strong>
        <p className="text-sm">
          Asking prices are not realized revenue or competitor occupancy.
          Approval records an internal management decision; no price publishing
          connector exists.
        </p>
      </div>
      {dataset.demo && (
        <header className="px-6">
          <h2 className="text-2xl font-bold">
            Geographic Market & Revenue Intelligence
          </h2>
          <p>
            {dataset.profiles.length} synthetic apartments · Yas Island is an
            illustrative example; all coordinates, operators, offers and
            policies are fixtures.
          </p>
        </header>
      )}
      {error && (
        <p role="alert" className="p-4 text-amber-200">
          {error}
        </p>
      )}
      <section className={box + " mx-6"}>
        <div className="grid md:grid-cols-4 gap-3">
          {dataset.demo && (
            <label>
              Demo market
              <select
                className={input}
                value={propertyId}
                onChange={(e) => {
                  setPropertyId(e.target.value);
                  setUnitId(
                    dataset.profiles.find(
                      (p) => p.propertyId === e.target.value,
                    )?.unitId || "",
                  );
                }}
              >
                {dataset.properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Managed apartment
            <select
              className={input}
              value={selected?.unitId || ""}
              onChange={(e) => setUnitId(e.target.value)}
            >
              <option value="">Choose apartment</option>
              {units.map((p) => (
                <option key={p.unitId} value={p.unitId}>
                  {p.unitNumber} ·{" "}
                  {p.characteristics.bedrooms === 0
                    ? "Studio"
                    : p.characteristics.bedrooms + " bedrooms"}
                </option>
              ))}
            </select>
          </label>
          <label>
            First check-in date
            <input
              className={input}
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Check-in dates to analyze
            <select
              className={input}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {[7, 14, 30, 60, 90].map((n) => (
                <option key={n} value={n}>
                  Next {n} dates
                </option>
              ))}
            </select>
          </label>
          <label>
            Custom number of dates (1–90)
            <input
              className={input}
              type="number"
              min={1}
              max={90}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </label>
          <label>
            Nights per stay
            <input
              className={input}
              type="number"
              min={1}
              max={30}
              value={nights}
              onChange={(e) => setNights(Number(e.target.value))}
            />
          </label>
          <label>
            Guests
            <input
              className={input}
              type="number"
              min={1}
              max={50}
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
            />
          </label>
          <label>
            Geographic scope
            <select
              className={input}
              value={scope}
              onChange={(e) => setScope(e.target.value as any)}
            >
              {["building", "community", "district", "nearby", "city"].map(
                (s) => (
                  <option key={s}>{s}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Radius (meters)
            <input
              className={input}
              list="market-radii"
              type="number"
              min={100}
              max={50000}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
            />
            <datalist id="market-radii">
              {[500, 1000, 2000, 3000, 5000].map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </label>
          <label>
            Cancellation
            <select
              className={input}
              value={cancel}
              onChange={(e) => setCancel(e.target.value as any)}
            >
              <option value="flexible">Flexible</option>
              <option value="nonrefundable">Nonrefundable</option>
            </select>
          </label>
          <label>
            Quote context
            <input
              className={input}
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
          </label>
        </div>
        <p className="text-xs text-slate-400">
          City scope deliberately permits a wider search; other scopes also
          apply the radius and coordinate uncertainty. The engine never silently
          substitutes other bedroom types. Match the provider's exact
          guest/residency/platform context.
        </p>
        <button
          className={button}
          disabled={busy || !selected}
          onClick={() => run(analyze)}
        >
          Analyze market prices
        </button>
      </section>
      <nav className="flex flex-wrap gap-2 px-6">
        {[
          "overview",
          "map",
          "comparables",
          "calendar",
          "approvals",
          "assistant",
          "reports",
          ...(!dataset.demo && gm ? ["registry", "sources", "access"] : []),
        ].map((t) => (
          <button
            key={t}
            className={button + (tab === t ? " ring-2 ring-sky-300" : "")}
            onClick={() => setTab(t)}
          >
            {
              (
                {
                  overview: "Market overview",
                  map: "Geographic map",
                  comparables: "Comparable evidence",
                  calendar: "Forward pricing",
                  approvals: "Approval center",
                  assistant: "Management questions",
                  reports: "Reports",
                  registry: "Property registry",
                  sources: "Source permissions",
                  access: "Team property access",
                } as any
              )[t]
            }
          </button>
        ))}
      </nav>
      <div className="px-6 pb-6 space-y-4">
        {selected && (
          <p className="text-sm text-slate-400">
            Unit {selected.unitNumber} ·{" "}
            {selected.location.buildingName || "Building unavailable"} ·{" "}
            {selected.location.community}, {selected.location.city} · Location{" "}
            {selected.location.status}
            {selected.location.verifiedAt
              ? " · verified " + selected.location.verifiedAt.slice(0, 10)
              : ""}
          </p>
        )}
        {tab === "overview" && (
          <>
            <section className="grid md:grid-cols-4 gap-3">
              {[
                ["Managed units", units.length],
                [
                  "Comparable physical units",
                  current?.market.uniqueProperties ?? "Analyze first",
                ],
                [
                  "Source offers (latest/listing)",
                  current?.market.sourceOffers ?? "Analyze first",
                ],
                ["Market guest-night median", money(current?.market.median)],
                ["Mean guest-night price", money(current?.market.mean)],
                [
                  "P25–P75 range",
                  current
                    ? money(current.market.p25) +
                      " – " +
                      money(current.market.p75)
                    : "Unavailable",
                ],
                ["Our guest-night total", money(current?.ourGuestNight)],
                [
                  "Comparable-range position",
                  current?.position?.replaceAll("_", " ") || "Unavailable",
                ],
                ["Closest 3-unit median", money(current?.market.closestMedian)],
                [
                  "Our market percentile",
                  current?.market.ourPercentile !== null &&
                  current?.market.ourPercentile !== undefined
                    ? current.market.ourPercentile.toFixed(1) + "%"
                    : "Unavailable",
                ],
              ].map(([name, value]) => (
                <div className={box} key={String(name)}>
                  <p className="text-xs text-slate-400">{name}</p>
                  <p className="font-bold">{value}</p>
                </div>
              ))}
            </section>
            <section className={box}>
              <h3 className="font-bold">Market alerts and freshness</h3>
              {!decisions.length && (
                <p>
                  Analyze an apartment and future date range to see
                  evidence-backed results.
                </p>
              )}
              {current?.explanation.map((x, i) => (
                <p key={i}>{x}</p>
              ))}
              {current?.market.differenceMedian !== null &&
                current?.market.differenceMedian !== undefined && (
                  <p>
                    Our guest-facing nightly total is{" "}
                    {money(Math.abs(current.market.differenceMedian))}{" "}
                    {current.market.differenceMedian < 0 ? "below" : "above"}{" "}
                    the comparable median for this exact stay.
                  </p>
                )}
              <p>
                Newest observation:{" "}
                {current?.market.newestObservation || "Unavailable"} · Oldest
                current observation:{" "}
                {current?.market.oldestObservation || "Unavailable"}
              </p>
              <p>
                {
                  matches.filter((m) =>
                    m.reasons.includes("Observation is stale"),
                  ).length
                }{" "}
                stale observations excluded. Excluded or missing offers do not
                establish sold-out supply.
              </p>
              {current?.market.matchedTrend.length ? (
                current.market.matchedTrend.map((t) => (
                  <p key={t.listingId}>
                    Same-listing asking-price change:{" "}
                    {t.changePercent.toFixed(1)}% · {t.from} → {t.to} · same
                    dates and conditions
                  </p>
                ))
              ) : (
                <p>
                  No comparable same-listing price history establishes a trend.
                </p>
              )}
            </section>
          </>
        )}
        {tab === "map" &&
          selected &&
          (selected.location.latitude !== null ? (
            <MarketMap
              profiles={units}
              selected={selected}
              matches={matches}
              radius={radius}
              onPoint={!dataset.demo && gm ? onPoint : undefined}
            />
          ) : (
            <p>
              Register and verify coordinates before mapping this apartment.
            </p>
          ))}
        {tab === "comparables" && (
          <section className={box}>
            <h3 className="font-bold">
              Why each observation was included or excluded
            </h3>
            <p>
              Scores use provisional location, capacity/bathrooms, area,
              amenity, quality, review and reliability weights. Identity linking
              requires documented physical-unit evidence; the engine does not
              merge by similar photographs or names.
            </p>
            <div className="overflow-auto max-h-[600px]">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr>
                    {[
                      "Listing / operator",
                      "Platform / source",
                      "Distance",
                      "Price basis",
                      "Status / reasons",
                      "Score",
                      "Observed",
                    ].map((h) => (
                      <th className="p-2" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => (
                    <tr className="border-t border-slate-700" key={m.offer.id}>
                      <td className="p-2">
                        {m.competitor.title}
                        <br />
                        {m.competitor.operatorName || "Operator unavailable"}
                        {!dataset.demo && m.competitor.operatorEvidence && (
                          <a
                            className="underline block"
                            href={m.competitor.operatorEvidence}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Operator evidence
                          </a>
                        )}
                      </td>
                      <td className="p-2">
                        {m.competitor.platform}
                        <br />
                        {dataset.demo ? (
                          "Synthetic source"
                        ) : (
                          <a
                            className="underline text-sky-300"
                            href={m.offer.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Permitted observation source
                          </a>
                        )}
                        <br />
                        {m.offer.id}
                      </td>
                      <td className="p-2">
                        {m.distanceMeters === null
                          ? "Unavailable"
                          : Math.round(m.distanceMeters) + " m"}{" "}
                        · ±{m.competitor.location.accuracyMeters ?? "?"} m
                      </td>
                      <td className="p-2">
                        Stay total {money(m.offer.guestTotal)}
                        <br />
                        {m.offer.checkIn} → {m.offer.checkOut} ·{" "}
                        {m.offer.guests} guests · {m.offer.cancellation}
                      </td>
                      <td
                        className={
                          "p-2 " +
                          (m.included ? "text-emerald-300" : "text-amber-200")
                        }
                      >
                        {m.included ? "Included" : m.reasons.join("; ")}
                      </td>
                      <td className="p-2">{m.score}/100</td>
                      <td className="p-2">{m.offer.observedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!matches.length && (
              <p>
                No dated observations exist for the selected stay. No market
                prices are inferred.
              </p>
            )}
          </section>
        )}
        {tab === "calendar" && (
          <section className={box}>
            <h3 className="font-bold">
              Forward pricing calendar — room rates versus guest-facing
              benchmarks
            </h3>
            <div className="overflow-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr>
                    {[
                      "Check-in / checkout",
                      "Our room rate",
                      "Market guest-night median",
                      "Unique comps",
                      "Proposed room rate",
                      "Adjustment",
                      "Conditional net Δ/stay",
                      "Confidence / action",
                    ].map((h) => (
                      <th className="p-2" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {decisions.map((d) => (
                    <tr key={d.date} className="border-t border-slate-700">
                      <td className="p-2">
                        <button
                          className="underline"
                          onClick={() => {
                            setActiveDate(d.date);
                            setTab("comparables");
                          }}
                        >
                          {d.date} → {d.checkOut}
                        </button>
                      </td>
                      <td className="p-2">{money(d.currentRate)}</td>
                      <td className="p-2">{money(d.market.median)}</td>
                      <td className="p-2">{d.market.uniqueProperties}</td>
                      <td className="p-2">{money(d.recommendedRate)}</td>
                      <td className="p-2">
                        {d.adjustmentPercent === null
                          ? "Unavailable"
                          : d.adjustmentPercent + "%"}
                      </td>
                      <td className="p-2">{money(d.conditionalNetDelta)}</td>
                      <td className="p-2">
                        {d.confidence}
                        {canWrite && d.recommendedRate !== null && (
                          <button
                            className={button}
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                if (dataset.demo)
                                  setRecords((old) => [
                                    ...old,
                                    {
                                      id: crypto.randomUUID(),
                                      snapshot: d,
                                      decision: null,
                                    },
                                  ]);
                                else {
                                  await api!(base + "/recommendations", {
                                    query,
                                    date: d.date,
                                  });
                                  await reload!();
                                }
                                setTab("approvals");
                              })
                            }
                          >
                            Save for GM review
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400">
              Each row compares identical stay dates and conditions. Conditional
              net change assumes the same occupied nights and excludes demand
              response, taxes and financing effects. It is not a revenue
              forecast.
            </p>
          </section>
        )}
        {tab === "approvals" && (
          <section className={box}>
            <h3 className="font-bold">Pricing approval center</h3>
            <p>
              Approval is a management record only. No internal schedule or live
              rental price is changed. New evidence or policy/rate changes
              require fresh analysis. A GM override must remain within owner,
              cost and movement limits.
            </p>
            {allRecords.map((r) => (
              <div key={r.id} className="border-t border-slate-700 pt-3">
                <p>
                  {r.snapshot.date} · Proposed room rate{" "}
                  {money(r.snapshot.recommendedRate)} ·{" "}
                  {r.decision || "Pending management review"}
                </p>
                {r.decision_reason && <p>{r.decision_reason}</p>}
                {gm && !r.decision && (
                  <>
                    <label>
                      Management reason
                      <input
                        className={input}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </label>
                    <label>
                      Approved room-rate override (optional)
                      <input
                        className={input}
                        type="number"
                        value={override}
                        onChange={(e) => setOverride(e.target.value)}
                      />
                    </label>
                    <div className="flex gap-2 mt-2">
                      {["approved", "rejected", "revision_requested"].map(
                        (s) => (
                          <button
                            className={button}
                            disabled={busy}
                            key={s}
                            onClick={() =>
                              run(async () => {
                                if (
                                  s === "approved" &&
                                  !window.confirm(
                                    "Record this internal pricing approval? No channel price will be changed.",
                                  )
                                )
                                  return;
                                await approve(r.id, s);
                              })
                            }
                          >
                            {s === "approved"
                              ? "Approve internal proposal"
                              : s === "rejected"
                                ? "Reject"
                                : "Request revision"}
                          </button>
                        ),
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
            {!allRecords.length && (
              <p>
                Save an evidence-supported proposal from Forward pricing first.
              </p>
            )}
            {!dataset.demo && canWrite && (
              <section className={box}>
                <h4 className="font-bold">
                  Record a reconciled outcome for an approved proposal
                </h4>
                <p className="text-xs text-slate-400">
                  An observed result does not prove that the recommendation
                  caused it. Include source evidence and confounding factors.
                </p>
                <label>
                  Approved proposal
                  <select
                    className={input}
                    value={outcome.id}
                    onChange={(e) =>
                      setOutcome({ ...outcome, id: e.target.value })
                    }
                  >
                    <option value="">Choose approved proposal</option>
                    {allRecords
                      .filter((r) => r.decision === "approved")
                      .map((r) => (
                        <option value={r.id} key={r.id}>
                          {r.snapshot.date}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="grid md:grid-cols-3 gap-3">
                  {(["from", "to"] as const).map((f) => (
                    <label key={f}>
                      {f}
                      <input
                        className={input}
                        type="date"
                        value={outcome[f]}
                        onChange={(e) =>
                          setOutcome({ ...outcome, [f]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                  <label>
                    Recorded room revenue (AED or blank)
                    <input
                      className={input}
                      type="number"
                      value={outcome.revenue}
                      onChange={(e) =>
                        setOutcome({ ...outcome, revenue: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Recorded occupied nights (or blank)
                    <input
                      className={input}
                      type="number"
                      value={outcome.nights}
                      onChange={(e) =>
                        setOutcome({ ...outcome, nights: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Reconciliation evidence URL
                    <input
                      className={input}
                      value={outcome.evidence}
                      onChange={(e) =>
                        setOutcome({ ...outcome, evidence: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Limitations and other influences
                    <input
                      className={input}
                      value={outcome.limitations}
                      onChange={(e) =>
                        setOutcome({ ...outcome, limitations: e.target.value })
                      }
                    />
                  </label>
                </div>
                <button
                  className={button}
                  disabled={busy || !outcome.id}
                  onClick={() =>
                    run(async () => {
                      await api!(base + "/outcomes", {
                        recommendationId: outcome.id,
                        observedFrom: outcome.from,
                        observedTo: outcome.to,
                        actualRoomRevenue:
                          outcome.revenue === ""
                            ? null
                            : Number(outcome.revenue),
                        occupiedNights:
                          outcome.nights === "" ? null : Number(outcome.nights),
                        evidenceReference: outcome.evidence,
                        limitations: outcome.limitations,
                      });
                      await reload!();
                    })
                  }
                >
                  Append outcome observation
                </button>
                {snapshot?.outcomes.map((o) => (
                  <p key={o.id}>
                    {o.observed_from?.slice(0, 10)} →{" "}
                    {o.observed_to?.slice(0, 10)} · Recorded room revenue{" "}
                    {money(
                      o.actual_room_revenue === null
                        ? null
                        : Number(o.actual_room_revenue),
                    )}{" "}
                    · {o.limitations}
                  </p>
                ))}
              </section>
            )}
          </section>
        )}
        {tab === "assistant" && (
          <section className={box}>
            <h3 className="font-bold">Evidence-based management questions</h3>
            <p className="text-xs text-slate-400">
              Answers are deterministic summaries of the selected apartment and
              date range, not unrestricted AI web research.
            </p>
            <label>
              Management question
              <input
                className={input}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </label>
            <button
              className={button}
              disabled={busy || !decisions.length}
              onClick={() =>
                run(async () =>
                  setAnswer(
                    dataset.demo
                      ? managementAnswer(question, decisions)
                      : await api!(base + "/assistant", { question, query }),
                  ),
                )
              }
            >
              Answer using selected evidence
            </button>
            {answer && (
              <div className="whitespace-pre-wrap">
                <p>{answer.answer}</p>
                <p className="text-xs text-slate-400">
                  Evidence: {answer.evidenceIds.join(", ") || "None available"}
                </p>
                {answer.limitations.map((l: string) => (
                  <p key={l}>{l}</p>
                ))}
              </div>
            )}
            <h4 className="font-bold">Hypothetical rate scenario</h4>
            <label>
              Rate adjustment (%)
              <input
                className={input}
                type="number"
                value={percent}
                onChange={(e) => setPercent(Number(e.target.value))}
              />
            </label>
            <button
              className={button}
              disabled={busy || !current}
              onClick={() =>
                run(async () => {
                  if (!current) return;
                  const policy = dataset.policies.find(
                    (p) => p.unitId === query.unitId,
                  );
                  setScenario(
                    dataset.demo
                      ? scenario(
                          current,
                          percent,
                          nights,
                          policy?.commissionPercent || 0,
                        )
                      : await api!(base + "/scenario", {
                          query,
                          date: current.date,
                          percent,
                          nights,
                        }),
                  );
                })
              }
            >
              Calculate fixed-night scenario
            </button>
            {scenarioResult && (
              <p>
                Room revenue change: {money(scenarioResult.roomRevenueDelta)} ·
                Net change: {money(scenarioResult.netDelta)} ·{" "}
                {scenarioResult.limitation}
              </p>
            )}
          </section>
        )}
        {tab === "reports" && (
          <section className={box}>
            <h3 className="font-bold">Management and owner review report</h3>
            <label>
              Report format
              <select
                className={input}
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
              >
                <option value="daily">Daily revenue intelligence brief</option>
                <option value="weekly">Weekly competitive market report</option>
                <option value="monthly">
                  Monthly owner pricing review draft
                </option>
              </select>
            </label>
            <p>
              Produces a versioned review snapshot with prices, sources,
              limitations and calculation basis. Actual property profit,
              forecasts and owner sign-off are not invented. Open the downloaded
              HTML and print to PDF for sharing after approval and license
              review.
            </p>
            <button
              className={button}
              disabled={busy || !decisions.length}
              onClick={() =>
                run(async () => {
                  let d = decisions;
                  if (!dataset.demo) {
                    const snapshot = await api!(base + "/reports", {
                      query,
                      type: reportType,
                    });
                    d = snapshot.decisions;
                  }
                  downloadText(
                    "Ahmed-Quality-Ops-" + reportType + "-market-review.html",
                    marketReportHtml({
                      property: propertyName,
                      type: reportType,
                      query,
                      decisions: d,
                      demo: dataset.demo,
                      createdAt: new Date().toISOString(),
                    }),
                    "text/html",
                  );
                })
              }
            >
              Prepare report snapshot and download
            </button>
            {!dataset.demo && (
              <GoogleTools
                propertyId={propertyId}
                api={api!}
                run={run}
                busy={busy}
                records={allRecords}
              />
            )}
          </section>
        )}
        {tab === "registry" && !dataset.demo && gm && (
          <RegistryEditor
            key={snapshot!.property.revision + ":" + unitId}
            dataset={dataset}
            propertyId={propertyId}
            revision={snapshot!.property.revision}
            units={snapshot!.registeredUnits}
            api={api!}
            onSaved={reload!}
            run={run}
            busy={busy}
            selectedUnit={selected?.unitId || ""}
            point={point}
          />
        )}
        {tab === "sources" && !dataset.demo && gm && (
          <SourceTools
            dataset={dataset}
            base={base}
            revision={snapshot!.property.revision}
            api={api!}
            reload={reload!}
            run={run}
            busy={busy}
            query={query}
            jobs={snapshot!.jobs}
          />
        )}
        {tab === "access" && !dataset.demo && gm && (
          <GrantTools base={base} api={api!} run={run} busy={busy} />
        )}
      </div>
    </div>
  );
}
function SourceTools({
  dataset,
  base,
  revision,
  api,
  reload,
  run,
  busy,
  query,
  jobs,
}: {
  dataset: MarketDataset;
  base: string;
  revision: number;
  api: Api;
  reload: () => Promise<void>;
  run: any;
  busy: boolean;
  query: MarketQuery;
  jobs: any[];
}) {
  const [name, setName] = useState(""),
    [provider, setProvider] = useState("authorized_feed"),
    [reference, setReference] = useState(""),
    [expiry, setExpiry] = useState(""),
    [rights, setRights] = useState(false),
    [exports, setExports] = useState(false),
    [age, setAge] = useState(24),
    [sourceId, setSource] = useState(dataset.sources[0]?.id || ""),
    [preview, setPreview] = useState<any>(null);
  return (
    <div className="space-y-4">
      <section className={box}>
        <h3 className="font-bold">Authorize a market-data source</h3>
        <p>
          No scraping or OTA research connection is configured. A provider's
          booking API does not automatically permit competitor-pricing analytics
          or storage. Record the reviewed contract and grant only its permitted
          uses.
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          <label>
            Source name
            <input
              className={input}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Licensed provider / connector identifier
            <input
              className={input}
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            />
          </label>
          <label>
            Permission / license evidence URL
            <input
              className={input}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <label>
            Permission expiry
            <input
              className={input}
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            />
          </label>
          <label>
            Maximum observation age (1–72 hours)
            <input
              className={input}
              type="number"
              min={1}
              max={72}
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
            />
          </label>
        </div>
        <label className="block">
          <input
            type="checkbox"
            checked={rights}
            onChange={(e) => setRights(e.target.checked)}
          />{" "}
          I verified explicit permission for pricing analysis, storage and
          derived recommendations for this use case.
        </label>
        <label className="block">
          <input
            type="checkbox"
            checked={exports}
            onChange={(e) => setExports(e.target.checked)}
          />{" "}
          License additionally permits report/export distribution.
        </label>
        <button
          className={button}
          disabled={busy || !rights}
          onClick={() =>
            run(async () => {
              if (!expiry) throw Error("Set a valid permission expiry.");
              await api(base + "/sources", {
                revision,
                source: {
                  name,
                  provider,
                  permissionReference: reference,
                  expiresAt: expiry + "T23:59:59Z",
                  maxAgeHours: age,
                  analysisAllowed: true,
                  storageAllowed: true,
                  derivativesAllowed: true,
                  exportAllowed: exports,
                },
              });
              await reload();
            })
          }
        >
          Record source authorization
        </button>
      </section>
      <section className={box}>
        <h3 className="font-bold">
          Authorized feed ingestion and research jobs
        </h3>
        <label>
          Source
          <select
            className={input}
            value={sourceId}
            onChange={(e) => {
              setSource(e.target.value);
              setPreview(null);
            }}
          >
            <option value="">Choose authorized source</option>
            {dataset.sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.revokedAt ? " (revoked)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Normalized authorized JSON feed
          <input
            className={input}
            type="file"
            accept=".json,application/json"
            disabled={busy || !sourceId}
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPreview(null);
              if (f)
                run(async () => {
                  if (f.size > 2000000)
                    throw Error("Use a feed smaller than 2 MB.");
                  setPreview(
                    await api(base + "/ingestion/preview", {
                      sourceId,
                      packet: JSON.parse(await f.text()),
                    }),
                  );
                });
            }}
          />
        </label>
        {preview && (
          <div>
            <p>
              {preview.listings} listings · {preview.offers} observations
              validated structurally. Confirm identity, dates, prices and
              contract rights before committing.
            </p>
            {preview.packet && (
              <div className="overflow-auto max-h-96">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr>
                      {[
                        "Listing / physical identity",
                        "Bedrooms / platform",
                        "Stay dates / guests",
                        "Guest total / currency",
                        "Complete fees / verification",
                        "Observed",
                      ].map((h) => (
                        <th className="p-2" key={h}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.packet.offers.map((o: any) => {
                      const listing = preview.packet.competitors.find(
                        (c: any) => c.externalListingId === o.listingId,
                      );
                      return (
                        <tr
                          key={o.observationId}
                          className="border-t border-slate-700"
                        >
                          <td className="p-2">
                            {listing?.title}
                            <br />
                            {listing?.physicalKey}
                            <br />
                            {listing?.identityEvidence}
                          </td>
                          <td className="p-2">
                            {listing?.characteristics.bedrooms} BR ·{" "}
                            {listing?.platform}
                          </td>
                          <td className="p-2">
                            {o.checkIn} → {o.checkOut} · {o.guests} guests ·{" "}
                            {o.cancellation}
                          </td>
                          <td className="p-2">
                            {o.guestTotal ?? "Unavailable"} {o.currency}
                          </td>
                          <td className="p-2">
                            {o.allFeesKnown ? "Complete" : "Incomplete"} ·{" "}
                            {o.verification}
                          </td>
                          <td className="p-2">{o.observedAt}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (
                    !window.confirm(
                      "Accept these source observations as reviewed market evidence?",
                    )
                  )
                    return;
                  await api(base + "/ingestion/" + preview.id + "/commit", {});
                  setPreview(null);
                  await reload();
                })
              }
            >
              Accept reviewed source evidence
            </button>
          </div>
        )}
        <button
          className={button}
          disabled={busy || !sourceId || !query.unitId}
          onClick={() =>
            run(async () => {
              await api(base + "/research", { sourceId, query });
              await reload();
            })
          }
        >
          Queue permitted provider research
        </button>
        <p className="text-xs text-slate-400">
          Collection runs in the server worker. No live connectors are installed
          by default; unsupported jobs report “needs configuration,” never
          synthetic live results.
        </p>
        {jobs.map((j) => (
          <div className="border-t border-slate-700 pt-2" key={j.id}>
            <p>
              {j.kind} · {j.status} · {j.created_at}
            </p>
            <p>{j.result?.message}</p>
            {j.status === "preview" && j.kind === "authorized_feed" && (
              <button
                className={button}
                onClick={() =>
                  run(async () => {
                    setPreview(await api(base + "/ingestion/" + j.id));
                  })
                }
              >
                Inspect collected evidence before acceptance
              </button>
            )}
          </div>
        ))}
      </section>
      <section className={box}>
        <h3 className="font-bold">Source transparency</h3>
        {dataset.sources.map((s) => (
          <div key={s.id}>
            <p>
              {s.name} · {s.provider} · Expires {s.expiresAt} ·{" "}
              {s.revokedAt ? "Revoked" : "Permission recorded"}
            </p>
            <a
              className="text-sky-300 underline"
              href={s.permissionReference}
              target="_blank"
              rel="noreferrer"
            >
              Permission evidence
            </a>
            <button
              className={button + " ml-3"}
              disabled={busy || !!s.revokedAt}
              onClick={() =>
                run(async () => {
                  await api(base + "/sources/" + s.id + "/revoke", {});
                  await reload();
                })
              }
            >
              Revoke source use
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
function GrantTools({
  base,
  api,
  run,
  busy,
}: {
  base: string;
  api: Api;
  run: any;
  busy: boolean;
}) {
  const [uid, setUid] = useState(""),
    [capability, setCapability] = useState("read");
  return (
    <section className={box}>
      <h3 className="font-bold">Property-specific team access</h3>
      <p>
        Team members see no market property until granted access. The GM has
        organization-wide market access. Restricted building notes remain
        GM-only.
      </p>
      <label>
        Team member account ID
        <input
          className={input}
          value={uid}
          onChange={(e) => setUid(e.target.value)}
        />
      </label>
      <label>
        Permission
        <select
          className={input}
          value={capability}
          onChange={(e) => setCapability(e.target.value)}
        >
          <option value="read">Read market evidence</option>
          <option value="research">Prepare research and proposals</option>
          <option value="revoke">Revoke property access</option>
        </select>
      </label>
      <button
        className={button}
        disabled={busy || !uid}
        onClick={() =>
          run(async () => {
            await api(base + "/grants", { uid, capability });
          })
        }
      >
        Apply property permission
      </button>
    </section>
  );
}
function GoogleTools({
  propertyId,
  api,
  run,
  busy,
  records,
}: {
  propertyId: string;
  api: Api;
  run: any;
  busy: boolean;
  records: any[];
}) {
  const [status, setStatus] = useState<any>(null),
    [record, setRecord] = useState("");
  return (
    <section className={box}>
      <h3 className="font-bold">Google Workspace review workflow</h3>
      <p>
        Requires company OAuth configuration and explicit consent. Exports and
        review meetings do not change rental rates. Connect only
        company-controlled Google resources.
      </p>
      <button
        className={button}
        disabled={busy}
        onClick={() =>
          run(async () => {
            setStatus(
              await api("/market/google/status?propertyId=" + propertyId),
            );
          })
        }
      >
        Check Google connection
      </button>
      {status && (
        <p>
          {status.configured
            ? status.connected
              ? "Google connected"
              : "OAuth configured; consent required"
            : "Google OAuth is not configured. No data has been sent."}
        </p>
      )}
      <button
        className={button}
        disabled={busy}
        onClick={() =>
          run(async () => {
            const r = await api("/market/google/connect", { propertyId });
            window.location.assign(r.url);
          })
        }
      >
        Authorize Google Workspace
      </button>
      <label>
        Approved pricing proposal
        <select
          className={input}
          value={record}
          onChange={(e) => setRecord(e.target.value)}
        >
          <option value="">Choose approved proposal</option>
          {records
            .filter((r) => r.decision === "approved")
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.snapshot.date} ·{" "}
                {money(
                  r.approved_rate === null ? null : Number(r.approved_rate),
                )}
              </option>
            ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        {["sheets", "drive", "calendar"].map((kind) => (
          <button
            className={button}
            disabled={busy || !record}
            key={kind}
            onClick={() =>
              run(async () => {
                if (
                  !window.confirm(
                    "Send this approved review snapshot to company Google " +
                      kind +
                      "?",
                  )
                )
                  return;
                const r = await api("/market/google/publish", {
                  propertyId,
                  recommendationId: record,
                  kind,
                });
                setStatus({ ...status, lastResult: r.url || r.message });
              })
            }
          >
            {kind === "sheets"
              ? "Export approved review to Sheets"
              : kind === "drive"
                ? "Save approved review in Drive"
                : "Schedule tomorrow’s pricing review"}
          </button>
        ))}
      </div>
      {status?.lastResult && <p className="break-all">{status.lastResult}</p>}
      <button
        className={button}
        disabled={busy}
        onClick={() =>
          run(async () => {
            await api("/market/google/disconnect", { propertyId });
            setStatus({ configured: true, connected: false });
          })
        }
      >
        Disconnect Google
      </button>
    </section>
  );
}
