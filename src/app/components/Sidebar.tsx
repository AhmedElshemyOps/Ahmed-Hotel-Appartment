import React from 'react';
import {
  LayoutDashboard,
  Building,
  Activity,
  CalendarCheck2,
  Wrench,
  TrendingUp,
  DollarSign,
  Bot,
  FlaskConical,
  FileText,
  UploadCloud,
  Settings,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { UserRole } from '../../shared/types';

export type NavigationTab = 
  | 'management'
  | 'dashboard'
  | 'apartments'
  | 'intelligence'
  | 'accounting'
  | 'readiness'
  | 'market'
  | 'reservations'
  | 'operations'
  | 'revenue'
  | 'financial'
  | 'agents'
  | 'simulation'
  | 'reports'
  | 'import'
  | 'settings';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  currentRole: UserRole;
  pendingApprovalsCount: number;
  openCasesCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  currentRole,
  pendingApprovalsCount,
  openCasesCount,
}) => {
  const navItems: {
    id: NavigationTab;
    label: string;
    icon: React.ElementType;
    badge?: string | number;
    badgeColor?: string;
    category?: string;
  }[] = [
    { id: 'management', label: 'Management Centre', icon: ShieldAlert },
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
    { id: 'intelligence', label: 'Property Intelligence', icon: Activity },
    { id: 'apartments', label: 'Apartments (40 Units)', icon: Building, badge: '40' },
    { id: 'reservations', label: 'Reservations Ledger', icon: CalendarCheck2 },
    { id: 'operations', label: 'Operations & Facilities', icon: Wrench, badge: openCasesCount > 0 ? `${openCasesCount} Open` : undefined, badgeColor: 'bg-rose-950 text-rose-300 border-rose-800' },
    { id: 'accounting', label: 'Odoo Accounting & Financial Intelligence', icon: Building },
    { id: 'readiness', label: 'Compliance, Activation & OTA', icon: Building },
    { id: 'market', label: 'Geographic Market Intelligence', icon: TrendingUp },
    { id: 'revenue', label: 'Revenue Intelligence', icon: TrendingUp },
    { id: 'financial', label: 'Financial Intelligence', icon: DollarSign },
    { id: 'agents', label: 'AI Agent Center', icon: Bot, badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount} Req` : undefined, badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-800' },
    { id: 'simulation', label: 'Simulation Laboratory', icon: FlaskConical },
    { id: 'reports', label: 'Reports Center', icon: FileText },
    { id: 'import', label: 'Real Data Import', icon: UploadCloud },
    { id: 'settings', label: 'Settings & KPI Glossary', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#0a0e17] border-r border-slate-800 flex flex-col shrink-0 min-h-[calc(100vh-65px)]">
      {/* Navigation List */}
      <div className="p-3 space-y-1 flex-1">
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Management Console
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group cursor-pointer ${
                isActive
                  ? 'bg-slate-800/90 text-white border-l-3 border-sky-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-sky-400' : 'text-slate-500 group-hover:text-slate-300'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border font-mono shrink-0 ${
                    item.badgeColor || 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Role Notice & Security Card */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
        <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold mb-1">
            <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
            <span>Governance Enforced</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            AI recommendations require human approval before booking/rate/CAPEX execution.
          </p>
          <div className="mt-2 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
            <span>Role:</span>
            <span className="text-slate-200 font-medium truncate max-w-[120px]">{currentRole}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
