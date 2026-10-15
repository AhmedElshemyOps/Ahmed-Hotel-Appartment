import type { StoredReservation } from "../../shared/api/contracts";
import type { AccountingDocument } from "../accounting/model";
import { cents } from "../accounting/model";
export type AccountingLink = {
  documentId: string;
  reservationSource: string;
  reservationExternalId: string;
  purpose: "invoice" | "refund" | "commission" | "settlement";
  evidenceNote: string;
  reviewedBy: string;
  reviewedDocumentUpdatedAt?: string;
  reviewedReservationVersion?: number;
};
/** Explicit, whole-document allocations only. No fuzzy matching or journal-balance inference. */
export function reconcile(
  reservations: StoredReservation[],
  documents: AccountingDocument[],
  links: AccountingLink[],
) {
  const used = new Set<string>();
  for (const l of links) {
    if (used.has(l.documentId))
      throw Error("A document cannot be allocated twice.");
    used.add(l.documentId);
  }
  const linkedDocuments = new Set<string>();
  const rows = reservations.map((r) => {
    const relevant = links.filter(
      (l) =>
        l.reservationSource === r.source &&
        l.reservationExternalId === r.externalId,
    );
    let invoice = 0,
      refund = 0,
      commission = 0,
      settlement = 0,
      outstanding = 0;
    const issues: string[] = [],
      evidence: {
        documentId: string;
        number: string;
        status: string;
        purpose: string;
        updatedAt: string;
        reviewedBy: string;
        note: string;
      }[] = [];
    for (const l of relevant) {
      const d = documents.find((d) => d.externalId === l.documentId);
      if (!d) {
        issues.push("Linked document is missing from the current ledger.");
        continue;
      }
      linkedDocuments.add(d.externalId);
      if (
        l.reviewedDocumentUpdatedAt !== d.sourceUpdatedAt ||
        l.reviewedReservationVersion !== r.version
      )
        issues.push(
          d.number +
            " or its booking changed since the link was reviewed; review the allocation again.",
        );
      evidence.push({
        documentId: d.externalId,
        number: d.number,
        status: d.status,
        purpose: l.purpose,
        updatedAt: d.sourceUpdatedAt,
        reviewedBy: l.reviewedBy,
        note: l.evidenceNote,
      });
      if (d.status !== "posted") {
        issues.push(d.number + " is " + d.status + "; excluded from totals.");
        continue;
      }
      if (d.currency !== "AED") {
        issues.push("Unsupported document currency.");
        continue;
      }
      if (l.purpose === "invoice" && d.type === "invoice") {
        invoice += cents(d.total);
        outstanding += cents(d.outstanding);
      } else if (l.purpose === "refund" && d.type === "credit_note")
        refund += cents(d.total);
      else if (
        l.purpose === "commission" &&
        ["supplier_bill", "expense"].includes(d.type)
      )
        commission += cents(d.total);
      else if (l.purpose === "settlement" && d.type === "payment")
        settlement += cents(d.total);
      else
        issues.push(d.number + " has an incompatible document type; excluded.");
    }
    const expected =
      r.data.status === "Canceled" ? 0 : cents(r.data.totalRoomRevenueAED);
    const expectedCommission =
      r.data.status === "Canceled"
        ? 0
        : Math.round((expected * r.data.commissionRatePercent) / 100);
    if (!evidence.length) issues.push("No Finance-reviewed accounting links.");
    const grossDifference = invoice - refund - expected;
    const settlementDifference = settlement - (invoice - refund - commission);
    if (grossDifference)
      issues.push(
        "Invoice less credit notes differs from room-only booking value; review tax, fees, scope and cancellation policy.",
      );
    if (settlementDifference)
      issues.push(
        "Linked payment value differs from invoice less credit notes and commission; review payment direction, partial payments and bank settlement evidence.",
      );
    if (commission !== expectedCommission)
      issues.push(
        "Linked commission differs from the recorded booking commission estimate.",
      );
    return {
      source: r.source,
      externalId: r.externalId,
      unitId: r.data.unitId,
      status: r.data.status,
      expectedRoomAED: expected / 100,
      invoicedAED: invoice / 100,
      creditNotesAED: refund / 100,
      commissionAED: commission / 100,
      paymentsAED: settlement / 100,
      outstandingAED: outstanding / 100,
      grossDifferenceAED: grossDifference / 100,
      settlementDifferenceAED: settlementDifference / 100,
      reviewStatus: "review_required" as const,
      issues,
      evidence,
    };
  });
  return {
    rows,
    unlinkedDocuments: documents
      .filter((d) => !linkedDocuments.has(d.externalId))
      .map((d) => ({
        id: d.externalId,
        number: d.number,
        type: d.type,
        status: d.status,
      })),
    orphanLinks: links.filter(
      (l) =>
        !reservations.some(
          (r) =>
            r.source === l.reservationSource &&
            r.externalId === l.reservationExternalId,
        ),
    ),
    limitations:
      "Review worksheet only: whole documents, AED, room-only booking estimates. Credit notes are not proof of cash refunds; payments are not proof of bank settlement. Tax, fees, payment direction, split invoices and shared settlements need Finance-approved rules. Zero differences never constitute automatic reconciliation approval.",
  };
}
