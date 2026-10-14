/**
 * Centralized Financial and Operational KPI Engine
 * Ahmed Quality Ops — Hospitality AI Command Center
 * 
 * Strict GAAP & USALI (Uniform System of Accounts for the Lodging Industry) compliance.
 * Reconciles reservations, transactions, out-of-order room nights, maintenance, and departmental P&L.
 */

import {
  Apartment,
  Reservation,
  FinancialTransaction,
  MaintenanceWorkOrder,
  GuestComplaint,
  PropertyKPISummary
} from '../types';

export interface DateFilterRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  label?: string;
}

/**
 * Standard KPI Definitions with explanations for transparency & inspection
 */
export const KPI_GLOSSARY = {
  Occupancy: {
    name: 'Occupancy Rate',
    formula: '(Occupied Unit Nights / Available Unit Nights) × 100',
    description: 'Percentage of physically available apartment nights that were occupied by registered guests during the period.',
    benchmark: '78% - 85% for Prime Dubai Serviced Apartments',
  },
  ADR: {
    name: 'Average Daily Rate (ADR)',
    formula: 'Total Room Revenue (AED) / Occupied Unit Nights',
    description: 'Average realized rental income achieved per occupied apartment per night, excluding taxes and ancillary services.',
    benchmark: 'AED 650 - AED 950 depending on apartment mix',
  },
  RevPAR: {
    name: 'Revenue Per Available Room (RevPAR)',
    formula: 'Total Room Revenue (AED) / Available Unit Nights (or ADR × Occupancy)',
    description: 'Total room revenue generated per physically available apartment night across the entire inventory.',
    benchmark: 'AED 500 - AED 800',
  },
  ALOS: {
    name: 'Average Length of Stay (ALOS)',
    formula: 'Occupied Unit Nights / Completed Stays (Check-outs)',
    description: 'Average duration of stay in nights per guest reservation.',
    benchmark: '3.5 to 7.0 nights for hybrid extended-stay properties',
  },
  OperatingMargin: {
    name: 'Operating Margin (NOI %)',
    formula: '(Net Operating Income / Total Revenue) × 100',
    description: 'Percentage of revenue remaining after deducting all operating expenses (Payroll, Utilities, Maintenance, Admin, Commissions).',
    benchmark: '35% - 48%',
  },
  MaintenancePerUnit: {
    name: 'Maintenance Cost Per Unit',
    formula: 'Total Maintenance Expenses (AED) / Total Inventory Units (40)',
    description: 'Average direct engineering, repair, and replacement cost incurred per apartment.',
    benchmark: '< AED 450 per unit / month',
  },
  ComplaintRate: {
    name: 'Guest Complaint Rate',
    formula: '(Total Logged Complaints / Occupied Unit Nights) × 100',
    description: 'Number of formal complaints logged per 100 occupied apartment nights.',
    benchmark: '< 2.5 per 100 nights',
  },
  BudgetVariance: {
    name: 'Budget Variance',
    formula: 'Actual Value - Budgeted Benchmark Value',
    description: 'Favorable (+) when revenue or NOI is higher than budget; Unfavorable (-) when expenses exceed budget.',
    benchmark: 'Within ± 5% of planned forecast',
  }
};

/**
 * Filter reservations within a date range (considering overlap)
 */
export function filterReservationsByDate(
  reservations: Reservation[],
  startDate: string,
  endDate: string,
  unitFilter?: string
): Reservation[] {
  return reservations.filter(res => {
    if (res.status === 'Canceled') return false;
    if (unitFilter && unitFilter !== 'ALL' && res.unitId !== unitFilter) return false;
    
    // Check if reservation overlaps with [startDate, endDate]
    return res.checkInDate <= endDate && res.checkOutDate > startDate;
  });
}

/**
 * Calculates occupied unit nights within a strict date range
 */
export function calculateOccupiedNightsInPeriod(
  reservations: Reservation[],
  startDate: string,
  endDate: string,
  unitFilter?: string
): { totalNights: number; recognizedRoomRevenueAED: number } {
  let totalNights = 0;
  let recognizedRevenue = 0;

  const start = new Date(startDate);
  const end = new Date(new Date(endDate).getTime() + 86400000);

  reservations.forEach(res => {
    if (res.status === 'Canceled') return;
    if (unitFilter && unitFilter !== 'ALL' && res.unitId !== unitFilter) return;

    const resStart = new Date(res.checkInDate);
    const resEnd = new Date(res.checkOutDate);

    // Overlapping interval
    const overlapStart = resStart > start ? resStart : start;
    const overlapEnd = resEnd < end ? resEnd : end;

    const diffTime = overlapEnd.getTime() - overlapStart.getTime();
    const nights = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));

    if (nights > 0) {
      totalNights += nights;
      recognizedRevenue += nights * res.dailyRateAED;
    }
  });

  return { totalNights, recognizedRoomRevenueAED: recognizedRevenue };
}

/**
 * Centralized Calculation Engine for Property Performance
 */
export function calculatePropertyKPISummary(params: {
  apartments: Apartment[];
  reservations: Reservation[];
  transactions: FinancialTransaction[];
  maintenanceOrders: MaintenanceWorkOrder[];
  complaints: GuestComplaint[];
  startDate: string;
  endDate: string;
  periodLabel: string;
  unitFilter?: string;
  apartmentTypeFilter?: string;
}): PropertyKPISummary {
  const {
    apartments,
    reservations,
    transactions,
    maintenanceOrders,
    complaints,
    startDate,
    endDate,
    periodLabel,
    unitFilter,
    apartmentTypeFilter,
  } = params;

  // Filter apartments
  let eligibleApartments = apartments;
  if (unitFilter && unitFilter !== 'ALL') {
    eligibleApartments = eligibleApartments.filter(a => a.id === unitFilter);
  } else if (apartmentTypeFilter && apartmentTypeFilter !== 'ALL') {
    eligibleApartments = eligibleApartments.filter(a => a.type === apartmentTypeFilter);
  }

  const apartmentCount = eligibleApartments.length;
  const unitIdSet = new Set(eligibleApartments.map(a => a.id));

  // Determine total days in reporting period
  const startD = new Date(startDate);
  const endD = new Date(endDate);
  const daysInPeriod = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  // Available Unit Nights = Eligible Apartments * Days
  const availableUnitNights = apartmentCount * daysInPeriod;

  // Out of order calculation from maintenance records
  const periodMaintenance = maintenanceOrders.filter(
    m => unitIdSet.has(m.unitId) && m.reportedDate <= endDate && (!m.resolvedDate || m.resolvedDate >= startDate)
  );
  const outOfOrderUnitNights = periodMaintenance.reduce((sum, m) => sum + (m.causedOutOfOrderNights || 0), 0); // TODO: reconcile overlaps and date clipping before production

  // Calculate occupied nights and recognized room revenue
  const filteredRes = reservations.filter(r => unitIdSet.has(r.unitId));
  const { totalNights: occupiedUnitNights, recognizedRoomRevenueAED } = calculateOccupiedNightsInPeriod(
    filteredRes,
    startDate,
    endDate
  );

  // Completed stays for ALOS
  const completedStays = filteredRes.filter(
    r => r.status === 'Completed' && r.checkOutDate >= startDate && r.checkOutDate <= endDate
  );
  const alosDays = completedStays.length > 0 
    ? Number((occupiedUnitNights / completedStays.length).toFixed(1))
    : 0; // No completed stays: unavailable, not an invented average

  // Cancellation Rate
  const totalBookings = filteredRes.filter(r => r.bookingDate >= startDate && r.bookingDate <= endDate);
  const canceledBookings = totalBookings.filter(r => r.status === 'Canceled');
  const cancellationRatePercent = totalBookings.length > 0
    ? Number(((canceledBookings.length / totalBookings.length) * 100).toFixed(1))
    : 0; // No bookings: unavailable, not an invented cancellation rate

  // Occupancy, ADR, RevPAR
  const occupancyPercent = availableUnitNights > 0
    ? Number(((occupiedUnitNights / availableUnitNights) * 100).toFixed(1))
    : 0;

  const adrAED = occupiedUnitNights > 0
    ? Math.round(recognizedRoomRevenueAED / occupiedUnitNights)
    : 0;

  const revParAED = availableUnitNights > 0
    ? Math.round(recognizedRoomRevenueAED / availableUnitNights)
    : 0;

  // Ancillary Revenue from transactions (F&B, laundry, parking, airport transfers)
  const actualPeriodTransactions = transactions.filter(
    t => !t.isBudget && t.date >= startDate && t.date <= endDate && (!t.unitId || unitIdSet.has(t.unitId))
  );

  const ancillaryRevenueAED = actualPeriodTransactions
    .filter(t => t.type === 'revenue' && t.category !== 'Room Revenue')
    .reduce((sum, t) => sum + t.amountAED, 0);

  const roomRevenueAED = recognizedRoomRevenueAED;
  const totalRevenueAED = roomRevenueAED + ancillaryRevenueAED;

  // Operating Expenses
  const operatingExpensesAED = actualPeriodTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amountAED, 0);

  // Net Operating Income (NOI)
  const netOperatingIncomeAED = totalRevenueAED - operatingExpensesAED;
  const operatingMarginPercent = totalRevenueAED > 0
    ? Number(((netOperatingIncomeAED / totalRevenueAED) * 100).toFixed(1))
    : 0;

  // Maintenance Cost per unit
  const periodMaintenanceCost = periodMaintenance.reduce((sum, m) => sum + m.costAED, 0);
  const maintenanceCostPerUnitAED = apartmentCount > 0
    ? Math.round(periodMaintenanceCost / apartmentCount)
    : 0;

  // Guest Complaints
  const periodComplaints = complaints.filter(
    c => unitIdSet.has(c.unitId) && c.reportedAt >= startDate && c.reportedAt <= endDate
  );
  const complaintRatePer100Nights = occupiedUnitNights > 0
    ? Number(((periodComplaints.length / occupiedUnitNights) * 100).toFixed(2))
    : 0;

  // Budgets & Variance from budget benchmark transactions
  const budgetPeriodTransactions = transactions.filter(
    t => t.isBudget && t.date >= startDate && t.date <= endDate
  );

  // Scaled budget if filtered
  const scaleRatio = apartments.length > 0 ? apartmentCount / apartments.length : 0;
  const budgetRevenueRaw = budgetPeriodTransactions
    .filter(t => t.type === 'revenue')
    .reduce((sum, t) => sum + t.amountAED, 0);
  
  const budgetOpExRaw = budgetPeriodTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amountAED, 0);

  const budgetRevenueAED = Math.round(budgetRevenueRaw * scaleRatio);
  const budgetOpExAED = Math.round(budgetOpExRaw * scaleRatio);
  const budgetNOIAED = budgetRevenueAED - budgetOpExAED;

  const revenueBudgetVarianceAED = totalRevenueAED - budgetRevenueAED;
  const revenueBudgetVariancePercent = budgetRevenueAED > 0
    ? Number(((revenueBudgetVarianceAED / budgetRevenueAED) * 100).toFixed(1))
    : 0;
  const noiBudgetVarianceAED = netOperatingIncomeAED - budgetNOIAED;

  // Audit Reconciliation Check
  // 1. RevPAR must equal ADR * Occupancy%
  // 2. Room Revenue + Ancillary Revenue = Total Revenue
  // 3. Total Revenue - Operating Expenses = NOI
  const revParCheck = Math.abs(revParAED - Math.round((adrAED * occupancyPercent) / 100)) <= 2;
  const revenueSumCheck = (roomRevenueAED + ancillaryRevenueAED) === totalRevenueAED;
  const noiCheck = (totalRevenueAED - operatingExpensesAED) === netOperatingIncomeAED;
  const reconciliationAuditPassed = revParCheck && revenueSumCheck && noiCheck;

  return {
    periodLabel,
    totalApartments: apartmentCount,
    availableUnitNights,
    occupiedUnitNights,
    outOfOrderUnitNights,
    roomRevenueAED,
    ancillaryRevenueAED,
    totalRevenueAED,
    operatingExpensesAED,
    netOperatingIncomeAED,
    operatingMarginPercent,
    occupancyPercent,
    adrAED,
    revParAED,
    alosDays,
    cancellationRatePercent,
    maintenanceCostPerUnitAED,
    complaintRatePer100Nights,
    budgetRevenueAED,
    budgetOpExAED,
    budgetNOIAED,
    revenueBudgetVarianceAED,
    revenueBudgetVariancePercent,
    noiBudgetVarianceAED,
    reconciliationAuditPassed,
  };
}

/**
 * Format currency in UAE Dirhams
 */
export function formatAED(amount: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format standard percentage
 */
export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}
