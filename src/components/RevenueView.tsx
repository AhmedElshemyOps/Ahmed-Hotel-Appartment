import React from "react";
import type { Reservation, Apartment, PropertyKPISummary } from "../types";
import {
  distributionStats,
  DEFAULT_CHANNELS,
  type DistributionChannel,
} from "../services/distribution";
import { formatAED } from "../data/kpiEngine";

interface RevenueViewProps {
  kpi: PropertyKPISummary;
  reservations: Reservation[];
  apartments: Apartment[];
  catalog?: DistributionChannel[];
  start?: string;
  end?: string;
  directory?: React.ReactNode;
}
export const RevenueView: React.FC<RevenueViewProps> = ({
  reservations,
  catalog = DEFAULT_CHANNELS,
  start = "2026-10-01",
  end = "2026-10-31",
  directory,
}) => {
  const stats = distributionStats(reservations, catalog, start, end);
  const gross = stats.reduce((s, c) => s + c.grossRevenue, 0),
    commission = stats.reduce((s, c) => s + c.commissionPaid, 0);
  return (
    <div className="p-6 space-y-6 text-slate-100">
      <header>
        <h2 className="text-xl font-bold">Revenue Intelligence</h2>
        <p className="text-sm text-slate-400">
          {start} to {end} · Room revenue allocated to nights in this period
        </p>
      </header>
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          ["Gross room revenue", gross],
          ["Estimated channel commission", commission],
          ["Room revenue after estimated commission", gross - commission],
        ].map(([label, value]) => (
          <div
            key={label}
            className="bg-slate-900 p-4 rounded-xl border border-slate-700"
          >
            <p className="text-xs text-slate-400">{label}</p>
            <p className="text-xl font-semibold">
              {formatAED(value as number)}
            </p>
          </div>
        ))}
      </div>
      {directory}
      <section className="bg-slate-900 rounded-xl border border-slate-700 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <caption className="text-left p-4 font-semibold">
            Distribution channels
          </caption>
          <thead>
            <tr>
              {[
                "Channel",
                "Bookings",
                "Gross revenue",
                "Share",
                "Est. commission",
                "Gross ADR",
                "Net ADR estimate",
              ].map((s) => (
                <th key={s} className="p-3 text-slate-400">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((c) => (
              <tr key={c.channel} className="border-t border-slate-800">
                <td className="p-3">
                  {c.channel}
                  {catalog.find((x) => x.name === c.channel)?.active === false
                    ? " (archived)"
                    : ""}
                </td>
                <td className="p-3">{c.bookingsCount}</td>
                <td className="p-3">{formatAED(c.grossRevenue)}</td>
                <td className="p-3">
                  {gross ? ((c.grossRevenue / gross) * 100).toFixed(1) : "0"}%
                </td>
                <td className="p-3">{formatAED(c.commissionPaid)}</td>
                <td className="p-3">
                  {c.bookingsCount ? formatAED(c.realizedADR) : "Unavailable"}
                </td>
                <td className="p-3">
                  {c.bookingsCount ? formatAED(c.netADR) : "Unavailable"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-sm text-amber-200">
        Commission uses the rate recorded on each reservation, not verified
        invoices. Net room revenue excludes operating costs and taxes. Adding a
        channel enables reporting; it does not connect or publish to that
        platform.
      </p>
    </div>
  );
};
