// Synthetic UI fixture served only by Vite's local test server, never included in dist.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { CloudRevenue } from "../../src/cloud/CloudApp";
import { OperationsBoard } from "../../src/cloud/OperationsBoard";
import {
  DEFAULT_GUEST_SERVICE,
  nextBusinessDate,
} from "../../src/services/guestService";
import { DEFAULT_CHANNELS } from "../../src/services/distribution";
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
  const api = async (path: string, body: any) => {
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
      </nav>
      {error && <p role="alert">{error}</p>}
      {tab === "revenue" ? (
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
