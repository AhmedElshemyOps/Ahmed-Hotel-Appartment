import React, { useState } from 'react';
import {
  Wrench,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  DollarSign,
  Building,
  Filter,
  Plus,
} from 'lucide-react';
import {
  MaintenanceWorkOrder,
  HousekeepingTask,
  GuestComplaint,
  Apartment,
} from '../types';
import { formatAED } from '../data/kpiEngine';

interface OperationsViewProps {
  maintenanceOrders: MaintenanceWorkOrder[];
  housekeepingTasks: HousekeepingTask[];
  complaints: GuestComplaint[];
  apartments: Apartment[];
  onSelectApartment: (id: string) => void;
}

export const OperationsView: React.FC<OperationsViewProps> = ({
  maintenanceOrders,
  housekeepingTasks,
  complaints,
  apartments,
  onSelectApartment,
}) => {
  const [activeTab, setActiveTab] = useState<'maintenance' | 'housekeeping' | 'complaints' | 'audits'>('maintenance');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');

  // Maintenance statistics
  const openMaint = maintenanceOrders.filter(m => m.status === 'Open' || m.status === 'In Progress');
  const totalMaintCost = maintenanceOrders.reduce((s, m) => s + m.costAED, 0);
  const totalOoONights = maintenanceOrders.reduce((s, m) => s + (m.causedOutOfOrderNights || 0), 0);
  const recurringOrders = maintenanceOrders.filter(m => m.isRecurring);

  // Housekeeping statistics
  const avgTurnaround = Math.round(
    housekeepingTasks.reduce((s, h) => s + h.turnaroundMinutes, 0) / Math.max(1, housekeepingTasks.length)
  );
  const avgInspectionScore = Math.round(
    housekeepingTasks.reduce((s, h) => s + h.inspectionScore, 0) / Math.max(1, housekeepingTasks.length)
  );
  const failedInspections = housekeepingTasks.filter(h => h.status === 'Failed Inspection');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">Operations & Facilities Command</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              Engineering &bull; Housekeeping &bull; Guest Care
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Interconnected tracking of MEP maintenance, cleaning turnaround velocity, and guest complaints.
          </p>
        </div>

        {/* Sub-Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === 'maintenance'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Engineering ({openMaint.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('housekeeping')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === 'housekeeping'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Housekeeping</span>
          </button>

          <button
            onClick={() => setActiveTab('complaints')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === 'complaints'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Complaints ({complaints.filter(c => c.status === 'Open').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audits')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === 'audits'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Quality & SOP</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ENGINEERING & MAINTENANCE */}
      {activeTab === 'maintenance' && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Open Work Orders</div>
              <div className="text-xl font-bold text-amber-400 mt-1">{openMaint.length} Active</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {openMaint.filter(m => m.priority === 'Critical').length} Critical urgency
              </div>
            </div>

            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Total Maintenance Spend</div>
              <div className="text-xl font-bold text-white font-mono mt-1">{formatAED(totalMaintCost)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Avg per unit: {formatAED(Math.round(totalMaintCost / apartments.length))}
              </div>
            </div>

            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Recurring Defects</div>
              <div className="text-xl font-bold text-rose-400 mt-1">{recurringOrders.length} Cases</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Unit 205 (HVAC) & 304 (Plumbing)
              </div>
            </div>

            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Out-of-Order Room Nights</div>
              <div className="text-xl font-bold text-slate-100 mt-1">{totalOoONights} Nights</div>
              <div className="text-[10px] text-rose-400 mt-0.5">
                Revenue exposure: ~AED 8,200
              </div>
            </div>
          </div>

          {/* Unit 205 Chronic HVAC Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/60 to-slate-900 border border-rose-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <h3 className="text-sm font-bold text-rose-300">
                  Critical Recurring Case: Apartment 205 HVAC Inverter Failure
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-900 text-rose-200 border border-rose-700 font-mono">
                  CASE-HVAC-205
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                4 recorded compressor breakdowns in 6 months. Total maintenance repair spend (AED 4,950) + out-of-order room losses (AED 4,600) exceeds 68% of new Daikin unit replacement cost (AED 6,200).
              </p>
            </div>
            <button
              onClick={() => onSelectApartment('APT-205')}
              className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs whitespace-nowrap cursor-pointer transition-all"
            >
              Inspect Unit 205 History &rarr;
            </button>
          </div>

          {/* Work Orders Ledger */}
          <div className="bg-slate-900/80 rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Engineering Work Orders Ledger</h3>
              <span className="text-xs text-slate-400">Showing {maintenanceOrders.length} orders</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-3">Unit</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-3">Reported</th>
                    <th className="py-3 px-3">Priority</th>
                    <th className="py-3 px-3">Technician</th>
                    <th className="py-3 px-3 text-right">Cost (AED)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {maintenanceOrders.map(m => (
                    <tr key={m.id} className="hover:bg-slate-850/50 text-slate-300 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-sky-400">{m.id}</td>
                      <td className="py-3 px-3 font-mono font-bold text-white">
                        <button
                          onClick={() => onSelectApartment(m.unitId)}
                          className="hover:text-sky-400 underline decoration-slate-600 cursor-pointer"
                        >
                          {m.unitId.replace('APT-', '')}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-slate-200">{m.category}</td>
                      <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                        {m.description}
                        {m.isRecurring && (
                          <span className="ml-2 text-[9px] px-1 py-0.2 rounded bg-rose-950 text-rose-400 border border-rose-800">
                            Recurring
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-400">{m.reportedDate}</td>
                      <td className="py-3 px-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                          m.priority === 'Critical' ? 'bg-rose-950 text-rose-300 border-rose-800' :
                          m.priority === 'High' ? 'bg-amber-950 text-amber-300 border-amber-800' :
                          'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {m.priority}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400">{m.technician}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-white">{formatAED(m.costAED)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${
                          m.status === 'Resolved' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' :
                          'bg-amber-950 text-amber-300 border-amber-800 animate-pulse'
                        }`}>
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HOUSEKEEPING BOARD */}
      {activeTab === 'housekeeping' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Avg Turnover Duration</div>
              <div className="text-xl font-bold text-white mt-1">{avgTurnaround} Mins</div>
              <div className="text-[10px] text-amber-400 mt-0.5">Target: 60 Mins</div>
            </div>

            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Average Inspection Score</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">{avgInspectionScore} / 100</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Threshold: 88 points</div>
            </div>

            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Failed Quality Inspections</div>
              <div className="text-xl font-bold text-rose-400 mt-1">{failedInspections.length} Tasks</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Re-cleaning completed</div>
            </div>

            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Floor Linen Par Level</div>
              <div className="text-xl font-bold text-sky-400 mt-1">2.4 Pars</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Floor 3 restocking bottleneck</div>
            </div>
          </div>

          <div className="bg-slate-900/80 rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Recent Housekeeping Quality Turnaround Logs</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
                    <th className="py-3 px-4">Task ID</th>
                    <th className="py-3 px-3">Unit</th>
                    <th className="py-3 px-3">Housekeeper</th>
                    <th className="py-3 px-3">Inspector</th>
                    <th className="py-3 px-3">Date & Time</th>
                    <th className="py-3 px-3 text-center">Duration</th>
                    <th className="py-3 px-3 text-center">Score</th>
                    <th className="py-3 px-4">Inspector Defect Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {housekeepingTasks.slice(0, 15).map(h => (
                    <tr key={h.id} className="text-slate-300">
                      <td className="py-3 px-4 font-mono font-semibold text-sky-400">{h.id}</td>
                      <td className="py-3 px-3 font-mono font-bold text-white">{h.unitId.replace('APT-', '')}</td>
                      <td className="py-3 px-3 font-medium text-slate-200">{h.housekeeper}</td>
                      <td className="py-3 px-3 text-slate-400">{h.inspector}</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-400">{h.completedAt || h.scheduledDate}</td>
                      <td className="py-3 px-3 text-center font-mono">{h.turnaroundMinutes}m</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                          h.inspectionScore >= 90 ? 'text-emerald-400 bg-emerald-950/60' :
                          h.inspectionScore >= 85 ? 'text-amber-400 bg-amber-950/60' : 'text-rose-400 bg-rose-950/60'
                        }`}>
                          {h.inspectionScore}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {h.defectNotes || <span className="text-emerald-500/80">Passed standard inspection</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GUEST COMPLAINTS */}
      {activeTab === 'complaints' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Total Logged Complaints</div>
              <div className="text-xl font-bold text-white mt-1">{complaints.length}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Past 12 months</div>
            </div>

            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Complaint Rate per 100 Nights</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">1.82</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Benchmark: &lt; 2.50</div>
            </div>

            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Service Recovery Credits Issued</div>
              <div className="text-xl font-bold text-rose-400 font-mono mt-1">
                {formatAED(complaints.reduce((s, c) => s + c.serviceRecoveryCostAED, 0))}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Includes dining & room credits</div>
            </div>
          </div>

          <div className="space-y-3">
            {complaints.map(c => (
              <div key={c.id} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                      Unit {c.unitId.replace('APT-', '')}
                    </span>
                    <span className="font-semibold text-slate-200">{c.category}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                      c.severity === 'Critical' ? 'bg-rose-950 text-rose-300 border-rose-800' :
                      c.severity === 'High' ? 'bg-amber-950 text-amber-300 border-amber-800' :
                      'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {c.severity} Severity
                    </span>
                  </div>
                  <span className="text-slate-400 text-[11px]">{c.reportedAt}</span>
                </div>

                <p className="text-slate-300 text-xs leading-relaxed">{c.description}</p>

                {c.resolutionNote && (
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-400 font-medium">Resolution: {c.resolutionNote}</span>
                    <span className="text-slate-400">
                      Recovery: <strong className="text-white font-mono">{formatAED(c.serviceRecoveryCostAED)}</strong>
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: QUALITY & SOP AUDITS */}
      {activeTab === 'audits' && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Dubai DTCM & Life Safety Regulatory Audit Check</h3>
                <p className="text-xs text-slate-400 mt-0.5">Governmental and brand compliance standards checklist</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
                Status: Audit Compliant (96/100)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-200">Civil Defense Fire Alarm & Smoke Sensors</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Tested across all 40 units Q3 2026. Next inspection: March 2027.</div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-200">Legionella Water Tank Testing</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Rooftop and basement domestic water certified zero bacteria.</div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-200">DTCM Hotel Apartments Classification</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Deluxe Serviced Apartment License valid until Dec 2027.</div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-200">Passenger Elevator AMC Safety Recertification</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Schindler contract maintenance visit completed monthly.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
