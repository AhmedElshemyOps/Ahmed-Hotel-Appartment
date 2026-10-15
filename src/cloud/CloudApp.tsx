import React, { useEffect, useState, useCallback, lazy, Suspense } from "react";
const MarketWorkspace = lazy(() =>
  import("../market/MarketWorkspace").then((m) => ({
    default: m.MarketWorkspace,
  })),
);
import { initializeApp } from "firebase/app";
import {
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  multiFactor,
  TotpMultiFactorGenerator,
  getMultiFactorResolver,
  onIdTokenChanged,
  type MultiFactorResolver,
  type TotpSecret,
  type User,
  type Auth,
} from "firebase/auth";
import type { Workspace, Actor } from "../../server/cloud";
import type { Preview, Mapping } from "../../server/pms";
import { RevenueView } from "../components/RevenueView";
import { calculatePropertyKPISummary } from "../data/kpiEngine";
import { cloudApi, CloudApiError } from "./api";
import { OperationsBoard } from "./OperationsBoard";

const fields = [
  "externalId",
  "unitNumber",
  "checkInDate",
  "checkOutDate",
  "bookingDate",
  "status",
  "channel",
  "dailyRateAED",
  "commissionRatePercent",
  "currency",
] as const;
const labels = [
  "Reservation ID",
  "Unit number",
  "Check-in date",
  "Check-out date",
  "Booking date",
  "Status",
  "Channel",
  "Room-only nightly rate (AED)",
  "Commission rate (%)",
  "Currency",
];
const box = "bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3";
const input = "bg-slate-950 border border-slate-600 rounded p-2 w-full";
const button =
  "bg-sky-700 hover:bg-sky-600 disabled:opacity-40 rounded px-4 py-2";
type Snapshot = {
  data: Workspace;
  revision: number;
  actor: Actor;
  history: any[];
  sync: any;
};

export function CloudApp({
  config,
}: {
  config: { apiKey: string; authDomain: string; projectId: string };
}) {
  const [auth] = useState(() => getAuth(initializeApp(config)));
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState("");
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null),
    [secret, setSecret] = useState<TotpSecret | null>(null);
  const [tab, setTab] = useState("operations");
  const marketApi = useCallback(
    async (path: string, body?: unknown) => {
      try {
        return await cloudApi(auth, path, body);
      } catch (e) {
        if (e instanceof CloudApiError && [401, 403].includes(e.status)) {
          setSnapshot(null);
          setError(e.message);
        }
        throw e;
      }
    },
    [auth],
  );
  useEffect(() => {
    let cleanup = () => {};
    let live = true;
    setPersistence(auth, inMemoryPersistence)
      .then(() => {
        if (live)
          cleanup = onIdTokenChanged(auth, (u) => {
            setUser((previous) => {
              if (previous?.uid !== u?.uid) setSnapshot(null);
              return u;
            });
            setReady(true);
          });
      })
      .catch(() => setError("Unable to initialize secure sign-in."));
    return () => {
      live = false;
      cleanup();
    };
  }, [auth]);
  const refresh = async () => {
    const uid = auth.currentUser?.uid;
    const data = await cloudApi(auth, "/workspace");
    if (uid && auth.currentUser?.uid === uid && data.actor.uid === uid)
      setSnapshot(data);
  };
  useEffect(() => {
    if (user) {
      let live = true;
      cloudApi(auth, "/workspace")
        .then((data) => {
          if (live && auth.currentUser?.uid === data.actor.uid)
            setSnapshot(data);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
      return () => {
        live = false;
      };
    }
  }, [user]);
  useEffect(() => {
    if (!user || tab !== "operations" || busy) return;
    let live = true;
    const timer = setInterval(() => {
      cloudApi(auth, "/workspace")
        .then((data) => {
          if (live && auth.currentUser?.uid === data.actor.uid)
            setSnapshot(data);
        })
        .catch((e) => {
          if (!live) return;
          if (e instanceof CloudApiError && [401, 403].includes(e.status))
            setSnapshot(null);
          setError(
            "Automatic refresh failed. The displayed plan may be stale. Reconnect and refresh.",
          );
        });
    }, 30000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [user, auth, tab, busy]);
  async function run(fn: () => Promise<unknown>) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      if (e instanceof CloudApiError && [401, 403].includes(e.status))
        setSnapshot(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const login = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setPassword("");
    } catch (e: any) {
      if (e.code === "auth/multi-factor-auth-required") {
        setResolver(getMultiFactorResolver(auth, e));
        setPassword("");
      } else
        throw Error(
          "Sign-in failed. Check your credentials or contact your administrator.",
        );
    }
  };
  const finishMfa = async () => {
    if (!resolver) return;
    const hint = resolver.hints.find(
      (h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID,
    );
    if (!hint)
      throw Error(
        "This account requires a supported authenticator factor. Contact your administrator.",
      );
    await resolver.resolveSignIn(
      TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code),
    );
    setResolver(null);
    setCode("");
  };
  const enroll = async () => {
    if (!user?.emailVerified)
      throw Error("Verify your email, then sign out and sign in again.");
    setSecret(
      await TotpMultiFactorGenerator.generateSecret(
        await multiFactor(user).getSession(),
      ),
    );
  };
  const finishEnrollment = async () => {
    if (!user || !secret) return;
    await multiFactor(user).enroll(
      TotpMultiFactorGenerator.assertionForEnrollment(secret, code),
      "Company authenticator",
    );
    setSecret(null);
    setCode("");
    await signOut(auth);
    setError("Authenticator enrolled. Sign in again and enter your code.");
  };
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-700 p-4 flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="font-bold text-lg">Ahmed Quality Ops</h1>
          <p className="text-xs text-slate-400">
            Cloud workspace · Revenue and PMS updates
          </p>
        </div>
        {user && (
          <div className="flex gap-3 items-center">
            <span>{snapshot?.actor.role || user.email}</span>
            <button
              className={button}
              onClick={() =>
                run(async () => {
                  await signOut(auth);
                  setSecret(null);
                  setCode("");
                  setSnapshot(null);
                  setError("");
                })
              }
            >
              Sign out
            </button>
          </div>
        )}
      </header>
      {error && (
        <p
          role="alert"
          className="m-4 p-3 border border-amber-700 rounded text-amber-200"
        >
          {error}
        </p>
      )}
      {!ready ? (
        <p className="p-6">Loading secure workspace…</p>
      ) : !user ? (
        <form
          className={box + " max-w-md m-6"}
          onSubmit={(e) => {
            e.preventDefault();
            run(resolver ? finishMfa : login);
          }}
        >
          <h2 className="text-xl">
            {resolver ? "Authenticator verification" : "Company sign-in"}
          </h2>
          {resolver ? (
            <label>
              Authenticator code
              <input
                className={input}
                required
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
          ) : (
            <>
              <label>
                Email
                <input
                  className={input}
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  className={input}
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            </>
          )}
          <button className={button} disabled={busy}>
            Continue
          </button>
          {resolver && (
            <button
              type="button"
              className={button}
              onClick={() => {
                setResolver(null);
                setCode("");
              }}
            >
              Back
            </button>
          )}
        </form>
      ) : !snapshot ? (
        <section className={box + " max-w-lg m-6"}>
          <h2 className="text-xl">Complete account security</h2>
          <p>
            Your administrator must assign a company seat. Verify your email and
            enroll an authenticator before accessing company data.
          </p>
          {!user.emailVerified && (
            <button
              disabled={busy}
              className={button}
              onClick={() =>
                run(async () => {
                  await sendEmailVerification(user);
                  setError(
                    "Verification email sent. After verifying, sign out and sign in again.",
                  );
                })
              }
            >
              Send verification email
            </button>
          )}
          {!secret ? (
            <button
              className={button}
              disabled={busy}
              onClick={() => run(enroll)}
            >
              Set up authenticator
            </button>
          ) : (
            <>
              <p>
                Add this setup key manually in your authenticator. Keep it
                private:
              </p>
              <code className="block break-all select-all">
                {secret.secretKey}
              </code>
              <label>
                Authenticator code
                <input
                  className={input}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <button
                className={button}
                disabled={busy}
                onClick={() => run(finishEnrollment)}
              >
                Verify and enroll
              </button>
            </>
          )}
          <button
            className={button}
            disabled={busy}
            onClick={() => run(refresh)}
          >
            Retry access
          </button>
        </section>
      ) : (
        <>
          <nav className="flex gap-3 p-4">
            {["operations", "revenue", "market", "imports", "units"].map(
              (t) => (
                <button
                  key={t}
                  className={button + (tab === t ? " ring-2 ring-sky-300" : "")}
                  onClick={() => setTab(t)}
                >
                  {t === "operations"
                    ? "Tomorrow and guest service"
                    : t === "revenue"
                      ? "Revenue Intelligence"
                      : t === "market"
                        ? "Geographic Market Intelligence"
                        : t === "imports"
                          ? "PMS file updates"
                          : "Property units"}
                </button>
              ),
            )}
            <button
              className={button}
              disabled={busy}
              onClick={() => run(refresh)}
            >
              Refresh company data
            </button>
          </nav>
          {tab === "operations" && (
            <OperationsBoard
              data={snapshot.data}
              actor={snapshot.actor}
              sync={snapshot.sync}
              revision={snapshot.revision}
              api={(path, body) => cloudApi(auth, path, body)}
              refresh={refresh}
              run={run}
              busy={busy}
            />
          )}
          {tab === "market" && (
            <Suspense
              fallback={<p className="p-6">Loading market intelligence…</p>}
            >
              <MarketWorkspace api={marketApi} role={snapshot.actor.role} />
            </Suspense>
          )}
          {tab === "revenue" && (
            <CloudRevenue
              snapshot={snapshot}
              run={run}
              busy={busy}
              api={(path, body) => cloudApi(auth, path, body)}
              refresh={refresh}
            />
          )}
          {tab === "imports" && (
            <PmsImport
              key={snapshot.revision}
              snapshot={snapshot}
              run={run}
              busy={busy}
              auth={auth}
              refresh={refresh}
            />
          )}
          {tab === "units" && (
            <Units
              snapshot={snapshot}
              run={run}
              busy={busy}
              auth={auth}
              refresh={refresh}
            />
          )}
        </>
      )}
    </div>
  );
}
export function CloudRevenue({
  snapshot,
  run,
  busy,
  api,
  refresh,
}: {
  snapshot: Snapshot;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  busy: boolean;
  api: (path: string, body?: unknown) => Promise<any>;
  refresh: () => Promise<void>;
}) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [start, setStart] = useState(today.slice(0, 7) + "-01"),
    [end, setEnd] = useState(today);
  const [id, setId] = useState(""),
    [name, setName] = useState(""),
    [aliases, setAliases] = useState(""),
    [active, setActive] = useState(true);
  const writable = snapshot.actor.role !== "Read-Only Viewer";
  const reservations = snapshot.data.reservations.map((r) => r.data);
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(start) &&
    /^\d{4}-\d{2}-\d{2}$/.test(end) &&
    start <= end;
  const kpi = calculatePropertyKPISummary({
    apartments: snapshot.data.apartments,
    reservations,
    transactions: [],
    maintenanceOrders: [],
    complaints: [],
    startDate: start,
    endDate: end,
    periodLabel: "Selected period",
  });
  const directory = (
    <section className={box}>
      <h3 className="font-bold">Distribution directory</h3>
      <p className="text-sm text-slate-400">
        Add any reporting source, including Expedia or TripAdvisor. Aliases
        match names in PMS exports. No platform connection is created.
      </p>
      <div className="flex flex-wrap gap-2">
        {snapshot.data.channels.map((c) => (
          <button
            key={c.id}
            disabled={!writable || busy}
            className={button}
            onClick={() => {
              setId(c.id);
              setName(c.name);
              setAliases(c.aliases.join(", "));
              setActive(c.active);
            }}
          >
            {c.name}
            {c.active ? "" : " (archived)"}
          </button>
        ))}
      </div>
      {writable && (
        <form
          className="grid sm:grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api("/channels", {
                id: id || undefined,
                name,
                aliases: aliases
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                active,
                revision: snapshot.revision,
              });
              await refresh();
              setId("");
              setName("");
              setAliases("");
              setActive(true);
            });
          }}
        >
          <label>
            Channel name
            <input
              className={input}
              value={name}
              required
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Source aliases (comma separated)
            <input
              className={input}
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />{" "}
            Active for new bookings
          </label>
          <div className="flex gap-2">
            <button disabled={busy} className={button}>
              {id ? "Save changes" : "Add channel"}
            </button>
            <button
              type="button"
              className={button}
              onClick={() => {
                setId("");
                setName("");
                setAliases("");
                setActive(true);
              }}
            >
              Clear
            </button>
          </div>
        </form>
      )}
    </section>
  );
  return (
    <>
      <div className="flex gap-4 px-6">
        <label>
          From
          <input
            className={input}
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          Through
          <input
            className={input}
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      {valid ? (
        <RevenueView
          kpi={kpi}
          reservations={reservations}
          apartments={snapshot.data.apartments}
          catalog={snapshot.data.channels}
          start={start}
          end={end}
          directory={directory}
        />
      ) : (
        <p className="p-6">Choose a valid date range.</p>
      )}
    </>
  );
}
function Units({
  snapshot,
  run,
  busy,
  auth,
  refresh,
}: {
  snapshot: Snapshot;
  run: any;
  busy: boolean;
  auth: Auth;
  refresh: () => Promise<void>;
}) {
  const [number, setNumber] = useState(""),
    [type, setType] = useState("Studio");
  return (
    <section className={box + " m-6"}>
      <h2 className="text-xl">Actual property units</h2>
      <p>
        Register your real unit identifiers before importing. Inventory starts
        empty. This establishes identity only; room readiness, capacity and
        operating costs are not verified.
      </p>
      <ul>
        {snapshot.data.apartments.map((a) => (
          <li key={a.id}>
            {a.unitNumber} · {a.type}
          </li>
        ))}
      </ul>
      {snapshot.actor.role === "General Manager" && (
        <form
          className="flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await cloudApi(auth, "/units", { unitNumber: number, type });
              await refresh();
              setNumber("");
            });
          }}
        >
          <label>
            Unit number
            <input
              className={input}
              required
              maxLength={60}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </label>
          <label>
            Type
            <select
              className={input}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {["Studio", "One-bedroom", "Two-bedroom", "Three-bedroom"].map(
                (t) => (
                  <option key={t}>{t}</option>
                ),
              )}
            </select>
          </label>
          <button className={button} disabled={busy}>
            Add unit
          </button>
        </form>
      )}
    </section>
  );
}
function PmsImport({
  snapshot,
  run,
  busy,
  auth,
  refresh,
}: {
  snapshot: Snapshot;
  run: any;
  busy: boolean;
  auth: Auth;
  refresh: () => Promise<void>;
}) {
  const [csv, setCsv] = useState(""),
    [fileName, setFileName] = useState(""),
    [source, setSource] = useState("lodgify-company-a");
  const [mapping, setMapping] = useState<Partial<Mapping>>({}),
    [preview, setPreview] = useState<(Preview & { id: string }) | null>(null),
    [confirmed, setConfirmed] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const writable = snapshot.actor.role !== "Read-Only Viewer";
  const invalidate = () => {
    setPreview(null);
    setConfirmed(false);
  };
  return (
    <section className={box + " m-6"}>
      <h2 className="text-xl">PMS file updates</h2>
      <p>
        Upload a normalized CSV exported from Lodgify or another PMS. Map
        columns explicitly; XLSX/PDF and live API synchronization are not
        included in this release. Use a stable source-account ID for every
        update from the same PMS account.
      </p>
      <p className="text-sm text-amber-200">
        Dates: YYYY-MM-DD. Status: Confirmed, In-House, Completed or Canceled.
        Currency: AED. Rate: room-only nightly amount excluding taxes/fees. No
        automatic currency conversion or inferred commission. Missing rows are
        retained; cancellations must be explicit.
      </p>
      <a
        className="text-sky-300 underline"
        href="/templates/pms-reservations.csv"
        download
      >
        Download normalized CSV example (synthetic data)
      </a>
      {writable && (
        <>
          <label>
            Source account
            <input
              className={input}
              value={source}
              maxLength={60}
              onChange={(e) => {
                setSource(e.target.value);
                invalidate();
              }}
            />
          </label>
          <label>
            CSV file
            <input
              className={input}
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                invalidate();
                setCsv("");
                setHeaders([]);
                setMapping({});
                if (file)
                  run(async () => {
                    if (file.size > 2000000)
                      throw Error("Choose a file smaller than 2 MB.");
                    const text = await file.text();
                    const { parse } =
                      await import("csv-parse/browser/esm/sync");
                    const rows = parse(text, {
                      bom: true,
                      skip_empty_lines: true,
                      max_record_size: 20000,
                    });
                    const h = (rows[0] || []).map((x: string) => x.trim());
                    setCsv(text);
                    setFileName(file.name);
                    setHeaders(h);
                    setMapping(
                      Object.fromEntries(
                        fields.map((f) => [f, h.includes(f) ? f : ""]),
                      ),
                    );
                  });
              }}
            />
          </label>
          {headers.length > 0 && (
            <div className="grid md:grid-cols-2 gap-3">
              {fields.map((field, i) => (
                <label key={field}>
                  {labels[i]}
                  <select
                    className={input}
                    value={mapping[field] || ""}
                    onChange={(e) => {
                      setMapping({ ...mapping, [field]: e.target.value });
                      invalidate();
                    }}
                  >
                    <option value="">Choose column</option>
                    {headers.map((h, i) => (
                      <option key={i} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          <button
            className={button}
            disabled={busy || !csv || fields.some((f) => !mapping[f])}
            onClick={() =>
              run(async () => {
                setConfirmed(false);
                setPreview(null);
                setPreview(
                  await cloudApi(auth, "/imports/preview", {
                    csv,
                    fileName,
                    source,
                    mapping,
                  }),
                );
              })
            }
          >
            Validate and preview changes
          </button>
          {preview && (
            <div className={box}>
              <p>
                {preview.summary.insert} new · {preview.summary.update} updated
                · {preview.summary.unchanged} unchanged
              </p>
              {preview.errors.length > 0 ? (
                <ul role="alert" className="text-amber-200">
                  {preview.errors.slice(0, 30).map((e, i) => (
                    <li key={i}>
                      {e.row ? "Row " + e.row + ": " : ""}
                      {e.message}
                    </li>
                  ))}
                  {preview.errors.length > 30 && (
                    <li>
                      More errors found. Correct the file and preview again.
                    </li>
                  )}
                </ul>
              ) : (
                <>
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th>Action</th>
                          <th>Reservation ID</th>
                          <th>Unit</th>
                          <th>Status before → after</th>
                          <th>Room revenue before → after</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.changes.slice(0, 100).map((c) => (
                          <tr key={c.key}>
                            <td>{c.operation}</td>
                            <td>{c.after.externalId}</td>
                            <td>
                              {
                                snapshot.data.apartments.find(
                                  (a) => a.id === c.after.data.unitId,
                                )?.unitNumber
                              }
                            </td>
                            <td>
                              {c.before?.data.status || "—"} →{" "}
                              {c.after.data.status}
                            </td>
                            <td>
                              {c.before?.data.totalRoomRevenueAED ?? "—"} →{" "}
                              {c.after.data.totalRoomRevenueAED} AED
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <label>
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />{" "}
                    I reviewed this batch and approve these additions and
                    updates.
                  </label>
                  <button
                    className={button}
                    disabled={busy || !confirmed}
                    onClick={() =>
                      run(async () => {
                        await cloudApi(
                          auth,
                          "/imports/" + preview.id + "/commit",
                          {},
                        );
                        await refresh();
                      })
                    }
                  >
                    Approve and save to company data
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
      <h3 className="font-bold">Recent import history</h3>
      <p className="text-sm text-slate-400">
        Rollback reverses this batch. It stops if newer changes would be
        overwritten or stays would overlap. Preview expires after 30 minutes or
        a company data change.
      </p>
      {snapshot.history.map((h) => (
        <div
          className="flex flex-wrap justify-between border-t border-slate-700 pt-2 gap-2"
          key={h.id}
        >
          <span>
            {h.file_name} · {h.source} · {h.status} ·{" "}
            {new Date(h.created_at).toLocaleString()} · {h.summary.insert} new /{" "}
            {h.summary.update} updates
          </span>
          {writable && h.status === "committed" && (
            <button
              className={button}
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Reverse this import? This restores the prior reservation versions.",
                  )
                )
                  run(async () => {
                    await cloudApi(auth, "/imports/" + h.id + "/rollback", {});
                    await refresh();
                  });
              }}
            >
              Roll back batch
            </button>
          )}
        </div>
      ))}
      {!snapshot.history.length && <p>No import batches yet.</p>}
    </section>
  );
}
