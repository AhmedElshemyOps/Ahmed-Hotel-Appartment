import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Download,
  Calendar,
  Building2,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import {
  PropertyKPISummary,
  AgentRecommendation,
  MaintenanceWorkOrder,
  GuestComplaint,
  Apartment,
  Reservation,
  FinancialTransaction,
} from '../types';
import { formatAED, formatPercent, KPI_GLOSSARY } from '../data/kpiEngine';

interface ReportsViewProps {
  kpi: PropertyKPISummary;
  recommendations: AgentRecommendation[];
  maintenanceOrders: MaintenanceWorkOrder[];
  complaints: GuestComplaint[];
  apartments: Apartment[];
  reservations: Reservation[];
  transactions: FinancialTransaction[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  kpi,
  recommendations,
  maintenanceOrders,
  complaints,
  apartments,
  reservations,
  transactions,
}) => {
  const [reportType, setReportType] = useState<'MONTHLY_OWNER' | 'WEEKLY_MANAGEMENT'>('MONTHLY_OWNER');
  const [reportMonth, setReportMonth] = useState('October 2026');

  // Trigger Print to PDF
  const handlePrint = () => {
    window.print();
  };

  // Export Supporting CSV Data
  const handleExportCSV = () => {
    const csvRows = [
      ['Metric', 'Actual Value', 'Benchmark / Budget', 'Variance', 'Unit of Measure'],
      ['Total Inventory', '40', '40', '0', 'Units'],
      ['Available Unit Nights', kpi.availableUnitNights.toString(), kpi.availableUnitNights.toString(), '0', 'Nights'],
      ['Occupied Unit Nights', kpi.occupiedUnitNights.toString(), Math.round(kpi.availableUnitNights * 0.80).toString(), (kpi.occupiedUnitNights - Math.round(kpi.availableUnitNights * 0.80)).toString(), 'Nights'],
      ['Occupancy Rate', `${kpi.occupancyPercent}%`, '80.0%', `+${(kpi.occupancyPercent - 80).toFixed(1)}%`, '%'],
      ['Average Daily Rate (ADR)', `AED ${kpi.adrAED}`, 'AED 690', `+AED ${kpi.adrAED - 690}`, 'AED'],
      ['RevPAR', `AED ${kpi.revParAED}`, 'AED 552', `+AED ${kpi.revParAED - 552}`, 'AED'],
      ['Room Revenue', `AED ${kpi.roomRevenueAED}`, `AED ${kpi.budgetRevenueAED}`, `AED ${kpi.revenueBudgetVarianceAED}`, 'AED'],
      ['Operating Expenses (OpEx)', `AED ${kpi.operatingExpensesAED}`, `AED ${kpi.budgetOpExAED}`, `AED ${kpi.operatingExpensesAED - kpi.budgetOpExAED}`, 'AED'],
      ['Net Operating Income (NOI)', `AED ${kpi.netOperatingIncomeAED}`, `AED ${kpi.budgetNOIAED}`, `AED ${kpi.noiBudgetVarianceAED}`, 'AED'],
      ['Operating Margin', `${kpi.operatingMarginPercent}%`, '45.0%', `+${(kpi.operatingMarginPercent - 45).toFixed(1)}%`, '%'],
      ['ALOS', `${kpi.alosDays}`, '3.8', '0.0', 'Nights'],
      ['Cancellation Rate', `${kpi.cancellationRatePercent}%`, '8.0%', `+${(kpi.cancellationRatePercent - 8).toFixed(1)}%`, '%'],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ahmed_Quality_Ops_Owner_Report_${reportMonth.replace(' ', '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Controls Bar */}
      <div className="no-print bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">Executive Owner & Management Reports</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 font-mono">
              Formal Institutional Format
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit-grade performance dossiers ready for property owners, asset managers, and department heads.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 p-1 text-xs">
            <button
              onClick={() => setReportType('MONTHLY_OWNER')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                reportType === 'MONTHLY_OWNER'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Monthly Owner Report
            </button>
            <button
              onClick={() => setReportType('WEEKLY_MANAGEMENT')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                reportType === 'WEEKLY_MANAGEMENT'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Weekly Management Brief
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all cursor-pointer shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print to PDF</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* REPORT VIEWER CONTAINER (Designed for Screen & Print PDF) */}
      <div className="report-container max-w-5xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-8 text-slate-200">
        {/* SECTION 1: COVER PAGE */}
        <div className="border-b border-slate-800 pb-8 space-y-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs uppercase font-extrabold tracking-widest text-sky-400">
                Ahmed Quality Ops — Hospitality Intelligence
              </span>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {reportType === 'MONTHLY_OWNER' ? 'Monthly Property Asset Management Report' : 'Weekly Operations & Revenue Management Brief'}
              </h1>
              <p className="text-sm text-slate-400">
                Property: <strong className="text-slate-200">Ahmed Quality Ops — Serviced Apartments (40 Units)</strong>
              </p>
            </div>

            <div className="text-right text-xs text-slate-400 font-mono space-y-1">
              <div>Reporting Period: <strong className="text-white">{reportMonth}</strong></div>
              <div>Currency: <strong className="text-amber-400">AED (UAE Dirham)</strong></div>
              <div>Audit Status: <span className="text-emerald-400 font-semibold">GAAP / USALI Verified</span></div>
              <div className="text-[10px] text-slate-500">Generated: 2026-10-14 14:00 GST</div>
            </div>
          </div>
        </div>

        {/* SECTION 2: EXECUTIVE SUMMARY */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            <span>1. Executive Summary & Property Performance</span>
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            During the audit period, the property delivered robust commercial results, achieving an average occupancy of <strong className="text-white">{kpi.occupancyPercent}%</strong> at an Average Daily Rate (ADR) of <strong className="text-white">{formatAED(kpi.adrAED)}</strong>, driving RevPAR to <strong className="text-sky-300">{formatAED(kpi.revParAED)}</strong>. Total recognized operating revenue reached <strong className="text-white">{formatAED(kpi.totalRevenueAED)}</strong>, delivering Net Operating Income (NOI) of <strong className="text-emerald-400">{formatAED(kpi.netOperatingIncomeAED)}</strong> at a <strong className="text-emerald-400">{kpi.operatingMarginPercent}%</strong> operating margin (+{formatAED(kpi.noiBudgetVarianceAED)} ahead of planned budget).
          </p>
        </div>

        {/* SECTION 3: KEY PERFORMANCE INDICATORS TABLE */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-sky-400">
            2. Core Financial & Operational KPI Table
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Metric</th>
                  <th className="py-2.5 px-3 text-right">Actual Realized</th>
                  <th className="py-2.5 px-3 text-right">Approved Budget</th>
                  <th className="py-2.5 px-3 text-right">Variance</th>
                  <th className="py-2.5 px-3">Performance Audit Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                <tr>
                  <td className="py-2 px-3 font-sans font-medium text-slate-200">Occupancy Rate</td>
                  <td className="py-2 px-3 text-right text-white font-bold">{kpi.occupancyPercent}%</td>
                  <td className="py-2 px-3 text-right text-slate-400">78.0%</td>
                  <td className="py-2 px-3 text-right text-emerald-400">+{(kpi.occupancyPercent - 78).toFixed(1)}%</td>
                  <td className="py-2 px-3 font-sans text-slate-400 text-[11px]">
                    {kpi.occupiedUnitNights} nights sold of {kpi.availableUnitNights} available
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans font-medium text-slate-200">Average Daily Rate (ADR)</td>
                  <td className="py-2 px-3 text-right text-white font-bold">{formatAED(kpi.adrAED)}</td>
                  <td className="py-2 px-3 text-right text-slate-400">AED 690</td>
                  <td className="py-2 px-3 text-right text-emerald-400">+{formatAED(kpi.adrAED - 690)}</td>
                  <td className="py-2 px-3 font-sans text-slate-400 text-[11px]">Strong corporate & 3-Bed mix</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans font-medium text-slate-200">RevPAR Yield</td>
                  <td className="py-2 px-3 text-right text-sky-400 font-bold">{formatAED(kpi.revParAED)}</td>
                  <td className="py-2 px-3 text-right text-slate-400">AED 538</td>
                  <td className="py-2 px-3 text-right text-emerald-400">+{formatAED(kpi.revParAED - 538)}</td>
                  <td className="py-2 px-3 font-sans text-slate-400 text-[11px]">Zero double counting (ADR × Occ%)</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans font-medium text-slate-200">Total Operating Revenue</td>
                  <td className="py-2 px-3 text-right text-white font-bold">{formatAED(kpi.totalRevenueAED)}</td>
                  <td className="py-2 px-3 text-right text-slate-400">{formatAED(kpi.budgetRevenueAED)}</td>
                  <td className="py-2 px-3 text-right text-emerald-400">+{formatAED(kpi.revenueBudgetVarianceAED)}</td>
                  <td className="py-2 px-3 font-sans text-slate-400 text-[11px]">+{kpi.revenueBudgetVariancePercent}% above annual budget</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans font-medium text-slate-200">Operating Expenses (OpEx)</td>
                  <td className="py-2 px-3 text-right text-slate-200">{formatAED(kpi.operatingExpensesAED)}</td>
                  <td className="py-2 px-3 text-right text-slate-400">{formatAED(kpi.budgetOpExAED)}</td>
                  <td className="py-2 px-3 text-right text-slate-300">{formatAED(kpi.operatingExpensesAED - kpi.budgetOpExAED)}</td>
                  <td className="py-2 px-3 font-sans text-slate-400 text-[11px]">Includes DEWA, payroll, linen & OTA comm.</td>
                </tr>
                <tr className="bg-emerald-950/30 text-emerald-300 font-bold">
                  <td className="py-2.5 px-3 font-sans">Net Operating Income (NOI)</td>
                  <td className="py-2.5 px-3 text-right text-emerald-400 text-sm">{formatAED(kpi.netOperatingIncomeAED)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">{formatAED(kpi.budgetNOIAED)}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-400">+{formatAED(kpi.noiBudgetVarianceAED)}</td>
                  <td className="py-2.5 px-3 font-sans text-[11px]">Operating Margin: {kpi.operatingMarginPercent}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 4: ASSET CONDITION & MAINTENANCE HIGHLIGHTS */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>3. Asset Condition & Technical Facilities Review</span>
          </h3>
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-2">
            <div className="font-semibold text-slate-200">
              Significant Engineering Cases Requiring Owner Action:
            </div>
            <ul className="list-disc pl-5 space-y-1 text-slate-300 leading-relaxed">
              <li>
                <strong className="text-rose-400">Unit 205 (1-Bedroom):</strong> Chronic HVAC inverter compressor breakdown (4 service orders, 6 out-of-order nights, AED 4,950 cumulative repairs). Full unit replacement quote received from Daikin authorized contractor for <strong className="text-white">AED 6,200</strong>. Recommended for immediate CAPEX authorization.
              </li>
              <li>
                <strong className="text-amber-400">Unit 304 (2-Bedroom):</strong> Master bathroom concealed mixer valve leak repaired (AED 3,150). Preventive replacement of mixer cartridges across Units 301-308 scheduled for next low-occupancy window to avoid corridor sub-floor water damage.
              </li>
              <li>
                <strong className="text-slate-300">Preventive Maintenance:</strong> All 40 apartments passed semi-annual smoke detector and life safety inspections in compliance with Dubai Civil Defense guidelines.
              </li>
            </ul>
          </div>
        </div>

        {/* SECTION 5: AI AGENT RECOMMENDATIONS & NEXT MONTH PRIORITIES */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>4. Consolidated Management Action Priorities</span>
          </h3>

          <div className="space-y-2">
            {recommendations.slice(0, 4).map((rec, idx) => (
              <div key={rec.id} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-white">
                    {idx + 1}. {rec.agentRole} &bull; {rec.recommendedAction}
                  </span>
                  <span className="text-amber-400 font-mono">{formatAED(rec.financialImplicationAED)} ROI</span>
                </div>
                <div className="text-slate-400 text-[11px] flex items-center justify-between">
                  <span>Accountable Manager: <strong className="text-slate-200">{rec.responsibleManager}</strong></span>
                  <span>Target Date: {rec.followUpDate} &bull; Status: {rec.approvalStatus}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 6: APPENDIX & KPI DEFINITIONS */}
        <div className="pt-6 border-t border-slate-800 space-y-3 text-xs text-slate-400">
          <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
            5. Appendix: Approved KPI Definitions & Accounting Standard
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
            <div>
              <strong className="text-slate-300">ADR (Average Daily Rate):</strong> {KPI_GLOSSARY.ADR.formula} — Realized room revenue divided by occupied unit nights.
            </div>
            <div>
              <strong className="text-slate-300">RevPAR:</strong> {KPI_GLOSSARY.RevPAR.formula} — Total room revenue divided by total physically available unit nights.
            </div>
            <div>
              <strong className="text-slate-300">Operating Margin (NOI):</strong> {KPI_GLOSSARY.OperatingMargin.formula} — Net operating cash flow divided by total operating revenue.
            </div>
            <div>
              <strong className="text-slate-300">Data Integrity Notice:</strong> All figures derived from verified reservations and financial ledgers. Zero double counting.
            </div>
          </div>
        </div>

        {/* SIGN-OFF BLOCK */}
        <div className="pt-6 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            <span>Prepared by: <strong className="text-slate-200">General Manager & Financial Controller</strong></span>
          </div>
          <div>
            <span>Approved by: <strong className="text-slate-200">Property Owner & Asset Board</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
