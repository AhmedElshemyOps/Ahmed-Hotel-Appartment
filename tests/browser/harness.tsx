import { ConnectedEvidenceCenter } from "../../src/features/connected-evidence/ConnectedEvidenceCenter";
import { OwnerReports } from "../../src/features/connected-evidence/OwnerReports";
// Synthetic UI fixture served only by Vite's local test server, never included in dist.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { CloudRevenue } from "../../src/app/CloudApp";
import { OperationsBoard } from "../../src/features/operations/OperationsBoard";
import {
  DEFAULT_GUEST_SERVICE,
  nextBusinessDate,
} from "../../src/features/guest-service/guestService";
import { DEFAULT_CHANNELS } from "../../src/features/revenue/distribution";
import "../../src/index.css";
const tomorrow = nextBusinessDate();
function Harness() {
  const [tab, setTab] = useState("operations"),
    [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<any>({
    revision: 0,
    actor: { uid: "gm", organization_id: "test", role: "General Manager" },
    data: {
      channels: structuredClone(DEFAULT_CHANNELS),
      apartments: [{ id: "u1", unitNumber: "101", type: "Studio" }],
      reservations: [
        {
          externalId: "test1",
          source: "test",
          version: 1,
          data: {
            id: "test1",
            unitId: "u1",
            checkInDate: tomorrow,
            checkOutDate: new Date(Date.parse(tomorrow) + 3 * 86400000)
              .toISOString()
              .slice(0, 10),
            bookingDate: "2026-10-01",
            status: "Confirmed",
            channel: "Expedia",
            dailyRateAED: 500,
            commissionRatePercent: 18,
            isDemo: false,
          },
        },
      ],
      guestService: structuredClone(DEFAULT_GUEST_SERVICE),
    },
    sync: { configured: false, lastSuccess: null, events: [] },
    history: [],
  });
  const api = async (path: string, body?: any): Promise<any> => {
    if (path === "/accounting")
      return {
        connections: [
          { id: "SIM-connection", config: { label: "SYNTHETIC ledger" } },
        ],
      };
    if (path === "/workspace") return snapshot;
    if (path === "/connected-evidence/owners")
      return { grants: [], releases: [] };
    if (path === "/connected-evidence/owners/preview")
      return {
        revision: 0,
        unitNumber: "101",
        period: { start: "2026-10-01", end: "2026-10-31" },
        current: {
          roomRevenue: 1500,
          commission: 270,
          afterCommission: 1230,
          occupiedNights: 3,
        },
        prior: { roomRevenue: 0 },
        limitations: "SYNTHETIC preview — not profit.",
      };
    if (path === "/connected-evidence/owners/release") {
      if (body.expectedRevision !== 0) throw Error("Missing reviewed revision");
      return { ok: true };
    }
    if (path === "/connected-evidence/questions")
      return {
        generatedAt: "2026-10-15T00:00:00Z",
        workspaceRevision: 0,
        facts: [
          {
            text: "SYNTHETIC apartment 101 arrival",
            references: [{ kind: "reservation", id: "test1", version: "1" }],
          },
        ],
        limitations: ["Native PMS is not connected."],
      };
    if (path === "/connected-evidence/evidence")
      return {
        kind: "reservation",
        version: 1,
        record: { source: "SYNTHETIC fixture", checkInDate: tomorrow },
      };

    if (path === "/channels")
      setSnapshot((s: any) => ({
        ...s,
        revision: s.revision + 1,
        data: {
          ...s.data,
          channels: [...s.data.channels, { ...body, id: "new-channel" }],
        },
      }));
    if (path === "/guest-service/complete")
      setSnapshot((s: any) => ({
        ...s,
        revision: s.revision + 1,
        data: {
          ...s.data,
          guestService: {
            ...s.data.guestService,
            completed: {
              ...s.data.guestService.completed,
              [body.taskId]: { at: new Date().toISOString(), by: "gm" },
            },
          },
        },
      }));
    return { ok: true };
  };
  const run = async (fn: any) => {
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="bg-slate-950 text-white min-h-screen">
      <nav>
        <button onClick={() => setTab("operations")}>Operations fixture</button>
        <button onClick={() => setTab("revenue")}>Revenue fixture</button>
        <button onClick={() => setTab("evidence")}>Evidence fixture</button>
      </nav>
      {error && <p role="alert">{error}</p>}
      {tab === "evidence" ? (
        <ConnectedEvidenceCenter api={api} gm />
      ) : tab === "revenue" ? (
        <CloudRevenue
          snapshot={snapshot}
          run={run}
          busy={false}
          api={api}
          refresh={async () => {}}
        />
      ) : (
        <OperationsBoard
          data={snapshot.data}
          actor={snapshot.actor}
          sync={snapshot.sync}
          revision={snapshot.revision}
          api={api}
          refresh={async () => {}}
          run={run}
          busy={false}
        />
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
