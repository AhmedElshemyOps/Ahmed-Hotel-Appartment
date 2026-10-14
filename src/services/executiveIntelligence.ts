/** Pure, deterministic executive intelligence for DEMO or verified data. */
export type Evidence = { sourceType: string; sourceId: string; note?: string };
export type ExecutiveMetric = { key: string; value: number | null; unit: string; evidence: Evidence[] };
export type ExecutiveFinding = { id: string; severity: 'info'|'warning'|'critical'; title: string; explanation: string; evidence: Evidence[]; limitations: string[]; proposedAction?: string };
export type HealthDimension = { key: string; score: number | null; weight: number; evidence: Evidence[] };
export type HealthResult = { score: number | null; completenessPercent: number; provisional: boolean; dimensions: HealthDimension[] };
export type ScenarioInput = { label: string; baselineRevenueAED: number; baselineExpenseAED: number; incrementalRevenueAED: number; oneTimeCostAED: number; incrementalExpenseAED: number };
export type ScenarioResult = { label: string; baselineProfitAED: number; projectedProfitAED: number; netBenefitAED: number; roiPercent: number | null; assumptions: string[] };
export type ActionStatus = 'proposed'|'pending_approval'|'approved'|'in_progress'|'completed'|'verified'|'rejected';
export type ManagementAction = { id: string; propertyId: string; title: string; ownerId: string | null; dueDate: string | null; status: ActionStatus; evidence: Evidence[]; createdAt: string; updatedAt: string };
export function calculateHealthScore(dimensions: HealthDimension[]): HealthResult {
  if (!dimensions.length || dimensions.some(d => !Number.isFinite(d.weight) || d.weight < 0) || Math.abs(dimensions.reduce((s,d)=>s+d.weight,0)-100)>0.0001) throw new Error('Health weights must total 100');
  for(const d of dimensions) if(d.score !== null && (!Number.isFinite(d.score)||d.score<0||d.score>100)) throw new Error('Health scores must be 0-100');
  const present = dimensions.filter(d=>d.score!==null);
  const coveredWeight=present.reduce((s,d)=>s+d.weight,0);
  const score=coveredWeight ? present.reduce((s,d)=>s+(d.score as number)*d.weight,0)/coveredWeight : null;
  return {score:score===null?null:Math.round(score*10)/10,completenessPercent:coveredWeight,provisional:coveredWeight<100,dimensions};
}
export function calculateScenario(input: ScenarioInput): ScenarioResult {
  const numbers=[input.baselineRevenueAED,input.baselineExpenseAED,input.incrementalRevenueAED,input.oneTimeCostAED,input.incrementalExpenseAED];
  if(numbers.some(n=>!Number.isFinite(n))||input.oneTimeCostAED<0) throw new Error('Invalid scenario amounts');
  const baselineProfitAED=input.baselineRevenueAED-input.baselineExpenseAED;
  const netBenefitAED=input.incrementalRevenueAED-input.incrementalExpenseAED-input.oneTimeCostAED;
  return {label:input.label,baselineProfitAED,projectedProfitAED:baselineProfitAED+netBenefitAED,netBenefitAED,roiPercent:input.oneTimeCostAED>0?Math.round((netBenefitAED/input.oneTimeCostAED)*1000)/10:null,assumptions:['Incremental amounts are user-supplied estimates, not forecasts','One-time cost is charged in full within the modeled period','Taxes, financing and time value of money are excluded']};
}
export function compareMetric(current:ExecutiveMetric,baseline:ExecutiveMetric):ExecutiveFinding {
  if(current.key!==baseline.key)throw new Error('Mismatched metrics');
  const missing=current.value===null||baseline.value===null;
  const change=missing?null:current.value!-baseline.value!;
  return {id:'variance-'+current.key,severity:missing?'warning':change!<0?'warning':'info',title:current.key+' variance',explanation:missing?'Insufficient verified data to calculate variance':('Change: '+change!.toFixed(2)+' '+current.unit+'. A change alone does not establish causation.'),evidence:[...current.evidence,...baseline.evidence],limitations:missing?['One or both comparison values are missing']:['Root cause is not established by numerical variance alone']};
}
export function buildDailyBriefing(date:string, metrics:ExecutiveMetric[], findings:ExecutiveFinding[]) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Expected ISO business date');
  return {date,generatedAt:new Date().toISOString(),metrics,findings,limitations:metrics.filter(m=>m.value===null).map(m=>m.key+' is unavailable'),requiresManagementReview:true};
}
export function transitionAction(action:ManagementAction,next:ActionStatus,actorId:string):{action:ManagementAction;audit:{actorId:string;from:ActionStatus;to:ActionStatus;timestamp:string}} {
  const allowed:Record<ActionStatus,ActionStatus[]>={proposed:['pending_approval','rejected'],pending_approval:['approved','rejected'],approved:['in_progress'],in_progress:['completed'],completed:['verified','in_progress'],verified:[],rejected:[]};
  if(!actorId.trim()||!allowed[action.status].includes(next))throw new Error('Invalid action transition');
  const timestamp=new Date().toISOString();
  return {action:{...action,status:next,updatedAt:timestamp},audit:{actorId,from:action.status,to:next,timestamp}};
}
