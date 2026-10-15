import type { Apartment, Reservation, UserRole } from "../types";
import type { DistributionChannel } from "../../features/revenue/distribution";
import type { GuestService } from "../../features/guest-service/guestService";
export type Actor = { uid: string; organization_id: string; role: UserRole };
export type Workspace = {
  channels: DistributionChannel[];
  apartments: Apartment[];
  reservations: StoredReservation[];
  guestService?: GuestService;
  operatingSettings?: Record<string, import("../../features/management-controls/model").OperatingPolicy>;
};
export const FIELDS = [
  "externalId",
  "unitNumber",
  "checkInDate",
  "checkOutDate",
  "bookingDate",
  "status",
  "channel",
  "dailyRateAED",
  "commissionRatePercent",
  "currency",
] as const;
export type Mapping = Record<(typeof FIELDS)[number], string>;
export type StoredReservation = {
  externalId: string;
  source: string;
  version: number;
  data: Reservation;
  lastBatch: string | null;
  sourceUpdatedAt?: string;
};
export type Change = {
  key: string;
  before: StoredReservation | null;
  after: StoredReservation;
  operation: "insert" | "update" | "unchanged";
};
export type Preview = {
  changes: Change[];
  errors: { row: number; message: string }[];
  summary: Record<"insert" | "update" | "unchanged", number>;
};
