/**
 * Competitor Intelligence & Comp Set Forward Forecasting Engine
 * Ahmed Quality Ops — Hospitality AI Command Center
 * 
 * Provides competitive benchmarking adhering to STR (Smith Travel Research) global standards:
 * - MPI (Market Penetration Index / Occupancy Index)
 * - ARI (Average Rate Index / Price Positioning)
 * - RGI (Revenue Generation Index / RevPAR Market Share)
 * 
 * Forward 30-Day Competitor Trajectory Modeling for Dubai Marina & JBR Prime Market.
 */

export interface CompetitorProperty {
  id: string;
  name: string;
  submarket: string;
  distanceKm: number;
  starRating: number;
  unitCount: number;
  currentADR: number;
  forecastADR30Days: number;
  currentOccupancy: number;
  forecastOccupancy30Days: number;
  revParCurrent: number;
  revParForecast: number;
  pricingStrategy: 'Premium Leader' | 'Rate Follower' | 'Discount Aggressive' | 'Dynamic Yield';
  tags: string[];
}

export interface CompSetTrajectoryPoint {
  weekLabel: string;
  dateRange: string;
  compSetAvgADR: number;
  compSetAvgOcc: number;
  compSetAvgRevPAR: number;
  ourProjectedADR: number;
  ourProjectedOcc: number;
  ourProjectedRevPAR: number;
  demandSurgeFactor: number; // 1.0 = normal, 1.2 = +20% demand compression
  primaryEvent?: string;
}

export interface CompSetBenchmarkSummary {
  compSetProperties: CompetitorProperty[];
  compSetAvgADR: number;
  compSetAvgOcc: number;
  compSetAvgRevPAR: number;
  compSetForecastADR: number;
  compSetForecastOcc: number;
  compSetForecastRevPAR: number;
  // Indexes: >100 means outperforming the competitive set
  mpiCurrent: number; // Market Penetration Index (Occupancy)
  ariCurrent: number; // Average Rate Index (ADR)
  rgiCurrent: number; // Revenue Generation Index (RevPAR)
  mpiForecast: number;
  ariForecast: number;
  rgiForecast: number;
  trajectory: CompSetTrajectoryPoint[];
  marketInsights: {
    id: string;
    type: 'opportunity' | 'threat' | 'parity' | 'surge';
    title: string;
    description: string;
    recommendedAction: string;
    potentialRevenueImpactAED: number;
  }[];
}

export const DUBAI_MARINA_COMP_SET: CompetitorProperty[] = [
  {
    id: 'comp-1',
    name: 'Marina Gate Luxury Suites',
    submarket: 'Dubai Marina North',
    distanceKm: 0.3,
    starRating: 4.8,
    unitCount: 120,
    currentADR: 765,
    forecastADR30Days: 825,
    currentOccupancy: 83.5,
    forecastOccupancy30Days: 86.0,
    revParCurrent: 639,
    revParForecast: 710,
    pricingStrategy: 'Dynamic Yield',
    tags: ['Waterfront', 'Infinity Pool', 'Corporate Favored'],
  },
  {
    id: 'comp-2',
    name: 'Address Beach Residences & Serviced Units',
    submarket: 'JBR / Marina South',
    distanceKm: 1.1,
    starRating: 4.9,
    unitCount: 215,
    currentADR: 940,
    forecastADR30Days: 1020,
    currentOccupancy: 87.0,
    forecastOccupancy30Days: 89.5,
    revParCurrent: 818,
    revParForecast: 913,
    pricingStrategy: 'Premium Leader',
    tags: ['Ultra Luxury', 'Beach Access', 'Highest ADR'],
  },
  {
    id: 'comp-3',
    name: 'Vida Dubai Marina & Yacht Club',
    submarket: 'Marina Promenade',
    distanceKm: 0.6,
    starRating: 4.7,
    unitCount: 158,
    currentADR: 710,
    forecastADR30Days: 765,
    currentOccupancy: 80.2,
    forecastOccupancy30Days: 82.8,
    revParCurrent: 569,
    revParForecast: 633,
    pricingStrategy: 'Rate Follower',
    tags: ['Yacht Club', 'Lifestyle', 'OTA Heavy'],
  },
  {
    id: 'comp-4',
    name: 'Stella Maris Waterfront Residences',
    submarket: 'Dubai Marina South',
    distanceKm: 0.4,
    starRating: 4.6,
    unitCount: 95,
    currentADR: 675,
    forecastADR30Days: 720,
    currentOccupancy: 77.8,
    forecastOccupancy30Days: 80.5,
    revParCurrent: 525,
    revParForecast: 580,
    pricingStrategy: 'Discount Aggressive',
    tags: ['New Opening', 'Discount Promotions', 'Extended Stays'],
  },
  {
    id: 'comp-5',
    name: 'Grosvenor House Luxury Serviced Apartments',
    submarket: 'Dubai Marina Center',
    distanceKm: 1.4,
    starRating: 4.9,
    unitCount: 180,
    currentADR: 890,
    forecastADR30Days: 960,
    currentOccupancy: 85.5,
    forecastOccupancy30Days: 87.5,
    revParCurrent: 761,
    revParForecast: 840,
    pricingStrategy: 'Premium Leader',
    tags: ['Luxury Pioneer', 'Michelin Dining', 'High Corporate Loyalty'],
  },
];

/**
 * Calculates complete competitive benchmark indexes and forward 30-day forecast
 */
export function calculateCompSetForecast(params: {
  ourCurrentADR: number;
  ourCurrentOcc: number;
  ourCurrentRevPAR: number;
  pricingScenario?: 'base' | 'aggressive' | 'conservative' | 'premium_leader';
}): CompSetBenchmarkSummary {
  const {
    ourCurrentADR,
    ourCurrentOcc,
    ourCurrentRevPAR,
    pricingScenario = 'base',
  } = params;

  // Comp set averages
  const totalUnits = DUBAI_MARINA_COMP_SET.reduce((s, c) => s + c.unitCount, 0);
  
  // Weighted averages based on competitor capacity
  const weightedCurrentADR = Math.round(
    DUBAI_MARINA_COMP_SET.reduce((s, c) => s + c.currentADR * c.unitCount, 0) / totalUnits
  );
  const weightedCurrentOcc = Number(
    (DUBAI_MARINA_COMP_SET.reduce((s, c) => s + c.currentOccupancy * c.unitCount, 0) / totalUnits).toFixed(1)
  );
  const weightedCurrentRevPAR = Math.round((weightedCurrentADR * weightedCurrentOcc) / 100);

  const weightedForecastADR = Math.round(
    DUBAI_MARINA_COMP_SET.reduce((s, c) => s + c.forecastADR30Days * c.unitCount, 0) / totalUnits
  );
  const weightedForecastOcc = Number(
    (DUBAI_MARINA_COMP_SET.reduce((s, c) => s + c.forecastOccupancy30Days * c.unitCount, 0) / totalUnits).toFixed(1)
  );
  const weightedForecastRevPAR = Math.round((weightedForecastADR * weightedForecastOcc) / 100);

  // Industry Standard Benchmarking Formulas:
  // MPI = (Property Occupancy / Comp Set Occupancy) * 100
  // ARI = (Property ADR / Comp Set ADR) * 100
  // RGI = (Property RevPAR / Comp Set RevPAR) * 100
  const mpiCurrent = Number(((ourCurrentOcc / weightedCurrentOcc) * 100).toFixed(1));
  const ariCurrent = Number(((ourCurrentADR / weightedCurrentADR) * 100).toFixed(1));
  const rgiCurrent = Number(((ourCurrentRevPAR / weightedCurrentRevPAR) * 100).toFixed(1));

  // Scenario multipliers for forward 30 days
  let adrMultiplier = 1.05; // Base high-season natural pickup +5%
  let occMultiplier = 1.03; // Base occupancy pickup +3%

  if (pricingScenario === 'aggressive') {
    adrMultiplier = 0.96; // Undercut comp set by -4% to capture high occupancy
    occMultiplier = 1.07; // +7% occupancy surge
  } else if (pricingScenario === 'conservative') {
    adrMultiplier = 1.02; // Mild rate lift
    occMultiplier = 0.99; // Slight volume protection
  } else if (pricingScenario === 'premium_leader') {
    adrMultiplier = 1.12; // Premium yield push +12%
    occMultiplier = 1.01; // Maintain healthy occupancy
  }

  const ourForecastADR = Math.round(ourCurrentADR * adrMultiplier);
  const ourForecastOcc = Math.min(96, Number((ourCurrentOcc * occMultiplier).toFixed(1)));
  const ourForecastRevPAR = Math.round((ourForecastADR * ourForecastOcc) / 100);

  const mpiForecast = Number(((ourForecastOcc / weightedForecastOcc) * 100).toFixed(1));
  const ariForecast = Number(((ourForecastADR / weightedForecastADR) * 100).toFixed(1));
  const rgiForecast = Number(((ourForecastRevPAR / weightedForecastRevPAR) * 100).toFixed(1));

  // 4-Week Forward Trajectory (Next 30 Days: Nov 2026 High Season Launch)
  const trajectory: CompSetTrajectoryPoint[] = [
    {
      weekLabel: 'Week +1 (Days 1–7)',
      dateRange: 'Nov 01 – Nov 07',
      compSetAvgADR: Math.round(weightedCurrentADR * 1.02),
      compSetAvgOcc: Math.round(weightedCurrentOcc * 1.01),
      compSetAvgRevPAR: Math.round(weightedCurrentRevPAR * 1.03),
      ourProjectedADR: Math.round(ourForecastADR * 0.98),
      ourProjectedOcc: Math.round(ourForecastOcc * 0.98),
      ourProjectedRevPAR: Math.round(ourForecastRevPAR * 0.96),
      demandSurgeFactor: 1.02,
      primaryEvent: 'High Season Transition',
    },
    {
      weekLabel: 'Week +2 (Days 8–14)',
      dateRange: 'Nov 08 – Nov 14',
      compSetAvgADR: Math.round(weightedCurrentADR * 1.05),
      compSetAvgOcc: Math.round(weightedCurrentOcc * 1.02),
      compSetAvgRevPAR: Math.round(weightedCurrentRevPAR * 1.07),
      ourProjectedADR: Math.round(ourForecastADR * 1.0),
      ourProjectedOcc: Math.round(ourForecastOcc * 1.0),
      ourProjectedRevPAR: Math.round(ourForecastRevPAR * 1.0),
      demandSurgeFactor: 1.06,
      primaryEvent: 'Global Tech & Corporate Summits',
    },
    {
      weekLabel: 'Week +3 (Days 15–21)',
      dateRange: 'Nov 15 – Nov 21',
      compSetAvgADR: Math.round(weightedCurrentADR * 1.14), // Big spike across competitors
      compSetAvgOcc: Math.round(weightedCurrentOcc * 1.06),
      compSetAvgRevPAR: Math.round(weightedCurrentRevPAR * 1.21),
      ourProjectedADR: Math.round(ourForecastADR * 1.08),
      ourProjectedOcc: Math.round(ourForecastOcc * 1.03),
      ourProjectedRevPAR: Math.round(ourForecastRevPAR * 1.11),
      demandSurgeFactor: 1.18,
      primaryEvent: 'Dubai International Boat Show & F1 Abu Dhabi Spillover',
    },
    {
      weekLabel: 'Week +4 (Days 22–30)',
      dateRange: 'Nov 22 – Nov 30',
      compSetAvgADR: Math.round(weightedCurrentADR * 1.09),
      compSetAvgOcc: Math.round(weightedCurrentOcc * 1.04),
      compSetAvgRevPAR: Math.round(weightedCurrentRevPAR * 1.13),
      ourProjectedADR: Math.round(ourForecastADR * 1.04),
      ourProjectedOcc: Math.round(ourForecastOcc * 1.02),
      ourProjectedRevPAR: Math.round(ourForecastRevPAR * 1.06),
      demandSurgeFactor: 1.10,
      primaryEvent: 'Winter Luxury Extended-Stay Kickoff',
    },
  ];

  // AI Strategic Market Insights & Yield Gap Detection
  const marketInsights: CompSetBenchmarkSummary['marketInsights'] = [
    {
      id: 'ins-1',
      type: 'surge',
      title: 'Week 3 Compression Wave: Marina Boat Show & GP Spillover',
      description: `Competitors (Marina Gate & Address Beach) have already pushed forward weekend rates by +18% to AED 880–1,050. Our current rate sits at AED ${ourCurrentADR}, leaving a significant price gap.`,
      recommendedAction: 'Elevate Two-Bedroom and Penthouse daily rates by +12% (AED 90–140/night) for Nov 18–22. Implement a 3-night minimum length of stay (MLOS).',
      potentialRevenueImpactAED: 38400,
    },
    {
      id: 'ins-2',
      type: 'opportunity',
      title: `Average Rate Index (ARI: ${ariCurrent}): Yield Opportunity vs Marina Gate`,
      description: `Our current ARI is ${ariCurrent < 100 ? `${(100 - ariCurrent).toFixed(1)}% below` : `${(ariCurrent - 100).toFixed(1)}% above`} the Comp Set average. With high guest satisfaction (4.82★) and luxury finishes, our product supports rate parity with top tier units.`,
      recommendedAction: 'Transition 30% of inventory from OTAs (18% commission) to direct corporate contract channels offering complimentary airport transfer.',
      potentialRevenueImpactAED: 24500,
    },
    {
      id: 'ins-3',
      type: 'threat',
      title: 'Stella Maris Aggressive Discounting in Studio Category',
      description: 'Stella Maris is offering AED 610/night promos on OTAs to stimulate unbooked Studio inventory, pressuring mid-week demand.',
      recommendedAction: 'Do not enter a price war on Studios. Instead, bundle high-speed workstation amenities and breakfast vouchers for 7+ day stays.',
      potentialRevenueImpactAED: 12800,
    },
  ];

  return {
    compSetProperties: DUBAI_MARINA_COMP_SET,
    compSetAvgADR: weightedCurrentADR,
    compSetAvgOcc: weightedCurrentOcc,
    compSetAvgRevPAR: weightedCurrentRevPAR,
    compSetForecastADR: weightedForecastADR,
    compSetForecastOcc: weightedForecastOcc,
    compSetForecastRevPAR: weightedForecastRevPAR,
    mpiCurrent,
    ariCurrent,
    rgiCurrent,
    mpiForecast,
    ariForecast,
    rgiForecast,
    trajectory,
    marketInsights,
  };
}
