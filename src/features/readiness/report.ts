import { memberName, type TeamMember } from "../../shared/team/members";
import { assess } from "./engine";
import type { ReadinessState } from "./model";
const escape = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function readinessReport(
  units: {
    id: string;
    unitNumber: string;
    revision: number;
    state: ReadinessState;
  }[],
  today: string,
  generatedBy: string,
  members: TeamMember[] = [],
) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Property readiness review</title><style>body{font:16px system-ui;max-width:1000px;margin:40px auto;padding:20px;color:#172033}article{border:1px solid #bcc7d5;border-radius:8px;padding:20px;margin:20px 0}h1,h2{color:#075985}li{margin:6px 0}@media print{article{break-inside:avoid}}</style><h1>Ahmed Quality Ops — Property readiness review</h1><p>INTERNAL MANAGEMENT DRAFT · ${escape(today)} · Prepared by ${escape(memberName(members, generatedBy))}</p><p>Based on saved company records. This report does not establish government approval or live OTA publication. No lost revenue or guaranteed performance is inferred. Evidence references identify internal apartment revisions; confidential document URLs and notes are excluded.</p>${units
    .map((u) => {
      const a = assess(
        {
          ...u.state,
          restriction: u.state.restriction
            ? "A legal restriction is recorded"
            : "",
        },
        today,
      );
      return `<article><h2>Apartment ${escape(u.unitNumber)} — ${escape(a.effectiveStatus)}</h2><p>Evidence: apartment ${escape(u.id)}, revision ${u.revision}. Jurisdiction: ${escape(u.state.jurisdiction)}. Rental model: ${escape(u.state.rentalModel)}.</p>${[
        ["Legal", a.legal],
        ["Operational", a.operational],
        ["Commercial", a.commercial],
      ]
        .map(
          ([label, gaps]) =>
            `<h3>${label} readiness</h3><ul>${(gaps as string[]).length ? (gaps as string[]).map((g) => `<li>${escape(g)}</li>`).join("") : "<li>Evidence gates passed</li>"}</ul>`,
        )
        .join(
          "",
        )}<h3>Renewal alerts</h3><ul>${a.alerts.map((v) => `<li>${escape(v.reason)} · document ${escape(v.documentId)} · ${v.daysRemaining} days remaining · assigned ${escape(memberName(members, v.responsibleUid))}</li>`).join("") || "<li>No current alerts in recorded documents. Missing documents still block legal readiness.</li>"}</ul><h3>Overdue responsibilities</h3><ul>${a.overdueTasks.map((t) => `<li>${escape(t.label)} · ${escape(t.dueOn)} · ${escape(memberName(members, t.responsibleUid))}</li>`).join("") || "<li>No overdue tasks in recorded data.</li>"}</ul><h3>Channel readiness</h3><ul>${u.state.listings.map((l) => `<li>${escape(l.channel)}: ${escape(l.status)} · recorded review ${escape(l.reviewedBy ? memberName(members, l.reviewedBy) : "No reviewer")}</li>`).join("") || "<li>No channel checklist recorded.</li>"}</ul></article>`;
    })
    .join("")}</html>`;
}
