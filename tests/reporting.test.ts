import { test } from "node:test";
import assert from "node:assert/strict";
import { reportPeriod, reportCsv, reportHtml } from "../src/reports/reporting";
test("daily weekly and monthly reports have real date windows including leap months", () => {
  assert.deepEqual(reportPeriod("DAILY", "2026-10-15"), {
    start: "2026-10-15",
    end: "2026-10-15",
  });
  assert.deepEqual(reportPeriod("WEEKLY", "2026-01-03"), {
    start: "2025-12-28",
    end: "2026-01-03",
  });
  assert.deepEqual(reportPeriod("MONTHLY", "2024-02-12"), {
    start: "2024-02-01",
    end: "2024-02-29",
  });
  assert.throws(() => reportPeriod("MONTHLY", "2026-02-30"));
  assert.throws(() => reportPeriod("DAILY", ""));
});
test("report CSV escapes source text and spreadsheet formulas while retaining numeric signs", () => {
  const csv = reportCsv([
    ["Metric", "Value"],
    ["=untrusted()", 'Text, with "quotes"'],
    ["Loss", -10],
  ]);
  assert.match(csv, /"'=untrusted\(\)"/);
  assert.match(csv, /"Text, with ""quotes"""/);
  assert.match(csv, /"-10"/);
});
test("isolated print document includes only explicit report markup and escapes its title", () => {
  const html = reportHtml(
    '<div class="management-report">Synthetic review</div>',
    ".management-report{background:white;color:black}",
    "A <test> & report",
  );
  assert.match(html, /<title>A &lt;test&gt; &amp; report<\/title>/);
  assert.equal(html.includes("sidebar"), false);
  assert.equal(html.includes("bg-slate"), false);
  assert.match(html, /<body><div class="management-report">/);
});
