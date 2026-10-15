export type ReportType = "DAILY" | "WEEKLY" | "MONTHLY";
export function reportPeriod(type: ReportType, date: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw Error("Choose a valid report date.");
  const end = new Date(date + "T00:00:00Z"),
    start = new Date(end);
  if (type === "WEEKLY") start.setUTCDate(start.getUTCDate() - 6);
  if (type === "MONTHLY") {
    start.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
  }
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}
export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function reportHtml(markup: string, styles: string, title: string) {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    escapeHtml(title) +
    "</title><style>" +
    styles +
    "</style></head><body>" +
    markup +
    "</body></html>"
  );
}
export async function printReport(
  markup: string,
  styles: string,
  title: string,
) {
  document
    .querySelectorAll("iframe[data-report-print]")
    .forEach((f) => f.remove());
  const frame = document.createElement("iframe");
  frame.dataset.reportPrint = "true";
  frame.title = "Report print document";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:800px;height:1100px;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument,
    win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    throw Error("The print document could not be opened. Try again.");
  }
  doc.open();
  doc.write(reportHtml(markup, styles, title));
  doc.close();
  await doc.fonts.ready;
  win.addEventListener("afterprint", () => frame.remove(), { once: true });
  win.focus();
  win.print();
}
export function reportCsv(rows: (string | number)[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            const text = String(value);
            const safe =
              typeof value === "string" && /^[=+@\-\t\r]/.test(text)
                ? "'" + text
                : text;
            return '"' + safe.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}
