# Report Center — professional print layout

The demonstration Report Center now has one white-page layout for Daily Operations Brief, Weekly Management Report and Monthly Owner Review. The dark app shell stays outside the isolated print document.

## Use

1. Open Reports Center in the synthetic app.
2. Choose Daily, Weekly or Monthly and a report date. Daily uses one date; Weekly uses seven dates ending on that date; Monthly uses its full calendar month. These settings are independent of the dashboard date filter.
3. Review the white-page preview, then choose **Print / Save PDF**. Use A4 portrait. Browser-added headers/footers can be disabled if the browser offers that setting; the report supplies its own page labels in Chromium's print output.
4. Export report CSV for the same selected period and metric definitions.

The iframe used for printing contains only report markup and its dedicated stylesheet. Browser print uses local content and does not upload data or call a PDF conversion service. Main-page printing also hides app navigation and controls.

## Content and evidence

Metrics are recalculated using the existing KPI engine for the selected period. Removed hardcoded report dates, fixed inventory/budgets/benchmarks, fabricated maintenance narratives, GAAP/USALI verification language and automatic owner/board approval claims. Source case and recommendation identifiers are printed. Current case/approval states are not presented as historical period-end snapshots. Recorded whole-case maintenance costs are not added again to dated operating expenses. Existing KPI-engine limits remain; these PDFs do not establish a reconciled live ledger or legal/accounting certification.

All Report Center records in this app path are synthetic. Every document carries that notice and internal-draft status. The company cloud workspace, secure owner portal and Odoo report synchronization are not implied by the design change.

## Layout and validation

- White A4 pages, navy text/teal accents, readable KPI cards and financial table.
- Repeating table headings, rows/action cards kept together where practical, page numbers and review fields.
- The in-document footer is hidden in print because page-margin branding replaces it; this prevents a footer-only trailing page.
- For the 15 October 2026 fixture, reviewed output is two daily pages and three weekly/monthly pages. Other records can change page counts.
- Unit tests cover period boundaries/leap months, CSV quoting/formula safety and print-document title escaping. Browser tests cover mode changes, period-specific values, white print styling, hidden controls, CSV naming and invalid-date handling.
- PDF samples were generated from the same report markup/stylesheet used by the print action, rendered to images and inspected. Page counters and nonempty pages were also checked programmatically. Browser differences still require a quick print-preview check on the presenter's device.

Files: `src/components/ReportsView.tsx`, `src/reports/reporting.ts`, `src/reports/reports.css`, `tests/reporting.test.ts`, extended `tests/browser/demo.spec.ts`.
