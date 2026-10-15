import type { SpecialistInsight } from './specialistAgents';
import React, { useState } from 'react';
import {
  Bot,
  Sparkles,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  Crown,
  TrendingUp,
  CalendarCheck,
  UserCheck,
  Wrench,
  DollarSign,
  Package,
  HeartHandshake,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  AgentRole,
  AgentRecommendation,
  AgentCoordinationCase,
  RecommendationApprovalStatus,
  UserRole,
} from '../../shared/types';
import { AGENT_ROSTER } from './agentEngine';
import { formatAED } from '../revenue/kpiEngine';

interface AgentCenterViewProps {
  specialistInsights?: SpecialistInsight[];
  recommendations: AgentRecommendation[];
  coordinationCases: AgentCoordinationCase[];
  onUpdateRecommendationStatus: (id: string, newStatus: RecommendationApprovalStatus) => void;
  currentRole: UserRole;
}

export const AgentCenterView: React.FC<AgentCenterViewProps> = ({
  recommendations,
  coordinationCases,
  onUpdateRecommendationStatus,
  currentRole,
  specialistInsights = [],
}) => {
  const [selectedAgentRole, setSelectedAgentRole] = useState<AgentRole | 'ALL'>('ALL');
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(coordinationCases[0]?.id || null);
  const [filterApprovalStatus, setFilterApprovalStatus] = useState<string>('ALL');

  // Filter recommendations
  const filteredRecs = recommendations.filter(r => {
    if (selectedAgentRole !== 'ALL' && r.agentRole !== selectedAgentRole) return false;
    if (filterApprovalStatus !== 'ALL' && r.approvalStatus !== filterApprovalStatus) return false;
    return true;
  });

  const agentKeys = Object.keys(AGENT_ROSTER) as AgentRole[];

  // Icon mapping helper
  const renderAgentIcon = (role: AgentRole) => {
    switch (role) {
      case 'General Manager Coordinator': return <Crown className="w-4 h-4 text-amber-400" />;
      case 'Revenue Management': return <TrendingUp className="w-4 h-4 text-sky-400" />;
      case 'Reservations': return <CalendarCheck className="w-4 h-4 text-emerald-400" />;
      case 'Front Office': return <UserCheck className="w-4 h-4 text-indigo-400" />;
      case 'Housekeeping': return <Sparkles className="w-4 h-4 text-pink-400" />;
      case 'Engineering and Maintenance': return <Wrench className="w-4 h-4 text-orange-400" />;
      case 'Finance and Cost Control': return <DollarSign className="w-4 h-4 text-emerald-400" />;
      case 'Procurement and Inventory': return <Package className="w-4 h-4 text-purple-400" />;
      case 'Guest Experience': return <HeartHandshake className="w-4 h-4 text-rose-400" />;
      case 'Quality and Risk': return <ShieldAlert className="w-4 h-4 text-red-400" />;
      case 'Owner Reporting': return <FileText className="w-4 h-4 text-cyan-400" />;
    }
  };

  const getStatusBadge = (status: RecommendationApprovalStatus) => {
    switch (status) {
      case 'Pending':
        return 'bg-amber-950/80 text-amber-300 border-amber-800';
      case 'Under Review':
        return 'bg-indigo-950/80 text-indigo-300 border-indigo-800';
      case 'Approved':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
      case 'Rejected':
        return 'bg-rose-950/80 text-rose-300 border-rose-800';
      case 'In Progress':
        return 'bg-sky-950/80 text-sky-300 border-sky-800';
      case 'Verified Closed':
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">11-Agent Coordinated Intelligence Center</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
              Role Roster & Governance Active
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Specialized domain agents analyze, explain, and recommend with evidence citations. Authorized hotel leaders approve actions.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/80 border border-indigo-800 text-indigo-300 font-medium">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Human Approval Required for Execution</span>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-sky-900 bg-slate-900/70 p-4 space-y-3">
        <h3 className="text-sm font-bold text-white">Eight Specialist Agents — Evidence-Based Findings</h3>
        <p className="text-xs text-slate-400">Advisory only. Figures derive from the selected application dataset; findings are not audited or automatically executed.</p>
        {specialistInsights.length === 0 ? <p className="text-xs text-slate-400">No findings for the selected records.</p> : specialistInsights.map(item => (
          <article key={item.id} className="rounded-lg border border-slate-700 bg-slate-950/50 p-3 space-y-1">
            <div className="flex items-center justify-between gap-2"><strong className="text-sm text-white">{item.title}</strong><span className="text-[10px] text-sky-300">{item.agent} · {item.priority}</span></div>
            <p className="text-xs text-slate-300">{item.explanation}</p>
            <p className="text-xs text-amber-300">Proposed (approval required): {item.proposedAction}</p>
            <p className="text-[11px] text-slate-400">Evidence: {item.evidence.length ? item.evidence.slice(0,8).map(e=>e.kind+':'+e.id).join(', ') : 'No linked source records'}{item.evidence.length>8?' + more':''}</p>
            {item.limitations.map((lim,i)=><p key={i} className="text-[11px] text-slate-500">Limitation: {lim}</p>)}
          </article>
        ))}
      </section>
      {/* 11 AGENT SELECTOR ROSTER CAROUSEL/GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
        <button
          onClick={() => setSelectedAgentRole('ALL')}
          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            selectedAgentRole === 'ALL'
              ? 'bg-slate-800 border-sky-500 shadow-md'
              : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-bold text-white">All 11 Agents</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {recommendations.length} Recommendations
          </div>
        </button>

        {agentKeys.map(role => {
          const profile = AGENT_ROSTER[role];
          const recCount = recommendations.filter(r => r.agentRole === role).length;
          const isSelected = selectedAgentRole === role;

          return (
            <button
              key={role}
              onClick={() => setSelectedAgentRole(role)}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-800 border-sky-500 shadow-md ring-1 ring-sky-500'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                {renderAgentIcon(role)}
                <span className="text-xs font-bold text-slate-100 truncate">{profile.shortTitle}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                <span className="truncate max-w-[80px]">{profile.department}</span>
                {recCount > 0 && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 font-mono">
                    {recCount}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* CROSS-DEPARTMENT CASE COORDINATION (e.g. Unit 205 Chronic HVAC Failure) */}
      <div className="bg-slate-900/80 rounded-xl p-5 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Cross-Department Coordination Cases ({coordinationCases.length})</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Multi-Agent Case System</span>
        </div>

        <div className="space-y-3">
          {coordinationCases.map(c => {
            const isExpanded = expandedCaseId === c.id;

            return (
              <div key={c.id} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-3">
                <div 
                  onClick={() => setExpandedCaseId(isExpanded ? null : c.id)}
                  className="flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800">
                      {c.caseNumber}
                    </span>
                    <span className="font-bold text-white text-sm">{c.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                      Risk: {formatAED(c.totalFinancialRiskAED)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      Status: {c.status}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="pt-3 border-t border-slate-800/80 space-y-3 text-slate-300 leading-relaxed text-xs">
                    <div>
                      <strong className="text-slate-200">Triggering Event:</strong> {c.triggerEvent}
                    </div>

                    <div>
                      <strong className="text-slate-200">Multi-Agent Narrative & Analysis:</strong>
                      <p className="mt-1 text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800 leading-relaxed">
                        {c.narrative}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span>Coordinating Agents:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {c.involvedAgents.map(ag => (
                          <span key={ag} className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-medium">
                            {ag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* RECOMMENDATIONS QUEUE & HUMAN APPROVAL WORKFLOW */}
      <div className="bg-slate-900/80 rounded-xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-sky-400" />
              <span>Agent Recommendations & Human Approval Queue</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Review evidence citations, financial implications, and authorize management execution.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Status Filter:</span>
            <select
              aria-label="Filter Approval Status"
              value={filterApprovalStatus}
              onChange={(e) => setFilterApprovalStatus(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Under Review">Under Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="In Progress">In Progress</option>
              <option value="Verified Closed">Verified Closed</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-slate-800">
          {filteredRecs.map(rec => (
            <div key={rec.id} className="p-5 space-y-3.5 hover:bg-slate-850/40 transition-colors">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sky-400 font-semibold text-xs">{rec.id}</span>
                  <span className="text-slate-500">&bull;</span>
                  <span className="font-bold text-white text-xs flex items-center gap-1.5">
                    {renderAgentIcon(rec.agentRole)}
                    {rec.agentRole}
                  </span>
                  {rec.unitId && (
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">
                      Unit {rec.unitId.replace('APT-', '')}
                    </span>
                  )}
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono border font-medium ${
                    rec.priority === 'Critical' ? 'bg-rose-950 text-rose-300 border-rose-800' :
                    rec.priority === 'High' ? 'bg-amber-950 text-amber-300 border-amber-800' :
                    'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {rec.priority} Priority
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded border font-semibold ${getStatusBadge(rec.approvalStatus)}`}>
                    {rec.approvalStatus}
                  </span>
                </div>
              </div>

              {/* Problem Description & Analysis */}
              <div className="space-y-1.5 text-xs">
                <div className="font-semibold text-slate-200">{rec.problemDescription}</div>
                <div className="text-slate-300 leading-relaxed text-[11px] bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                  <strong className="text-slate-400 block mb-1">Supporting Evidence & Root Cause:</strong>
                  {rec.supportingEvidence}
                  <div className="mt-2 text-slate-300">
                    <strong className="text-slate-400">Analysis:</strong> {rec.analysis}
                  </div>
                </div>
              </div>

              {/* Action & Financial Impact */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Recommended Action:</span>
                  <div className="text-slate-200 mt-0.5 font-medium">{rec.recommendedAction}</div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Financial Exposure / ROI:</span>
                  <div className="text-amber-300 mt-0.5 font-mono font-bold text-sm">
                    {formatAED(rec.financialImplicationAED)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{rec.assumptions}</div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Accountability & Follow-up:</span>
                  <div className="text-slate-200 mt-0.5">Resp: <strong>{rec.responsibleManager}</strong></div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Target SLA: {rec.followUpDate}</div>
                </div>
              </div>

              {/* Human Approval Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-slate-400 text-[11px]">
                  Requires authorization by <strong className="text-slate-200">{rec.responsibleManager}</strong> or Property Owner.
                </span>

                <div className="flex items-center gap-2">
                  {rec.approvalStatus !== 'Approved' && rec.approvalStatus !== 'Verified Closed' && (
                    <button
                      onClick={() => onUpdateRecommendationStatus(rec.id, 'Approved')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all cursor-pointer"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Approve Recommendation</span>
                    </button>
                  )}

                  {rec.approvalStatus !== 'Rejected' && rec.approvalStatus !== 'Verified Closed' && (
                    <button
                      onClick={() => onUpdateRecommendationStatus(rec.id, 'Rejected')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 font-semibold transition-all cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  )}

                  {rec.approvalStatus === 'Approved' && (
                    <button
                      onClick={() => onUpdateRecommendationStatus(rec.id, 'Verified Closed')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold transition-all cursor-pointer"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Mark Verified Closed</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
