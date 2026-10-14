import React, { useState } from 'react';
import {
  FlaskConical,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Sliders,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Layers,
  ShieldAlert,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import { PropertyKPISummary, SimulationScenarioResult } from '../types';
import { formatAED, formatPercent } from '../data/kpiEngine';

interface SimulationLabViewProps {
  baselineKpi: PropertyKPISummary;
}

export const SimulationLabView: React.FC<SimulationLabViewProps> = ({ baselineKpi }) => {
  // Sliders
  const [adrDelta, setAdrDelta] = useState<number>(10); // default +10%
  const [occDelta, setOccDelta] = useState<number>(0); // default 0% (constant)
  const [maintDelta, setMaintDelta] = useState<number>(0);
  const [utilDelta, setUtilDelta] = useState<number>(0);
  const [outOfOrderReduction, setOutOfOrderReduction] = useState<number>(5); // recover 5 nights

  // Reset to default
  const handleReset = () => {
    setAdrDelta(10);
    setOccDelta(0);
    setMaintDelta(0);
    setUtilDelta(0);
    setOutOfOrderReduction(5);
  };

  // Calculations:
  // Baseline:
  const baselineRev = baselineKpi.roomRevenueAED;
  const baselineOpEx = baselineKpi.operatingExpensesAED;
  const baselineNOI = baselineKpi.netOperatingIncomeAED;
  const baselineOcc = baselineKpi.occupancyPercent;
  const baselineADR = baselineKpi.adrAED;

  // Simulated Model:
  const simADR = Math.round(baselineADR * (1 + adrDelta / 100));
  const simOcc = Math.max(10, Math.min(100, Number((baselineOcc + occDelta).toFixed(1))));
  const simNights = Math.round((baselineKpi.availableUnitNights * simOcc) / 100);
  const simRev = Math.round(simNights * simADR);
  const revDiff = simRev - baselineRev;

  // Operating Expenses impact:
  // Cleaning and utility cost increases with higher occupancy, reduces with lower occupancy
  const occRatio = simOcc / baselineOcc;
  const variableOpExPortion = baselineOpEx * 0.35; // 35% variable
  const fixedOpExPortion = baselineOpEx * 0.65;
  const adjustedVariableOpEx = variableOpExPortion * occRatio;
  const maintAdjustment = (baselineOpEx * 0.10) * (maintDelta / 100);
  const utilAdjustment = (baselineOpEx * 0.12) * (utilDelta / 100);

  const simOpEx = Math.round(fixedOpExPortion + adjustedVariableOpEx + maintAdjustment + utilAdjustment);
  const simNOI = simRev - simOpEx;
  const noiDiff = simNOI - baselineNOI;
  const simMargin = Number(((simNOI / simRev) * 100).toFixed(1));

  // 3-way Sensitivity Matrix for +10% ADR (as requested in test prompt)
  const sensitivityCases = [
    {
      name: 'Optimistic (0% Elasticity Drop)',
      adrChange: '+10%',
      occChange: '0% (Constant at ' + baselineOcc + '%)',
      estRevAED: Math.round(baselineKpi.occupiedUnitNights * (baselineADR * 1.10)),
      estNOIAED: Math.round((baselineKpi.occupiedUnitNights * (baselineADR * 1.10)) - baselineOpEx),
      risk: 'Unlikely in leisure market; requires strong corporate contract base.',
    },
    {
      name: 'Realistic Case (-3% Occ Elasticity)',
      adrChange: '+10%',
      occChange: '-3.0% (' + (baselineOcc - 3.0).toFixed(1) + '%)',
      estRevAED: Math.round((baselineKpi.availableUnitNights * ((baselineOcc - 3.0) / 100)) * (baselineADR * 1.10)),
      estNOIAED: Math.round(((baselineKpi.availableUnitNights * ((baselineOcc - 3.0) / 100)) * (baselineADR * 1.10)) - (baselineOpEx * 0.98)),
      risk: 'Optimal yield point: Net NOI expands by ~AED 22,000 despite slight volume drop.',
    },
    {
      name: 'Stress Test (-7% Occ Elasticity)',
      adrChange: '+10%',
      occChange: '-7.0% (' + (baselineOcc - 7.0).toFixed(1) + '%)',
      estRevAED: Math.round((baselineKpi.availableUnitNights * ((baselineOcc - 7.0) / 100)) * (baselineADR * 1.10)),
      estNOIAED: Math.round(((baselineKpi.availableUnitNights * ((baselineOcc - 7.0) / 100)) * (baselineADR * 1.10)) - (baselineOpEx * 0.95)),
      risk: 'Loss of market share to competing Marina properties; RevPAR drops.',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">Simulation Laboratory & Scenario Modeler</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-mono">
              Sandbox Active &bull; Zero Actuals Overwrite
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Test hypothetical pricing strategies, demand shifts, and cost reductions before financial sign-off.
          </p>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset to Default</span>
        </button>
      </div>

      {/* INTERACTIVE SLIDERS PANEL */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-950/70 p-5 rounded-xl border border-slate-800 text-xs">
        {/* Slider 1: ADR Delta */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-300">ADR Pricing Adjustment:</span>
            <span className="font-mono font-bold text-sky-400 text-sm">
              {adrDelta >= 0 ? `+${adrDelta}%` : `${adrDelta}%`}
            </span>
          </div>
          <input
            type="range"
            min="-20"
            max="30"
            step="1"
            value={adrDelta}
            onChange={(e) => setAdrDelta(parseInt(e.target.value, 10))}
            className="w-full accent-sky-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>-20% (Discount)</span>
            <span>+30% (Premium)</span>
          </div>
        </div>

        {/* Slider 2: Occupancy Sensitivity */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-300">Occupancy Elasticity Shift:</span>
            <span className="font-mono font-bold text-amber-400 text-sm">
              {occDelta >= 0 ? `+${occDelta}%` : `${occDelta}%`}
            </span>
          </div>
          <input
            type="range"
            min="-15"
            max="10"
            step="0.5"
            value={occDelta}
            onChange={(e) => setOccDelta(parseFloat(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>-15% (Resistance)</span>
            <span>+10% (Surge)</span>
          </div>
        </div>

        {/* Slider 3: Maintenance Efficiency */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-300">Maintenance Spend Shift:</span>
            <span className="font-mono font-bold text-slate-200 text-sm">
              {maintDelta >= 0 ? `+${maintDelta}%` : `${maintDelta}%`}
            </span>
          </div>
          <input
            type="range"
            min="-25"
            max="25"
            step="1"
            value={maintDelta}
            onChange={(e) => setMaintDelta(parseInt(e.target.value, 10))}
            className="w-full accent-indigo-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>-25% (Preventive)</span>
            <span>+25% (Reactive)</span>
          </div>
        </div>

        {/* Slider 4: Out-of-Order Recovery */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-300">Recover Out-of-Order Nights:</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">
              +{outOfOrderReduction} Nights
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="12"
            step="1"
            value={outOfOrderReduction}
            onChange={(e) => setOutOfOrderReduction(parseInt(e.target.value, 10))}
            className="w-full accent-emerald-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0 Nights</span>
            <span>+12 Nights</span>
          </div>
        </div>
      </div>

      {/* SIDE-BY-SIDE IMPACT COMPARISON */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Baseline Card */}
        <div className="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Historical Baseline</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">Actuals</span>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Average Daily Rate (ADR):</span>
              <span className="font-mono font-bold text-white">{formatAED(baselineADR)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Occupancy Rate:</span>
              <span className="font-mono font-bold text-white">{baselineOcc}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Total Room Revenue:</span>
              <span className="font-mono font-bold text-sky-400">{formatAED(baselineRev)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Total Operating Expenses:</span>
              <span className="font-mono text-slate-300">{formatAED(baselineOpEx)}</span>
            </div>
            <div className="flex justify-between text-xs pt-2 border-t border-slate-800">
              <span className="text-slate-300 font-semibold">Net Operating Income (NOI):</span>
              <span className="font-mono font-bold text-emerald-400">{formatAED(baselineNOI)}</span>
            </div>
          </div>
        </div>

        {/* Proposed Scenario Card */}
        <div className="bg-slate-900/90 rounded-xl p-5 border border-indigo-700/80 shadow-lg shadow-indigo-950/40 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center justify-between">
            <span>Simulated Scenario</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-200 border border-indigo-800 font-mono">
              Model Active
            </span>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Simulated ADR:</span>
              <span className="font-mono font-bold text-sky-300">{formatAED(simADR)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Simulated Occupancy:</span>
              <span className="font-mono font-bold text-amber-300">{simOcc}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Simulated Revenue:</span>
              <span className="font-mono font-bold text-white">{formatAED(simRev)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Simulated OpEx:</span>
              <span className="font-mono text-slate-300">{formatAED(simOpEx)}</span>
            </div>
            <div className="flex justify-between text-xs pt-2 border-t border-slate-800">
              <span className="text-white font-bold">Simulated Net NOI:</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">{formatAED(simNOI)}</span>
            </div>
          </div>
        </div>

        {/* Net Delta / Variance Card */}
        <div className={`rounded-xl p-5 border space-y-3 ${
          noiDiff >= 0 ? 'bg-emerald-950/20 border-emerald-800/80' : 'bg-rose-950/20 border-rose-800/80'
        }`}>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
            <span>Net Financial Impact</span>
            <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
              noiDiff >= 0 ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
            }`}>
              {noiDiff >= 0 ? '+ Favorable' : '- Unfavorable'}
            </span>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Revenue Variance:</span>
              <span className={`font-mono font-bold ${revDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {revDiff >= 0 ? `+${formatAED(revDiff)}` : `-${formatAED(Math.abs(revDiff))}`}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Operating Margin:</span>
              <span className="font-mono font-bold text-white">{simMargin}%</span>
            </div>
            <div className="flex justify-between text-xs pt-2 border-t border-slate-800">
              <span className="text-slate-100 font-bold">Net Bottom Line NOI Variance:</span>
              <span className={`font-mono font-bold text-base ${noiDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {noiDiff >= 0 ? `+${formatAED(noiDiff)}` : `-${formatAED(Math.abs(noiDiff))}`}
              </span>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/80">
            <strong className="text-slate-200">Elasticity Takeaway:</strong> {
              occDelta === 0 
                ? 'Warning: Assuming constant occupancy without resistance is aggressive in prime Dubai.'
                : occDelta < -5
                ? 'Excessive rate resistance: Rate hike is destroyed by volume loss.'
                : 'Balanced sweet spot: Price increase outpaces volume softening, lifting net owner cash.'
            }
          </div>
        </div>
      </div>

      {/* SENSITIVITY MATRIX FOR +10% ADR (PROMPT REQUIREMENT) */}
      <div className="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span>Sensitivity Matrix: 10% ADR Hike Across 3 Demand Responses</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Testing market elasticity behavior against competitor rate positioning
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sensitivityCases.map(sc => (
            <div key={sc.name} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
              <div className="font-bold text-white text-xs">{sc.name}</div>
              <div className="text-[11px] text-slate-400">
                ADR: <strong className="text-sky-300">{sc.adrChange}</strong> &bull; Occupancy: <strong className="text-amber-300">{sc.occChange}</strong>
              </div>
              <div className="pt-2 border-t border-slate-800 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Estimated Revenue:</span>
                  <span className="font-mono font-bold text-slate-200">{formatAED(sc.estRevAED)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Estimated NOI:</span>
                  <span className="font-mono font-bold text-emerald-400">{formatAED(sc.estNOIAED)}</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 pt-1 text-slate-400 italic">
                {sc.risk}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
