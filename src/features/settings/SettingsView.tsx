import React, { useState } from 'react';
import {
  Settings,
  Building,
  Coins,
  Clock,
  ShieldCheck,
  Lock,
  UserCheck,
  CheckCircle2,
  BookOpen,
  Activity,
  Sparkles,
} from 'lucide-react';
import { KPI_GLOSSARY } from '../revenue/kpiEngine';
import { UserRole } from '../../shared/types';

interface SettingsViewProps {
  currentRole: UserRole;
  onRoleChange: (r: UserRole) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ currentRole, onRoleChange }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'glossary' | 'rbac' | 'security'>('glossary');

  const rbacMatrix: { role: UserRole; access: string; permissions: string[] }[] = [
    {
      role: 'Platform Administrator',
      access: 'Full Root Access',
      permissions: ['Manage multi-property tenants', 'System configuration', 'User credential provisioning', 'Audit logs', 'CAPEX approval overrides'],
    },
    {
      role: 'Property Owner',
      access: 'Executive Asset & Investor Oversight',
      permissions: ['Monthly owner reports', 'Full P&L and NOI review', 'Approve major CAPEX (>AED 5,000)', 'Simulation modeling', 'Asset valuations'],
    },
    {
      role: 'General Manager',
      access: 'Property-Wide Operational Leadership',
      permissions: ['Consolidated executive dashboard', 'Cross-agent case approvals', 'Departmental oversight', 'Weekly reports', 'Daily briefings'],
    },
    {
      role: 'Finance Manager',
      access: 'Financial & Accounting Control',
      permissions: ['USALI statement audit', 'Budget variance forensics', 'Expense verification', 'P&L reconciliations', 'Cash flow review'],
    },
    {
      role: 'Revenue Manager',
      access: 'Commercial Strategy & Yield',
      permissions: ['ADR / RevPAR pace', 'Channel distribution mix', 'Pricing elasticity', 'Rate fence recommendations', 'Restrictions modeling'],
    },
    {
      role: 'Operations Manager',
      access: 'Facilities & Service Delivery',
      permissions: ['Maintenance work orders', 'Housekeeping turnaround board', 'Guest complaint resolution', 'Quality & SOP compliance'],
    },
    {
      role: 'Department Manager',
      access: 'Departmental Execution',
      permissions: ['Department-specific work queues', 'Task assignments', 'Supply replenishment requests', 'Turnaround logging'],
    },
    {
      role: 'Read-Only Viewer',
      access: 'Auditor & Observer View',
      permissions: ['View executive reports', 'View published dashboards', 'Export permitted tables', 'Zero mutation permissions'],
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">System Settings & Governance Standards</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              Enterprise Configuration
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Property metadata, audited KPI mathematical formulas, and role-based permissions matrix.
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('glossary')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === 'glossary' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            KPI Glossary
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === 'profile' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Property Setup
          </button>
          <button
            onClick={() => setActiveTab('rbac')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === 'rbac' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            User Roles (RBAC)
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === 'security' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Security & AI
          </button>
        </div>
      </div>

      {/* TAB 1: KPI GLOSSARY */}
      {activeTab === 'glossary' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-sky-400" />
              <span>Approved KPI Definitions, Mathematical Formulas & Benchmarks</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Every dashboard, financial statement, and AI agent uses these identical mathematical definitions to guarantee reconciliation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(KPI_GLOSSARY).map(([key, item]) => (
              <div key={key} className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{item.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-sky-300 font-mono">
                    USALI Standard
                  </span>
                </div>

                <div className="p-2 rounded bg-slate-950 font-mono text-[11px] text-emerald-300 border border-slate-800">
                  {item.formula}
                </div>

                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {item.description}
                </p>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Dubai Industry Benchmark:</span>
                  <strong className="text-amber-300">{item.benchmark}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: PROPERTY PROFILE */}
      {activeTab === 'profile' && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4 max-w-2xl text-xs">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Building className="w-4 h-4 text-sky-400" />
              <span>Demonstration Property Profile</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-slate-400 text-[11px] font-semibold block mb-1">Property Name:</label>
                <input
                  type="text"
                  readOnly
                  value="Ahmed Quality Ops — Demo Serviced Apartments"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-medium focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-[11px] font-semibold block mb-1">Total Unit Inventory:</label>
                  <input
                    type="text"
                    readOnly
                    value="40 Serviced Apartments"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-[11px] font-semibold block mb-1">Operating Currency:</label>
                  <input
                    type="text"
                    readOnly
                    value="AED (United Arab Emirates Dirham)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-[11px] font-semibold block mb-1">Operating Timezone:</label>
                  <input
                    type="text"
                    readOnly
                    value="Asia/Dubai (GST UTC+04:00)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-[11px] font-semibold block mb-1">Regulatory Licensing:</label>
                  <input
                    type="text"
                    readOnly
                    value="Dubai DTCM Deluxe Hotel Apartment"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ROLE-BASED ACCESS CONTROL */}
      {activeTab === 'rbac' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-indigo-400" />
              <span>Role-Based Access Control (RBAC) Matrix</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Test roles using the role switcher in the header to observe customized views and permission boundaries.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 text-[11px]">
                <tr>
                  <th className="py-3 px-4">Role Title</th>
                  <th className="py-3 px-3">Primary Authority</th>
                  <th className="py-3 px-4">Granted Permissions</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {rbacMatrix.map(item => (
                  <tr key={item.role} className={`text-slate-300 hover:bg-slate-850/50 ${
                    currentRole === item.role ? 'bg-sky-950/30' : ''
                  }`}>
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        currentRole === item.role ? 'bg-sky-400' : 'bg-slate-600'
                      }`} />
                      {item.role}
                    </td>
                    <td className="py-3 px-3 text-sky-300 font-medium">{item.access}</td>
                    <td className="py-3 px-4 text-slate-400">
                      <div className="flex flex-wrap gap-1">
                        {item.permissions.map((p, idx) => (
                          <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => onRoleChange(item.role)}
                        className={`text-[10px] px-2.5 py-1 rounded font-semibold cursor-pointer transition-colors ${
                          currentRole === item.role
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {currentRole === item.role ? 'Active Role' : 'Switch'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SECURITY & AI ARCHITECTURE */}
      {activeTab === 'security' && (
        <div className="space-y-4 max-w-2xl">
          <div className="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Cybersecurity & Server-Side AI Safeguards</span>
            </h3>

            <div className="space-y-2 text-slate-300 leading-relaxed text-[11px]">
              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Server-Side Proxy Architecture:</strong>
                  The Gemini API key is strictly maintained on the server-side proxy (`/api/ai/chat`) and never sent to the browser bundle.
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Strict Tenant & Mode Isolation:</strong>
                  Mode A (40-Apartment Simulation) and Mode B (Real Property Data) operate with independent storage keys to prevent accidental data mixing.
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Human-in-the-Loop Governance:</strong>
                  AI agents generate evidence-backed recommendations and financial exposure calculations, but never execute rate changes or purchase orders automatically.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
