/** Strictly pure calculations: synthetic or validated source records only. */
export type SourceRef={kind:string;id:string};
export type Unit={id:string;unitNumber:string;type:string};
export type Stay={id:string;unitId:string;checkIn:string;checkOut:string;status:string;dailyRateAED:number;channel:string;commissionRatePercent?:number;actualCommissionAED?:number};
export type Expense={id:string;unitId?:string;date:string;amountAED:number;category:string;isBudget?:boolean;type:'revenue'|'expense'};
export type Incident={id:string;unitId:string;date:string;kind:'maintenance'|'complaint';costAED?:number;isRecurring?:boolean;resolved?:boolean};
export type UnitIntelligence={unitId:string;unitNumber:string;occupiedNights:number;roomRevenueAED:number;directExpenseAED:number;estimatedCommissionAED:number;contributionAED:number;riskPoints:number;evidence:SourceRef[];limitations:string[]};
const utc=(s:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('Expected ISO date');const d=new Date(s+'T00:00:00Z');if(Number.isNaN(d.valueOf())||d.toISOString().slice(0,10)!==s)throw Error('Invalid date');return d.valueOf()};
const DAY=86400000;
export function overlapNights(start:string,end:string,periodStart:string,periodEndInclusive:string){const a=utc(start),b=utc(end),p=utc(periodStart),q=utc(periodEndInclusive)+DAY;if(b<a||q<=p)throw Error('Invalid date range');return Math.max(0,Math.round((Math.min(b,q)-Math.max(a,p))/DAY))}
export function buildUnitIntelligence(units:Unit[],stays:Stay[],expenses:Expense[],incidents:Incident[],start:string,end:string):UnitIntelligence[]{
  utc(start);utc(end);if(start>end)throw Error('Invalid period');
  return units.map(unit=>{
    const reservations=stays.filter(r=>r.unitId===unit.id&&r.status!=='Canceled');
    const nights=reservations.map(r=>({r,n:overlapNights(r.checkIn,r.checkOut,start,end)})).filter(x=>x.n>0);
    const roomRevenueAED=nights.reduce((sum,x)=>sum+x.n*x.r.dailyRateAED,0);
    const estimatedCommissionAED=nights.reduce((sum,x)=>sum+x.n*x.r.dailyRateAED*(x.r.commissionRatePercent??0)/100,0);
    const direct=expenses.filter(x=>x.unitId===unit.id&&!x.isBudget&&x.type==='expense'&&x.date>=start&&x.date<=end);
    const issues=incidents.filter(x=>x.unitId===unit.id&&x.date>=start&&x.date<=end);
    const directExpenseAED=direct.reduce((sum,x)=>sum+x.amountAED,0);
    const riskPoints=issues.reduce((sum,x)=>sum+(x.kind==='complaint'?3:2)+(x.isRecurring?3:0)+(x.resolved===false?2:0),0);
    return {unitId:unit.id,unitNumber:unit.unitNumber,occupiedNights:nights.reduce((sum,x)=>sum+x.n,0),roomRevenueAED,directExpenseAED,estimatedCommissionAED,contributionAED:roomRevenueAED-directExpenseAED-estimatedCommissionAED,riskPoints,evidence:[...nights.map(x=>({kind:'reservation',id:x.r.id})),...direct.map(x=>({kind:'transaction',id:x.id})),...issues.map(x=>({kind:x.kind,id:x.id}))],limitations:['Commission calculated from reservation rates; actual invoiced commission may differ.','Contribution excludes shared overhead, taxes and non-attributed expenses.']};
  });
}
export function summarizeChannels(stays:Stay[],start:string,end:string){
  const groups=new Map<string,{grossAED:number;estimatedCommissionAED:number;actualCommissionAED:number;actualCommissionCount:number;reservations:string[]}>();
  for(const r of stays){if(r.status==='Canceled')continue;const n=overlapNights(r.checkIn,r.checkOut,start,end);if(!n)continue;const x=groups.get(r.channel)||{grossAED:0,estimatedCommissionAED:0,actualCommissionAED:0,actualCommissionCount:0,reservations:[]};x.grossAED+=n*r.dailyRateAED;x.estimatedCommissionAED+=n*r.dailyRateAED*(r.commissionRatePercent??0)/100;if(r.actualCommissionAED!==undefined){x.actualCommissionAED+=r.actualCommissionAED;x.actualCommissionCount++}x.reservations.push(r.id);groups.set(r.channel,x)}
  return [...groups].map(([channel,values])=>({channel,...values,actualCommissionComplete:values.actualCommissionCount===values.reservations.length}));
}
export function compareApprovedBudget(actual:Expense[],budget:Expense[],start:string,end:string){
  const inPeriod=(r:Expense)=>r.date>=start&&r.date<=end;
  const a=actual.filter(r=>!r.isBudget&&inPeriod(r));const b=budget.filter(r=>r.isBudget&&inPeriod(r));
  const categories=new Set([...a,...b].map(r=>r.category));
  return [...categories].map(category=>{const av=a.filter(r=>r.category===category).reduce((s,r)=>s+r.amountAED,0);const bb=b.filter(r=>r.category===category);const bv=bb.reduce((s,r)=>s+r.amountAED,0);return {category,actualAED:av,budgetAED:bb.length?bv:null,varianceAED:bb.length?av-bv:null,evidence:[...a.filter(r=>r.category===category),...bb].map(r=>({kind:'transaction',id:r.id}))}});
}
