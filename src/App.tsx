import { analyzeSpecialists } from './services/specialistAgents';
/**
 * Ahmed Quality Ops — Hospitality AI Command Center
 * Professional Hotel & Serviced Apartment Management Platform
 */

import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
const AccountingCenter=lazy(()=>import('./accounting/AccountingCenter').then(m=>({default:m.AccountingCenter})));
const ReadinessCenter=lazy(()=>import('./readiness/ReadinessCenter').then(m=>({default:m.ReadinessCenter})));
const MarketWorkspace = lazy(() => import('./market/MarketWorkspace').then(m => ({ default:m.MarketWorkspace })));
import {
  UserRole,
  DataOperatingMode,
  Apartment,
  Reservation,
  MaintenanceWorkOrder,
  HousekeepingTask,
  GuestComplaint,
  UtilityRecord,
  FinancialTransaction,
  AgentRecommendation,
  AgentCoordinationCase,
  RecommendationApprovalStatus,
  ImportJobRecord,
  LiveRefreshRecord,
} from './types';
import { generateSimulationDataset } from './data/simulationEngine';
import { calculatePropertyKPISummary } from './data/kpiEngine';
import { generateAgentRecommendations } from './data/agentEngine';

import { Header } from './components/Header';
import { Sidebar, NavigationTab } from './components/Sidebar';
import { PropertyIntelligenceView } from './components/PropertyIntelligenceView';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { ApartmentsView } from './components/ApartmentsView';
import { ReservationsView } from './components/ReservationsView';
import { OperationsView } from './components/OperationsView';
import { RevenueView } from './components/RevenueView';
import { FinancialView } from './components/FinancialView';
import { AgentCenterView } from './components/AgentCenterView';
import { SimulationLabView } from './components/SimulationLabView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { AiManagerChat } from './components/AiManagerChat';

export default function App() {
  // Global Application State
  const dataMode: DataOperatingMode = 'SIMULATION';
  const [currentRole, setCurrentRole] = useState<UserRole>('General Manager');
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [simulationSeed, setSimulationSeed] = useState<number>(4242);
  const [isAiChatOpen, setIsAiChatOpen] = useState<boolean>(false);
  const [selectedApartmentId, setSelectedApartmentId] = useState<string | null>(null);

  // Live Mode: triggers automatic refresh of simulation data every 60 seconds
  const [isLiveMode, setIsLiveMode] = useState<boolean>(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(60);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Volatility Sparkline History (Stores the last 5 operational refreshes)
  const [liveRefreshHistory, setLiveRefreshHistory] = useState<LiveRefreshRecord[]>([
    { id: 't1', refreshNumber: 1, timeLabel: 'T-4', occupancy: 81.2, adr: 718, revpar: 583, openWorkOrders: 4 },
    { id: 't2', refreshNumber: 2, timeLabel: 'T-3', occupancy: 82.5, adr: 724, revpar: 597, openWorkOrders: 3 },
    { id: 't3', refreshNumber: 3, timeLabel: 'T-2', occupancy: 83.0, adr: 730, revpar: 606, openWorkOrders: 3 },
    { id: 't4', refreshNumber: 4, timeLabel: 'T-1', occupancy: 82.0, adr: 722, revpar: 592, openWorkOrders: 4 },
    { id: 't5', refreshNumber: 5, timeLabel: 'Latest', occupancy: 82.4, adr: 724, revpar: 596, openWorkOrders: 3 },
  ]);

  // useEffect to refresh simulation data every 60 seconds when Live Mode is enabled
  useEffect(() => {
    if (!isLiveMode) {
      setCountdownSeconds(60);
      return;
    }

    const interval = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          // Trigger refresh of simulation data every 60s
          setSimulationSeed((s) => s + 1);
          setLastRefreshedAt(new Date());
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isLiveMode]);

  // Filters for reporting period & apartment cohorts
  const [selectedDateRange, setSelectedDateRange] = useState<string>('LAST_30_DAYS');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');

  // Generate or Load Datasets
  // Mode A: Synthetic 12-Month Simulation
  const demoData = useMemo(() => {
    return generateSimulationDataset(simulationSeed);
  }, [simulationSeed]);

  // Dynamic Apartment Inventory Management (Add / Delete)
  const [addedSimApartments, setAddedSimApartments] = useState<Apartment[]>([]);
  const [deletedSimApartmentIds, setDeletedSimApartmentIds] = useState<string[]>([]);

  // Demo records never share persistence or mutation handlers with the cloud workspace.
  const activeApartments = useMemo(() => {
    const deletedSet = new Set(deletedSimApartmentIds);
    return [...demoData.apartments, ...addedSimApartments].filter(a => !deletedSet.has(a.id));
  }, [demoData.apartments, deletedSimApartmentIds, addedSimApartments]);
  const handleAddApartment = (apartment: Apartment) => setAddedSimApartments(prev => [...prev, apartment]);
  const handleDeleteApartment = (id: string) => {
    setDeletedSimApartmentIds(prev => [...prev, id]);
    setAddedSimApartments(prev => prev.filter(a => a.id !== id));
    if (selectedApartmentId === id) setSelectedApartmentId(null);
  };
  const activeReservations = demoData.reservations;
  const activeMaintenance = demoData.maintenanceOrders;
  const activeHousekeeping = demoData.housekeepingTasks;
  const activeComplaints = demoData.complaints;
  const activeUtilities = demoData.utilityRecords;
  const activeTransactions = demoData.transactions;

  // Date Boundary resolver
  const dateInterval = useMemo(() => {
    switch (selectedDateRange) {
      case 'PREVIOUS_MONTH':
        return { start: '2026-09-01', end: '2026-09-30', label: 'September 2026' };
      case 'Q3_2026':
        return { start: '2026-07-01', end: '2026-09-30', label: 'Q3 2026' };
      case 'FULL_12_MONTHS':
        return { start: '2025-11-01', end: '2026-10-31', label: 'Past 12 Months' };
      case 'LAST_30_DAYS':
      default:
        return { start: '2026-10-01', end: '2026-10-31', label: 'October 2026' };
    }
  }, [selectedDateRange]);

  // Centralized KPI Summary Calculation (Reconciled)
  const kpiSummary = useMemo(() => {
    return calculatePropertyKPISummary({
      apartments: activeApartments,
      reservations: activeReservations,
      transactions: activeTransactions,
      maintenanceOrders: activeMaintenance,
      complaints: activeComplaints,
      startDate: dateInterval.start,
      endDate: dateInterval.end,
      periodLabel: dateInterval.label,
      apartmentTypeFilter: selectedTypeFilter,
    });
  }, [
    activeApartments,
    activeReservations,
    activeTransactions,
    activeMaintenance,
    activeComplaints,
    dateInterval,
    selectedTypeFilter,
  ]);

  // AI Agent Recommendations & Coordination Cases
  const initialAgentOutputs = useMemo(() => {
    return generateAgentRecommendations({
      apartments: activeApartments,
      reservations: activeReservations,
      maintenanceOrders: activeMaintenance,
      complaints: activeComplaints,
      transactions: activeTransactions,
      kpiSummary,
    });
  }, [
    activeApartments,
    activeReservations,
    activeMaintenance,
    activeComplaints,
    activeTransactions,
    kpiSummary,
  ]);

  const [recommendations, setRecommendations] = useState<AgentRecommendation[]>(initialAgentOutputs.recommendations);
  const [coordinationCases, setCoordinationCases] = useState<AgentCoordinationCase[]>(initialAgentOutputs.coordinationCases);

  // Sync recommendations if simulation dataset regenerates
  useEffect(() => {
    setRecommendations(initialAgentOutputs.recommendations);
    setCoordinationCases(initialAgentOutputs.coordinationCases);
  }, [initialAgentOutputs]);

  // Update volatility sparkline history when simulation regenerates in Live Mode or manual re-seed
  useEffect(() => {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLiveRefreshHistory((prev) => {
      const nextNum = (prev[prev.length - 1]?.refreshNumber || 5) + 1;
      const newPoint: LiveRefreshRecord = {
        id: `tick-${Date.now()}`,
        refreshNumber: nextNum,
        timeLabel: nowTime,
        occupancy: kpiSummary.occupancyPercent,
        adr: kpiSummary.adrAED,
        revpar: kpiSummary.revParAED,
        openWorkOrders: activeMaintenance.filter(m => m.status === 'Open' || m.status === 'In Progress').length,
      };
      return [...prev.slice(-4), newPoint]; // strictly keep the last 5
    });
  }, [simulationSeed]);

  // Approval status handler
  const handleUpdateRecommendationStatus = (recId: string, newStatus: RecommendationApprovalStatus) => {
    setRecommendations(prev =>
      prev.map(r => (r.id === recId ? { ...r, approvalStatus: newStatus } : r))
    );
  };

  // Counts for sidebar badges
  const pendingApprovalsCount = recommendations.filter(
    r => r.approvalStatus === 'Pending' || r.approvalStatus === 'Under Review'
  ).length;

  const openCasesCount = activeMaintenance.filter(
    m => m.status === 'Open' || m.status === 'In Progress'
  ).length;

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        dataMode={dataMode}
        onDataModeChange={(mode) => { if (mode !== 'SIMULATION') alert('This is a demo workspace. Real data requires the authenticated cloud workspace.'); }}
        onOpenAiChat={() => setIsAiChatOpen(true)}
        onResetDemoData={() => setSimulationSeed(s => s + 1)}
        isLiveMode={isLiveMode}
        onToggleLiveMode={() => setIsLiveMode(prev => !prev)}
        countdownSeconds={countdownSeconds}
        lastRefreshedAt={lastRefreshedAt}
      />

      {/* Main Body with Sidebar & Dynamic View */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          currentRole={currentRole}
          pendingApprovalsCount={pendingApprovalsCount}
          openCasesCount={openCasesCount}
        />

        <main className="flex-1 overflow-y-auto">
          {currentTab === 'accounting' && <Suspense fallback={<p className="p-6">Loading accounting…</p>}><AccountingCenter apartments={activeApartments} role={currentRole}/></Suspense>}
          {currentTab === 'readiness' && <Suspense fallback={<p className="p-6">Loading readiness…</p>}><ReadinessCenter apartments={activeApartments} role={currentRole}/></Suspense>}
          {currentTab === 'market' && <Suspense fallback={<p className="p-6">Loading market intelligence…</p>}><MarketWorkspace apartments={activeApartments}/></Suspense>}
          {currentTab === 'intelligence' && <PropertyIntelligenceView apartments={activeApartments} reservations={activeReservations} transactions={activeTransactions} maintenance={activeMaintenance} complaints={activeComplaints} kpi={kpiSummary} start={dateInterval.start} end={dateInterval.end} mode={dataMode} />}
          {currentTab === 'dashboard' && (
            <ExecutiveDashboard
              kpi={kpiSummary}
              apartments={activeApartments}
              reservations={activeReservations}
              transactions={activeTransactions}
              maintenanceOrders={activeMaintenance}
              complaints={activeComplaints}
              recommendations={recommendations}
              selectedDateRange={selectedDateRange}
              onDateRangeChange={setSelectedDateRange}
              selectedTypeFilter={selectedTypeFilter}
              onTypeFilterChange={setSelectedTypeFilter}
              onSelectApartment={(aptId) => {
                setSelectedApartmentId(aptId);
                setCurrentTab('apartments');
              }}
              onNavigateToTab={(tab) => setCurrentTab(tab)}
              liveRefreshHistory={liveRefreshHistory}
              isLiveMode={isLiveMode}
              countdownSeconds={countdownSeconds}
            />
          )}

          {currentTab === 'apartments' && (
            <ApartmentsView
              apartments={activeApartments}
              reservations={activeReservations}
              maintenanceOrders={activeMaintenance}
              housekeepingTasks={activeHousekeeping}
              complaints={activeComplaints}
              utilityRecords={activeUtilities}
              selectedApartmentId={selectedApartmentId}
              onSelectApartment={setSelectedApartmentId}
              onAddApartment={handleAddApartment}
              onDeleteApartment={handleDeleteApartment}
            />
          )}

          {currentTab === 'reservations' && (
            <ReservationsView reservations={activeReservations} />
          )}

          {currentTab === 'operations' && (
            <OperationsView
              maintenanceOrders={activeMaintenance}
              housekeepingTasks={activeHousekeeping}
              complaints={activeComplaints}
              apartments={activeApartments}
              onSelectApartment={(id) => {
                setSelectedApartmentId(id);
                setCurrentTab('apartments');
              }}
            />
          )}

          {currentTab === 'revenue' && (
            <RevenueView
              kpi={kpiSummary}
              reservations={activeReservations}
              apartments={activeApartments}
              start={dateInterval.start} end={dateInterval.end}
            />
          )}

          {currentTab === 'financial' && (
            <FinancialView
              kpi={kpiSummary}
              transactions={activeTransactions}
              maintenanceOrders={activeMaintenance}
            />
          )}

          {currentTab === 'agents' && (
            <AgentCenterView
              recommendations={recommendations}
              coordinationCases={coordinationCases}
              onUpdateRecommendationStatus={handleUpdateRecommendationStatus}
              currentRole={currentRole}
              specialistInsights={analyzeSpecialists({
                businessDate: new Date().toISOString().slice(0,10),
                periodStart: '2026-10-01',
                periodEnd: '2026-10-31',
                apartments: activeApartments,
                reservations: activeReservations,
                maintenance: activeMaintenance,
                housekeeping: activeHousekeeping,
                complaints: activeComplaints,
                transactions: activeTransactions,
              })}
            />
          )}

          {currentTab === 'simulation' && (
            <SimulationLabView baselineKpi={kpiSummary} />
          )}

          {currentTab === 'reports' && (
            <ReportsView
              kpi={kpiSummary}
              recommendations={recommendations}
              maintenanceOrders={activeMaintenance}
              complaints={activeComplaints}
              apartments={activeApartments}
              reservations={activeReservations}
              transactions={activeTransactions}
            />
          )}

          {currentTab === 'import' && <div className="p-6 text-slate-300">PMS file updates require the authenticated cloud workspace. Do not upload real guest records into this demo.</div>}
          {currentTab === 'settings' && (
            <SettingsView
              currentRole={currentRole}
              onRoleChange={setCurrentRole}
            />
          )}
        </main>
      </div>

      {/* "Ask the AI Hotel Manager" Interactive Slide-Over Drawer */}
      <AiManagerChat
        isOpen={isAiChatOpen}
        onClose={() => setIsAiChatOpen(false)}
        kpiSummary={kpiSummary}
      />
    </div>
  );
}
