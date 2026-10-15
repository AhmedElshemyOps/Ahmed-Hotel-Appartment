import React from 'react';
import {
  Building2,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Globe,
  Coins,
  Clock,
  User,
  ChevronDown,
  Database,
  RefreshCw,
  MessageSquare,
  Radio,
  Activity,
} from 'lucide-react';
import { UserRole, DataOperatingMode } from '../../shared/types';

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  dataMode: DataOperatingMode;
  onDataModeChange: (mode: DataOperatingMode) => void;
  onOpenAiChat: () => void;
  onResetDemoData: () => void;
  isLiveMode: boolean;
  onToggleLiveMode: () => void;
  countdownSeconds: number;
  lastRefreshedAt: Date;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  dataMode,
  onDataModeChange,
  onOpenAiChat,
  onResetDemoData,
  isLiveMode,
  onToggleLiveMode,
  countdownSeconds,
  lastRefreshedAt,
}) => {
  const roles: UserRole[] = [
    'Platform Administrator',
    'Property Owner',
    'General Manager',
    'Finance Manager',
    'Revenue Manager',
    'Operations Manager',
    'Department Manager',
    'Read-Only Viewer',
  ];

  return (
    <header className="sticky top-0 z-30 bg-[#0f172a] border-b border-slate-800 text-slate-100 shadow-md">
      {/* Top Operating Mode Banner */}
      <div className={`px-4 py-1.5 text-xs font-semibold flex flex-wrap items-center justify-between gap-2 transition-colors ${
        dataMode === 'SIMULATION' 
          ? 'bg-amber-950/80 border-b border-amber-800/60 text-amber-300'
          : 'bg-emerald-950/80 border-b border-emerald-800/60 text-emerald-300'
      }`}>
        <div className="flex items-center gap-2">
          {dataMode === 'SIMULATION' ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>DEMO DATA — NOT ACTUAL PROPERTY PERFORMANCE (40 Serviced Apartments Synthetic Model)</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>LIVE REAL PROPERTY DATA MODE — ISOLATED TENANT #AHQ-8820 (Real Uploads Only)</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Live Mode Toggle Pill in Banner */}
          {dataMode === 'SIMULATION' && (
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleLiveMode}
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer border ${
                  isLiveMode
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm ring-1 ring-emerald-500/50'
                    : 'bg-slate-900/90 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
                title={isLiveMode ? "Disable 60s synthetic data auto-refresh" : "Enable 60s synthetic data auto-refresh"}
              >
                <span className={`w-2 h-2 rounded-full ${
                  isLiveMode ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`} />
                <span>Demo refresh: {isLiveMode ? 'ACTIVE' : 'OFF'}</span>
                {isLiveMode && (
                  <span className="font-mono text-[10px] bg-emerald-900/90 px-1.5 py-0.2 rounded text-emerald-200 border border-emerald-700 ml-0.5">
                    {countdownSeconds}s
                  </span>
                )}
              </button>

              <button
                onClick={onResetDemoData}
                title="Regenerate Seeded Simulation Dataset"
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-amber-900/60 hover:bg-amber-800 text-amber-200 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Re-seed 12M</span>
              </button>
            </div>
          )}

          <div className="flex items-center bg-black/40 rounded p-0.5 border border-slate-700/60 text-[11px]">
            <button
              onClick={() => onDataModeChange('SIMULATION')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                dataMode === 'SIMULATION'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Demo Simulation
            </button>
            <button
              onClick={() => onDataModeChange('REAL_PROPERTY')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                dataMode === 'REAL_PROPERTY'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Real Property Data
            </button>
          </div>
        </div>
      </div>

      {/* Main Executive Header */}
      <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Property Identity */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 via-sky-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-950/50">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-bold text-sky-400">Ahmed Quality Ops</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">v3.2 PRO</span>
              </div>
              <h1 className="text-base font-bold text-white tracking-tight">Hospitality AI Command Center</h1>
            </div>
          </div>

          <div className="hidden lg:block h-8 w-px bg-slate-800 mx-1" />

          {/* Active Property */}
          <div className="hidden lg:flex flex-col">
            <span className="text-[11px] text-slate-400">Active Property:</span>
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              {dataMode === 'SIMULATION' ? 'Ahmed Quality Ops — Demo Serviced Apartments' : 'Grand Marina Executive Residences'}
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </span>
          </div>
        </div>

        {/* Global Controls: Live Mode Toggle, Currency, Role Switcher, Ask AI */}
        <div className="flex items-center gap-3">
          {/* Prominent Live Mode Toggle Switch in Header Bar */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded-lg border border-slate-800">
            <div className="flex flex-col text-left">
              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                <Activity className="w-3 h-3 text-emerald-400" />
                Demo refresh (60s)
              </span>
              <span className="text-[10px] font-mono text-slate-300">
                {isLiveMode ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    Tick in {countdownSeconds}s
                  </span>
                ) : (
                  <span className="text-slate-400">Paused</span>
                )}
              </span>
            </div>

            {/* iOS/Tailwind style toggle switch */}
            <button
              type="button"
              role="switch"
              aria-checked={isLiveMode}
              onClick={onToggleLiveMode}
              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out focus:outline-none ${
                isLiveMode ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                  isLiveMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Metadata pill */}
          <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-slate-900 rounded-lg border border-slate-800 text-xs text-slate-300">
            <span className="flex items-center gap-1 text-slate-400">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>AED</span>
            </span>
            <span className="w-px h-3.5 bg-slate-700" />
            <span className="flex items-center gap-1 text-slate-400">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>Asia/Dubai (GST)</span>
            </span>
            <span className="w-px h-3.5 bg-slate-700" />
            <span className="flex items-center gap-1 text-slate-400">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>EN</span>
            </span>
          </div>

          {/* User Role Switcher */}
          <div className="relative flex items-center bg-slate-900 rounded-lg border border-slate-800 px-3 py-1.5 text-xs">
            <User className="w-3.5 h-3.5 text-indigo-400 mr-2 shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-[9px] text-slate-400 uppercase font-medium">Logged Role:</span>
              <select
                aria-label="User Role"
                value={currentRole}
                onChange={(e) => onRoleChange(e.target.value as UserRole)}
                className="bg-transparent text-slate-100 font-semibold focus:outline-none cursor-pointer pr-4 text-xs"
              >
                {roles.map(r => (
                  <option key={r} value={r} className="bg-slate-900 text-slate-100">{r}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Ask AI Hotel Manager Button */}
          <button
            onClick={onOpenAiChat}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white text-xs font-semibold shadow-md shadow-indigo-900/30 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Ask AI Hotel Manager</span>
          </button>
        </div>
      </div>
    </header>
  );
};
