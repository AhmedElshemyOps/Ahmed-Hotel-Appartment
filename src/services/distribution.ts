import type { Reservation } from "../types";
import { overlapNights } from "./propertyIntelligence";

export type DistributionChannel = {
  id: string;
  name: string;
  aliases: string[];
  active: boolean;
};
export const DEFAULT_CHANNELS: DistributionChannel[] = [
  "Direct Web",
  "Corporate Contract",
  "Booking.com",
  "Airbnb",
  "Expedia",
].map((name, i) => ({ id: `channel-${i}`, name, aliases: [], active: true }));
export const channelKey = (name: string) =>
  name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
export function validateChannel(
  input: unknown,
  existing: DistributionChannel[],
  id: string,
): DistributionChannel {
  const value = input as Partial<DistributionChannel>;
  if (
    !value ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.trim().length > 80
  )
    throw Error("Channel name must contain 1–80 characters.");
  if (
    !Array.isArray(value.aliases) ||
    value.aliases.length > 20 ||
    value.aliases.some(
      (a) => typeof a !== "string" || !a.trim() || a.length > 80,
    )
  )
    throw Error("Provide up to 20 nonempty aliases.");
  if (typeof value.active !== "boolean")
    throw Error("Choose an active status.");
  const result = {
    id,
    name: value.name.trim(),
    aliases: value.aliases.map((a) => a.trim()),
    active: value.active,
  };
  const keys = [result.name, ...result.aliases].map(channelKey);
  if (new Set(keys).size !== keys.length)
    throw Error("Names and aliases must be distinct.");
  if (
    existing
      .filter((c) => c.id !== id)
      .some((c) =>
        [c.name, ...c.aliases].some((n) => keys.includes(channelKey(n))),
      )
  )
    throw Error("This channel name or alias already exists.");
  return result;
}

export function distributionStats(
  reservations: Reservation[],
  catalog: DistributionChannel[],
  start: string,
  end: string,
) {
  // Include archived and unknown historic channels so totals never silently omit a source.
  const names = new Set([
    ...catalog.map((c) => c.name),
    ...reservations.map((r) => r.channel),
  ]);
  return [...names].map((channel) => {
    const selected = reservations
      .filter((r) => r.channel === channel && r.status !== "Canceled")
      .map((r) => ({
        r,
        nights: overlapNights(r.checkInDate, r.checkOutDate, start, end),
      }))
      .filter((x) => x.nights > 0);
    const nights = selected.reduce((s, x) => s + x.nights, 0);
    const grossRevenue = selected.reduce(
      (s, x) => s + x.nights * x.r.dailyRateAED,
      0,
    );
    const commissionPaid = selected.reduce(
      (s, x) =>
        s + (x.nights * x.r.dailyRateAED * x.r.commissionRatePercent) / 100,
      0,
    );
    return {
      channel,
      bookingsCount: selected.length,
      grossRevenue,
      commissionPaid,
      commPercent: grossRevenue ? (commissionPaid / grossRevenue) * 100 : 0,
      netRevenue: grossRevenue - commissionPaid,
      realizedADR: nights ? grossRevenue / nights : 0,
      netADR: nights ? (grossRevenue - commissionPaid) / nights : 0,
    };
  });
}
