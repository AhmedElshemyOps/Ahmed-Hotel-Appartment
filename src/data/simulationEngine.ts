/**
 * Reproducible Synthetic Simulation Engine
 * Ahmed Quality Ops — Hospitality AI Command Center
 * 
 * Generates 40 Serviced Apartments with 12 months of interconnected,
 * reconciled operational, financial, maintenance, housekeeping, and guest data.
 */

import {
  Apartment,
  ApartmentType,
  ApartmentStatus,
  Reservation,
  MaintenanceWorkOrder,
  HousekeepingTask,
  GuestComplaint,
  UtilityRecord,
  FinancialTransaction,
  GuestCategory,
  BookingChannel,
} from '../types';

// Simple seeded PRNG (LCG) for deterministic reproducibility
class SeededRandom {
  private seed: number;
  constructor(seed: number = 4242) {
    this.seed = seed;
  }
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  range(min: number, max: number): number {
    return Math.floor(min + this.next() * (max - min + 1));
  }
  choice<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

/**
 * Generate 40 Standard Serviced Apartments Inventory
 */
export function generateApartmentsInventory(): Apartment[] {
  const apartments: Apartment[] = [];

  // 16 Studios: 101–116 (Floor 1)
  for (let i = 1; i <= 16; i++) {
    const num = `1${i < 10 ? '0' + i : i}`;
    apartments.push({
      id: `APT-${num}`,
      unitNumber: num,
      type: 'Studio',
      floor: 1,
      maxOccupancy: 2,
      floorAreaSqm: 45,
      baseRateAED: 450,
      currentStatus: 'Occupied',
      isDemoUnit: true,
      notes: i === 8 ? 'Thermostat sensor replaced Q2. Monitor calibration.' : undefined,
    });
  }

  // 12 One-bedroom: 201–212 (Floor 2)
  for (let i = 1; i <= 12; i++) {
    const num = `2${i < 10 ? '0' + i : i}`;
    apartments.push({
      id: `APT-${num}`,
      unitNumber: num,
      type: 'One-bedroom',
      floor: 2,
      maxOccupancy: 3,
      floorAreaSqm: 72,
      baseRateAED: 680,
      currentStatus: 'Occupied',
      isDemoUnit: true,
      notes: i === 5 ? 'Recurring HVAC compressor noise reported by 3 guests.' : undefined,
    });
  }

  // 8 Two-bedroom: 301–308 (Floor 3)
  for (let i = 1; i <= 8; i++) {
    const num = `30${i}`;
    apartments.push({
      id: `APT-${num}`,
      unitNumber: num,
      type: 'Two-bedroom',
      floor: 3,
      maxOccupancy: 5,
      floorAreaSqm: 118,
      baseRateAED: 1080,
      currentStatus: 'Occupied',
      isDemoUnit: true,
      notes: i === 4 ? 'Secondary bathroom plumbing seal monitored.' : undefined,
    });
  }

  // 4 Three-bedroom: 401–404 (Floor 4 Penthouse level)
  for (let i = 1; i <= 4; i++) {
    const num = `40${i}`;
    apartments.push({
      id: `APT-${num}`,
      unitNumber: num,
      type: 'Three-bedroom',
      floor: 4,
      maxOccupancy: 7,
      floorAreaSqm: 195,
      baseRateAED: 1650,
      currentStatus: 'Occupied',
      isDemoUnit: true,
      notes: 'Penthouse executive serviced apartment with panoramic terrace.',
    });
  }

  return apartments;
}

/**
 * Generate 12 Months of Coordinated Data
 */
export function generateSimulationDataset(seed: number = 4242) {
  const rng = new SeededRandom(seed);
  const apartments = generateApartmentsInventory();

  const reservations: Reservation[] = [];
  const maintenanceOrders: MaintenanceWorkOrder[] = [];
  const housekeepingTasks: HousekeepingTask[] = [];
  const complaints: GuestComplaint[] = [];
  const utilityRecords: UtilityRecord[] = [];
  const transactions: FinancialTransaction[] = [];

  const channels: BookingChannel[] = [
    'Direct Web',
    'Booking.com',
    'Airbnb',
    'Expedia',
    'Corporate Contract',
  ];

  const guestCategories: GuestCategory[] = [
    'Corporate',
    'Leisure',
    'Extended Stay',
    'VIP',
  ];

  const firstNames = ['David', 'Sara', 'Mohammed', 'Elena', 'Tariq', 'Jessica', 'Hans', 'Fatima', 'Alexander', 'Chloe', 'Zaid', 'Kenji', 'Maria', 'Liam', 'Sophie', 'Nasser'];
  const lastNames = ['Al-Falasi', 'Smith', 'Vanderbilt', 'Mansoori', 'Chen', 'Mueller', 'Dubois', 'Novak', 'Tanaka', 'Ibrahim', 'O\'Connor', 'Habib'];

  // 12 months timeline: 2025-11-01 to 2026-10-31
  const startSimulationDate = new Date('2025-11-01');
  const endSimulationDate = new Date('2026-10-31');
  const nowAnchorDate = new Date('2026-10-14'); // matches system time anchor

  let resCounter = 1000;
  let maintCounter = 500;
  let hkCounter = 8000;
  let compCounter = 300;
  let txCounter = 20000;

  // Month-by-month high season adjustments (Dubai hospitality: Nov-Apr high, Jul-Aug low)
  function getSeasonalMultiplier(monthIdx: number): number {
    // 0=Jan, 1=Feb, 6=Jul, 7=Aug, 10=Nov, 11=Dec
    if (monthIdx >= 10 || monthIdx <= 2) return 1.25; // Winter peak (Nov, Dec, Jan, Feb, Mar)
    if (monthIdx === 3 || monthIdx === 4 || monthIdx === 9) return 1.05; // Shoulder (Apr, May, Oct)
    return 0.78; // Summer heat (Jun, Jul, Aug, Sep)
  }

  // 1. Generate Non-Overlapping Realistic Reservations for each apartment
  apartments.forEach((apt) => {
    let cursorDate = new Date(startSimulationDate);
    // slight offset per apartment
    cursorDate.setDate(cursorDate.getDate() + rng.range(0, 3));

    while (cursorDate < endSimulationDate) {
      // Vacancy gap between bookings: 0 to 3 days (shorter during peak)
      const seasonFactor = getSeasonalMultiplier(cursorDate.getMonth());
      const gapDays = rng.next() > (0.65 * seasonFactor) ? rng.range(1, 3) : 0;
      cursorDate.setDate(cursorDate.getDate() + gapDays);

      if (cursorDate >= endSimulationDate) break;

      // Stay length: Studio/1-Bed: 2 to 7 days, or extended stay (14-30 days)
      const isExtendedStay = rng.next() < 0.18;
      const stayLength = isExtendedStay ? rng.range(14, 30) : rng.range(2, 6);

      const checkInDate = new Date(cursorDate);
      const checkOutDate = new Date(cursorDate);
      checkOutDate.setDate(checkOutDate.getDate() + stayLength);

      const bookingLeadDays = rng.range(4, 45);
      const bookingDate = new Date(checkInDate);
      bookingDate.setDate(bookingDate.getDate() - bookingLeadDays);

      const channel = rng.choice(channels);
      const guestCategory = isExtendedStay ? 'Extended Stay' : rng.choice(guestCategories);
      const guestName = `${rng.choice(firstNames)} ${rng.choice(lastNames)}`;

      // Seasonal rate calculation
      let dailyRate = Math.round(apt.baseRateAED * seasonFactor * (0.92 + rng.next() * 0.16));
      // Discounts for extended stays
      if (isExtendedStay) dailyRate = Math.round(dailyRate * 0.82);

      const totalRoomRevenue = dailyRate * stayLength;
      const commissionRate = channel === 'Booking.com' ? 15 : channel === 'Expedia' ? 18 : channel === 'Airbnb' ? 12 : 0;
      const commissionAmount = Math.round((totalRoomRevenue * commissionRate) / 100);
      const netRevenue = totalRoomRevenue - commissionAmount;

      // Status determination relative to anchor date (2026-10-14)
      let status: 'Confirmed' | 'In-House' | 'Completed' | 'Canceled' = 'Completed';
      const isCanceled = rng.next() < 0.07; // 7% cancellation rate

      if (isCanceled) {
        status = 'Canceled';
      } else if (checkInDate <= nowAnchorDate && checkOutDate >= nowAnchorDate) {
        status = 'In-House';
      } else if (checkInDate > nowAnchorDate) {
        status = 'Confirmed';
      } else {
        status = 'Completed';
      }

      const resId = `RES-${resCounter++}`;
      const reservation: Reservation = {
        id: resId,
        unitId: apt.id,
        guestName,
        guestCategory,
        channel,
        bookingDate: bookingDate.toISOString().split('T')[0],
        checkInDate: checkInDate.toISOString().split('T')[0],
        checkOutDate: checkOutDate.toISOString().split('T')[0],
        nights: stayLength,
        dailyRateAED: dailyRate,
        totalRoomRevenueAED: totalRoomRevenue,
        commissionRatePercent: commissionRate,
        netRevenueAED: netRevenue,
        status,
        cancellationDate: isCanceled ? new Date(bookingDate.getTime() + 86400000 * 2).toISOString().split('T')[0] : undefined,
        isDemo: true,
      };

      reservations.push(reservation);

      // Advance cursor to next check-out date
      cursorDate = new Date(checkOutDate);
    }
  });

  // 2. Coordinated Maintenance, Complaints, and Housekeeping
  // Specific Real-World Scenarios required by prompt:
  // Scenario A: Unit 205 (1-Bed) - Chronic HVAC compressor defect
  // Causing 4 work orders, 3 guest complaints, 6 out-of-order room nights, and AED 5,800 total costs
  const acDates = ['2026-03-12', '2026-05-20', '2026-07-14', '2026-09-02'];
  acDates.forEach((dt, idx) => {
    const isMajor = idx >= 2;
    const maintId = `MNT-${maintCounter++}`;
    maintenanceOrders.push({
      id: maintId,
      unitId: 'APT-205',
      category: 'HVAC',
      description: idx === 3
        ? 'Compressor bearing burnt out; full cooling coil and blower replacement recommended'
        : 'AC cooling inadequate; refrigerant top-up and capacitor reset',
      reportedDate: dt,
      resolvedDate: new Date(new Date(dt).getTime() + (isMajor ? 86400000 * 3 : 86400000)).toISOString().split('T')[0],
      status: 'Resolved',
      priority: isMajor ? 'Critical' : 'High',
      costAED: isMajor ? 2400 : 850,
      technician: 'Kamran Engineering / Daikin Tech',
      isRecurring: true,
      revenueImpactAED: isMajor ? 1360 : 0,
      causedOutOfOrderNights: isMajor ? 2 : 0,
      isDemo: true,
    });

    complaints.push({
      id: `CMP-${compCounter++}`,
      unitId: 'APT-205',
      guestCategory: 'Leisure',
      category: 'HVAC / Cooling',
      description: `Room temperature reached 28°C despite thermostat set to 20°C. Loud rattling noise at night.`,
      severity: isMajor ? 'Critical' : 'High',
      reportedAt: dt,
      resolvedAt: new Date(new Date(dt).getTime() + 86400000).toISOString().split('T')[0],
      status: 'Resolved',
      resolutionNote: 'Offered complimentary breakfast + AED 400 service credit. Unit moved to maintenance hold.',
      serviceRecoveryCostAED: 400,
      isDemo: true,
    });
  });

  // Scenario B: Unit 304 - Master Bathroom shower mixer leak
  maintenanceOrders.push({
    id: `MNT-${maintCounter++}`,
    unitId: 'APT-304',
    category: 'Plumbing',
    description: 'Concealed valve mixer failure leaking through drywall into corridor sub-base',
    reportedDate: '2026-06-18',
    resolvedDate: '2026-06-21',
    status: 'Resolved',
    priority: 'Critical',
    costAED: 3150,
    technician: 'Al-Barsha Facilities',
    isRecurring: true,
    revenueImpactAED: 3240,
    causedOutOfOrderNights: 3,
    isDemo: true,
  });

  complaints.push({
    id: `CMP-${compCounter++}`,
    unitId: 'APT-304',
    guestCategory: 'VIP',
    category: 'Plumbing / Odor',
    description: 'Water seepage from bathroom baseboard dampening bedroom carpet',
    severity: 'High',
    reportedAt: '2026-06-18',
    resolvedAt: '2026-06-19',
    status: 'Resolved',
    resolutionNote: 'Relocated VIP guest to Penthouse 402 with complimentary dinner vouchers.',
    serviceRecoveryCostAED: 750,
    isDemo: true,
  });

  // Scenario C: Unit 108 - Thermostat sensor drift
  maintenanceOrders.push({
    id: `MNT-${maintCounter++}`,
    unitId: 'APT-108',
    category: 'Electrical',
    description: 'Digital thermostat sensor reporting false ambient temperature readings',
    reportedDate: '2026-08-10',
    resolvedDate: '2026-08-11',
    status: 'Resolved',
    priority: 'Medium',
    costAED: 480,
    technician: 'In-House Eng. Team',
    isRecurring: false,
    revenueImpactAED: 0,
    causedOutOfOrderNights: 0,
    isDemo: true,
  });

  // Scenario D: Additional routine maintenance work orders across the 40 apartments
  const categories: ('HVAC' | 'Plumbing' | 'Electrical' | 'Carpentry / Furniture' | 'Appliance' | 'Preventive')[] = [
    'HVAC', 'Plumbing', 'Electrical', 'Carpentry / Furniture', 'Appliance', 'Preventive'
  ];
  apartments.forEach((apt) => {
    // 1 to 4 work orders per unit across the year
    const ordersCount = rng.range(1, 3);
    for (let k = 0; k < ordersCount; k++) {
      const orderDate = new Date(startSimulationDate.getTime() + rng.next() * (endSimulationDate.getTime() - startSimulationDate.getTime()));
      const category = rng.choice(categories);
      const isPreventive = category === 'Preventive';
      const cost = isPreventive ? rng.range(150, 350) : rng.range(280, 950);
      
      const isOpen = orderDate > new Date('2026-10-01') && rng.next() < 0.25;

      maintenanceOrders.push({
        id: `MNT-${maintCounter++}`,
        unitId: apt.id,
        category,
        description: isPreventive
          ? `Bi-annual filter cleaning, smoke detector test & window seal inspection`
          : `${category} routine repair and component servicing`,
        reportedDate: orderDate.toISOString().split('T')[0],
        resolvedDate: isOpen ? undefined : new Date(orderDate.getTime() + 86400000 * rng.range(1, 2)).toISOString().split('T')[0],
        status: isOpen ? 'Open' : 'Resolved',
        priority: isOpen ? 'High' : 'Low',
        costAED: cost,
        technician: rng.choice(['Farhan K.', 'Rashid Ali', 'In-House Eng. Team', 'Empower Service Partner']),
        isRecurring: rng.next() < 0.15,
        revenueImpactAED: 0,
        causedOutOfOrderNights: 0,
        isDemo: true,
      });
    }
  });

  // Additional Complaints
  const complaintDescriptions = [
    { cat: 'Cleanliness', desc: 'Dust detected under living room media console and balcony railing dirty.', sev: 'Low', cost: 0 },
    { cat: 'Wi-Fi / TV', desc: 'Smart TV streaming latency and weak Wi-Fi signal in bedroom area.', sev: 'Medium', cost: 0 },
    { cat: 'Noise', desc: 'Elevator motor vibration audible between 23:00 and 06:00.', sev: 'Medium', cost: 150 },
    { cat: 'HVAC / Cooling', desc: 'Thermostat takes over 90 minutes to cool room after arrival.', sev: 'High', cost: 200 },
    { cat: 'Cleanliness', desc: 'Bathroom towels lacked fresh citrus scent as per brand standard.', sev: 'Low', cost: 0 },
    { cat: 'Keycard / Access', desc: 'Digital door lock battery drained, RFID card required 3 attempts.', sev: 'Medium', cost: 50 },
  ];

  for (let c = 0; c < 35; c++) {
    const compDate = new Date(startSimulationDate.getTime() + rng.next() * (endSimulationDate.getTime() - startSimulationDate.getTime()));
    const compApt = rng.choice(apartments);
    const template = rng.choice(complaintDescriptions);
    const isRecentOpen = compDate > new Date('2026-10-05') && rng.next() < 0.3;

    complaints.push({
      id: `CMP-${compCounter++}`,
      unitId: compApt.id,
      guestCategory: rng.choice(guestCategories),
      category: template.cat as any,
      description: template.desc,
      severity: template.sev as any,
      reportedAt: compDate.toISOString().split('T')[0],
      resolvedAt: isRecentOpen ? undefined : new Date(compDate.getTime() + 86400000).toISOString().split('T')[0],
      status: isRecentOpen ? 'Open' : 'Resolved',
      resolutionNote: isRecentOpen ? undefined : 'Handled promptly by Assistant Duty Manager.',
      serviceRecoveryCostAED: template.cost,
      isDemo: true,
    });
  }

  // 3. Housekeeping Turnover Records
  const housekeepers = ['Amina Begum', 'Priya Sharma', 'Sunita Rao', 'Kavita Patel', 'Grace Oduya', 'Mary Jane'];
  const inspectors = ['Executive Housekeeper Fatima', 'Supervisor Leilani', 'Quality Lead Zaid'];

  apartments.forEach((apt) => {
    // Generate 6 sample housekeeping logs per unit for recent months
    for (let h = 0; h < 6; h++) {
      const taskDate = new Date('2026-09-01');
      taskDate.setDate(taskDate.getDate() + (h * 7) + rng.range(0, 3));
      const score = rng.range(82, 100);
      const isFail = score < 88;

      housekeepingTasks.push({
        id: `HK-${hkCounter++}`,
        unitId: apt.id,
        housekeeper: rng.choice(housekeepers),
        inspector: rng.choice(inspectors),
        status: isFail ? 'Failed Inspection' : 'Inspected',
        scheduledDate: taskDate.toISOString().split('T')[0],
        completedAt: `${taskDate.toISOString().split('T')[0]} 14:${rng.range(15, 55)}`,
        turnaroundMinutes: apt.type === 'Studio' ? rng.range(35, 50) : apt.type === 'One-bedroom' ? rng.range(45, 65) : rng.range(70, 110),
        linenChanged: true,
        inspectionScore: score,
        defectNotes: isFail ? 'Mirrors showed water streaks; kitchen utensil drawer misaligned.' : undefined,
        isDemo: true,
      });
    }
  });

  // 4. Utility Records (12 Months per Apartment)
  // Higher electricity & chilled water in Dubai summer (June - September)
  const months = [
    '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04',
    '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'
  ];

  apartments.forEach((apt) => {
    months.forEach((mStr) => {
      const mIdx = parseInt(mStr.split('-')[1], 10);
      const isSummer = mIdx >= 6 && mIdx <= 9;
      const baseAreaMultiplier = apt.floorAreaSqm / 50;

      const kwh = Math.round((isSummer ? rng.range(650, 950) : rng.range(380, 520)) * baseAreaMultiplier);
      const waterM3 = Math.round(rng.range(12, 28) * baseAreaMultiplier);
      const tonHours = Math.round((isSummer ? rng.range(500, 800) : rng.range(180, 320)) * baseAreaMultiplier);

      // Unit 205 has high consumption anomaly due to malfunctioning AC continuous cycle!
      const isAnomalyUnit = apt.unitNumber === '205' && isSummer;
      const actualKwh = isAnomalyUnit ? Math.round(kwh * 1.45) : kwh;

      const electricityCost = Math.round(actualKwh * 0.38); // DEWA tariff ~0.38 AED/kWh
      const waterCost = Math.round(waterM3 * 9.5); // DEWA water ~9.5 AED/m3
      const chilledWaterCost = Math.round(tonHours * 0.55); // District cooling
      const totalCost = electricityCost + waterCost + chilledWaterCost;

      utilityRecords.push({
        id: `UTL-${apt.id}-${mStr}`,
        unitId: apt.id,
        month: mStr,
        electricityKwh: actualKwh,
        electricityCostAED: electricityCost,
        waterM3,
        waterCostAED: waterCost,
        chilledWaterTonHours: tonHours,
        chilledWaterCostAED: chilledWaterCost,
        totalUtilityAED: totalCost,
        isAnomaly: isAnomalyUnit,
        isDemo: true,
      });
    });
  });

  // 5. Generate Reconciled Financial Transactions & Budgets
  // Create monthly actual expenses + budget benchmarks
  months.forEach((mStr) => {
    const monthReservations = reservations.filter(
      r => r.status !== 'Canceled' && r.checkInDate.startsWith(mStr)
    );
    const monthRoomRev = monthReservations.reduce((s, r) => s + r.totalRoomRevenueAED, 0);

    // Actual Departmental Expenses
    // Payroll (Housekeeping, Eng, Front Office, Management) ~ AED 68,000 / month
    transactions.push({
      id: `TX-${txCounter++}`,
      date: `${mStr}-28`,
      month: mStr,
      type: 'expense',
      category: 'Payroll & Benefits',
      department: 'Administration',
      amountAED: 68500,
      description: 'Salaries, health insurance, visa allocations for 14 operational staff',
      isBudget: false,
      isDemo: true,
    });

    // Utilities (Sum from utility records for that month)
    const monthUtils = utilityRecords.filter(u => u.month === mStr);
    const totalUtilCost = monthUtils.reduce((s, u) => s + u.totalUtilityAED, 0) + 4200; // + common area
    transactions.push({
      id: `TX-${txCounter++}`,
      date: `${mStr}-25`,
      month: mStr,
      type: 'expense',
      category: 'Utilities (DEWA & District Cooling)',
      department: 'Utilities',
      amountAED: totalUtilCost,
      description: 'Consolidated DEWA electricity, water and Empower district cooling invoice',
      isBudget: false,
      isDemo: true,
    });

    // Maintenance Parts & Contractors for that month
    const monthMaint = maintenanceOrders.filter(m => m.reportedDate.startsWith(mStr));
    const totalMaintCost = monthMaint.reduce((s, m) => s + m.costAED, 0) + 3500; // + preventive contract
    transactions.push({
      id: `TX-${txCounter++}`,
      date: `${mStr}-20`,
      month: mStr,
      type: 'expense',
      category: 'Maintenance & Repairs',
      department: 'Maintenance',
      amountAED: totalMaintCost,
      description: 'Engineering spare parts, HVAC consumables, lift AMC, specialist callouts',
      isBudget: false,
      isDemo: true,
    });

    // Housekeeping Supplies & Commercial Laundry
    const hkSuppliesCost = Math.round(14500 + rng.range(-800, 1200));
    transactions.push({
      id: `TX-${txCounter++}`,
      date: `${mStr}-18`,
      month: mStr,
      type: 'expense',
      category: 'Housekeeping Supplies',
      department: 'Housekeeping',
      amountAED: hkSuppliesCost,
      description: 'Chemicals, premium guest bathroom amenities, linen replacement pool',
      isBudget: false,
      isDemo: true,
    });

    // OTA Commissions
    const otaCommissions = monthReservations
      .filter(r => r.channel === 'Booking.com' || r.channel === 'Expedia' || r.channel === 'Airbnb')
      .reduce((s, r) => s + (r.totalRoomRevenueAED - r.netRevenueAED), 0);
    transactions.push({
      id: `TX-${txCounter++}`,
      date: `${mStr}-30`,
      month: mStr,
      type: 'expense',
      category: 'OTA Commissions',
      department: 'Sales & Marketing',
      amountAED: otaCommissions,
      description: 'Distribution commissions to Booking.com, Expedia Group, and Airbnb',
      isBudget: false,
      isDemo: true,
    });

    // Marketing, Tech, SaaS & Admin
    transactions.push({
      id: `TX-${txCounter++}`,
      date: `${mStr}-15`,
      month: mStr,
      type: 'expense',
      category: 'Marketing & Tech Software',
      department: 'Sales & Marketing',
      amountAED: 8900,
      description: 'PMS licensing, channel manager, high-speed fiber internet, local marketing',
      isBudget: false,
      isDemo: true,
    });

    // Ancillary Revenue (Mini-market, laundry, parking, airport transfers) ~ 5-8% of room revenue
    const ancillaryRev = Math.round(monthRoomRev * 0.065);
    transactions.push({
      id: `TX-${txCounter++}`,
      date: `${mStr}-30`,
      month: mStr,
      type: 'revenue',
      category: 'Ancillary Services & Laundry',
      department: 'Rooms',
      amountAED: ancillaryRev,
      description: 'Guest laundry fees, mini-convenience hub sales, premium parking & airport transfers',
      isBudget: false,
      isDemo: true,
    });

    // MONTHLY BUDGET BENCHMARK TRANSACTIONS (For variance reporting)
    const mIdx = parseInt(mStr.split('-')[1], 10);
    const season = getSeasonalMultiplier(mIdx);
    const budgetMonthlyRevenue = Math.round(380000 * season);
    const budgetMonthlyOpEx = Math.round(185000 + (season * 12000));

    transactions.push({
      id: `BUDGET-REV-${mStr}`,
      date: `${mStr}-01`,
      month: mStr,
      type: 'revenue',
      category: 'Total Revenue Budget',
      department: 'Rooms',
      amountAED: budgetMonthlyRevenue,
      description: `Target revenue approved in annual owner budget for ${mStr}`,
      isBudget: true,
      isDemo: true,
    });

    transactions.push({
      id: `BUDGET-EXP-${mStr}`,
      date: `${mStr}-01`,
      month: mStr,
      type: 'expense',
      category: 'Total OpEx Budget',
      department: 'Administration',
      amountAED: budgetMonthlyOpEx,
      description: `Target operating expenses approved in annual budget for ${mStr}`,
      isBudget: true,
      isDemo: true,
    });
  });

  // Assign live real-time status to apartments as of today (2026-10-14)
  apartments.forEach((apt) => {
    // Special units:
    if (apt.unitNumber === '205') {
      apt.currentStatus = 'Under Maintenance';
      apt.notes = 'Under comprehensive HVAC coil overhaul. Expected completion in 48h.';
      return;
    }
    if (apt.unitNumber === '304') {
      apt.currentStatus = 'Vacant Clean';
      apt.notes = 'Plumbing repairs certified. Inspection passed score: 98/100.';
      return;
    }
    if (apt.unitNumber === '112') {
      apt.currentStatus = 'Vacant Dirty';
      apt.notes = 'Checkout completed at 11:30. Assigned to Amina for turnover.';
      return;
    }
    if (apt.unitNumber === '108') {
      apt.currentStatus = 'Arrival Expected';
      apt.notes = 'VIP Arrival expected at 16:00. Amenities placed.';
      return;
    }
    if (apt.unitNumber === '401') {
      apt.currentStatus = 'Departure Expected';
      apt.currentGuestName = 'H.E. Al-Falasi';
      apt.currentGuestCategory = 'VIP';
      apt.currentCheckOut = '2026-10-14';
      return;
    }

    // Check if in-house reservation exists for today
    const inHouse = reservations.find(
      r => r.unitId === apt.id && r.status === 'In-House'
    );

    if (inHouse) {
      apt.currentStatus = 'Occupied';
      apt.currentGuestName = inHouse.guestName;
      apt.currentGuestCategory = inHouse.guestCategory;
      apt.currentCheckOut = inHouse.checkOutDate;
    } else {
      const stRand = rng.next();
      if (stRand < 0.70) apt.currentStatus = 'Occupied';
      else if (stRand < 0.85) apt.currentStatus = 'Vacant Clean';
      else apt.currentStatus = 'Vacant Dirty';
    }
  });

  return {
    apartments,
    reservations,
    maintenanceOrders,
    housekeepingTasks,
    complaints,
    utilityRecords,
    transactions,
  };
}
