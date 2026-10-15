import React, { useState } from 'react';
import {
  Building2,
  Filter,
  Search,
  Wrench,
  Sparkles,
  AlertCircle,
  X,
  Calendar,
  DollarSign,
  TrendingUp,
  User,
  Zap,
  Droplets,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Plus,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import {
  Apartment,
  ApartmentStatus,
  ApartmentType,
  Reservation,
  MaintenanceWorkOrder,
  HousekeepingTask,
  GuestComplaint,
  UtilityRecord,
  FinancialTransaction,
} from '../../shared/types';
import { formatAED } from '../revenue/kpiEngine';

interface ApartmentsViewProps {
  apartments: Apartment[];
  reservations: Reservation[];
  maintenanceOrders: MaintenanceWorkOrder[];
  housekeepingTasks: HousekeepingTask[];
  complaints: GuestComplaint[];
  utilityRecords: UtilityRecord[];
  selectedApartmentId?: string | null;
  onSelectApartment: (id: string | null) => void;
  onAddApartment?: (apartment: Apartment) => void;
  onDeleteApartment?: (apartmentId: string) => void;
}

export const ApartmentsView: React.FC<ApartmentsViewProps> = ({
  apartments,
  reservations,
  maintenanceOrders,
  housekeepingTasks,
  complaints,
  utilityRecords,
  selectedApartmentId,
  onSelectApartment,
  onAddApartment,
  onDeleteApartment,
}) => {
  const [filterFloor, setFilterFloor] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add Apartment Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUnitNumber, setNewUnitNumber] = useState('');
  const [newType, setNewType] = useState<ApartmentType>('One-bedroom');
  const [newFloor, setNewFloor] = useState<number>(2);
  const [newMaxOcc, setNewMaxOcc] = useState<number>(3);
  const [newAreaSqm, setNewAreaSqm] = useState<number>(65);
  const [newBaseRate, setNewBaseRate] = useState<number>(680);
  const [newStatus, setNewStatus] = useState<ApartmentStatus>('Vacant Clean');
  const [newNotes, setNewNotes] = useState('');
  const [addFormError, setAddFormError] = useState('');
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  // Delete / Decommission Modal State
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Auto-fill sensible default attributes when apartment type changes
  const handleTypeSelect = (type: ApartmentType) => {
    setNewType(type);
    switch (type) {
      case 'Studio':
        setNewMaxOcc(2);
        setNewAreaSqm(45);
        setNewBaseRate(460);
        break;
      case 'One-bedroom':
        setNewMaxOcc(3);
        setNewAreaSqm(65);
        setNewBaseRate(680);
        break;
      case 'Two-bedroom':
        setNewMaxOcc(5);
        setNewAreaSqm(110);
        setNewBaseRate(980);
        break;
      case 'Three-bedroom':
        setNewMaxOcc(7);
        setNewAreaSqm(185);
        setNewBaseRate(1850);
        break;
    }
  };

  const handleCreateApartment = (e: React.FormEvent) => {
    e.preventDefault();
    setAddFormError('');
    const cleanUnit = newUnitNumber.trim();
    if (!cleanUnit) {
      setAddFormError('Unit number is required (e.g. 501).');
      return;
    }

    if (apartments.some(a => a.unitNumber.toLowerCase() === cleanUnit.toLowerCase())) {
      setAddFormError(`Unit #${cleanUnit} already exists in the inventory.`);
      return;
    }

    const createdApt: Apartment = {
      id: `APT-${cleanUnit}`,
      unitNumber: cleanUnit,
      type: newType,
      floor: Number(newFloor),
      maxOccupancy: Number(newMaxOcc),
      floorAreaSqm: Number(newAreaSqm),
      baseRateAED: Number(newBaseRate),
      currentStatus: newStatus,
      notes: newNotes.trim() ? newNotes.trim() : undefined,
      isDemoUnit: false,
    };

    onAddApartment?.(createdApt);
    setIsAddModalOpen(false);
    setActionSuccessNotice(`Apartment #${cleanUnit} successfully added to inventory! Capacity expanded.`);
    setTimeout(() => setActionSuccessNotice(null), 5000);
  };

  const handleConfirmDelete = (apartmentId: string, unitNum: string) => {
    onDeleteApartment?.(apartmentId);
    setIsDeleteConfirmOpen(false);
    onSelectApartment(null);
    setActionSuccessNotice(`Apartment #${unitNum} successfully removed from inventory. Available room nights updated.`);
    setTimeout(() => setActionSuccessNotice(null), 5000);
  };

  // Selected apartment for modal
  const selectedApt = apartments.find(a => a.id === selectedApartmentId) || null;

  // Status badge styling helper
  const getStatusBadge = (status: ApartmentStatus) => {
    switch (status) {
      case 'Occupied':
        return {
          bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
          dot: 'bg-emerald-500',
          cardBorder: 'border-emerald-800/60 hover:border-emerald-500',
        };
      case 'Vacant Clean':
        return {
          bg: 'bg-sky-950/80 text-sky-300 border-sky-800',
          dot: 'bg-sky-500',
          cardBorder: 'border-sky-800/60 hover:border-sky-500',
        };
      case 'Vacant Dirty':
        return {
          bg: 'bg-amber-950/80 text-amber-300 border-amber-800',
          dot: 'bg-amber-500',
          cardBorder: 'border-amber-800/60 hover:border-amber-500',
        };
      case 'Under Maintenance':
        return {
          bg: 'bg-rose-950/80 text-rose-300 border-rose-800',
          dot: 'bg-rose-500 animate-pulse',
          cardBorder: 'border-rose-800/80 hover:border-rose-500 bg-rose-950/20',
        };
      case 'Out of Order':
        return {
          bg: 'bg-purple-950/80 text-purple-300 border-purple-800',
          dot: 'bg-purple-500',
          cardBorder: 'border-purple-800/80 hover:border-purple-500',
        };
      case 'Arrival Expected':
        return {
          bg: 'bg-indigo-950/80 text-indigo-300 border-indigo-800',
          dot: 'bg-indigo-500',
          cardBorder: 'border-indigo-800/60 hover:border-indigo-500',
        };
      case 'Departure Expected':
        return {
          bg: 'bg-orange-950/80 text-orange-300 border-orange-800',
          dot: 'bg-orange-500',
          cardBorder: 'border-orange-800/60 hover:border-orange-500',
        };
      default:
        return {
          bg: 'bg-slate-800 text-slate-300 border-slate-700',
          dot: 'bg-slate-500',
          cardBorder: 'border-slate-800 hover:border-slate-600',
        };
    }
  };

  // Filter apartments
  const filteredApartments = apartments.filter(apt => {
    if (filterFloor !== 'ALL' && apt.floor.toString() !== filterFloor) return false;
    if (filterType !== 'ALL' && apt.type !== filterType) return false;
    if (filterStatus !== 'ALL' && apt.currentStatus !== filterStatus) return false;
    if (searchQuery.trim() && !apt.unitNumber.includes(searchQuery.trim()) && !apt.type.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Calculate stats for the selected apartment
  let aptRes: Reservation[] = [];
  let aptMaint: MaintenanceWorkOrder[] = [];
  let aptHk: HousekeepingTask[] = [];
  let aptCmp: GuestComplaint[] = [];
  let aptUtil: UtilityRecord[] = [];
  let cohortApts: Apartment[] = [];
  let cohortAvgRevenue = 0;
  let cohortAvgMaint = 0;

  if (selectedApt) {
    aptRes = reservations.filter(r => r.unitId === selectedApt.id && r.status !== 'Canceled');
    aptMaint = maintenanceOrders.filter(m => m.unitId === selectedApt.id);
    aptHk = housekeepingTasks.filter(h => h.unitId === selectedApt.id);
    aptCmp = complaints.filter(c => c.unitId === selectedApt.id);
    aptUtil = utilityRecords.filter(u => u.unitId === selectedApt.id);

    // Cohort benchmark (apartments of the exact same type)
    cohortApts = apartments.filter(a => a.type === selectedApt.type);
    const cohortUnitIds = new Set(cohortApts.map(a => a.id));

    const cohortTotalRevenue = reservations
      .filter(r => cohortUnitIds.has(r.unitId) && r.status !== 'Canceled')
      .reduce((s, r) => s + r.totalRoomRevenueAED, 0);
    cohortAvgRevenue = Math.round(cohortTotalRevenue / Math.max(1, cohortApts.length));

    const cohortTotalMaint = maintenanceOrders
      .filter(m => cohortUnitIds.has(m.unitId))
      .reduce((s, m) => s + m.costAED, 0);
    cohortAvgMaint = Math.round(cohortTotalMaint / Math.max(1, cohortApts.length));
  }

  const aptTotalRevenue = aptRes.reduce((s, r) => s + r.totalRoomRevenueAED, 0);
  const aptTotalNights = aptRes.reduce((s, r) => s + r.nights, 0);
  const aptTotalMaintSpend = aptMaint.reduce((s, m) => s + m.costAED, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Action Success Toast */}
      {actionSuccessNotice && (
        <div className="bg-emerald-950/90 border border-emerald-700/80 p-3 rounded-xl flex items-center justify-between text-xs text-emerald-200 animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="font-medium">{actionSuccessNotice}</span>
          </div>
          <button
            onClick={() => setActionSuccessNotice(null)}
            className="text-emerald-400 hover:text-white text-xs px-2 py-0.5"
          >
            &times;
          </button>
        </div>
      )}

      {/* View Header & Status Legend */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">Interactive {apartments.length}-Apartment Master Inventory</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              {filteredApartments.length} / {apartments.length} Units Visible
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage apartment inventory lifecycle, add new units, decommission rooms, and inspect operational histories.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Legend Pills */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800 text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Occupied
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-sky-950/70 border border-sky-800 text-sky-300">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
              Vacant Clean
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/70 border border-amber-800 text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Vacant Dirty
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-950/70 border border-rose-800 text-rose-300">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              Under Maint
            </span>
          </div>

          {/* Add Apartment Button */}
          <button
            onClick={() => {
              setNewUnitNumber('');
              setAddFormError('');
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md shadow-indigo-950/50 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Apartment</span>
          </button>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 text-xs">
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search unit number (e.g. 205)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Floor Filter */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
          <Building2 className="w-3.5 h-3.5 text-slate-400 mr-2" />
          <select
            aria-label="Floor Filter"
            value={filterFloor}
            onChange={(e) => setFilterFloor(e.target.value)}
            className="bg-transparent text-slate-200 w-full focus:outline-none cursor-pointer"
          >
            <option value="ALL" className="bg-slate-900">All Floors (1 - 4)</option>
            <option value="1" className="bg-slate-900">Floor 1 (Studios 101–116)</option>
            <option value="2" className="bg-slate-900">Floor 2 (1-Bedroom 201–212)</option>
            <option value="3" className="bg-slate-900">Floor 3 (2-Bedroom 301–308)</option>
            <option value="4" className="bg-slate-900">Floor 4 (Penthouses 401–404)</option>
          </select>
        </div>

        {/* Type Filter */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-2" />
          <select
            aria-label="Filter Apartment Type"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-transparent text-slate-200 w-full focus:outline-none cursor-pointer"
          >
            <option value="ALL" className="bg-slate-900">All Apartment Types</option>
            <option value="Studio" className="bg-slate-900">Studio (16 units)</option>
            <option value="One-bedroom" className="bg-slate-900">One-bedroom (12 units)</option>
            <option value="Two-bedroom" className="bg-slate-900">Two-bedroom (8 units)</option>
            <option value="Three-bedroom" className="bg-slate-900">Three-bedroom (4 units)</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-2" />
          <select
            aria-label="Filter Current Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-transparent text-slate-200 w-full focus:outline-none cursor-pointer"
          >
            <option value="ALL" className="bg-slate-900">All Current Statuses</option>
            <option value="Occupied" className="bg-slate-900">Occupied</option>
            <option value="Vacant Clean" className="bg-slate-900">Vacant Clean</option>
            <option value="Vacant Dirty" className="bg-slate-900">Vacant Dirty</option>
            <option value="Under Maintenance" className="bg-slate-900">Under Maintenance</option>
            <option value="Arrival Expected" className="bg-slate-900">Arrival Expected</option>
            <option value="Departure Expected" className="bg-slate-900">Departure Expected</option>
          </select>
        </div>
      </div>

      {/* 40-APARTMENT INTERACTIVE GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-3">
        {filteredApartments.map((apt) => {
          const badge = getStatusBadge(apt.currentStatus);
          const hasOpenMaint = maintenanceOrders.some(m => m.unitId === apt.id && (m.status === 'Open' || m.status === 'In Progress'));
          const hasChronicIssue = apt.unitNumber === '205';

          return (
            <button
              key={apt.id}
              onClick={() => onSelectApartment(apt.id)}
              className={`p-3 rounded-xl bg-slate-900/90 border transition-all text-left flex flex-col justify-between cursor-pointer relative group ${
                badge.cardBorder
              } ${selectedApartmentId === apt.id ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-950' : ''}`}
            >
              {/* Unit Header */}
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-mono font-bold text-white group-hover:text-sky-300">
                    #{apt.unitNumber}
                  </span>
                  <div className="text-[10px] text-slate-400 truncate max-w-[80px]">
                    {apt.type === 'Three-bedroom' ? '3-Bed Penthouse' : apt.type}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {hasChronicIssue && (
                    <span title="Chronic HVAC failure case flagged by AI" className="w-4 h-4 rounded-full bg-rose-500/20 border border-rose-500 flex items-center justify-center text-[10px] text-rose-400 font-bold">
                      !
                    </span>
                  )}
                  <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                </div>
              </div>

              {/* Status Pill */}
              <div className="mt-3">
                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium block truncate ${badge.bg}`}>
                  {apt.currentStatus}
                </span>

                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 font-mono">
                  <span>Fl {apt.floor}</span>
                  <span className="text-slate-300 font-semibold">{formatAED(apt.baseRateAED)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* DETAILED APARTMENT PROFILE MODAL */}
      {selectedApt && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-sky-950 border border-sky-800 flex items-center justify-center font-mono font-bold text-sky-300 text-lg">
                  {selectedApt.unitNumber}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">
                      Apartment #{selectedApt.unitNumber} — {selectedApt.type}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${getStatusBadge(selectedApt.currentStatus).bg}`}>
                      {selectedApt.currentStatus}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Floor {selectedApt.floor} &bull; {selectedApt.floorAreaSqm} m² &bull; Max Occ: {selectedApt.maxOccupancy} Guests &bull; Base Rate: {formatAED(selectedApt.baseRateAED)}/night
                  </p>
                </div>
              </div>

              <button
                onClick={() => onSelectApartment(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Unit Highlights & Cohort Benchmarking */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-slate-400">Total Recognized Revenue</div>
                  <div className="text-lg font-bold text-white font-mono mt-1">{formatAED(aptTotalRevenue)}</div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Cohort Avg: <span className="font-mono text-slate-300">{formatAED(cohortAvgRevenue)}</span>
                  </div>
                </div>

                <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-slate-400">Total Occupied Nights</div>
                  <div className="text-lg font-bold text-white font-mono mt-1">{aptTotalNights} Nights</div>
                  <div className="text-[10px] text-emerald-400 mt-1">
                    {Math.round((aptTotalNights / 365) * 100)}% 12M Occupancy
                  </div>
                </div>

                <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-slate-400">Cumulative Maintenance</div>
                  <div className={`text-lg font-bold font-mono mt-1 ${aptTotalMaintSpend > cohortAvgMaint * 1.5 ? 'text-rose-400' : 'text-slate-100'}`}>
                    {formatAED(aptTotalMaintSpend)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Cohort Avg: <span className="font-mono text-slate-300">{formatAED(cohortAvgMaint)}</span>
                  </div>
                </div>

                <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-slate-400">Guest Complaints</div>
                  <div className={`text-lg font-bold mt-1 ${aptCmp.length > 2 ? 'text-rose-400' : 'text-slate-100'}`}>
                    {aptCmp.length} Incidents
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {aptHk.length} Housekeeping logs
                  </div>
                </div>
              </div>

              {/* Special Diagnostic Alert if Unit 205 */}
              {selectedApt.unitNumber === '205' && (
                <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-rose-300">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>AI Engineering Diagnosis — Chronic HVAC Inverter Defect (Case #CAS-2026-089)</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    This unit has experienced 4 compressor failures over the trailing 6 months, generating AED 4,950 in cumulative patch repairs and AED 4,600 in out-of-order room revenue losses. Electrical consumption is 45% above cohort average due to continuous compressor strain. The Engineering Agent has escalated a CAPEX recommendation to replace the full Daikin VRF inverter unit (AED 6,200).
                  </p>
                </div>
              )}

              {/* TABS: Stays, Maintenance, Complaints, Housekeeping */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Wrench className="w-3.5 h-3.5 text-sky-400" />
                  <span>Maintenance History & Work Orders ({aptMaint.length})</span>
                </h4>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {aptMaint.length === 0 ? (
                    <div className="text-xs text-slate-500 py-3 text-center">No maintenance incidents recorded for this unit.</div>
                  ) : (
                    aptMaint.map(m => (
                      <div key={m.id} className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-200">{m.category}: {m.description}</span>
                            {m.isRecurring && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800">
                                Recurring
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            Reported: {m.reportedDate} &bull; Tech: {m.technician}
                            {m.causedOutOfOrderNights > 0 && (
                              <span className="text-rose-400 ml-2">&bull; {m.causedOutOfOrderNights} out-of-order nights</span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-mono font-bold text-slate-200">{formatAED(m.costAED)}</span>
                          <div className="text-[10px] text-emerald-400">{m.status}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Guest Complaints */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Logged Guest Complaints ({aptCmp.length})</span>
                </h4>

                <div className="space-y-2 max-h-44 overflow-y-auto">
                  {aptCmp.length === 0 ? (
                    <div className="text-xs text-slate-500 py-2 text-center">No complaints recorded for this apartment. Clean guest track record.</div>
                  ) : (
                    aptCmp.map(c => (
                      <div key={c.id} className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200">{c.category} — {c.severity} Severity</span>
                          <span className="text-[10px] text-slate-400">{c.reportedAt}</span>
                        </div>
                        <p className="text-slate-300 text-[11px]">{c.description}</p>
                        {c.resolutionNote && (
                          <div className="text-[10px] text-emerald-400 pt-1">
                            Resolution: {c.resolutionNote} (Recovery cost: {formatAED(c.serviceRecoveryCostAED)})
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Bookings Sample */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Recent Stays & Guest History (Showing Top 5)</span>
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                        <th className="pb-2">Guest Category</th>
                        <th className="pb-2">Channel</th>
                        <th className="pb-2">Check-In</th>
                        <th className="pb-2">Check-Out</th>
                        <th className="pb-2">Nights</th>
                        <th className="pb-2">Rate/Night</th>
                        <th className="pb-2 text-right">Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {aptRes.slice(-5).reverse().map(r => (
                        <tr key={r.id} className="text-slate-300">
                          <td className="py-2 font-medium">{r.guestCategory}</td>
                          <td className="py-2 text-slate-400">{r.channel}</td>
                          <td className="py-2 font-mono text-[11px]">{r.checkInDate}</td>
                          <td className="py-2 font-mono text-[11px]">{r.checkOutDate}</td>
                          <td className="py-2">{r.nights}</td>
                          <td className="py-2 font-mono">{formatAED(r.dailyRateAED)}</td>
                          <td className="py-2 text-right font-mono font-semibold text-white">{formatAED(r.totalRoomRevenueAED)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer with Delete / Decommission Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px]">UID: {selectedApt.id}</span>
                <span className="text-slate-600">|</span>
                <span>Type: {selectedApt.type}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  className="px-3 py-2 rounded-lg bg-rose-950/50 hover:bg-rose-900/80 border border-rose-800/80 text-rose-300 hover:text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Delete / Decommission Unit</span>
                </button>

                <button
                  onClick={() => onSelectApartment(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium cursor-pointer"
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE / DECOMMISSION CONFIRMATION MODAL */}
      {isDeleteConfirmOpen && selectedApt && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-rose-800/80 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Decommission or Delete Apartment #{selectedApt.unitNumber}?
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Floor {selectedApt.floor} &bull; {selectedApt.type} &bull; Current Status: {selectedApt.currentStatus}
                </p>
              </div>
            </div>

            {/* Impact Details & Guardrails */}
            <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800 text-xs space-y-2.5">
              <div className="text-slate-300 font-semibold flex items-center justify-between">
                <span>Recorded Stays:</span>
                <span className="font-mono text-white">{aptRes.length} bookings</span>
              </div>
              <div className="text-slate-300 font-semibold flex items-center justify-between">
                <span>Associated Maintenance Orders:</span>
                <span className="font-mono text-white">{aptMaint.length} work orders</span>
              </div>
              <div className="text-slate-300 font-semibold flex items-center justify-between">
                <span>Lifetime Revenue Impact:</span>
                <span className="font-mono text-emerald-400">{formatAED(aptTotalRevenue)}</span>
              </div>

              <div className="pt-2 border-t border-slate-800 text-slate-400 text-[11px] leading-relaxed">
                Deleting this apartment will dynamically reduce available room nights from the property master inventory and recalculate total capacity and RevPAR.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="w-full sm:w-auto px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleConfirmDelete(selectedApt.id, selectedApt.unitNumber)}
                className="w-full sm:w-auto px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-rose-950/50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Permanent Deletion</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD NEW APARTMENT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-300">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add New Apartment to Inventory</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Expand property inventory. Capacity and available room nights recalculate automatically.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateApartment} className="p-6 space-y-4">
              {addFormError && (
                <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{addFormError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Unit Number */}
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Unit Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 501"
                    value={newUnitNumber}
                    onChange={(e) => setNewUnitNumber(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Unique identifier for PMS & lock system</span>
                </div>

                {/* Apartment Type */}
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Apartment Classification *</label>
                  <select
                    value={newType}
                    onChange={(e) => handleTypeSelect(e.target.value as ApartmentType)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="Studio">Studio (45 m² - Base AED 460)</option>
                    <option value="One-bedroom">One-bedroom (65 m² - Base AED 680)</option>
                    <option value="Two-bedroom">Two-bedroom (110 m² - Base AED 980)</option>
                    <option value="Three-bedroom">Three-bedroom Penthouse (185 m² - Base AED 1,850)</option>
                  </select>
                </div>

                {/* Floor */}
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Floor Level</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={newFloor}
                    onChange={(e) => setNewFloor(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                {/* Base Rate AED */}
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Base Nightly Rate (AED) *</label>
                  <input
                    type="number"
                    min="100"
                    max="10000"
                    step="10"
                    value={newBaseRate}
                    onChange={(e) => setNewBaseRate(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                {/* Square Meters */}
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Floor Area (m²)</label>
                  <input
                    type="number"
                    min="20"
                    max="500"
                    value={newAreaSqm}
                    onChange={(e) => setNewAreaSqm(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                {/* Max Occupancy */}
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Max Guest Occupancy</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={newMaxOcc}
                    onChange={(e) => setNewMaxOcc(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                {/* Initial Status */}
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">Initial Operational Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as ApartmentStatus)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="Vacant Clean">Vacant Clean (Ready for immediate check-in)</option>
                    <option value="Vacant Dirty">Vacant Dirty (Requires housekeeping turnaround)</option>
                    <option value="Occupied">Occupied (Guest in-house)</option>
                    <option value="Under Maintenance">Under Maintenance (Work order pending)</option>
                    <option value="Out of Order">Out of Order (Decommissioned / Off-market)</option>
                  </select>
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">Unit Features & View Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Marina Canal Panoramic Balcony, High-speed fiber desk"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Dynamic Capacity Preview Callout */}
              <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-800/60 text-xs space-y-1.5">
                <div className="font-bold text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Real-Time Inventory Simulation Preview</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Adding Unit #{newUnitNumber || '___'} will expand your active portfolio to <strong className="text-white font-mono">{apartments.length + 1} apartments</strong>, providing <strong className="text-emerald-400 font-mono">+31 available room nights/month</strong>. At baseline 82% occupancy, this unit is projected to generate <strong className="text-sky-300 font-mono">{formatAED(Math.round(newBaseRate * 31 * 0.82))}</strong> in incremental monthly gross room revenue.
                </p>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-950/60 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Apartment to Inventory</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
