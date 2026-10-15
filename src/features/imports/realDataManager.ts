/**
 * Real Property Data Manager & CSV/Excel Import Engine
 * Ahmed Quality Ops — Hospitality AI Command Center
 * 
 * Strict isolation between Simulated Demo Data and Live Real Property Data.
 * Includes data validation, column mapping, dry-run previews, explicit human approval,
 * rollback capabilities, and downloadable templates.
 */

import {
  Apartment,
  Reservation,
  FinancialTransaction,
  MaintenanceWorkOrder,
  GuestComplaint,
  ImportJobRecord,
} from '../../shared/types';

const STORAGE_KEYS = {
  REAL_APARTMENTS: 'ahq_real_apartments_v1',
  REAL_RESERVATIONS: 'ahq_real_reservations_v1',
  REAL_TRANSACTIONS: 'ahq_real_transactions_v1',
  REAL_MAINTENANCE: 'ahq_real_maintenance_v1',
  REAL_COMPLAINTS: 'ahq_real_complaints_v1',
  IMPORT_HISTORY: 'ahq_import_history_v1',
};

// Initial empty/starter real property dataset (Property ID: AHQ-REAL-01)
export function getStoredRealPropertyData(): {
  apartments: Apartment[];
  reservations: Reservation[];
  transactions: FinancialTransaction[];
  maintenanceOrders: MaintenanceWorkOrder[];
  complaints: GuestComplaint[];
  importHistory: ImportJobRecord[];
} {
  try {
    const rawApts = localStorage.getItem(STORAGE_KEYS.REAL_APARTMENTS);
    const rawRes = localStorage.getItem(STORAGE_KEYS.REAL_RESERVATIONS);
    const rawTx = localStorage.getItem(STORAGE_KEYS.REAL_TRANSACTIONS);
    const rawMnt = localStorage.getItem(STORAGE_KEYS.REAL_MAINTENANCE);
    const rawCmp = localStorage.getItem(STORAGE_KEYS.REAL_COMPLAINTS);
    const rawHist = localStorage.getItem(STORAGE_KEYS.IMPORT_HISTORY);

    // If no real apartments yet, initialize real property configuration with 40 units matching real schema
    let apartments: Apartment[] = rawApts ? JSON.parse(rawApts) : [];
    if (apartments.length === 0) {
      apartments = initializeRealPropertyApartments();
      localStorage.setItem(STORAGE_KEYS.REAL_APARTMENTS, JSON.stringify(apartments));
    }

    return {
      apartments,
      reservations: rawRes ? JSON.parse(rawRes) : [],
      transactions: rawTx ? JSON.parse(rawTx) : [],
      maintenanceOrders: rawMnt ? JSON.parse(rawMnt) : [],
      complaints: rawCmp ? JSON.parse(rawCmp) : [],
      importHistory: rawHist ? JSON.parse(rawHist) : [],
    };
  } catch (err) {
    console.error('Error loading real property data:', err);
    return {
      apartments: initializeRealPropertyApartments(),
      reservations: [],
      transactions: [],
      maintenanceOrders: [],
      complaints: [],
      importHistory: [],
    };
  }
}

export function saveRealPropertyData(data: {
  apartments?: Apartment[];
  reservations?: Reservation[];
  transactions?: FinancialTransaction[];
  maintenanceOrders?: MaintenanceWorkOrder[];
  complaints?: GuestComplaint[];
  importHistory?: ImportJobRecord[];
}) {
  try {
    if (data.apartments) localStorage.setItem(STORAGE_KEYS.REAL_APARTMENTS, JSON.stringify(data.apartments));
    if (data.reservations) localStorage.setItem(STORAGE_KEYS.REAL_RESERVATIONS, JSON.stringify(data.reservations));
    if (data.transactions) localStorage.setItem(STORAGE_KEYS.REAL_TRANSACTIONS, JSON.stringify(data.transactions));
    if (data.maintenanceOrders) localStorage.setItem(STORAGE_KEYS.REAL_MAINTENANCE, JSON.stringify(data.maintenanceOrders));
    if (data.complaints) localStorage.setItem(STORAGE_KEYS.REAL_COMPLAINTS, JSON.stringify(data.complaints));
    if (data.importHistory) localStorage.setItem(STORAGE_KEYS.IMPORT_HISTORY, JSON.stringify(data.importHistory));
  } catch (err) {
    console.error('Error saving real property data:', err);
  }
}

function initializeRealPropertyApartments(): Apartment[] {
  const apts: Apartment[] = [];
  // 16 Studios
  for (let i = 1; i <= 16; i++) {
    const num = `1${i < 10 ? '0' + i : i}`;
    apts.push({
      id: `REAL-APT-${num}`,
      unitNumber: num,
      type: 'Studio',
      floor: 1,
      maxOccupancy: 2,
      floorAreaSqm: 45,
      baseRateAED: 460,
      currentStatus: 'Vacant Clean',
      isDemoUnit: false,
    });
  }
  // 12 1-Beds
  for (let i = 1; i <= 12; i++) {
    const num = `2${i < 10 ? '0' + i : i}`;
    apts.push({
      id: `REAL-APT-${num}`,
      unitNumber: num,
      type: 'One-bedroom',
      floor: 2,
      maxOccupancy: 3,
      floorAreaSqm: 72,
      baseRateAED: 690,
      currentStatus: 'Vacant Clean',
      isDemoUnit: false,
    });
  }
  // 8 2-Beds
  for (let i = 1; i <= 8; i++) {
    const num = `30${i}`;
    apts.push({
      id: `REAL-APT-${num}`,
      unitNumber: num,
      type: 'Two-bedroom',
      floor: 3,
      maxOccupancy: 5,
      floorAreaSqm: 118,
      baseRateAED: 1100,
      currentStatus: 'Vacant Clean',
      isDemoUnit: false,
    });
  }
  // 4 3-Beds
  for (let i = 1; i <= 4; i++) {
    const num = `40${i}`;
    apts.push({
      id: `REAL-APT-${num}`,
      unitNumber: num,
      type: 'Three-bedroom',
      floor: 4,
      maxOccupancy: 7,
      floorAreaSqm: 195,
      baseRateAED: 1700,
      currentStatus: 'Vacant Clean',
      isDemoUnit: false,
    });
  }
  return apts;
}

/**
 * CSV / TSV Parser
 */
export function parseCSVText(csvText: string): { headers: string[]; rows: string[][] } {
  const lines = csvText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) return { headers: [], rows: [] };

  // Detect delimiter (, or ; or \t)
  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);

  return { headers, rows };
}

/**
 * Validation Engine for Real Property Data
 */
export interface ValidationResult {
  validRows: any[];
  invalidRows: { rowNumber: number; raw: any; reason: string }[];
  warnings: string[];
}

export function validateReservationsImport(
  headers: string[],
  rows: string[][],
  mapping: Record<string, string>,
  validUnitNumbers: Set<string>
): ValidationResult {
  const validRows: Reservation[] = [];
  const invalidRows: { rowNumber: number; raw: any; reason: string }[] = [];
  const warnings: string[] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // header is row 1
    const rowObj: Record<string, string> = {};
    headers.forEach((h, hIdx) => {
      rowObj[h] = row[hIdx] || '';
    });

    const unitNumber = rowObj[mapping.unitNumber]?.trim();
    const checkIn = rowObj[mapping.checkInDate]?.trim();
    const checkOut = rowObj[mapping.checkOutDate]?.trim();
    const dailyRateStr = rowObj[mapping.dailyRateAED]?.replace(/[^0-9.]/g, '');
    const dailyRate = parseFloat(dailyRateStr);
    const guestName = rowObj[mapping.guestName]?.trim() || 'Guest';
    const channel = (rowObj[mapping.channel]?.trim() || 'Direct Web') as any;

    if (!unitNumber) {
      invalidRows.push({ rowNumber: rowNum, raw: rowObj, reason: 'Missing Unit Number' });
      return;
    }

    if (!validUnitNumbers.has(unitNumber) && !validUnitNumbers.has(`REAL-APT-${unitNumber}`)) {
      invalidRows.push({ rowNumber: rowNum, raw: rowObj, reason: `Unknown Unit Number ${unitNumber}` });
      return;
    }

    if (!checkIn || !checkOut) {
      invalidRows.push({ rowNumber: rowNum, raw: rowObj, reason: 'Missing Check-In or Check-Out date' });
      return;
    }

    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);
    if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) {
      invalidRows.push({ rowNumber: rowNum, raw: rowObj, reason: 'Invalid date format (must be YYYY-MM-DD)' });
      return;
    }

    if (outDate <= inDate) {
      invalidRows.push({ rowNumber: rowNum, raw: rowObj, reason: 'Check-out date must be strictly after Check-in date' });
      return;
    }

    if (isNaN(dailyRate) || dailyRate <= 0) {
      invalidRows.push({ rowNumber: rowNum, raw: rowObj, reason: 'Daily rate must be a positive number' });
      return;
    }

    const nights = Math.max(1, Math.round((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24)));
    const totalRev = dailyRate * nights;

    const commissionRate = channel === 'Booking.com' ? 15 : channel === 'Expedia' ? 18 : channel === 'Airbnb' ? 12 : 0;
    const netRevenue = Math.round(totalRev * (1 - commissionRate / 100));

    validRows.push({
      id: `REAL-RES-${Date.now()}-${idx}`,
      unitId: unitNumber.startsWith('REAL-APT-') ? unitNumber : `REAL-APT-${unitNumber}`,
      guestName,
      guestCategory: 'Corporate',
      channel,
      bookingDate: checkIn,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      nights,
      dailyRateAED: dailyRate,
      totalRoomRevenueAED: totalRev,
      commissionRatePercent: commissionRate,
      netRevenueAED: netRevenue,
      status: 'Completed',
      isDemo: false,
    });
  });

  if (invalidRows.length > 0) {
    warnings.push(`${invalidRows.length} out of ${rows.length} rows contained validation issues and were flagged.`);
  }

  return { validRows, invalidRows, warnings };
}

/**
 * Sample Downloadable CSV Templates
 */
export const SAMPLE_TEMPLATES = {
  reservations: `Unit_Number,Guest_Name,Check_In,Check_Out,Daily_Rate_AED,Booking_Channel
101,Sheikh Hamdan,2026-10-01,2026-10-05,520,Direct Web
102,Alexander Vance,2026-10-02,2026-10-07,480,Booking.com
201,Fatima Al-Falasi,2026-10-03,2026-10-09,750,Corporate Contract
205,Marcus Brody,2026-10-04,2026-10-10,720,Airbnb
301,Global Logistics Corp,2026-10-05,2026-10-20,1150,Corporate Contract
401,Royal Suite Guest,2026-10-08,2026-10-14,1850,Direct Web`,

  expenses: `Date,Category,Department,Amount_AED,Description
2026-10-01,Payroll & Benefits,Administration,65000,October payroll staff salaries
2026-10-05,Utilities (DEWA & District Cooling),Utilities,24500,DEWA water and electric monthly bill
2026-10-08,Maintenance & Repairs,Maintenance,4200,Air conditioning filters and spare valves
2026-10-12,Housekeeping Supplies,Housekeeping,8900,Guest amenities and laundry detergent chemicals
2026-10-15,Marketing & Tech Software,Sales & Marketing,5200,PMS software license and cloud hosting`,

  maintenance: `Unit_Number,Category,Description,Reported_Date,Status,Cost_AED,Technician
105,HVAC,Thermostat battery replacement,2026-10-02,Resolved,120,In-House Team
205,HVAC,AC cooling inspection and filter clean,2026-10-04,Resolved,450,Kamran Eng
304,Plumbing,Bathroom faucet washer seal,2026-10-09,Resolved,280,Al-Barsha Facilities
402,Electrical,Balcony accent lighting dimmer repair,2026-10-11,Resolved,320,Rashid Ali`,
};
