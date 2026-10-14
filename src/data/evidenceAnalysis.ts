/** Evidence-first operational analysis. No invented hotel figures. */
export type EvidenceRecord = { unitId: string; date: string; amountAED?: number; status?: string; category?: string };
export type EvidenceFinding = { title: string; facts: string[]; limitations: string[]; recommendation: string; requiresApproval: true };
export function maintenanceCostFindings(records: EvidenceRecord[], startDate: string, endDate: string): EvidenceFinding[] {
  const relevant = records.filter(r => r.date >= startDate && r.date <= endDate);
  const groups = new Map<string, { total: number; count: number; missing: number }>();
  for (const r of relevant) {
    const key = r.unitId || 'Unassigned';
    const g = groups.get(key) || { total: 0, count: 0, missing: 0 };
    g.count++;
    if (typeof r.amountAED === 'number' && Number.isFinite(r.amountAED) && r.amountAED >= 0) g.total += r.amountAED;
    else g.missing++;
    groups.set(key, g);
  }
  return [...groups.entries()].sort((a,b) => b[1].total - a[1].total).map(([unitId, g]) => ({
    title: 'Maintenance review: ' + unitId,
    facts: [g.count + ' recorded work orders in selected period', 'Recorded cost: AED ' + g.total.toFixed(2)],
    limitations: g.missing ? [g.missing + ' work orders have missing or invalid costs; total is incomplete'] : [],
    recommendation: 'Engineering should review recurring work orders and validate repair-versus-replacement options before approval.',
    requiresApproval: true
  }));
}
export function safeOccupancy(occupiedNights: number, availableNights: number): number | null {
  if (!Number.isFinite(occupiedNights) || !Number.isFinite(availableNights) || availableNights <= 0 || occupiedNights < 0 || occupiedNights > availableNights) return null;
  return occupiedNights / availableNights * 100;
}
