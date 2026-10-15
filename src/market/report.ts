import type { MarketQuery, PriceDecision } from "./model";
const esc = (v: unknown) =>
  String(v ?? "Unavailable").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function marketReportHtml(input: {
  property: string;
  type: string;
  query: MarketQuery;
  decisions: PriceDecision[];
  demo: boolean;
  createdAt: string;
}) {
  const sources = new Map<
    string,
    { url: string; observedAt: string; label: string }
  >();
  for (const d of input.decisions)
    for (const m of d.matches)
      if (m.included)
        sources.set(m.offer.id, {
          url: m.offer.sourceUrl,
          observedAt: m.offer.observedAt,
          label: m.competitor.title,
        });
  return (
    '<!doctype html><html><head><meta charset="utf-8"><title>Market intelligence report</title><style>body{font:14px Arial,sans-serif;color:#172033;max-width:1100px;margin:40px auto;padding:24px}h1{font-size:28px}table{border-collapse:collapse;width:100%;margin:24px 0;font-size:12px}td,th{padding:9px;border:1px solid #ccd4df;text-align:left}th{background:#edf3f9}.notice{padding:14px;background:#fff3d9;border-left:4px solid #c88500}small{color:#526075}@media print{body{margin:0;padding:12px}thead{display:table-header-group}tr{break-inside:avoid}a{color:inherit}}</style></head><body>' +
    `<h1>Ahmed Quality Ops</h1><h2>${esc(input.type)} Market & Pricing Review</h2><p>${esc(input.property)} · Prepared ${esc(input.createdAt)} · ${esc(input.query.start)} + ${input.query.days} check-in dates · ${input.query.stayNights}-night stays</p><p class="notice">${input.demo ? "SYNTHETIC DEMONSTRATION — NO REAL MARKET DATA" : "INTERNAL REVIEW DRAFT — not an audited owner statement"} · No rental prices have been published.</p><p>Price basis: AED. Market prices are average nightly guest-facing asking totals including known fees; our current/suggested rates are room-only. Conditional revenue changes assume the same occupied nights and do not predict demand.</p><table><thead><tr><th>Check-in</th><th>Current room rate</th><th>Market guest-night median</th><th>Unique physical properties</th><th>Suggested room rate</th><th>Confidence</th><th>Conditional net change/stay</th></tr></thead><tbody>` +
    input.decisions
      .map(
        (d) =>
          `<tr><td>${esc(d.date)}</td><td>${esc(d.currentRate)}</td><td>${esc(d.market.median?.toFixed(2))}</td><td>${d.market.uniqueProperties}</td><td>${esc(d.recommendedRate)}</td><td>${esc(d.confidence)}</td><td>${esc(d.conditionalNetDelta)}</td></tr>`,
      )
      .join("") +
    "</tbody></table><h2>Management review</h2>" +
    input.decisions
      .slice(0, 7)
      .map(
        (d) =>
          `<h3>${esc(d.date)}</h3><p>${esc(d.explanation.join(" "))}</p><small>${esc(d.limitations.join(" "))}</small>`,
      )
      .join("") +
    "<h2>Evidence and source observations</h2><ol>" +
    [...sources]
      .map(
        ([id, s]) =>
          `<li>${esc(id)} · ${esc(s.label)} · Collected ${esc(s.observedAt)}${input.demo ? " · Synthetic fixture" : ` · <a href="${esc(s.url)}" rel="noreferrer">Source</a>`}</li>`,
      )
      .join("") +
    "</ol><h2>Property performance, forecasts and outcomes</h2><p>Actual realized property revenue/contribution and demand forecasts are not established by competitor asking prices. See separately reconciled operational reports and approved outcome records. No causal effect or achieved competitor occupancy is claimed.</p><p>Formula: " +
    esc(input.decisions[0]?.formulaVersion) +
    ". Matching and movement rules are provisional. Missing and excluded observations do not prove sold-out supply. Review applicable data licenses before distribution.</p></body></html>"
  );
}
export function downloadText(
  name: string,
  content: string,
  type = "text/plain",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
