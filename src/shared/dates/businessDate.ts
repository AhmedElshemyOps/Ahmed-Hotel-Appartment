export function businessDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function nextBusinessDate(now = new Date()) {
  const today = businessDate(now);
  return new Date(Date.parse(today + "T00:00:00Z") + 86400000)
    .toISOString()
    .slice(0, 10);
}
