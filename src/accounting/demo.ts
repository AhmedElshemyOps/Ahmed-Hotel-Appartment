import type { Apartment } from "../types";
import type { AccountingDocument, DimensionMapping } from "./model";
export function accountingDemo(units: Apartment[]) {
  const documents: AccountingDocument[] = [],
    mappings: DimensionMapping[] = [];
  for (const [i, u] of units.entries()) {
    const dim = "SIM-UNIT-" + u.unitNumber;
    const base = {
      companyId: "SYNTHETIC-ONLY",
      postingDate: "2026-09-30",
      currency: "AED" as const,
      status: "posted" as const,
      sourceUpdatedAt: "2026-10-01T00:00:00Z",
      partnerName: "Synthetic counterparty " + (i + 1),
      outstanding: 0,
    };
    const line = (
      suffix: string,
      accountClass: "revenue" | "expense" | "balance",
      debit: number,
      credit: number,
      accountCode: string,
    ) => ({
      externalLineId: "SIM-" + i + "-" + suffix,
      accountCode,
      accountClass,
      dimensionKey: dim,
      debit,
      credit,
      description: "SIMULATED accounting fixture — not a real transaction",
    });
    documents.push(
      {
        ...base,
        externalId: "SIM-INV-" + i,
        type: "invoice",
        number: "SIM-INV-" + i,
        total: 10500,
        lines: [
          line("receivable", "balance", 10500, 0, "1100"),
          line("revenue", "revenue", 0, 10000, "4000"),
          line("output-tax", "balance", 0, 500, "2200"),
        ],
      },
      {
        ...base,
        externalId: "SIM-BILL-" + i,
        type: "supplier_bill",
        number: "SIM-BILL-" + i,
        total: 2100 + i * 10,
        lines: [
          line("maintenance", "expense", 2000 + i * 10, 0, "5100"),
          line("input-tax", "balance", 100, 0, "1200"),
          line("payable", "balance", 0, 2100 + i * 10, "2100"),
        ],
      },
      {
        ...base,
        externalId: "SIM-PAY-" + i,
        type: "payment",
        number: "SIM-PAY-" + i,
        total: 10500,
        lines: [
          line("bank", "balance", 10500, 0, "1000"),
          line("settlement", "balance", 0, 10500, "1100"),
        ],
      },
    );
    mappings.push({
      dimensionKey: dim,
      unitId: u.id,
      building: i < 20 ? "Synthetic building A" : "Synthetic building B",
      reviewedBy: "SYNTHETIC-DEMO",
    });
  }
  if (units[0])
    documents.push({
      externalId: "SIM-EXP-1",
      companyId: "SYNTHETIC-ONLY",
      type: "expense",
      number: "SIM-EXP-1",
      postingDate: "2026-09-30",
      currency: "AED",
      status: "posted",
      sourceUpdatedAt: "2026-10-01T00:00:00Z",
      partnerName: "Synthetic contractor",
      total: 500,
      outstanding: 0,
      lines: [
        {
          externalLineId: "SIM-overhead-1",
          accountCode: "5200",
          accountClass: "expense",
          dimensionKey: "SIM-BUILDING-A",
          debit: 500,
          credit: 0,
          description: "Simulated shared cost; not allocated to apartments",
        },
        {
          externalLineId: "SIM-overhead-2",
          accountCode: "1000",
          accountClass: "balance",
          dimensionKey: "",
          debit: 0,
          credit: 500,
          description: "Simulated cash",
        },
      ],
    });
  mappings.push({
    dimensionKey: "SIM-BUILDING-A",
    unitId: null,
    building: "Synthetic building A",
    reviewedBy: "SYNTHETIC-DEMO",
  });
  return { documents, mappings, simulated: true as const };
}
