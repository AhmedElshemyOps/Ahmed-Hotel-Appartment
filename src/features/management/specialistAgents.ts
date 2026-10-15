import type { Apartment, Reservation, MaintenanceWorkOrder, HousekeepingTask, GuestComplaint, FinancialTransaction } from '../../shared/types';

/** All recommendations are advisory. No agent performs operational mutations. */
export type SpecialistRole = 'revenue'|'frontOffice'|'housekeeping'|'maintenance'|'guestExperience'|'finance'|'ownerReporting'|'coordination';
export type AgentEvidence = { kind: string; id: string };
export type SpecialistInsight = { id: string; agent: SpecialistRole; priority: 'P1'|'P2'; title: string; explanation: string; evidence: AgentEvidence[]; proposedAction: string; requiresApproval: true; limitations: string[] };
export type SpecialistInput = { businessDate: string; periodStart: string; periodEnd: string; apartments: Apartment[]; reservations: Reservation[]; maintenance: MaintenanceWorkOrder[]; housekeeping: HousekeepingTask[]; complaints: GuestComplaint[]; transactions: FinancialTransaction[] };
const insight=(agent:SpecialistRole,id:string,title:string,explanation:string,evidence:AgentEvidence[],proposedAction:string,limitations:string[]=[],priority:'P1'|'P2'='P1'):SpecialistInsight=>({id,agent,priority,title,explanation,evidence,proposedAction,limitations,requiresApproval:true});
const validDate=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d));
export function analyzeSpecialists(input:SpecialistInput):SpecialistInsight[] {
  if(![input.businessDate,input.periodStart,input.periodEnd].every(validDate)||input.periodStart>input.periodEnd) throw new Error('Invalid reporting dates');
  const out:SpecialistInsight[]=[];
  const active=input.reservations.filter(r=>r.status!=='Canceled');
  const arrivals=active.filter(r=>r.checkInDate===input.businessDate);
  const departures=active.filter(r=>r.checkOutDate===input.businessDate);
  const occupied=active.filter(r=>r.checkInDate<=input.businessDate&&r.checkOutDate>input.businessDate);
  const units=new Map(input.apartments.map(a=>[a.id,a]));
  const arrivalUnits=new Set(arrivals.map(r=>r.unitId));
  const ready=new Set(input.housekeeping.filter(h=>h.scheduledDate===input.businessDate&&h.status==='Inspected').map(h=>h.unitId));
  const notReady=arrivals.filter(r=>!ready.has(r.unitId));
  if(notReady.length)out.push(insight('frontOffice','arrival-readiness','Arrival readiness requires verification',notReady.length+' arriving reservations have no inspected housekeeping task recorded for this date.',notReady.map(r=>({kind:'reservation',id:r.id})),'Confirm room readiness with front office and housekeeping before assigning arrival rooms.',['A missing inspection task does not prove a room is dirty.'],'P2'));
  if(arrivals.length||departures.length)out.push(insight('frontOffice','movement-summary','Daily arrival/departure coordination',arrivals.length+' arrivals and '+departures.length+' departures scheduled.',[...arrivals,...departures].map(r=>({kind:'reservation',id:r.id})),'Review arrival and departure coverage; early/late check-in events require a separate timestamp feed.',[],'P2'));
  const cleaning=input.housekeeping.filter(h=>h.scheduledDate===input.businessDate&&h.status!=='Clean'&&h.status!=='Inspected');
  const urgent=cleaning.filter(h=>arrivalUnits.has(h.unitId));
  if(urgent.length)out.push(insight('housekeeping','priority-turnover','Arrival-linked cleaning priority',urgent.length+' open housekeeping tasks correspond to scheduled arrivals.',urgent.map(h=>({kind:'housekeeping',id:h.id})),'Prioritize and inspect these rooms before check-in; confirm staff capacity.',['Staff rosters and exact arrival times are not available.']));
  const work=input.maintenance.filter(m=>m.reportedDate<=input.periodEnd&&(m.resolvedDate??input.periodEnd)>=input.periodStart);
  const byUnit=new Map<string,MaintenanceWorkOrder[]>();for(const m of work)byUnit.set(m.unitId,[...(byUnit.get(m.unitId)||[]),m]);
  for(const [unitId,orders] of byUnit){if(orders.length<2&&!orders.some(m=>m.isRecurring))continue;const known=orders.filter(m=>Number.isFinite(m.costAED)&&m.costAED>=0);out.push(insight('maintenance','recurring-'+unitId,'Recurring maintenance: '+(units.get(unitId)?.unitNumber??unitId),orders.length+' work orders; recorded nonnegative costs AED '+known.reduce((s,m)=>s+m.costAED,0).toFixed(2)+'.',orders.map(m=>({kind:'maintenance',id:m.id})),'Review repeat failures and preventive inspection history before authorizing repair or replacement.',known.length!==orders.length?['Some work-order costs are missing or invalid.']:[]));}
  const openComplaints=input.complaints.filter(c=>c.reportedAt.slice(0,10)<=input.periodEnd&&c.status!=='Resolved');
  if(openComplaints.length)out.push(insight('guestExperience','open-complaints','Guest complaints awaiting resolution',openComplaints.length+' complaints are not marked resolved.',openComplaints.map(c=>({kind:'complaint',id:c.id})),'Assign service recovery owners and verify resolution with guests.',['Guest satisfaction cannot be inferred without guest feedback.']));
  const period=input.transactions.filter(t=>t.date>=input.periodStart&&t.date<=input.periodEnd);
  const actual=period.filter(t=>!t.isBudget),budget=period.filter(t=>t.isBudget);
  const expense=actual.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amountAED,0);
  const budgetExpense=budget.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amountAED,0);
  if(budget.some(t=>t.type==='expense'))out.push(insight('finance','expense-variance','Expense versus recorded budget','Actual expenses AED '+expense.toFixed(2)+'; budget entries AED '+budgetExpense.toFixed(2)+'; difference AED '+(expense-budgetExpense).toFixed(2)+'.',period.filter(t=>t.type==='expense').map(t=>({kind:'transaction',id:t.id})),'Investigate category-level variances and confirm that budget and actual periods are comparable.',['This is a transaction comparison, not a ledger reconciliation.']));
  else out.push(insight('finance','budget-missing','Expense budget unavailable','No expense budget transactions were provided for this period.',actual.filter(t=>t.type==='expense').map(t=>({kind:'transaction',id:t.id})),'Import approved period budget before calculating budget variance.'));
  const roomBookings=active.filter(r=>r.checkInDate<=input.periodEnd&&r.checkOutDate>input.periodStart);
  const channel=new Map<string,{gross:number;commission:number;ids:string[]}>();for(const r of roomBookings){const x=channel.get(r.channel)||{gross:0,commission:0,ids:[]};x.gross+=r.totalRoomRevenueAED;x.commission+=r.totalRoomRevenueAED*r.commissionRatePercent/100;x.ids.push(r.id);channel.set(r.channel,x);}
  if(channel.size)out.push(insight('revenue','channel-cost','Booking-channel commission review',[...channel].map(([name,v])=>name+': estimated commission AED '+v.commission.toFixed(2)).join('; ')+'.',[...roomBookings].map(r=>({kind:'reservation',id:r.id})),'Compare net channel contribution and validate rate opportunities before adjusting prices.',['Booking totals may cover nights outside the selected period.','No demand forecast or competitor-rate feed is connected.']));
  const revenue=actual.filter(t=>t.type==='revenue').reduce((s,t)=>s+t.amountAED,0);
  out.push(insight('ownerReporting','period-brief','Owner reporting snapshot','Recorded transaction revenue AED '+revenue.toFixed(2)+'; expenses AED '+expense.toFixed(2)+'; net difference AED '+(revenue-expense).toFixed(2)+'.',actual.map(t=>({kind:'transaction',id:t.id})),'Review transaction completeness and approve a weekly or monthly owner briefing.',['This is not audited NOI; accruals, taxes, and allocations may be missing.']));
  const affected=new Map<string,Set<SpecialistRole>>();for(const item of out){for(const ev of item.evidence){if(!['maintenance','complaint','housekeeping'].includes(ev.kind))continue;const record=ev.kind==='maintenance'?input.maintenance.find(x=>x.id===ev.id):ev.kind==='complaint'?input.complaints.find(x=>x.id===ev.id):input.housekeeping.find(x=>x.id===ev.id);if(record){const roles=affected.get(record.unitId)||new Set<SpecialistRole>();roles.add(item.agent);affected.set(record.unitId,roles);}}}
  for(const [unitId,roles] of affected)if(roles.size>1)out.push(insight('coordination','coord-'+unitId,'Cross-department review: '+(units.get(unitId)?.unitNumber??unitId),[...roles].join(', ')+' have findings linked to this apartment.',out.filter(x=>x.agent!=='coordination'&&x.evidence.some(e=>{const record=e.kind==='maintenance'?input.maintenance.find(r=>r.id===e.id):e.kind==='complaint'?input.complaints.find(r=>r.id===e.id):e.kind==='housekeeping'?input.housekeeping.find(r=>r.id===e.id):undefined;return record?.unitId===unitId})).flatMap(x=>x.evidence),'Assign a joint case owner and seek approval before executing departmental changes.',[],'P2'));
  return out;
}
