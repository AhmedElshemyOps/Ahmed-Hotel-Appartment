/**
 * Core Types for Ahmed Quality Ops — Hospitality AI Command Center
 */

export type ApartmentType = 'Studio' | 'One-bedroom' | 'Two-bedroom' | 'Three-bedroom';

export type ApartmentStatus = 
  | 'Occupied' 
  | 'Vacant Clean' 
  | 'Vacant Dirty' 
  | 'Under Maintenance' 
  | 'Out of Order' 
  | 'Arrival Expected' 
  | 'Departure Expected';

export type BookingStatus = 'Confirmed' | 'In-House' | 'Completed' | 'Canceled';

export type BookingChannel = string;

export type GuestCategory = 'Corporate' | 'Leisure' | 'Extended Stay' | 'VIP';

export interface Apartment {
  id: string; // e.g. "APT-101"
  unitNumber: string; // e.g. "101"
  type: ApartmentType;
  floor: number;
  maxOccupancy: number;
  floorAreaSqm: number;
  baseRateAED: number;
  currentStatus: ApartmentStatus;
  currentGuestName?: string;
  currentGuestCategory?: GuestCategory;
  currentCheckOut?: string;
  nextArrival?: string;
  notes?: string;
  isDemoUnit: boolean;
}

export interface Reservation {
  id: string;
  unitId: string;
  guestName: string;
  guestCategory: GuestCategory;
  channel: BookingChannel;
  bookingDate: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  dailyRateAED: number;
  totalRoomRevenueAED: number;
  commissionRatePercent: number;
  netRevenueAED: number;
  status: BookingStatus;
  cancellationDate?: string;
  isDemo: boolean;
}

export type MaintenanceCategory = 'HVAC' | 'Plumbing' | 'Electrical' | 'Carpentry / Furniture' | 'Appliance' | 'Preventive';

export type MaintenanceStatus = 'Open' | 'In Progress' | 'Resolved' | 'Pending Parts';

export interface MaintenanceWorkOrder {
  id: string;
  unitId: string;
  category: MaintenanceCategory;
  description: string;
  reportedDate: string;
  resolvedDate?: string;
  status: MaintenanceStatus;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  costAED: number;
  technician: string;
  isRecurring: boolean;
  revenueImpactAED: number;
  causedOutOfOrderNights: number;
  preventiveInspectionDue?: string;
  isDemo: boolean;
}

export type HousekeepingStatus = 'Clean' | 'Dirty' | 'In Progress' | 'Inspected' | 'Failed Inspection';

export interface HousekeepingTask {
  id: string;
  unitId: string;
  housekeeper: string;
  inspector: string;
  status: HousekeepingStatus;
  scheduledDate: string;
  completedAt?: string;
  turnaroundMinutes: number;
  linenChanged: boolean;
  inspectionScore: number; // 0 - 100
  defectNotes?: string;
  isDemo: boolean;
}

export interface GuestComplaint {
  id: string;
  unitId: string;
  guestCategory: GuestCategory;
  category: 'HVAC / Cooling' | 'Noise' | 'Plumbing / Odor' | 'Cleanliness' | 'Wi-Fi / TV' | 'Keycard / Access';
  description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  reportedAt: string;
  resolvedAt?: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  resolutionNote?: string;
  serviceRecoveryCostAED: number;
  isDemo: boolean;
}

export interface UtilityRecord {
  id: string;
  unitId: string;
  month: string; // YYYY-MM
  electricityKwh: number;
  electricityCostAED: number;
  waterM3: number;
  waterCostAED: number;
  chilledWaterTonHours: number;
  chilledWaterCostAED: number;
  totalUtilityAED: number;
  isAnomaly: boolean;
  isDemo: boolean;
}

export type ExpenseCategory = 
  | 'Payroll & Benefits'
  | 'Maintenance & Repairs'
  | 'Housekeeping Supplies'
  | 'Utilities (DEWA & District Cooling)'
  | 'OTA Commissions'
  | 'Guest Amenities'
  | 'Administration & Insurance'
  | 'Marketing & Tech Software';

export interface FinancialTransaction {
  id: string;
  date: string;
  month: string; // YYYY-MM
  type: 'revenue' | 'expense';
  category: string;
  department: 'Rooms' | 'Maintenance' | 'Housekeeping' | 'Administration' | 'Sales & Marketing' | 'Utilities';
  amountAED: number;
  unitId?: string;
  description: string;
  isBudget: boolean; // false = actual, true = monthly budget benchmark
  isDemo: boolean;
}

export interface PropertyKPISummary {
  periodLabel: string;
  totalApartments: number;
  availableUnitNights: number;
  occupiedUnitNights: number;
  outOfOrderUnitNights: number;
  roomRevenueAED: number;
  ancillaryRevenueAED: number;
  totalRevenueAED: number;
  operatingExpensesAED: number;
  netOperatingIncomeAED: number;
  operatingMarginPercent: number;
  occupancyPercent: number;
  adrAED: number;
  revParAED: number;
  alosDays: number;
  cancellationRatePercent: number;
  maintenanceCostPerUnitAED: number;
  complaintRatePer100Nights: number;
  budgetRevenueAED: number;
  budgetOpExAED: number;
  budgetNOIAED: number;
  revenueBudgetVarianceAED: number;
  revenueBudgetVariancePercent: number;
  noiBudgetVarianceAED: number;
  reconciliationAuditPassed: boolean;
}

export type AgentRole = 
  | 'General Manager Coordinator'
  | 'Revenue Management'
  | 'Reservations'
  | 'Front Office'
  | 'Housekeeping'
  | 'Engineering and Maintenance'
  | 'Finance and Cost Control'
  | 'Procurement and Inventory'
  | 'Guest Experience'
  | 'Quality and Risk'
  | 'Owner Reporting';

export type RecommendationApprovalStatus = 
  | 'Pending' 
  | 'Under Review' 
  | 'Approved' 
  | 'Rejected' 
  | 'In Progress' 
  | 'Verified Closed';

export interface AgentRecommendation {
  id: string;
  agentRole: AgentRole;
  date: string;
  unitId?: string;
  problemDescription: string;
  supportingEvidence: string;
  analysis: string;
  financialImplicationAED: number;
  assumptions: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  recommendedAction: string;
  responsibleManager: string;
  approvalStatus: RecommendationApprovalStatus;
  followUpDate: string;
  resolutionStatus: 'Unresolved' | 'In Progress' | 'Resolved';
  isDemo: boolean;
}

export interface AgentCoordinationCase {
  id: string;
  caseNumber: string;
  title: string;
  unitId: string;
  triggerEvent: string;
  involvedAgents: AgentRole[];
  reportedAt: string;
  totalFinancialRiskAED: number;
  narrative: string;
  recommendations: AgentRecommendation[];
  status: 'Active' | 'Under Review' | 'Mitigated' | 'Closed';
}

export type UserRole = 
  | 'Platform Administrator'
  | 'Property Owner'
  | 'General Manager'
  | 'Finance Manager'
  | 'Revenue Manager'
  | 'Operations Manager'
  | 'Department Manager'
  | 'Read-Only Viewer';

export type DataOperatingMode = 'SIMULATION' | 'REAL_PROPERTY';

export interface ImportJobRecord {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  dataType: 'Reservations' | 'Financial Transactions' | 'Maintenance Work Orders' | 'Guest Complaints';
  totalRows: number;
  validRows: number;
  errorRows: number;
  status: 'Preview' | 'Approved' | 'Rolled Back';
  importedBy: string;
  approvedAt?: string;
  columnMapping: Record<string, string>;
  warnings: string[];
}

export interface SimulationScenarioResult {
  scenarioName: string;
  adrDeltaPercent: number;
  occDeltaPercent: number;
  baselineRevenueAED: number;
  simulatedRevenueAED: number;
  revenueDifferenceAED: number;
  baselineNOIAED: number;
  simulatedNOIAED: number;
  noiDifferenceAED: number;
  simulatedOccupancyPercent: number;
  simulatedADRAED: number;
  simulatedRevParAED: number;
  keyAssumptions: string[];
  operationalRisks: string[];
}

export interface LiveRefreshRecord {
  id: string;
  refreshNumber: number;
  timeLabel: string;
  occupancy: number;
  adr: number;
  revpar: number;
  openWorkOrders: number;
}

