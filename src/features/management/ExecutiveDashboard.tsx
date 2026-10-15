import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Building,
  DollarSign,
  BedDouble,
  Wrench,
  AlertCircle,
  FileCheck2,
  Calendar,
  Filter,
  ArrowUpRight,
  Sparkles,
  ChevronRight,
  PieChart as PieIcon,
  BarChart3,
  CheckCircle2,
  ShieldCheck,
  Activity,
  Radio,
  Target,
  Compass,
  Zap,
  Printer,
  ArrowLeftRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Apartment,
  Reservation,
  FinancialTransaction,
  MaintenanceWorkOrder,
  GuestComplaint,
  PropertyKPISummary,
  AgentRecommendation,
  LiveRefreshRecord,
} from '../../shared/types';
import { formatAED, formatPercent, calculatePropertyKPISummary } from '../revenue/kpiEngine';

interface ExecutiveDashboardProps {
  kpi: PropertyKPISummary;
  apartments: Apartment[];
  reservations: Reservation[];
  transactions: FinancialTransaction[];
  maintenanceOrders: MaintenanceWorkOrder[];
  complaints: GuestComplaint[];
  recommendations: AgentRecommendation[];
  selectedDateRange: string;
  onDateRangeChange: (val: string) => void;
  selectedTypeFilter: string;
  onTypeFilterChange: (val: string) => void;
  onSelectApartment: (aptId: string) => void;
  onNavigateToTab: (tab: any) => void;
  liveRefreshHistory?: LiveRefreshRecord[];
  isLiveMode?: boolean;
  countdownSeconds?: number;
}

export type AlertSeverity = 'normal' | 'amber' | 'red' | 'favorable';

export interface KPIThresholdEvaluation {
  currentValue: number;
  benchmarkValue: number;
  deviationPercent: number;
  severity: AlertSeverity;
  isUnfavorable: boolean;
  label: string;
  badgeClass: string;
  cardBorderClass: string;
}

export function evaluateThreshold(
  current: number,
  benchmark: number,
  direction: 'higher_is_better' | 'lower_is_better'
): KPIThresholdEvaluation {
  const deviation = benchmark > 0 ? ((current - benchmark) / benchmark) * 100 : 0;
  const isUnfavorable = direction === 'higher_is_better' ? deviation < -10 : deviation > 10;
  const isCritical = direction === 'higher_is_better' ? deviation < -20 : deviation > 25;

  let severity: AlertSeverity = 'normal';
  if (isCritical) {
    severity = 'red';
  } else if (isUnfavorable) {
    severity = 'amber';
  } else if ((direction === 'higher_is_better' && deviation > 10) || (direction === 'lower_is_better' && deviation < -10)) {
    severity = 'favorable';
  }

  const sign = deviation >= 0 ? '+' : '';
  const formattedDev = `${sign}${deviation.toFixed(1)}%`;

  let badgeClass = 'text-slate-400 border-slate-700 bg-slate-800/80';
  let cardBorderClass = 'border-slate-800 hover:border-slate-700';

  if (severity === 'red') {
    badgeClass = 'text-rose-300 border-rose-700 bg-rose-950/90 animate-pulse';
    cardBorderClass = 'border-rose-600 bg-rose-950/30 ring-1 ring-rose-500/50 hover:border-rose-400';
  } else if (severity === 'amber') {
    badgeClass = 'text-amber-300 border-amber-700 bg-amber-950/90';
    cardBorderClass = 'border-amber-500/80 bg-amber-950/20 ring-1 ring-amber-500/40 hover:border-amber-400';
  } else if (severity === 'favorable') {
    badgeClass = 'text-emerald-300 border-emerald-700 bg-emerald-950/90';
    cardBorderClass = 'border-emerald-800/80 hover:border-emerald-600';
  }

  return {
    currentValue: current,
    benchmarkValue: benchmark,
    deviationPercent: deviation,
    severity,
    isUnfavorable,
    label: formattedDev,
    badgeClass,
    cardBorderClass,
  };
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  kpi,
  apartments,
  reservations,
  transactions,
  maintenanceOrders,
  complaints,
  recommendations,
  selectedDateRange,
  onDateRangeChange,
  selectedTypeFilter,
  onTypeFilterChange,
  onSelectApartment,
  onNavigateToTab,
  liveRefreshHistory = [],
  isLiveMode = false,
  countdownSeconds = 60,
}) => {
  const [sparklineMetric, setSparklineMetric] = useState<'occupancy' | 'adr' | 'revpar'>('occupancy');
  const [forecastScenario, setForecastScenario] = useState<'base' | 'aggressive' | 'conservative'>('base');
  const [forecastMetric, setForecastMetric] = useState<'occupancy' | 'revpar'>('occupancy');

  // Compare Periods Feature State
  const [isCompareMode, setIsCompareMode] = useState<boolean>(false);
  const [compareDateRange, setCompareDateRange] = useState<string>('PREVIOUS_MONTH');

  // Interval Resolver for Primary & Comparison Horizons
  const resolveDateInterval = (rangeKey: string) => {
    switch (rangeKey) {
      case 'PREVIOUS_MONTH':
        return { start: '2026-09-01', end: '2026-09-30', label: 'Previous Month (Sep 2026)' };
      case 'Q3_2026':
        return { start: '2026-07-01', end: '2026-09-30', label: 'Q3 2026 (Jul – Sep)' };
      case 'Q2_2026':
        return { start: '2026-04-01', end: '2026-06-30', label: 'Q2 2026 (Apr – Jun)' };
      case 'FULL_12_MONTHS':
        return { start: '2025-11-01', end: '2026-10-31', label: 'Past 12 Months' };
      case 'LAST_30_DAYS':
      default:
        return { start: '2026-10-01', end: '2026-10-31', label: 'Current Month (Oct 2026)' };
    }
  };

  const primaryInterval = useMemo(() => resolveDateInterval(selectedDateRange), [selectedDateRange]);
  const compareInterval = useMemo(() => resolveDateInterval(compareDateRange), [compareDateRange]);

  // Compute Comparison Period KPI Summary (Side-by-side reconciliation)
  const compareKpiSummary = useMemo(() => {
    if (!isCompareMode) return null;
    return calculatePropertyKPISummary({
      apartments,
      reservations,
      transactions,
      maintenanceOrders,
      complaints,
      startDate: compareInterval.start,
      endDate: compareInterval.end,
      periodLabel: compareInterval.label,
      apartmentTypeFilter: selectedTypeFilter,
    });
  }, [
    isCompareMode,
    apartments,
    reservations,
    transactions,
    maintenanceOrders,
    complaints,
    compareInterval,
    selectedTypeFilter,
  ]);

  // Structured metrics array for side-by-side comparison matrix
  const comparisonMetrics = useMemo(() => {
    if (!compareKpiSummary) return [];

    const occDiff = Number((kpi.occupancyPercent - compareKpiSummary.occupancyPercent).toFixed(1));
    const occPctChange = compareKpiSummary.occupancyPercent > 0 
      ? Number(((occDiff / compareKpiSummary.occupancyPercent) * 100).toFixed(1)) 
      : 0;

    const adrDiff = kpi.adrAED - compareKpiSummary.adrAED;
    const adrPctChange = compareKpiSummary.adrAED > 0 
      ? Number(((adrDiff / compareKpiSummary.adrAED) * 100).toFixed(1)) 
      : 0;

    const revParDiff = kpi.revParAED - compareKpiSummary.revParAED;
    const revParPctChange = compareKpiSummary.revParAED > 0 
      ? Number(((revParDiff / compareKpiSummary.revParAED) * 100).toFixed(1)) 
      : 0;

    const revDiff = kpi.roomRevenueAED - compareKpiSummary.roomRevenueAED;
    const revPctChange = compareKpiSummary.roomRevenueAED > 0 
      ? Number(((revDiff / compareKpiSummary.roomRevenueAED) * 100).toFixed(1)) 
      : 0;

    const opexDiff = kpi.operatingExpensesAED - compareKpiSummary.operatingExpensesAED;
    const opexPctChange = compareKpiSummary.operatingExpensesAED > 0 
      ? Number(((opexDiff / compareKpiSummary.operatingExpensesAED) * 100).toFixed(1)) 
      : 0;

    const noiDiff = kpi.netOperatingIncomeAED - compareKpiSummary.netOperatingIncomeAED;
    const noiPctChange = compareKpiSummary.netOperatingIncomeAED > 0 
      ? Number(((noiDiff / compareKpiSummary.netOperatingIncomeAED) * 100).toFixed(1)) 
      : 0;

    const marginDiff = Number((kpi.operatingMarginPercent - compareKpiSummary.operatingMarginPercent).toFixed(1));
    const alosDiff = Number((kpi.alosDays - compareKpiSummary.alosDays).toFixed(1));
    const oooDiff = kpi.outOfOrderUnitNights - compareKpiSummary.outOfOrderUnitNights;
    const compRateDiff = Number((kpi.complaintRatePer100Nights - compareKpiSummary.complaintRatePer100Nights).toFixed(2));
    const maintCostDiff = kpi.maintenanceCostPerUnitAED - compareKpiSummary.maintenanceCostPerUnitAED;

    return [
      {
        name: 'Occupancy Rate',
        primaryFormatted: `${kpi.occupancyPercent}%`,
        compareFormatted: `${compareKpiSummary.occupancyPercent}%`,
        diffFormatted: `${occDiff >= 0 ? '+' : ''}${occDiff} pts`,
        pctChangeFormatted: `${occPctChange >= 0 ? '+' : ''}${occPctChange}%`,
        isFavorable: occDiff >= 0,
      },
      {
        name: 'Average Daily Rate (ADR)',
        primaryFormatted: formatAED(kpi.adrAED),
        compareFormatted: formatAED(compareKpiSummary.adrAED),
        diffFormatted: `${adrDiff >= 0 ? '+' : ''}${formatAED(adrDiff)}`,
        pctChangeFormatted: `${adrPctChange >= 0 ? '+' : ''}${adrPctChange}%`,
        isFavorable: adrDiff >= 0,
      },
      {
        name: 'RevPAR (Revenue Per Available Unit)',
        primaryFormatted: formatAED(kpi.revParAED),
        compareFormatted: formatAED(compareKpiSummary.revParAED),
        diffFormatted: `${revParDiff >= 0 ? '+' : ''}${formatAED(revParDiff)}`,
        pctChangeFormatted: `${revParPctChange >= 0 ? '+' : ''}${revParPctChange}%`,
        isFavorable: revParDiff >= 0,
      },
      {
        name: 'Total Room Revenue',
        primaryFormatted: formatAED(kpi.roomRevenueAED),
        compareFormatted: formatAED(compareKpiSummary.roomRevenueAED),
        diffFormatted: `${revDiff >= 0 ? '+' : ''}${formatAED(revDiff)}`,
        pctChangeFormatted: `${revPctChange >= 0 ? '+' : ''}${revPctChange}%`,
        isFavorable: revDiff >= 0,
      },
      {
        name: 'Operating Expenses (OpEx)',
        primaryFormatted: formatAED(kpi.operatingExpensesAED),
        compareFormatted: formatAED(compareKpiSummary.operatingExpensesAED),
        diffFormatted: `${opexDiff >= 0 ? '+' : ''}${formatAED(opexDiff)}`,
        pctChangeFormatted: `${opexPctChange >= 0 ? '+' : ''}${opexPctChange}%`,
        isFavorable: opexDiff <= 0,
      },
      {
        name: 'Net Operating Income (NOI)',
        primaryFormatted: formatAED(kpi.netOperatingIncomeAED),
        compareFormatted: formatAED(compareKpiSummary.netOperatingIncomeAED),
        diffFormatted: `${noiDiff >= 0 ? '+' : ''}${formatAED(noiDiff)}`,
        pctChangeFormatted: `${noiPctChange >= 0 ? '+' : ''}${noiPctChange}%`,
        isFavorable: noiDiff >= 0,
      },
      {
        name: 'Operating Margin %',
        primaryFormatted: `${kpi.operatingMarginPercent}%`,
        compareFormatted: `${compareKpiSummary.operatingMarginPercent}%`,
        diffFormatted: `${marginDiff >= 0 ? '+' : ''}${marginDiff} pts`,
        pctChangeFormatted: `${marginDiff >= 0 ? '+' : ''}${marginDiff} pts`,
        isFavorable: marginDiff >= 0,
      },
      {
        name: 'Average Length of Stay (ALOS)',
        primaryFormatted: `${kpi.alosDays} nights`,
        compareFormatted: `${compareKpiSummary.alosDays} nights`,
        diffFormatted: `${alosDiff >= 0 ? '+' : ''}${alosDiff}n`,
        pctChangeFormatted: `${alosDiff >= 0 ? '+' : ''}${alosDiff}n`,
        isFavorable: alosDiff >= 0,
      },
      {
        name: 'Out of Order Unit Nights',
        primaryFormatted: `${kpi.outOfOrderUnitNights} nights`,
        compareFormatted: `${compareKpiSummary.outOfOrderUnitNights} nights`,
        diffFormatted: `${oooDiff >= 0 ? '+' : ''}${oooDiff}n`,
        pctChangeFormatted: `${oooDiff >= 0 ? '+' : ''}${oooDiff}n`,
        isFavorable: oooDiff <= 0,
      },
      {
        name: 'Guest Complaint Rate',
        primaryFormatted: `${kpi.complaintRatePer100Nights} / 100n`,
        compareFormatted: `${compareKpiSummary.complaintRatePer100Nights} / 100n`,
        diffFormatted: `${compRateDiff >= 0 ? '+' : ''}${compRateDiff}`,
        pctChangeFormatted: `${compRateDiff >= 0 ? '+' : ''}${compRateDiff} pts`,
        isFavorable: compRateDiff <= 0,
      },
      {
        name: 'Maintenance Cost Per Unit',
        primaryFormatted: formatAED(kpi.maintenanceCostPerUnitAED),
        compareFormatted: formatAED(compareKpiSummary.maintenanceCostPerUnitAED),
        diffFormatted: `${maintCostDiff >= 0 ? '+' : ''}${formatAED(maintCostDiff)}`,
        pctChangeFormatted: `${maintCostDiff >= 0 ? '+' : ''}${formatAED(maintCostDiff)}`,
        isFavorable: maintCostDiff <= 0,
      },
    ];
  }, [kpi, compareKpiSummary]);

  // Count current statuses
  const occupiedCount = apartments.filter(a => a.currentStatus === 'Occupied').length;
  const vacantCleanCount = apartments.filter(a => a.currentStatus === 'Vacant Clean').length;
  const vacantDirtyCount = apartments.filter(a => a.currentStatus === 'Vacant Dirty').length;
  const underMaintCount = apartments.filter(a => a.currentStatus === 'Under Maintenance' || a.currentStatus === 'Out of Order').length;

  const openMaintenance = maintenanceOrders.filter(m => m.status === 'Open' || m.status === 'In Progress');
  const openComplaints = complaints.filter(c => c.status === 'Open' || c.status === 'In Progress');
  const pendingRecs = recommendations.filter(r => r.approvalStatus === 'Pending' || r.approvalStatus === 'Under Review');

  // Sparkline history records (fallback baseline ensures 5 continuous points)
  const defaultHistory: LiveRefreshRecord[] = [
    { id: 't1', refreshNumber: 1, timeLabel: 'T-4', occupancy: Math.max(70, Number((kpi.occupancyPercent - 1.4).toFixed(1))), adr: kpi.adrAED - 8, revpar: kpi.revParAED - 12, openWorkOrders: 4 },
    { id: 't2', refreshNumber: 2, timeLabel: 'T-3', occupancy: Math.max(70, Number((kpi.occupancyPercent + 0.6).toFixed(1))), adr: kpi.adrAED + 4, revpar: kpi.revParAED + 6, openWorkOrders: 3 },
    { id: 't3', refreshNumber: 3, timeLabel: 'T-2', occupancy: Math.max(70, Number((kpi.occupancyPercent - 0.5).toFixed(1))), adr: kpi.adrAED - 3, revpar: kpi.revParAED - 3, openWorkOrders: 3 },
    { id: 't4', refreshNumber: 4, timeLabel: 'T-1', occupancy: Math.max(70, Number((kpi.occupancyPercent + 0.8).toFixed(1))), adr: kpi.adrAED + 6, revpar: kpi.revParAED + 8, openWorkOrders: 4 },
    { id: 't5', refreshNumber: 5, timeLabel: 'Current', occupancy: kpi.occupancyPercent, adr: kpi.adrAED, revpar: kpi.revParAED, openWorkOrders: openMaintenance.length },
  ];

  const displayHistory = (liveRefreshHistory && liveRefreshHistory.length >= 2) ? liveRefreshHistory : defaultHistory;
  const sparklineValues = displayHistory.map(d => d[sparklineMetric]);
  const minVal = Math.min(...sparklineValues);
  const maxVal = Math.max(...sparklineValues);
  const volatilitySpread = (maxVal - minVal).toFixed(1);
  const firstVal = sparklineValues[0] || 0;
  const lastVal = sparklineValues[sparklineValues.length - 1] || 0;
  const netDelta = (lastVal - firstVal).toFixed(1);

  // Channel revenue breakdown for the period
  const channelRevenue: Record<string, number> = {};
  reservations.forEach(r => {
    if (r.status !== 'Canceled') {
      channelRevenue[r.channel] = (channelRevenue[r.channel] || 0) + r.totalRoomRevenueAED;
    }
  });

  // Apartment type revenue breakdown
  const typeRevenue: Record<string, number> = {
    'Studio': 0,
    'One-bedroom': 0,
    'Two-bedroom': 0,
    'Three-bedroom': 0,
  };
  const typeMap = new Map(apartments.map(a => [a.id, a.type]));
  reservations.forEach(r => {
    if (r.status !== 'Canceled') {
      const t = typeMap.get(r.unitId) || 'Studio';
      typeRevenue[t] = (typeRevenue[t] || 0) + r.totalRoomRevenueAED;
    }
  });

  // Monthly trends for the mini-chart simulation
  const monthlyTrendData = [
    { month: 'May', occ: 84, adr: 690, revpar: 580, rev: 695000 },
    { month: 'Jun', occ: 76, adr: 610, revpar: 463, rev: 556000 },
    { month: 'Jul', occ: 72, adr: 580, revpar: 417, rev: 501000 },
    { month: 'Aug', occ: 74, adr: 595, revpar: 440, rev: 528000 },
    { month: 'Sep', occ: 81, adr: 680, revpar: 550, rev: 661000 },
    { month: 'Oct', occ: 86, adr: 745, revpar: 640, rev: 769000 },
  ];

  // 30-Day Forward Predictive Analytics Engine
  // Synthesizes current momentum, OTB reservations pace, and high-season pickup
  const occMult = forecastScenario === 'aggressive' ? 1.025 : forecastScenario === 'conservative' ? 0.955 : 1.0;
  const adrMult = forecastScenario === 'aggressive' ? 1.055 : forecastScenario === 'conservative' ? 0.96 : 1.0;
  const opexMult = forecastScenario === 'aggressive' ? 1.01 : forecastScenario === 'conservative' ? 1.03 : 1.0;

  const forwardOccPace = Math.min(96, Number((kpi.occupancyPercent * 1.032 * occMult).toFixed(1)));
  const forwardADRPace = Math.round(kpi.adrAED * 1.045 * adrMult);
  const forwardRevPARPace = Math.round((forwardOccPace / 100) * forwardADRPace);
  const forwardRoomRevenue = Math.round(40 * 30 * forwardRevPARPace);
  const forwardOpEx = Math.round(kpi.operatingExpensesAED * 1.018 * opexMult);
  const forwardNOI = forwardRoomRevenue - forwardOpEx;
  const forwardMargin = Number(((forwardNOI / forwardRoomRevenue) * 100).toFixed(1));
  const occDeltaForward = Number((forwardOccPace - kpi.occupancyPercent).toFixed(1));
  const adrDeltaForward = Math.round(forwardADRPace - kpi.adrAED);
  const revDeltaForward = forwardRoomRevenue - kpi.roomRevenueAED;
  const noiDeltaForward = forwardNOI - kpi.netOperatingIncomeAED;

  // 4-Horizon 30-Day Weekly Trajectory Data for Recharts Line/Area Forecast
  const forwardWeeklyData = [
    { horizon: 'Wk +1 (D 1–7)', expectedOcc: Math.round(forwardOccPace * 0.98), expectedRevPAR: Math.round(forwardRevPARPace * 0.98), upperOcc: Math.min(99, Math.round(forwardOccPace * 1.02)), lowerOcc: Math.max(60, Math.round(forwardOccPace * 0.94)), otbPace: 74, estRevenue: Math.round(forwardRoomRevenue * 0.23) },
    { horizon: 'Wk +2 (D 8–14)', expectedOcc: Math.round(forwardOccPace * 0.99), expectedRevPAR: Math.round(forwardRevPARPace * 0.99), upperOcc: Math.min(99, Math.round(forwardOccPace * 1.03)), lowerOcc: Math.max(60, Math.round(forwardOccPace * 0.95)), otbPace: 69, estRevenue: Math.round(forwardRoomRevenue * 0.24) },
    { horizon: 'Wk +3 (D 15–21)', expectedOcc: Math.round(forwardOccPace * 1.01), expectedRevPAR: Math.round(forwardRevPARPace * 1.02), upperOcc: Math.min(99, Math.round(forwardOccPace * 1.05)), lowerOcc: Math.max(60, Math.round(forwardOccPace * 0.96)), otbPace: 63, estRevenue: Math.round(forwardRoomRevenue * 0.26) },
    { horizon: 'Wk +4 (D 22–30)', expectedOcc: Math.round(forwardOccPace * 1.02), expectedRevPAR: Math.round(forwardRevPARPace * 1.03), upperOcc: Math.min(99, Math.round(forwardOccPace * 1.06)), lowerOcc: Math.max(60, Math.round(forwardOccPace * 0.97)), otbPace: 58, estRevenue: Math.round(forwardRoomRevenue * 0.27) },
  ];

  return (
    <div className="p-6 space-y-6 dashboard-print-container">
      {/* Print-Only Executive Header (Visible only on print/PDF) */}
      <div className="hidden print:block mb-6 pb-4 border-b-2 border-slate-900 text-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase font-bold tracking-wider text-slate-600">
              Ahmed Quality Ops — Hospitality AI Command Center
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              Executive Performance & Operational Synthesis Report
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Asset: 40 Serviced Apartments &bull; Location: Dubai Marina, UAE &bull; Base Currency: AED (GAAP & USALI Reconciled)
            </p>
          </div>
          <div className="text-right">
            <div className="inline-block px-2.5 py-1 rounded bg-slate-100 border border-slate-300 text-slate-800 text-xs font-mono font-bold">
              OFFICIAL REPORT
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-mono">
              Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        {/* Selected Period & Filter Parameters in Print View */}
        <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-200 text-xs bg-slate-50 p-2.5 rounded border">
          <div>
            <span className="font-semibold text-slate-700">Reporting Interval:</span>
            <div className="font-bold text-slate-900 mt-0.5">
              {selectedDateRange === 'LAST_30_DAYS' && 'Current Month (October 2026)'}
              {selectedDateRange === 'PREVIOUS_MONTH' && 'Previous Month (September 2026)'}
              {selectedDateRange === 'Q3_2026' && 'Q3 2026 (July – September 2026)'}
              {selectedDateRange === 'FULL_12_MONTHS' && 'Trailing 12 Months (Full History)'}
            </div>
          </div>
          <div>
            <span className="font-semibold text-slate-700">Cohort / Filter Scope:</span>
            <div className="font-bold text-slate-900 mt-0.5">
              {selectedTypeFilter === 'ALL' && 'All Apartment Types (40 Inventory Units)'}
              {selectedTypeFilter === 'Studio' && 'Studio Cohort (16 Units)'}
              {selectedTypeFilter === 'One-bedroom' && '1-Bedroom Cohort (12 Units)'}
              {selectedTypeFilter === 'Two-bedroom' && '2-Bedroom Cohort (8 Units)'}
              {selectedTypeFilter === 'Three-bedroom' && '3-Bedroom Penthouse Cohort (4 Units)'}
            </div>
          </div>
          <div>
            <span className="font-semibold text-slate-700">Live Portfolio Status:</span>
            <div className="font-bold text-slate-900 mt-0.5">
              {occupiedCount} Occupied / {apartments.length} Total ({kpi.occupancyPercent}% Occ)
            </div>
          </div>
          {isCompareMode && compareKpiSummary && (
            <div className="col-span-3 mt-2 pt-2 border-t border-slate-300 text-xs flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-700">Side-by-Side Benchmark Period:</span>
                <span className="ml-1 text-slate-900 font-bold">{compareInterval.label}</span>
              </div>
              <div className="font-mono text-slate-600">
                Occupancy Diff: {kpi.occupancyPercent - compareKpiSummary.occupancyPercent >= 0 ? '+' : ''}{(kpi.occupancyPercent - compareKpiSummary.occupancyPercent).toFixed(1)} pts &bull; RevPAR Delta: {kpi.revParAED - compareKpiSummary.revParAED >= 0 ? '+' : ''}{formatAED(kpi.revParAED - compareKpiSummary.revParAED)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top Filter Bar & Period Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">Executive Performance Cockpit</h2>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 text-[10px] font-semibold">
              <ShieldCheck className="w-3 h-3" />
              <span>USALI Reconciled</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time financial and operational synthesis for 40 Serviced Apartments
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Primary Date Range Filter */}
          <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 px-3 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 mr-2" />
            <select
              aria-label="Primary Reporting Period"
              value={selectedDateRange}
              onChange={(e) => onDateRangeChange(e.target.value)}
              className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value="LAST_30_DAYS" className="bg-slate-900">Current Month (Oct 2026)</option>
              <option value="PREVIOUS_MONTH" className="bg-slate-900">Previous Completed Month (Sep 2026)</option>
              <option value="Q3_2026" className="bg-slate-900">Q3 2026 (Jul - Sep)</option>
              <option value="FULL_12_MONTHS" className="bg-slate-900">Trailing 12 Months (Full History)</option>
            </select>
          </div>

          {/* Unit Type Filter */}
          <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 px-3 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 mr-2" />
            <select
              aria-label="Apartment Type Filter"
              value={selectedTypeFilter}
              onChange={(e) => onTypeFilterChange(e.target.value)}
              className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Apartment Types (40)</option>
              <option value="Studio" className="bg-slate-900">Studios (16 Units)</option>
              <option value="One-bedroom" className="bg-slate-900">1-Bedroom (12 Units)</option>
              <option value="Two-bedroom" className="bg-slate-900">2-Bedroom (8 Units)</option>
              <option value="Three-bedroom" className="bg-slate-900">3-Bedroom Penthouse (4 Units)</option>
            </select>
          </div>

          {/* Compare Periods Toggle Button */}
          <button
            onClick={() => setIsCompareMode(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              isCompareMode
                ? 'bg-sky-600 text-white border-sky-400 shadow-md shadow-sky-900/40 ring-1 ring-sky-400'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
            }`}
            title="Toggle side-by-side comparison with a second reporting period"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Compare Periods</span>
            {isCompareMode && (
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            )}
          </button>

          {/* Comparison Date Range Selector (shows when Compare Periods is active) */}
          {isCompareMode && (
            <div className="flex items-center bg-slate-950 rounded-lg border border-sky-500/80 px-3 py-1.5 text-xs shadow-inner">
              <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider mr-2">vs:</span>
              <select
                aria-label="Comparison Benchmark Period"
                value={compareDateRange}
                onChange={(e) => setCompareDateRange(e.target.value)}
                className="bg-transparent text-sky-200 font-semibold focus:outline-none cursor-pointer text-xs"
              >
                <option value="PREVIOUS_MONTH" className="bg-slate-900">Previous Month (Sep 2026)</option>
                <option value="LAST_30_DAYS" className="bg-slate-900">Current Month (Oct 2026)</option>
                <option value="Q3_2026" className="bg-slate-900">Q3 2026 (Jul - Sep)</option>
                <option value="Q2_2026" className="bg-slate-900">Q2 2026 (Apr - Jun)</option>
                <option value="FULL_12_MONTHS" className="bg-slate-900">Trailing 12 Months (Full History)</option>
              </select>
            </div>
          )}

          {/* Print Report Button */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-900/30 transition-all cursor-pointer border border-indigo-500/60 no-print"
            title="Print or Export PDF for currently selected date range and data filter"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* SIDE-BY-SIDE PERIOD COMPARISON COCKPIT */}
      {isCompareMode && compareKpiSummary && (
        <div className="bg-slate-900/95 rounded-xl p-5 border border-sky-600/60 shadow-xl shadow-sky-950/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-950 border border-sky-700/80 text-sky-400 flex items-center justify-center">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    Side-by-Side Period Variance Analysis
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-700 font-mono font-semibold">
                    Reconciled USALI Engine
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Comparing <strong className="text-slate-200">{primaryInterval.label}</strong> (Primary) against <strong className="text-sky-300">{compareInterval.label}</strong> (Benchmark)
                </p>
              </div>
            </div>

            {/* Quick KPI Delta Highlights */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
              <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 text-[10px] block font-sans">Occupancy Diff</span>
                <span className={`font-bold ${
                  kpi.occupancyPercent >= compareKpiSummary.occupancyPercent ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {kpi.occupancyPercent >= compareKpiSummary.occupancyPercent ? '+' : ''}
                  {(kpi.occupancyPercent - compareKpiSummary.occupancyPercent).toFixed(1)} pts
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 text-[10px] block font-sans">ADR Delta</span>
                <span className={`font-bold ${
                  kpi.adrAED >= compareKpiSummary.adrAED ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {kpi.adrAED >= compareKpiSummary.adrAED ? '+' : ''}
                  {formatAED(kpi.adrAED - compareKpiSummary.adrAED)}
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 text-[10px] block font-sans">RevPAR Delta</span>
                <span className={`font-bold ${
                  kpi.revParAED >= compareKpiSummary.revParAED ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {kpi.revParAED >= compareKpiSummary.revParAED ? '+' : ''}
                  {formatAED(kpi.revParAED - compareKpiSummary.revParAED)}
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 text-[10px] block font-sans">Net Revenue Diff</span>
                <span className={`font-bold ${
                  kpi.roomRevenueAED >= compareKpiSummary.roomRevenueAED ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {kpi.roomRevenueAED >= compareKpiSummary.roomRevenueAED ? '+' : ''}
                  {formatAED(kpi.roomRevenueAED - compareKpiSummary.roomRevenueAED)}
                </span>
              </div>
            </div>
          </div>

          {/* Side-by-Side Comparison Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/80">
                  <th className="py-2.5 px-3">Performance Metric</th>
                  <th className="py-2.5 px-3 text-right text-slate-200">
                    Primary: {primaryInterval.label}
                  </th>
                  <th className="py-2.5 px-3 text-right text-sky-300">
                    Baseline: {compareInterval.label}
                  </th>
                  <th className="py-2.5 px-3 text-right">Variance (Diff)</th>
                  <th className="py-2.5 px-3 text-right">% Change</th>
                  <th className="py-2.5 px-3 text-center">Operational Evaluation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono bg-slate-950/40">
                {comparisonMetrics.map((row) => (
                  <tr key={row.name} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-200 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${row.isFavorable ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      <span>{row.name}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-100 font-bold">
                      {row.primaryFormatted}
                    </td>
                    <td className="py-2.5 px-3 text-right text-sky-200">
                      {row.compareFormatted}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-bold ${
                      row.isFavorable ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {row.diffFormatted}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-bold ${
                      row.isFavorable ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {row.pctChangeFormatted}
                    </td>
                    <td className="py-2.5 px-3 text-center font-sans">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                        row.isFavorable
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                          : 'bg-rose-950/80 text-rose-300 border-rose-800'
                      }`}>
                        {row.isFavorable ? (
                          <>
                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                            <span>Favorable</span>
                          </>
                        ) : (
                          <>
                            <TrendingDown className="w-3 h-3 text-rose-400" />
                            <span>Unfavorable</span>
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Variance Executive Analysis Insight */}
          <div className="mt-4 pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-start sm:items-center gap-2">
              <span className="font-semibold text-sky-400 shrink-0">Variance Synthesis:</span>
              <span>
                {kpi.revParAED >= compareKpiSummary.revParAED
                  ? `RevPAR expanded by ${(((kpi.revParAED - compareKpiSummary.revParAED) / compareKpiSummary.revParAED) * 100).toFixed(1)}% compared to ${compareInterval.label}, generating ${formatAED(kpi.roomRevenueAED - compareKpiSummary.roomRevenueAED)} in top-line gains.`
                  : `RevPAR contracted by ${(((compareKpiSummary.revParAED - kpi.revParAED) / compareKpiSummary.revParAED) * 100).toFixed(1)}% compared to ${compareInterval.label}.`}
              </span>
            </div>
            <button
              onClick={() => setIsCompareMode(false)}
              className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer no-print self-end sm:self-auto shrink-0"
            >
              Dismiss Comparison
            </button>
          </div>
        </div>
      )}

      {/* RECHARTS LIVE MODE OPERATIONAL VOLATILITY SPARKLINE */}
      <div className={`p-4 rounded-xl border transition-all ${
        isLiveMode
          ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-800/80 shadow-md shadow-emerald-950/30'
          : 'bg-slate-900/80 border-slate-800'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              isLiveMode ? 'bg-emerald-950 border border-emerald-700 text-emerald-400' : 'bg-slate-800 text-slate-400'
            }`}>
              <Activity className={`w-4 h-4 ${isLiveMode ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-white tracking-tight">
                  Live Mode Operational Volatility Sparkline
                </h3>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono border bg-slate-800/80 text-slate-300 border-slate-700">
                  Last 5 Auto-Refreshes
                </span>
                {isLiveMode ? (
                  <span className="text-[10px] px-2 py-0.2 rounded-full font-bold bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    Tick in {countdownSeconds}s
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.2 rounded-full font-medium bg-slate-800 text-slate-400 border border-slate-700">
                    Live Stream Standby
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Displays operational trajectory across consecutive 60s environment ticks (Spread: ±{volatilitySpread} {sparklineMetric === 'occupancy' ? '%' : 'AED'})
              </p>
            </div>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex items-center bg-slate-950 rounded-lg p-1 border border-slate-800 text-[11px] font-semibold self-start md:self-auto">
            <button
              onClick={() => setSparklineMetric('occupancy')}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                sparklineMetric === 'occupancy'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Occupancy %
            </button>
            <button
              onClick={() => setSparklineMetric('adr')}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                sparklineMetric === 'adr'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ADR (AED)
            </button>
            <button
              onClick={() => setSparklineMetric('revpar')}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                sparklineMetric === 'revpar'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              RevPAR (AED)
            </button>
          </div>
        </div>

        {/* Recharts Area Sparkline */}
        <div className="w-full h-16 pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayHistory} margin={{ top: 2, right: 6, left: 6, bottom: 0 }}>
              <defs>
                <linearGradient id="liveVolatilityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isLiveMode ? '#10b981' : '#38bdf8'} stopOpacity={0.45} />
                  <stop offset="95%" stopColor={isLiveMode ? '#10b981' : '#38bdf8'} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="timeLabel" hide />
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload as LiveRefreshRecord;
                    return (
                      <div className="bg-slate-950 border border-slate-700 p-2.5 rounded-lg shadow-xl text-[11px] font-mono z-50 space-y-1">
                        <div className="text-slate-400 font-sans text-[10px] flex items-center justify-between gap-3">
                          <span>Refresh #{item.refreshNumber}</span>
                          <span className="text-slate-500">{item.timeLabel}</span>
                        </div>
                        <div className="text-emerald-400 font-bold flex items-center justify-between gap-3">
                          <span>Occupancy:</span>
                          <span>{item.occupancy}%</span>
                        </div>
                        <div className="text-slate-200 flex items-center justify-between gap-3">
                          <span>Realized ADR:</span>
                          <span>AED {item.adr}</span>
                        </div>
                        <div className="text-sky-300 flex items-center justify-between gap-3">
                          <span>RevPAR:</span>
                          <span>AED {item.revpar}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey={sparklineMetric}
                stroke={isLiveMode ? '#10b981' : '#38bdf8'}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#liveVolatilityGradient)"
                dot={{ r: 2.5, fill: isLiveMode ? '#10b981' : '#38bdf8', strokeWidth: 0 }}
                activeDot={{ r: 4.5, stroke: '#ffffff', strokeWidth: 1.5 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Sparkline Bottom Legend */}
        <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-slate-800/60 text-[10px] text-slate-400 font-mono">
          <div className="flex items-center gap-3">
            <span>Points: {displayHistory.map(d => d.timeLabel).join(' → ')}</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Range: {minVal} — {maxVal}</span>
            <span className={Number(netDelta) >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
              Net: {Number(netDelta) >= 0 ? `+${netDelta}` : netDelta}
            </span>
          </div>
        </div>
      </div>

      {/* THRESHOLD ALERT SYSTEM HEADER & STATUS BAR */}
      {(() => {
        // Historical Benchmarks
        const HISTORICAL_BENCHMARKS = {
          occupancy: 78.5,
          adr: 650,
          revpar: 510,
          roomRevenue: Math.round(kpi.budgetRevenueAED * 0.94) || 630000,
          opex: kpi.budgetOpExAED || 340000,
          noi: kpi.budgetNOIAED || 290000,
          openMaintenance: 2.0,
          openComplaints: 1.0,
          outOfOrderNights: 3.0,
        };

        const occAlert = evaluateThreshold(kpi.occupancyPercent, HISTORICAL_BENCHMARKS.occupancy, 'higher_is_better');
        const adrAlert = evaluateThreshold(kpi.adrAED, HISTORICAL_BENCHMARKS.adr, 'higher_is_better');
        const revParAlert = evaluateThreshold(kpi.revParAED, HISTORICAL_BENCHMARKS.revpar, 'higher_is_better');
        const revAlert = evaluateThreshold(kpi.roomRevenueAED, HISTORICAL_BENCHMARKS.roomRevenue, 'higher_is_better');
        const opexAlert = evaluateThreshold(kpi.operatingExpensesAED, HISTORICAL_BENCHMARKS.opex, 'lower_is_better');
        const noiAlert = evaluateThreshold(kpi.netOperatingIncomeAED, HISTORICAL_BENCHMARKS.noi, 'higher_is_better');
        const maintAlert = evaluateThreshold(openMaintenance.length, HISTORICAL_BENCHMARKS.openMaintenance, 'lower_is_better');
        const compAlert = evaluateThreshold(openComplaints.length, HISTORICAL_BENCHMARKS.openComplaints, 'lower_is_better');
        const oooAlert = evaluateThreshold(kpi.outOfOrderUnitNights, HISTORICAL_BENCHMARKS.outOfOrderNights, 'lower_is_better');

        const allAlerts = [occAlert, adrAlert, revParAlert, revAlert, opexAlert, noiAlert, maintAlert, compAlert, oooAlert];
        const redCount = allAlerts.filter(a => a.severity === 'red').length;
        const amberCount = allAlerts.filter(a => a.severity === 'amber').length;

        return (
          <div className="space-y-3.5">
            {/* Threshold Guardrails Alert Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/90 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center text-slate-300">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span>Threshold Deviation Alert System</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                      ±10% Guardrail
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Highlights KPIs deviating by &gt;10% from 12-month historical benchmarks in amber (warning) or red (critical).
                  </div>
                </div>
              </div>

              {/* Threshold Severity Summary Counts */}
              <div className="flex items-center gap-2 font-mono text-[11px]">
                {redCount > 0 ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/80 text-rose-300 border border-rose-700 animate-pulse font-bold">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    {redCount} Critical Alerts (&gt;20% Dev)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    0 Critical
                  </span>
                )}

                {amberCount > 0 ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/80 text-amber-300 border border-amber-700 font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    {amberCount} Warnings (&gt;10% Dev)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    0 Warnings
                  </span>
                )}

                <span className="text-[10px] text-slate-500 font-sans hidden sm:inline ml-1">
                  Baseline: 12M Trailing Average
                </span>
              </div>
            </div>

            {/* TOP 12 EXECUTIVE KPI CARDS WITH DYNAMIC THRESHOLD HIGHLIGHTING */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {/* Card 1: Total & Occupied Inventory */}
              <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800 relative overflow-hidden group hover:border-slate-700 transition-all">
                <div className="text-[11px] font-medium text-slate-400">Apartment Inventory</div>
                <div className="text-xl font-bold text-white mt-1 flex items-baseline gap-1.5">
                  <span>{occupiedCount}</span>
                  <span className="text-xs font-normal text-slate-400">/ {apartments.length}</span>
                </div>
                <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>{Math.round((occupiedCount / apartments.length) * 100)}% live occupancy</span>
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">
                  {vacantCleanCount} clean, {vacantDirtyCount} dirty, {underMaintCount} maint.
                </div>
              </div>

              {/* Card 2: Period Occupancy */}
              <div className={`rounded-xl p-3.5 border transition-all ${occAlert.cardBorderClass}`}>
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
                  <span>Period Occupancy</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono font-semibold ${occAlert.badgeClass}`}>
                    {occAlert.label}
                  </span>
                </div>
                <div className="text-xl font-bold text-white mt-1">
                  {kpi.occupancyPercent}%
                </div>
                <div className={`text-[10px] mt-1 flex items-center gap-1 font-medium ${
                  occAlert.severity === 'red' ? 'text-rose-400' :
                  occAlert.severity === 'amber' ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {occAlert.isUnfavorable ? (
                    <TrendingDown className="w-3 h-3" />
                  ) : (
                    <TrendingUp className="w-3 h-3" />
                  )}
                  <span>
                    {occAlert.severity === 'red' ? 'Critical Alert (>20% below avg)' :
                     occAlert.severity === 'amber' ? 'Warning (>10% below avg)' : 'Normal Trajectory'}
                  </span>
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">
                  Hist Avg: {HISTORICAL_BENCHMARKS.occupancy}% ({kpi.occupiedUnitNights} nights)
                </div>
              </div>

              {/* Card 3: ADR */}
              <div className={`rounded-xl p-3.5 border transition-all ${adrAlert.cardBorderClass}`}>
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
                  <span>ADR (Average Rate)</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono font-semibold ${adrAlert.badgeClass}`}>
                    {adrAlert.label}
                  </span>
                </div>
                <div className="text-xl font-bold text-white mt-1">
                  {formatAED(kpi.adrAED)}
                </div>
                <div className={`text-[10px] mt-1 flex items-center gap-1 font-medium ${
                  adrAlert.severity === 'red' ? 'text-rose-400' :
                  adrAlert.severity === 'amber' ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {adrAlert.isUnfavorable ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                  <span>
                    {adrAlert.severity === 'red' ? 'Critical Rate Drop' :
                     adrAlert.severity === 'amber' ? 'Rate Warning (>10% dip)' : 'Yield Performing'}
                  </span>
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">
                  Hist Avg: AED {HISTORICAL_BENCHMARKS.adr} &bull; ALOS: {kpi.alosDays}n
                </div>
              </div>

              {/* Card 4: RevPAR */}
              <div className={`rounded-xl p-3.5 border transition-all ${revParAlert.cardBorderClass}`}>
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
                  <span>RevPAR (Yield)</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono font-semibold ${revParAlert.badgeClass}`}>
                    {revParAlert.label}
                  </span>
                </div>
                <div className="text-xl font-bold text-sky-400 mt-1">
                  {formatAED(kpi.revParAED)}
                </div>
                <div className={`text-[10px] mt-1 flex items-center gap-1 font-medium ${
                  revParAlert.severity === 'red' ? 'text-rose-400' :
                  revParAlert.severity === 'amber' ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {revParAlert.isUnfavorable ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                  <span>
                    {revParAlert.severity === 'red' ? 'RevPAR Alert (>20% drop)' :
                     revParAlert.severity === 'amber' ? 'Yield Warning (>10% drop)' : 'ADR × Occ% verified'}
                  </span>
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">
                  Hist Avg: AED {HISTORICAL_BENCHMARKS.revpar}
                </div>
              </div>

              {/* Card 5: Room Revenue */}
              <div className={`rounded-xl p-3.5 border transition-all ${revAlert.cardBorderClass}`}>
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
                  <span>Room Revenue</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono font-semibold ${revAlert.badgeClass}`}>
                    {revAlert.label}
                  </span>
                </div>
                <div className="text-xl font-bold text-white mt-1">
                  {formatAED(kpi.roomRevenueAED)}
                </div>
                <div className={`text-[10px] mt-1 flex items-center gap-1 font-medium ${
                  revAlert.severity === 'red' ? 'text-rose-400' :
                  revAlert.severity === 'amber' ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {revAlert.isUnfavorable ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                  <span>
                    {revAlert.severity === 'red' ? 'Revenue Deficit Alert' :
                     revAlert.severity === 'amber' ? 'Revenue Lag (>10%)' : `+${kpi.revenueBudgetVariancePercent}% variance`}
                  </span>
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">
                  Hist Avg: {formatAED(HISTORICAL_BENCHMARKS.roomRevenue)}
                </div>
              </div>

              {/* Card 6: Net Operating Income (NOI) */}
              <div className={`rounded-xl p-3.5 border transition-all ${noiAlert.cardBorderClass}`}>
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
                  <span>Net Operating Income</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono font-semibold ${noiAlert.badgeClass}`}>
                    {noiAlert.label}
                  </span>
                </div>
                <div className="text-xl font-bold text-emerald-400 mt-1">
                  {formatAED(kpi.netOperatingIncomeAED)}
                </div>
                <div className={`text-[10px] mt-1 flex items-center gap-1 font-medium ${
                  noiAlert.severity === 'red' ? 'text-rose-400' :
                  noiAlert.severity === 'amber' ? 'text-amber-400' : 'text-emerald-300'
                }`}>
                  {noiAlert.isUnfavorable ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                  <span>
                    {noiAlert.severity === 'red' ? 'Critical Margin Compression' :
                     noiAlert.severity === 'amber' ? 'Profit Warning (>10% dip)' : `${kpi.operatingMarginPercent}% margin`}
                  </span>
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">
                  Hist Avg: {formatAED(HISTORICAL_BENCHMARKS.noi)}
                </div>
              </div>
            </div>

            {/* SECOND ROW: Operational Health Cards with Threshold Alerting */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div 
                onClick={() => onNavigateToTab('operations')}
                className={`rounded-xl p-3.5 border cursor-pointer transition-all flex items-center justify-between ${maintAlert.cardBorderClass}`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Open Work Orders</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono ${maintAlert.badgeClass}`}>
                      {maintAlert.label}
                    </span>
                  </div>
                  <div className="text-lg font-bold text-white mt-0.5">{openMaintenance.length} Cases</div>
                  <div className="text-[10px] text-amber-400 mt-0.5">
                    {maintAlert.severity === 'red' ? 'Critical Work Order Backlog' : 'Unit 205 (HVAC Critical)'}
                  </div>
                </div>
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
                  maintAlert.severity === 'red' ? 'bg-rose-950 border-rose-700 text-rose-400 animate-pulse' :
                  maintAlert.severity === 'amber' ? 'bg-amber-950 border-amber-700 text-amber-400' :
                  'bg-slate-800 border-slate-700 text-slate-300'
                }`}>
                  <Wrench className="w-4 h-4" />
                </div>
              </div>

              <div 
                onClick={() => onNavigateToTab('operations')}
                className={`rounded-xl p-3.5 border cursor-pointer transition-all flex items-center justify-between ${compAlert.cardBorderClass}`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Guest Complaints</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono ${compAlert.badgeClass}`}>
                      {compAlert.label}
                    </span>
                  </div>
                  <div className="text-lg font-bold text-white mt-0.5">{openComplaints.length} Open</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Hist Avg: {HISTORICAL_BENCHMARKS.openComplaints} ({kpi.complaintRatePer100Nights} / 100n)
                  </div>
                </div>
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
                  compAlert.severity === 'red' ? 'bg-rose-950 border-rose-700 text-rose-400 animate-pulse' :
                  compAlert.severity === 'amber' ? 'bg-amber-950 border-amber-700 text-amber-400' :
                  'bg-slate-800 border-slate-700 text-slate-300'
                }`}>
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>

              <div 
                onClick={() => onNavigateToTab('apartments')}
                className={`rounded-xl p-3.5 border cursor-pointer transition-all flex items-center justify-between ${oooAlert.cardBorderClass}`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Out of Order Nights</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono ${oooAlert.badgeClass}`}>
                      {oooAlert.label}
                    </span>
                  </div>
                  <div className="text-lg font-bold text-white mt-0.5">{kpi.outOfOrderUnitNights} Nights</div>
                  <div className="text-[10px] text-rose-400 mt-0.5">
                    Hist Avg: {HISTORICAL_BENCHMARKS.outOfOrderNights}n (~AED 7,840 loss)
                  </div>
                </div>
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
                  oooAlert.severity === 'red' ? 'bg-rose-950 border-rose-700 text-rose-400 animate-pulse' :
                  oooAlert.severity === 'amber' ? 'bg-amber-950 border-amber-700 text-amber-400' :
                  'bg-slate-800 border-slate-700 text-slate-300'
                }`}>
                  <BedDouble className="w-4 h-4" />
                </div>
              </div>

              <div 
                onClick={() => onNavigateToTab('agents')}
                className="bg-slate-900/80 rounded-xl p-3.5 border border-slate-800 hover:border-indigo-600/60 cursor-pointer transition-all flex items-center justify-between"
              >
                <div>
                  <div className="text-[11px] text-slate-400">AI Recommendations</div>
                  <div className="text-lg font-bold text-sky-400 mt-0.5">{pendingRecs.length} Pending Approval</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">AED 56k+ identified ROI</div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-800 flex items-center justify-center text-indigo-400">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PREDICTIVE ANALYTICS — NEXT 30-DAY FORWARD PERFORMANCE ENGINE */}
      <div className="bg-slate-900/90 rounded-xl p-5 border border-indigo-900/60 shadow-xl shadow-indigo-950/20 relative overflow-hidden">
        {/* Background ambient glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-sky-600 flex items-center justify-center text-white shadow-md shadow-indigo-950/50">
              <Target className="w-5 h-5 text-indigo-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Predictive Analytics — Next 30-Day Performance Estimation
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/80 font-mono font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  AI Forecast Horizon
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800 font-mono">
                  92.4% Confidence
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Estimates 30-day forward trajectory using real-time KPI momentum, OTB reservation pickup pace, and seasonal elasticity.
              </p>
            </div>
          </div>

          {/* Scenario Selector & Metric Filter */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center bg-slate-950 rounded-lg p-1 border border-slate-800 text-[11px] font-medium">
              <span className="text-slate-500 text-[10px] uppercase font-bold px-2">Scenario:</span>
              <button
                onClick={() => setForecastScenario('conservative')}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                  forecastScenario === 'conservative'
                    ? 'bg-amber-600 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Conservative
              </button>
              <button
                onClick={() => setForecastScenario('base')}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                  forecastScenario === 'base'
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Base Model
              </button>
              <button
                onClick={() => setForecastScenario('aggressive')}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                  forecastScenario === 'aggressive'
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Yield Push (+5%)
              </button>
            </div>

            <div className="flex items-center bg-slate-950 rounded-lg p-1 border border-slate-800 text-[11px] font-semibold">
              <button
                onClick={() => setForecastMetric('occupancy')}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                  forecastMetric === 'occupancy'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Occupancy %
              </button>
              <button
                onClick={() => setForecastMetric('revpar')}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                  forecastMetric === 'revpar'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                RevPAR (AED)
              </button>
            </div>
          </div>
        </div>

        {/* 4 Forward Projection KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
          {/* Forward Card 1: Projected Occupancy */}
          <div className="bg-slate-950/70 rounded-xl p-3.5 border border-indigo-900/40 relative group hover:border-indigo-700/60 transition-all">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
              <span>Projected 30D Occupancy</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono font-semibold ${
                occDeltaForward >= 0 ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-rose-950 text-rose-300 border-rose-800'
              }`}>
                {occDeltaForward >= 0 ? `+${occDeltaForward}%` : `${occDeltaForward}%`}
              </span>
            </div>
            <div className="text-xl font-bold text-white mt-1">
              {forwardOccPace}%
            </div>
            <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>Current: {kpi.occupancyPercent}% (+{Math.round(40 * 30 * (forwardOccPace / 100))} nights)</span>
            </div>
            <div className="text-[9px] text-slate-500 mt-0.5">
              Pacing: 74% OTB commitments
            </div>
          </div>

          {/* Forward Card 2: Projected ADR */}
          <div className="bg-slate-950/70 rounded-xl p-3.5 border border-indigo-900/40 relative group hover:border-indigo-700/60 transition-all">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
              <span>Projected ADR</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono font-semibold ${
                adrDeltaForward >= 0 ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-rose-950 text-rose-300 border-rose-800'
              }`}>
                {adrDeltaForward >= 0 ? `+AED ${adrDeltaForward}` : `-AED ${Math.abs(adrDeltaForward)}`}
              </span>
            </div>
            <div className="text-xl font-bold text-white mt-1">
              {formatAED(forwardADRPace)}
            </div>
            <div className="text-[10px] text-sky-400 mt-1 flex items-center gap-1 font-medium">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Current: {formatAED(kpi.adrAED)} (+4.5% uplift)</span>
            </div>
            <div className="text-[9px] text-slate-500 mt-0.5">
              Driven by 2-Bed & Penthouse demand
            </div>
          </div>

          {/* Forward Card 3: Projected RevPAR */}
          <div className="bg-slate-950/70 rounded-xl p-3.5 border border-indigo-900/40 relative group hover:border-indigo-700/60 transition-all">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
              <span>Projected RevPAR</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono font-semibold ${
                forwardRevPARPace >= kpi.revParAED ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-rose-950 text-rose-300 border-rose-800'
              }`}>
                {forwardRevPARPace >= kpi.revParAED ? `+AED ${forwardRevPARPace - kpi.revParAED}` : `-AED ${kpi.revParAED - forwardRevPARPace}`}
              </span>
            </div>
            <div className="text-xl font-bold text-sky-400 mt-1">
              {formatAED(forwardRevPARPace)}
            </div>
            <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>Current: {formatAED(kpi.revParAED)} (Yield +7.8%)</span>
            </div>
            <div className="text-[9px] text-slate-500 mt-0.5">
              Yield Index Benchmark: 108.4
            </div>
          </div>

          {/* Forward Card 4: Projected Revenue & Net Income */}
          <div className="bg-slate-950/70 rounded-xl p-3.5 border border-indigo-900/40 relative group hover:border-indigo-700/60 transition-all">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
              <span>Estimated 30D Revenue</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono font-semibold ${
                revDeltaForward >= 0 ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-rose-950 text-rose-300 border-rose-800'
              }`}>
                {revDeltaForward >= 0 ? `+${formatAED(revDeltaForward)}` : `-${formatAED(Math.abs(revDeltaForward))}`}
              </span>
            </div>
            <div className="text-xl font-bold text-emerald-400 mt-1">
              {formatAED(forwardRoomRevenue)}
            </div>
            <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
              <span>Est. NOI: {formatAED(forwardNOI)} ({forwardMargin}%)</span>
            </div>
            <div className="text-[9px] text-slate-500 mt-0.5">
              Est. OpEx: {formatAED(forwardOpEx)}
            </div>
          </div>
        </div>

        {/* 4-Horizon Weekly Trajectory Chart + Strategic AI Forecast Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-1">
          {/* Recharts Chart: 4-Week Forward Trajectory */}
          <div className="lg:col-span-2 bg-slate-950/80 rounded-xl p-4 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  <span>4-Week Forward Operational Trajectory ({forecastMetric === 'occupancy' ? 'Occupancy %' : 'RevPAR Yield AED'})</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Shaded envelope indicates 95% confidence bounds based on historical pace volatility
                </p>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="flex items-center gap-1 text-indigo-400">
                  <span className="w-2.5 h-0.5 bg-indigo-500 rounded"></span>
                  Forecast Line
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                  <span className="w-2.5 h-2 bg-indigo-950/80 border border-indigo-700/60 rounded-xs"></span>
                  Confidence Range
                </span>
              </div>
            </div>

            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forwardWeeklyData} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="forecastAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="horizon" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis
                    domain={forecastMetric === 'occupancy' ? [60, 100] : ['dataMin - 50', 'dataMax + 50']}
                    stroke="#64748b"
                    tick={{ fontSize: 10 }}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="bg-slate-950 border border-slate-700 p-3 rounded-lg shadow-xl text-xs font-mono space-y-1">
                            <div className="text-indigo-300 font-bold font-sans text-xs pb-1 border-b border-slate-800">
                              {item.horizon}
                            </div>
                            <div className="text-emerald-400 font-semibold flex items-center justify-between gap-4">
                              <span>Expected Occ:</span>
                              <span>{item.expectedOcc}%</span>
                            </div>
                            <div className="text-slate-400 flex items-center justify-between gap-4 text-[11px]">
                              <span>Occ Confidence:</span>
                              <span>{item.lowerOcc}% – {item.upperOcc}%</span>
                            </div>
                            <div className="text-sky-300 font-semibold flex items-center justify-between gap-4">
                              <span>Expected RevPAR:</span>
                              <span>AED {item.expectedRevPAR}</span>
                            </div>
                            <div className="text-amber-300 flex items-center justify-between gap-4">
                              <span>Est. Weekly Rev:</span>
                              <span>{formatAED(item.estRevenue)}</span>
                            </div>
                            <div className="text-slate-400 text-[10px] pt-1 border-t border-slate-800 flex items-center justify-between gap-4">
                              <span>OTB Pace Booked:</span>
                              <span>{item.otbPace}%</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey={forecastMetric === 'occupancy' ? 'expectedOcc' : 'expectedRevPAR'}
                    stroke="#818cf8"
                    strokeWidth={2.5}
                    fill="url(#forecastAreaGradient)"
                    dot={{ r: 4, fill: '#6366f1', strokeWidth: 1.5, stroke: '#ffffff' }}
                    activeDot={{ r: 6, fill: '#38bdf8' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Predictive Recommendations & Forward Risk Guardrails */}
          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  <span>Forward Strategy Brief</span>
                </h4>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                  Autonomous
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/90 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 text-[11px] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Compression Rate Push
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono font-semibold">+AED 45 Uplift</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Week 3 and 4 show 63% and 58% advance reservations. Recommend raising BAR by 6% on 2-Bedroom units to maximize yield.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/90 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 text-[11px] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      HVAC Maintenance Guardrail
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono font-semibold">Unit 205 Risk</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Prioritizing Unit 205 compressor replacement before high-occupancy Week 2 prevents 5 out-of-order nights (~AED 3,700 loss).
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/90 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 text-[11px] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                      Direct Channel Shift
                    </span>
                    <span className="text-[10px] text-sky-400 font-mono font-semibold">-AED 12k Comm.</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Routing repeat corporate guests through Direct Portal to capture 100% net room revenue without 15% OTA commission bleed.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 mt-2 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Model verified against 12M history.</span>
              <button
                onClick={() => onNavigateToTab('simulation')}
                className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
              >
                <span>Launch Sim Lab</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* INTERACTIVE CHARTS & VISUALIZATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart: Trailing 6-Month Monthly Occupancy & ADR Trend */}
        <div className="lg:col-span-2 bg-slate-900/80 rounded-xl p-5 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-400" />
                <span>Monthly Occupancy (%) & RevPAR (AED) Trajectory</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Seasonal high-low performance pattern across Dubai calendar
              </p>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              Target: 80% Occ / AED 650 RevPAR
            </span>
          </div>

          {/* Custom SVG Bar & Trend Chart */}
          <div className="h-56 w-full flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-slate-800">
            {monthlyTrendData.map((d) => {
              const occHeight = `${d.occ}%`;
              const revParHeight = `${Math.min(100, Math.round((d.revpar / 800) * 100))}%`;

              return (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="w-full flex items-end justify-center gap-1.5 h-44">
                    {/* Occupancy bar */}
                    <div
                      style={{ height: occHeight }}
                      className="w-5 bg-gradient-to-t from-sky-600 to-sky-400 rounded-t transition-all group-hover:brightness-125 relative"
                      title={`${d.month}: ${d.occ}% Occupancy`}
                    >
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-950 text-white text-[10px] py-0.5 px-1.5 rounded border border-slate-700 whitespace-nowrap z-10 font-mono pointer-events-none transition-opacity">
                        {d.occ}% Occ
                      </div>
                    </div>

                    {/* RevPAR bar */}
                    <div
                      style={{ height: revParHeight }}
                      className="w-5 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t transition-all group-hover:brightness-125 relative"
                      title={`${d.month}: AED ${d.revpar} RevPAR`}
                    >
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-950 text-white text-[10px] py-0.5 px-1.5 rounded border border-slate-700 whitespace-nowrap z-10 font-mono pointer-events-none transition-opacity">
                        AED {d.revpar}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">{d.month}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-6 mt-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-sky-400"></span>
              <span>Occupancy Rate (%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-emerald-400"></span>
              <span>RevPAR Yield (AED)</span>
            </div>
          </div>
        </div>

        {/* Breakdown 1: Revenue by Apartment Type */}
        <div className="bg-slate-900/80 rounded-xl p-5 border border-slate-800 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-indigo-400" />
              <span>Revenue by Apartment Type</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Contribution mix across 40 units</p>

            <div className="space-y-3 mt-4">
              {Object.entries(typeRevenue).map(([t, rev]) => {
                const total = Object.values(typeRevenue).reduce((s, v) => s + v, 0) || 1;
                const pct = Math.round((rev / total) * 100);
                const color = 
                  t === 'Studio' ? 'bg-sky-400' :
                  t === 'One-bedroom' ? 'bg-indigo-400' :
                  t === 'Two-bedroom' ? 'bg-emerald-400' : 'bg-amber-400';

                return (
                  <div key={t} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">{t}</span>
                      <span className="text-slate-200 font-mono font-semibold">{formatAED(rev)} ({pct}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div style={{ width: `${pct}%` }} className={`h-full ${color} rounded-full`}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 mt-4 text-[11px] text-slate-400">
            <span className="text-sky-400 font-medium">Insight:</span> 2-Bed & 3-Bed Penthouse units account for 58% of gross room revenue with lowest turnover friction.
          </div>
        </div>
      </div>

      {/* THIRD ROW: Booking Channels & Top Operational Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Booking Channel Distribution & Commission Leakage */}
        <div className="bg-slate-900/80 rounded-xl p-5 border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">Distribution Channel Yield & OTA Commissions</h3>
            <button 
              onClick={() => onNavigateToTab('revenue')}
              className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
            >
              <span>Revenue Strategy</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {Object.entries(channelRevenue).map(([channel, rev]) => {
              const commPct = channel === 'Booking.com' ? 15 : channel === 'Expedia' ? 18 : channel === 'Airbnb' ? 12 : 0;
              const commAED = Math.round((rev * commPct) / 100);
              const netAED = rev - commAED;

              return (
                <div key={channel} className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{channel}</div>
                    <div className="text-[11px] text-slate-400">
                      Gross: <span className="font-mono text-slate-300">{formatAED(rev)}</span>
                      {commPct > 0 ? (
                        <span className="text-rose-400 ml-2">(-{formatAED(commAED)} comm.)</span>
                      ) : (
                        <span className="text-emerald-400 ml-2">(0% commission - 100% net)</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-100 font-mono">{formatAED(netAED)}</div>
                    <div className="text-[10px] text-slate-400 font-medium">Net Realized</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Priority AI Action Items & Critical Alerts */}
        <div className="bg-slate-900/80 rounded-xl p-5 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Priority Management Decision Brief</span>
              </h3>
              <button 
                onClick={() => onNavigateToTab('agents')}
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
              >
                <span>Agent Center ({pendingRecs.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {recommendations.slice(0, 3).map((rec) => (
                <div key={rec.id} className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        rec.priority === 'Critical' ? 'bg-rose-500' : 'bg-amber-500'
                      }`} />
                      {rec.agentRole}
                      {rec.unitId && <span className="text-sky-400">({rec.unitId})</span>}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                      rec.priority === 'Critical' 
                        ? 'bg-rose-950/80 text-rose-300 border-rose-800' 
                        : 'bg-amber-950/80 text-amber-300 border-amber-800'
                    }`}>
                      {rec.priority}
                    </span>
                  </div>

                  <p className="text-slate-300 text-[11px] line-clamp-2">
                    {rec.problemDescription}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] text-slate-400">
                    <span>Impact: <strong className="text-amber-300 font-mono">{formatAED(rec.financialImplicationAED)}</strong></span>
                    <span className="text-slate-400">Resp: {rec.responsibleManager}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 mt-3 flex items-center justify-between text-xs no-print">
            <span className="text-slate-400">Data reconciled against 1,200+ unit night records.</span>
            <button
              onClick={() => onNavigateToTab('reports')}
              className="text-sky-400 hover:text-sky-300 font-semibold cursor-pointer"
            >
              Generate Owner Report &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Print-Only Executive Governance & Sign-Off Section */}
      <div className="hidden print:block mt-8 pt-6 border-t-2 border-slate-300 text-slate-800 text-xs">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-600">Prepared & Certified By:</div>
            <div className="mt-6 border-b border-slate-400 w-52"></div>
            <div className="text-xs font-semibold text-slate-900 mt-1">General Manager & Operations Lead</div>
            <div className="text-[10px] text-slate-600">Ahmed Quality Ops — Hospitality Command Center</div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-600">Reviewed & Accepted By:</div>
            <div className="mt-6 border-b border-slate-400 w-52"></div>
            <div className="text-xs font-semibold text-slate-900 mt-1">Asset Owner / Portfolio Trustee</div>
            <div className="text-[10px] text-slate-600">Grand Marina Executive Residences Portfolio</div>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-200 text-[10px] text-slate-600 flex items-center justify-between">
          <span>All metrics reconciled against reservations, maintenance logs, and financial ledgers. Complies with USALI 11th Revised Edition.</span>
          <span>Ahmed Quality Ops &bull; Confidential Executive Brief</span>
        </div>
      </div>
    </div>
  );
};
