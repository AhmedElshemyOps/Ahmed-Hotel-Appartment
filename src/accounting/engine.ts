import { cents, type AccountingDocument, type DimensionMapping } from "./model";
export function financialAnalysis(
  documents: AccountingDocument[],
  mappings: DimensionMapping[],
  start: string,
  end: string,
) {
  const inPeriod = documents.filter(
    (d) => d.postingDate >= start && d.postingDate <= end,
  );
  const rows = new Map<
    string,
    {
      key: string;
      unitId: string | null;
      building: string;
      revenueCents: number;
      expenseCents: number;
      lineIds: string[];
    }
  >();
  const exceptions: {
    documentId: string;
    number: string;
    reason: string;
    deltaAED: number;
  }[] = [];
  let recognised = 0,
    excluded = 0,
    payments = 0,
    outstanding = 0;
  for (const d of inPeriod) {
    const debit = d.lines.reduce((n, l) => n + cents(l.debit), 0),
      credit = d.lines.reduce((n, l) => n + cents(l.credit), 0);
    const paymentClassification =
      d.type === "payment" && d.lines.some((l) => l.accountClass !== "balance");
    if (d.status !== "posted" || debit !== credit || paymentClassification) {
      excluded++;
      exceptions.push({
        documentId: d.externalId,
        number: d.number,
        reason:
          d.status !== "posted"
            ? "Not posted"
            : paymentClassification
              ? "Payment contains profit-and-loss lines; normalization review required"
              : "Journal does not balance",
        deltaAED: (debit - credit) / 100,
      });
      continue;
    }
    recognised++;
    if (d.type === "payment") payments += cents(d.total);
    if (["invoice", "credit_note"].includes(d.type))
      outstanding += (d.type === "credit_note" ? -1 : 1) * cents(d.outstanding);
    for (const l of d.lines) {
      if (l.accountClass === "balance") continue;
      const map = mappings.find((m) => m.dimensionKey === l.dimensionKey);
      const key = map?.unitId
        ? "unit:" + map.unitId
        : map?.building
          ? "building:" + map.building
          : "unallocated";
      const row = rows.get(key) ?? {
        key,
        unitId: map?.unitId ?? null,
        building: map?.building ?? "",
        revenueCents: 0,
        expenseCents: 0,
        lineIds: [],
      };
      if (l.accountClass === "revenue")
        row.revenueCents += cents(l.credit) - cents(l.debit);
      else row.expenseCents += cents(l.debit) - cents(l.credit);
      row.lineIds.push(l.externalLineId);
      rows.set(key, row);
    }
  }
  const profitability = [...rows.values()].map((r) => ({
    ...r,
    revenueAED: r.revenueCents / 100,
    expenseAED: r.expenseCents / 100,
    contributionAED: (r.revenueCents - r.expenseCents) / 100,
  }));
  const revenueAED =
      profitability.reduce((n, r) => n + r.revenueCents, 0) / 100,
    expenseAED = profitability.reduce((n, r) => n + r.expenseCents, 0) / 100;
  return {
    start,
    end,
    recognisedDocuments: recognised,
    excludedDocuments: excluded,
    revenueAED,
    expenseAED,
    contributionAED: revenueAED - expenseAED,
    paymentDocumentTotalsAED: payments / 100,
    receivableOutstandingAED: outstanding / 100,
    profitability,
    exceptions,
    insights: [
      {
        finding: `Posted balanced records contain AED ${revenueAED.toFixed(2)} revenue and AED ${expenseAED.toFixed(2)} expenses in this selected period.`,
        evidence: inPeriod
          .filter(
            (d) =>
              d.status === "posted" &&
              !exceptions.some((e) => e.documentId === d.externalId),
          )
          .map((d) => d.externalId),
      },
      {
        finding: `${exceptions.length} records excluded from profitability; ${profitability.filter((r) => r.key === "unallocated").reduce((n, r) => n + r.lineIds.length, 0)} financial lines are unallocated.`,
        evidence: exceptions.map((e) => e.documentId),
      },
    ],
    limitations: [
      "Deterministic financial analysis of imported source records; not a live Odoo AI connection.",
      "Accrual contribution from mapped revenue/expense lines excludes missing exports, unmapped expenses outside this packet and unrecorded shared costs. It is not audited net profit.",
      "Payment document totals are informational and are not added to revenue or expenses. No bank, settlement or invoice-payment matching is inferred.",
      "Journal balancing is an arithmetic check, not independent bank or trial-balance reconciliation.",
      "VAT and balance-sheet lines stay excluded from contribution; FX conversion is unavailable.",
    ],
  };
}
