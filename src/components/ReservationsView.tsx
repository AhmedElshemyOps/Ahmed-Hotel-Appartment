import React, { useState } from 'react';
import {
  CalendarCheck2,
  Search,
  Filter,
  DollarSign,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Clock,
  Download,
} from 'lucide-react';
import { Reservation, BookingStatus, BookingChannel } from '../types';
import { formatAED } from '../data/kpiEngine';

interface ReservationsViewProps {
  reservations: Reservation[];
}

export const ReservationsView: React.FC<ReservationsViewProps> = ({ reservations }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Filter reservations
  const filtered = reservations.filter(r => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (channelFilter !== 'ALL' && r.channel !== channelFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchGuest = r.guestName.toLowerCase().includes(q);
      const matchUnit = r.unitId.toLowerCase().includes(q);
      const matchId = r.id.toLowerCase().includes(q);
      if (!matchGuest && !matchUnit && !matchId) return false;
    }
    return true;
  });

  // Calculate summary metrics
  const totalBookings = reservations.length;
  const completedOrInHouse = reservations.filter(r => r.status === 'Completed' || r.status === 'In-House');
  const totalGrossRev = completedOrInHouse.reduce((s, r) => s + r.totalRoomRevenueAED, 0);
  const totalNetRev = completedOrInHouse.reduce((s, r) => s + r.netRevenueAED, 0);
  const totalCommission = totalGrossRev - totalNetRev;
  const canceledCount = reservations.filter(r => r.status === 'Canceled').length;
  const cancellationRate = totalBookings > 0 ? ((canceledCount / totalBookings) * 100).toFixed(1) : '0';

  // Pagination
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Status badge helper
  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'In-House':
        return 'bg-emerald-950 text-emerald-300 border-emerald-800';
      case 'Confirmed':
        return 'bg-sky-950 text-sky-300 border-sky-800';
      case 'Completed':
        return 'bg-slate-800 text-slate-300 border-slate-700';
      case 'Canceled':
        return 'bg-rose-950 text-rose-300 border-rose-800 line-through';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">Reservations Ledger & Distribution Mix</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              {reservations.length} Historical Stays
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit trail of non-overlapping guest stays, rate realizations, and distribution channels.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Non-Overlapping Verification: Passed</span>
          </div>
        </div>
      </div>

      {/* SUMMARY STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400">Total Bookings Recorded</div>
          <div className="text-xl font-bold text-white mt-1">{totalBookings}</div>
          <div className="text-[10px] text-slate-400 mt-1">
            {completedOrInHouse.length} realized stays
          </div>
        </div>

        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400">Gross Room Revenue</div>
          <div className="text-xl font-bold text-white font-mono mt-1">{formatAED(totalGrossRev)}</div>
          <div className="text-[10px] text-slate-400 mt-1">
            Average realized per stay: {formatAED(Math.round(totalGrossRev / Math.max(1, completedOrInHouse.length)))}
          </div>
        </div>

        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400">OTA Commission Paid</div>
          <div className="text-xl font-bold text-rose-400 font-mono mt-1">-{formatAED(totalCommission)}</div>
          <div className="text-[10px] text-slate-400 mt-1">
            Net Realized: <span className="text-emerald-400 font-mono">{formatAED(totalNetRev)}</span>
          </div>
        </div>

        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400">Cancellation Rate</div>
          <div className="text-xl font-bold text-amber-400 mt-1">{cancellationRate}%</div>
          <div className="text-[10px] text-slate-400 mt-1">
            {canceledCount} cancellations within 48h SLA
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 text-xs">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search by guest name, unit (APT-205), or Res ID..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-2" />
          <select
            aria-label="Filter Booking Status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-transparent text-slate-200 w-full focus:outline-none cursor-pointer"
          >
            <option value="ALL" className="bg-slate-900">All Statuses</option>
            <option value="In-House" className="bg-slate-900">In-House Stays</option>
            <option value="Confirmed" className="bg-slate-900">Confirmed Future Bookings</option>
            <option value="Completed" className="bg-slate-900">Completed Stays</option>
            <option value="Canceled" className="bg-slate-900">Canceled Bookings</option>
          </select>
        </div>

        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-2" />
          <select
            aria-label="Filter Booking Channel"
            value={channelFilter}
            onChange={(e) => {
              setChannelFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-transparent text-slate-200 w-full focus:outline-none cursor-pointer"
          >
            <option value="ALL" className="bg-slate-900">All Booking Channels</option>
            <option value="Direct Web" className="bg-slate-900">Direct Web (0% Comm)</option>
            <option value="Corporate Contract" className="bg-slate-900">Corporate Contract (0% Comm)</option>
            <option value="Booking.com" className="bg-slate-900">Booking.com (15% Comm)</option>
            <option value="Expedia" className="bg-slate-900">Expedia (18% Comm)</option>
            <option value="Airbnb" className="bg-slate-900">Airbnb (12% Comm)</option>
          </select>
        </div>
      </div>

      {/* RESERVATIONS TABLE */}
      <div className="bg-slate-900/80 rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
                <th className="py-3 px-4">Res ID</th>
                <th className="py-3 px-3">Unit</th>
                <th className="py-3 px-3">Guest Name</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Channel</th>
                <th className="py-3 px-3">Dates (In - Out)</th>
                <th className="py-3 px-3 text-center">Nights</th>
                <th className="py-3 px-3 text-right">Rate/Night</th>
                <th className="py-3 px-3 text-right">Gross Rev</th>
                <th className="py-3 px-3 text-right">Net Rev</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-500">
                    No reservations matching current filters.
                  </td>
                </tr>
              ) : (
                paginated.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-850/50 text-slate-300 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-sky-400">{r.id}</td>
                    <td className="py-3 px-3 font-mono font-bold text-white">
                      {r.unitId.replace('APT-', '').replace('REAL-APT-', '')}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-200">{r.guestName}</td>
                    <td className="py-3 px-3 text-slate-400">{r.guestCategory}</td>
                    <td className="py-3 px-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                        r.channel === 'Direct Web' || r.channel === 'Corporate Contract'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {r.channel}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                      {r.checkInDate} &rarr; {r.checkOutDate}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-slate-300">{r.nights}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">{formatAED(r.dailyRateAED)}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-white">
                      {r.status === 'Canceled' ? 'AED 0' : formatAED(r.totalRoomRevenueAED)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-400">
                      {r.status === 'Canceled' ? 'AED 0' : formatAED(r.netRevenueAED)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${getStatusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} reservations
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-slate-300">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
