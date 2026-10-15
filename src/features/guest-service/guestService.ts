import {
  DEFAULT_OPERATING_POLICY,
  type OperatingPolicy,
} from "../management-controls/model";
import {
  businessDate,
  nextBusinessDate,
} from "../../shared/dates/businessDate";
export {
  businessDate,
  nextBusinessDate,
} from "../../shared/dates/businessDate";
import type { Reservation } from "../../shared/types";
export type MessageTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
};
export type ServiceRule = {
  id: string;
  name: string;
  anchor: "arrival" | "departure";
  offsetHours: number;
  templateId: string;
  enabled: boolean;
};
export type GuestService = {
  templates: MessageTemplate[];
  rules: ServiceRule[];
  completed: Record<string, { at: string; by: string }>;
};
export const DEFAULT_GUEST_SERVICE: GuestService = {
  templates: [
    {
      id: "confirmation",
      name: "Booking confirmation",
      subject: "Your reservation {{reservationId}}",
      body: "Hello {{guestName}},\nThank you for your reservation for {{unitNumber}}, from {{checkInDate}} to {{checkOutDate}}. Please review your confirmed booking details.\n{{companyName}}",
    },
    {
      id: "prearrival",
      name: "Pre-arrival details request",
      subject: "Preparing for your arrival on {{checkInDate}}",
      body: "Hello {{guestName}},\nWe look forward to welcoming you to {{unitNumber}}. Please confirm your expected arrival time and any assistance you need through our approved guest contact channel.\n{{companyName}}",
    },
    {
      id: "checkin",
      name: "Check-in reminder",
      subject: "Your upcoming check-in",
      body: "Hello {{guestName}},\nYour stay at {{unitNumber}} starts on {{checkInDate}}. Your reservation team will confirm access arrangements through our approved channel. Please contact us if your arrival plans change.\n{{companyName}}",
    },
    {
      id: "welcome",
      name: "Welcome and assistance",
      subject: "Welcome to your stay",
      body: "Hello {{guestName}},\nWelcome to {{unitNumber}}. Please let our team know if anything needs attention so we can assist you.\n{{companyName}}",
    },
    {
      id: "checkout",
      name: "Checkout reminder",
      subject: "Preparing for checkout on {{checkOutDate}}",
      body: "Hello {{guestName}},\nYour checkout date is {{checkOutDate}}. Please confirm your departure time with our team and follow the checkout instructions supplied with your booking.\n{{companyName}}",
    },
    {
      id: "followup",
      name: "Post-stay follow-up",
      subject: "Thank you for staying with us",
      body: "Hello {{guestName}},\nThank you for staying at {{unitNumber}}. We welcome your feedback and hope to host you again.\n{{companyName}}",
    },
  ],
  rules: [
    {
      id: "prearrival",
      name: "Request arrival arrangements",
      anchor: "arrival",
      offsetHours: -24,
      templateId: "prearrival",
      enabled: true,
    },
    {
      id: "checkin",
      name: "Send check-in reminder",
      anchor: "arrival",
      offsetHours: -3,
      templateId: "checkin",
      enabled: true,
    },
    {
      id: "checkout",
      name: "Send checkout reminder",
      anchor: "departure",
      offsetHours: -18,
      templateId: "checkout",
      enabled: true,
    },
    {
      id: "followup",
      name: "Send post-stay follow-up",
      anchor: "departure",
      offsetHours: 24,
      templateId: "followup",
      enabled: true,
    },
  ],
  completed: {},
};
export function serviceTasks(
  reservations: Reservation[],
  settings: GuestService,
  now = new Date(),
  policies: Record<string, OperatingPolicy> = {},
) {
  return reservations
    .filter((r) => r.status !== "Canceled")
    .flatMap((r) =>
      settings.rules
        .filter((rule) => rule.enabled)
        .map((rule) => {
          const date =
            rule.anchor === "arrival" ? r.checkInDate : r.checkOutDate;
          const policy = policies[r.unitId] || DEFAULT_OPERATING_POLICY;
          const dueAt = new Date(
            Date.parse(
              date +
                "T" +
                (rule.anchor === "arrival" ? policy.checkIn : policy.checkOut) +
                ":00+04:00",
            ) +
              (policy.contactOffsets[rule.id] ?? rule.offsetHours) * 3600000,
          ).toISOString();
          const id = r.id + ":" + rule.id + ":" + date;
          const completed = settings.completed[id];
          return {
            id,
            reservationId: r.id,
            unitId: r.unitId,
            ruleId: rule.id,
            title: rule.name,
            templateId: rule.templateId,
            dueAt,
            status: completed
              ? "completed"
              : Date.parse(dueAt) < now.valueOf()
                ? "overdue"
                : "pending",
            completed,
          };
        }),
    );
}
export function nextDayOperations(reservations: Reservation[], date: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw Error("Invalid operations date.");
  const active = reservations.filter((r) => r.status !== "Canceled");
  const arrivals = active.filter((r) => r.checkInDate === date),
    departures = active.filter((r) => r.checkOutDate === date);
  return {
    date,
    arrivals,
    departures,
    stayovers: active.filter(
      (r) => r.checkInDate < date && r.checkOutDate > date,
    ),
    turnovers: departures.map((r) => ({
      unitId: r.unitId,
      departureId: r.id,
      arrivalIds: arrivals
        .filter((a) => a.unitId === r.unitId)
        .map((a) => a.id),
    })),
  };
}
export function renderTemplate(
  template: MessageTemplate,
  values: Record<string, string>,
) {
  const render = (text: string) =>
    text.replace(
      /\{\{([a-zA-Z]+)\}\}/g,
      (_all, key) => values[key]?.trim() || "[" + key + " required]",
    );
  return { subject: render(template.subject), body: render(template.body) };
}
export function validateServiceSettings(
  input: unknown,
  current: GuestService,
): GuestService {
  const v = input as GuestService;
  if (
    !v ||
    !Array.isArray(v.templates) ||
    !Array.isArray(v.rules) ||
    v.templates.length < 1 ||
    v.templates.length > 30 ||
    v.rules.length > 20
  )
    throw Error("Provide 1–30 templates and up to 20 SLA rules.");
  const ids = new Set<string>();
  for (const t of v.templates) {
    if (
      !t ||
      typeof t.id !== "string" ||
      !/^[a-z0-9_-]{1,40}$/.test(t.id) ||
      ids.has(t.id) ||
      typeof t.name !== "string" ||
      !t.name.trim() ||
      t.name.length > 100 ||
      typeof t.subject !== "string" ||
      !t.subject.trim() ||
      t.subject.length > 200 ||
      typeof t.body !== "string" ||
      !t.body.trim() ||
      t.body.length > 6000
    )
      throw Error("Invalid or duplicate message template.");
    ids.add(t.id);
  }
  const ruleIds = new Set<string>();
  for (const r of v.rules) {
    if (
      !r ||
      typeof r.id !== "string" ||
      !/^[a-z0-9_-]{1,40}$/.test(r.id) ||
      ruleIds.has(r.id) ||
      typeof r.name !== "string" ||
      !r.name.trim() ||
      r.name.length > 100 ||
      !["arrival", "departure"].includes(r.anchor) ||
      !Number.isInteger(r.offsetHours) ||
      Math.abs(r.offsetHours) > 168 ||
      !ids.has(r.templateId) ||
      typeof r.enabled !== "boolean"
    )
      throw Error(
        "Invalid SLA rule. Offsets must be whole hours within seven days.",
      );
    ruleIds.add(r.id);
  }
  return {
    templates: v.templates,
    rules: v.rules,
    completed: current.completed,
  };
}
