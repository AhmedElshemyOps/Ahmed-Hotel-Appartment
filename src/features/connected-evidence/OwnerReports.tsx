import React from "react";
export function OwnerReports({
  data,
  refresh,
}: {
  data: any;
  refresh: () => void;
}) {
  return (
    <section className="p-6 space-y-4">
      <h2 className="text-xl font-bold">Owner report portal</h2>
      <p>{data.message}</p>
      <button className="rounded bg-sky-700 p-2" onClick={refresh}>
        Refresh approved reports
      </button>
      {!data.reports.length && (
        <p>
          No approved reports are currently available for your authorized
          apartments.
        </p>
      )}
      {data.reports.map((r: any) => (
        <article className="bg-white text-slate-900 rounded p-5" key={r.id}>
          <h3>Apartment {r.snapshot.unitNumber}</h3>
          {r.snapshot.dataMode === "synthetic" && (
            <p>SYNTHETIC DEMONSTRATION — not real financial results.</p>
          )}
          <p>
            {r.snapshot.period.start} to {r.snapshot.period.end} · Approved{" "}
            {new Date(r.approved_at).toLocaleString()}
          </p>
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Selected period</th>
                <th>Previous period</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["roomRevenue", "Room revenue estimate (AED)"],
                ["commission", "Recorded commission (AED)"],
                ["afterCommission", "After commission (AED)"],
                ["occupiedNights", "Occupied nights"],
              ].map(([k, label]) => (
                <tr key={k}>
                  <td>{label}</td>
                  <td>
                    {r.snapshot.current[k].toLocaleString("en-AE", {
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td>
                    {r.snapshot.prior[k].toLocaleString("en-AE", {
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>{r.snapshot.limitations}</p>
          <p>
            Method {r.snapshot.methodology} · Source revision{" "}
            {r.snapshot.sourceRevision} · Captured {r.snapshot.recordedAt}
          </p>
        </article>
      ))}
    </section>
  );
}
