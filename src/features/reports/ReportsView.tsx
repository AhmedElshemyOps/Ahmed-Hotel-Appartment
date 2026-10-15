import React, { useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentRecommendation,
  MaintenanceWorkOrder,
  GuestComplaint,
  Apartment,
  Reservation,
  FinancialTransaction,
} from "../../shared/types";
import { calculatePropertyKPISummary, formatAED } from "../revenue/kpiEngine";
import { businessDate } from "../guest-service/guestService";
import {
  reportPeriod,
  printReport,
  reportCsv,
  type ReportType,
} from "./reporting";
import reportStyles from "../reports/reports.css?inline";
interface ReportsViewProps {
  recommendations: AgentRecommendation[];
  maintenanceOrders: MaintenanceWorkOrder[];
  complaints: GuestComplaint[];
  apartments: Apartment[];
  reservations: Reservation[];
  transactions: FinancialTransaction[];
}
const dateLabel = (date: string) =>
  new Date(date + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
export const ReportsView: React.FC<ReportsViewProps> = ({
  recommendations,
  maintenanceOrders,
  complaints,
  apartments,
  reservations,
  transactions,
}) => {
  const [type, setType] = useState<ReportType>("MONTHLY"),
    [date, setDate] = useState(businessDate),
    [error, setError] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.body.classList.add("report-center-active");
    return () => document.body.classList.remove("report-center-active");
  }, []);
  let period: { start: string; end: string } | null = null;
  try {
    period = reportPeriod(type, date);
  } catch {}
  const start = period?.start ?? "",
    end = period?.end ?? "";
  const kpi = useMemo(
    () =>
      period
        ? calculatePropertyKPISummary({
            apartments,
            reservations,
            transactions,
            maintenanceOrders,
            complaints,
            startDate: start,
            endDate: end,
            periodLabel: start + " to " + end,
          })
        : null,
    [
      start,
      end,
      apartments,
      reservations,
      transactions,
      maintenanceOrders,
      complaints,
    ],
  );
  const title =
    type === "DAILY"
      ? "Daily Operations Brief"
      : type === "WEEKLY"
        ? "Weekly Management Report"
        : "Monthly Owner Review";
  const activeCases = maintenanceOrders
    .filter(
      (m) =>
        m.reportedDate <= end && (!m.resolvedDate || m.resolvedDate >= start),
    )
    .sort(
      (a, b) =>
        Number(["Critical", "High"].includes(b.priority)) -
        Number(["Critical", "High"].includes(a.priority)),
    );
  const periodComplaints = complaints.filter(
    (c) =>
      c.reportedAt.slice(0, 10) >= start && c.reportedAt.slice(0, 10) <= end,
  );
  const priorities = recommendations
    .filter((r) => r.resolutionStatus !== "Resolved" && r.date <= end)
    .sort(
      (a, b) =>
        Number(["Critical", "High"].includes(b.priority)) -
        Number(["Critical", "High"].includes(a.priority)),
    )
    .slice(0, type === "DAILY" ? 4 : 6);
  const arrivals = reservations.filter(
      (r) =>
        r.status !== "Canceled" &&
        r.checkInDate >= start &&
        r.checkInDate <= end,
    ).length,
    departures = reservations.filter(
      (r) =>
        r.status !== "Canceled" &&
        r.checkOutDate >= start &&
        r.checkOutDate <= end,
    ).length;
  const generated = new Date().toLocaleString("en-GB", {
    timeZone: "Asia/Dubai",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const unit = (id: string) =>
    apartments.find((a) => a.id === id)?.unitNumber ?? id;
  const csv = () => {
    if (!kpi) return;
    const rows: (string | number)[][] = [
      ["Ahmed Quality Ops", title],
      ["Data status", "SYNTHETIC DEMONSTRATION - INTERNAL DRAFT"],
      ["Period start", start],
      ["Period end", end],
      ["Metric", "Value", "Unit"],
      ["Apartments", apartments.length, "Units"],
      ["Occupied unit nights", kpi.occupiedUnitNights, "Nights"],
      ["Available unit nights", kpi.availableUnitNights, "Nights"],
      ["Occupancy", kpi.occupancyPercent, "%"],
      ["ADR", kpi.adrAED, "AED"],
      ["RevPAR", kpi.revParAED, "AED"],
      ["Room revenue", kpi.roomRevenueAED, "AED"],
      ["Ancillary revenue", kpi.ancillaryRevenueAED, "AED"],
      ["Total revenue", kpi.totalRevenueAED, "AED"],
      ["Operating expenses", kpi.operatingExpensesAED, "AED"],
      ["Calculated operating contribution", kpi.netOperatingIncomeAED, "AED"],
    ];
    const url = URL.createObjectURL(
      new Blob([reportCsv(rows)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "AHQ-SYNTHETIC-" + type + "-" + start + ".csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="report-center">
      <style>{reportStyles}</style>
      <div className="report-toolbar no-print">
        <h2>Report Center</h2>
        <p>
          White-page reports designed for A4. Choose a period, then print or
          save as PDF. These reports use synthetic demonstration records.
        </p>
        <div className="report-control-row">
          <div className="report-type-group">
            {(["DAILY", "WEEKLY", "MONTHLY"] as ReportType[]).map((t) => (
              <button
                key={t}
                aria-pressed={type === t}
                onClick={() => {
                  setType(t);
                  setError("");
                }}
              >
                {t === "DAILY"
                  ? "Daily report"
                  : t === "WEEKLY"
                    ? "Weekly report"
                    : "Monthly report"}
              </button>
            ))}
          </div>
          <label>
            Report date
            <input
              aria-label="Report date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <button
            className="report-print-button"
            disabled={!kpi}
            onClick={async () => {
              try {
                setError("");
                if (reportRef.current)
                  await printReport(
                    reportRef.current.outerHTML,
                    reportStyles,
                    title,
                  );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Print / Save PDF
          </button>
          <button disabled={!kpi} onClick={csv}>
            Export report CSV
          </button>
        </div>
        <p>
          Daily: selected date. Weekly: seven days ending on that date. Monthly:
          the full calendar month. Report dates are independent of the dashboard
          filter.
        </p>
        {!period && <p role="alert">Choose a valid report date.</p>}
        {error && <p role="alert">{error}</p>}
      </div>
      {kpi && (
        <div
          className="management-report"
          ref={reportRef}
          data-report-type={type}
        >
          <div className="report-masthead">
            <div>
              <div className="report-brand">Ahmed Quality Ops</div>
              <h1>{title}</h1>
              <p className="report-subtitle">
                Serviced Apartments | Portfolio of {apartments.length} units
              </p>
            </div>
            <div className="report-meta">
              <p>
                REPORTING PERIOD
                <strong>
                  {dateLabel(start)} - {dateLabel(end)}
                </strong>
              </p>
              <p>
                PREPARED<strong>{generated} GST</strong>
              </p>
              <p>
                REFERENCE
                <strong>
                  AHQ-{type}-{start}
                </strong>
              </p>
            </div>
          </div>
          <div className="report-disclosure">
            <strong>SYNTHETIC DEMONSTRATION | INTERNAL REVIEW DRAFT</strong>All
            figures and cases below are derived from the selected fictional
            dataset. This is not an audited statement, a live Odoo report,
            government approval or an owner-approved release. Currency: AED.
          </div>
          <div className="report-kpis">
            {[
              ["Occupancy", kpi.occupancyPercent.toFixed(1) + "%"],
              ["Average daily rate", formatAED(kpi.adrAED)],
              ["Revenue per available night", formatAED(kpi.revParAED)],
              ["Total revenue", formatAED(kpi.totalRevenueAED)],
              ["Operating expenses", formatAED(kpi.operatingExpensesAED)],
              ["Operating contribution", formatAED(kpi.netOperatingIncomeAED)],
            ].map(([label, value]) => (
              <div className="report-kpi" key={label}>
                <div className="report-kpi-label">{label}</div>
                <div className="report-kpi-value">{value}</div>
              </div>
            ))}
          </div>
          <section>
            <h2>
              <span>01</span> Management overview
            </h2>
            <p>
              The selected period contains{" "}
              <strong>
                {kpi.occupiedUnitNights.toLocaleString("en-GB")} occupied
                apartment-nights
              </strong>{" "}
              from {kpi.availableUnitNights.toLocaleString("en-GB")} available
              apartment-nights. Recorded revenue is{" "}
              {formatAED(kpi.totalRevenueAED)}, with{" "}
              {formatAED(kpi.netOperatingIncomeAED)} calculated operating
              contribution after the included operating expenses.
            </p>
            <p>
              Operational activity: <strong>{arrivals} arrivals</strong>,{" "}
              <strong>{departures} departures</strong>,{" "}
              <strong>{activeCases.length} maintenance cases</strong> active
              during the period and{" "}
              <strong>{periodComplaints.length} complaints</strong> reported in
              the period.
            </p>
          </section>
          <section>
            <h2>
              <span>02</span> Revenue and operating performance
            </h2>
            <table>
              <colgroup>
                <col style={{ width: "40%" }} />
                <col style={{ width: "24%" }} />
                <col style={{ width: "36%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Measure</th>
                  <th className="report-number">Selected period</th>
                  <th>Calculation basis</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "Room revenue",
                    formatAED(kpi.roomRevenueAED),
                    "Stay nights clipped to the report period",
                  ],
                  [
                    "Ancillary revenue",
                    formatAED(kpi.ancillaryRevenueAED),
                    "Included non-room revenue transactions",
                  ],
                  [
                    "Total revenue",
                    formatAED(kpi.totalRevenueAED),
                    "Room and ancillary revenue",
                  ],
                  [
                    "Operating expenses",
                    formatAED(kpi.operatingExpensesAED),
                    "Included dated expense transactions",
                  ],
                  [
                    "Operating contribution",
                    formatAED(kpi.netOperatingIncomeAED),
                    "Total revenue less included expenses",
                  ],
                  [
                    "Occupancy",
                    kpi.occupancyPercent.toFixed(1) + "%",
                    `${kpi.occupiedUnitNights} occupied / ${kpi.availableUnitNights} available nights`,
                  ],
                  [
                    "Average daily rate",
                    formatAED(kpi.adrAED),
                    "Room revenue / occupied apartment-nights",
                  ],
                  [
                    "RevPAR",
                    formatAED(kpi.revParAED),
                    "Room revenue / available apartment-nights",
                  ],
                ].map(([label, value, basis]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td className="report-number">{value}</td>
                    <td>{basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="report-caption">
              No approved budget or external benchmark is asserted. Contribution
              includes only the expenses present in the fictional source
              records; it is not audited net profit. A zero metric can reflect a
              period without source activity.
            </p>
          </section>
          <section>
            <h2>
              <span>03</span> Maintenance and guest experience
            </h2>
            {activeCases.length ? (
              <table>
                <colgroup>
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "39%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "25%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Unit / source</th>
                    <th>Recorded issue</th>
                    <th>Priority / status</th>
                    <th className="report-number">Case cost</th>
                  </tr>
                </thead>
                <tbody>
                  {activeCases.slice(0, type === "DAILY" ? 4 : 6).map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong>{unit(m.unitId)}</strong>
                        <br />
                        {m.id}
                      </td>
                      <td>{m.description}</td>
                      <td>
                        {m.priority}
                        <br />
                        {m.status}
                      </td>
                      <td className="report-number">{formatAED(m.costAED)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="report-empty">
                No maintenance cases overlap this period in the supplied
                dataset.
              </p>
            )}
            <p className="report-caption">
              Showing up to {type === "DAILY" ? 4 : 6} priority cases of{" "}
              {activeCases.length}. Case costs are recorded whole-case amounts,
              not period-allocated expenses. They are not added again to the
              financial table.
            </p>
            <p>
              Guest experience:{" "}
              {periodComplaints.filter((c) => c.status === "Resolved").length}{" "}
              of {periodComplaints.length} period-reported complaints are marked
              resolved in the current dataset. Current status does not prove
              historical resolution by period end.
            </p>
          </section>
          <section>
            <h2>
              <span>04</span> Management priorities and follow-up
            </h2>
            {priorities.length ? (
              priorities.map((r, i) => (
                <div className="report-action" key={r.id}>
                  <div className="report-action-title">
                    {i + 1}. {r.recommendedAction}
                  </div>
                  <p>{r.problemDescription}</p>
                  <p className="report-action-meta">
                    Responsible: {r.responsibleManager} | Priority: {r.priority}{" "}
                    | Due: {r.followUpDate} | Current approval:{" "}
                    {r.approvalStatus}
                    <br />
                    Evidence reference: {r.id}
                    {r.unitId ? " | Unit " + unit(r.unitId) : ""}
                  </p>
                </div>
              ))
            ) : (
              <p className="report-empty">
                No unresolved recommendations dated on or before the period end
                in the supplied dataset.
              </p>
            )}
            <p className="report-caption">
              These are current unresolved demonstration recommendations, not
              guaranteed future savings or a historical approval snapshot.
            </p>
          </section>
          <section>
            <h2>
              <span>05</span> Reading notes and review
            </h2>
            <div className="report-definitions">
              <div>
                <strong>ADR:</strong> Room revenue divided by occupied
                apartment-nights.
              </div>
              <div>
                <strong>RevPAR:</strong> Room revenue divided by available
                apartment-nights.
              </div>
              <div>
                <strong>Period:</strong> Dates are inclusive; checkout nights
                are excluded from occupied stay nights.
              </div>
              <div>
                <strong>Source:</strong> Local synthetic reservations,
                transactions, cases and recommendations. No live accounting
                connection.
              </div>
            </div>
            <div className="report-signoff">
              <div>
                Prepared for management review
                <br />
                <strong>Reviewer: __________________________</strong>
              </div>
              <div>
                Approval has not been recorded in this report
                <br />
                <strong>Review date: _______________________</strong>
              </div>
            </div>
          </section>
          <div className="report-footer">
            <span>AHMED QUALITY OPS | Hospitality management intelligence</span>
            <span>Synthetic data | Internal draft | AED</span>
          </div>
        </div>
      )}
    </div>
  );
};
