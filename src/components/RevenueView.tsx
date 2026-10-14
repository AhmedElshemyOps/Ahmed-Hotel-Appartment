import React from 'react';
import {
  TrendingUp,
  DollarSign,
  PieChart,
  BarChart,
  ArrowUpRight,
  ShieldAlert,
  Sparkles,
  Layers,
  Percent,
} from 'lucide-react';
import { Reservation, Apartment, PropertyKPISummary } from '../types';
import { formatAED } from '../data/kpiEngine';

interface RevenueViewProps {
  kpi: PropertyKPISummary;
  reservations: Reservation[];
  apartments: Apartment[];
}

export const RevenueView: React.FC<RevenueViewProps> = ({ kpi, reservations, apartments }) => {
  // Compute channel net yields
  const channels = ['Direct Web', 'Corporate Contract', 'Booking.com', 'Airbnb', 'Expedia'];
  const channelStats = channels.map(channel => {
    const channelRes = reservations.filter(r => r.channel === channel && r.status !== 'Canceled');
    const gross = channelRes.reduce((s, r) => s + r.totalRoomRevenueAED, 0);
    const net = channelRes.reduce((s, r) => s + r.netRevenueAED, 0);
    const commission = gross - net;
    const commPercent = gross > 0 ? Math.round((commission / gross) * 100) : 0;
    const nights = channelRes.reduce((s, r) => s + r.nights, 0);
    const realizedADR = nights > 0 ? Math.round(gross / nights) : 0;
    const netADR = nights > 0 ? Math.round(net / nights) : 0;

    return {
      channel,
      bookingsCount: channelRes.length,
      grossRevenue: gross,
      commissionPaid: commission,
      commPercent,
      netRevenue: net,
      realizedADR,
      netADR,
    };
  });

  const totalGross = channelStats.reduce((s, c) => s + c.grossRevenue, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">Revenue Strategy & Yield Intelligence</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
              RevPAR Velocity: {formatAED(kpi.revParAED)}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Realized ADR analysis, distribution channel profit margins, and rate elasticity models.
          </p>
        </div>

        <div className="text-xs text-slate-300 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
          <span>ALOS: <strong className="text-sky-400 font-mono">{kpi.alosDays} Nights</strong></span>
          <span className="mx-2 text-slate-600">|</span>
          <span>Cancellation: <strong className="text-amber-400 font-mono">{kpi.cancellationRatePercent}%</strong></span>
        </div>
      </div>

      {/* REVENUE KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400">Realized ADR</div>
          <div className="text-xl font-bold text-white font-mono mt-1">{formatAED(kpi.adrAED)}</div>
          <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
            <TrendingUp className="w-3 h-3" />
            <span>+4.8% vs last month</span>
          </div>
        </div>

        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400">RevPAR Yield</div>
          <div className="text-xl font-bold text-sky-400 font-mono mt-1">{formatAED(kpi.revParAED)}</div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">
            {kpi.occupancyPercent}% × {formatAED(kpi.adrAED)}
          </div>
        </div>

        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400">Gross Room Revenue</div>
          <div className="text-xl font-bold text-white font-mono mt-1">{formatAED(kpi.roomRevenueAED)}</div>
          <div className="text-[10px] text-emerald-400 mt-1 font-mono">
            + {formatAED(kpi.ancillaryRevenueAED)} ancillary
          </div>
        </div>

        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400">OTA Commission Loss</div>
          <div className="text-xl font-bold text-rose-400 font-mono mt-1">
            -{formatAED(channelStats.reduce((s, c) => s + c.commissionPaid, 0))}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Target: Shift 20% to direct
          </div>
        </div>
      </div>

      {/* CHANNEL PROFITABILITY MATRIX */}
      <div className="bg-slate-900/80 rounded-xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Channel Profitability & Net Yield Matrix</h3>
            <p className="text-xs text-slate-400 mt-0.5">Comparing realized nightly ADR vs actual net realized cash after commission</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
                <th className="py-3 px-4">Distribution Channel</th>
                <th className="py-3 px-3 text-center">Bookings</th>
                <th className="py-3 px-3 text-right">Gross Realized</th>
                <th className="py-3 px-3 text-center">Share (%)</th>
                <th className="py-3 px-3 text-center">Commission (%)</th>
                <th className="py-3 px-3 text-right">Commission Loss</th>
                <th className="py-3 px-3 text-right">Gross ADR</th>
                <th className="py-3 px-4 text-right">Net ADR Realized</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {channelStats.map(c => {
                const sharePct = totalGross > 0 ? Math.round((c.grossRevenue / totalGross) * 100) : 0;

                return (
                  <tr key={c.channel} className="text-slate-300 hover:bg-slate-850/50">
                    <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        c.commPercent === 0 ? 'bg-emerald-400' : 'bg-amber-400'
                      }`} />
                      {c.channel}
                    </td>
                    <td className="py-3 px-3 text-center font-mono">{c.bookingsCount}</td>
                    <td className="py-3 px-3 text-right font-mono font-medium">{formatAED(c.grossRevenue)}</td>
                    <td className="py-3 px-3 text-center font-mono">{sharePct}%</td>
                    <td className="py-3 px-3 text-center font-mono">
                      {c.commPercent === 0 ? (
                        <span className="text-emerald-400 font-bold">0% (Direct)</span>
                      ) : (
                        <span className="text-rose-400">{c.commPercent}%</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-rose-400">
                      {c.commissionPaid === 0 ? 'AED 0' : `-${formatAED(c.commissionPaid)}`}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">{formatAED(c.realizedADR)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      {formatAED(c.netADR)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI REVENUE STRATEGY RECOMMENDATIONS */}
      <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-800 text-xs space-y-3">
        <div className="flex items-center gap-2 font-bold text-indigo-300">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>Revenue Management Agent Strategy Guidance</span>
        </div>
        <p className="text-slate-300 leading-relaxed">
          Direct bookings and corporate contracts deliver an average of <strong className="text-emerald-400">AED 115 higher net ADR per occupied night</strong> than Booking.com or Expedia. By restricting OTA channel distribution on 3-Bedroom Penthouses and offering direct-bookers complimentary Dubai airport chauffeur transfers, the property can preserve an estimated <strong className="text-amber-300">AED 24,500 in net margin</strong> during Q4 high season.
        </p>
      </div>
    </div>
  );
};
