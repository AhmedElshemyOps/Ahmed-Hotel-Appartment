import type {
  AccountingPacket,
  AccountingConnection,
} from "../../src/accounting/model";
/** No arbitrary RPC dispatcher or accounting mutation is exposed. Implementations must support only reads. */
export interface ReadOnlyAccountingAdapter {
  readonly provider: string;
  readonly readOnly: true;
  discover(signal: AbortSignal): Promise<{
    version: string;
    companies: { id: string; name: string }[];
    capabilities: string[];
  }>;
  readPage(input: {
    companyId: string;
    from: string;
    to: string;
    cursor?: string;
    signal: AbortSignal;
  }): Promise<{ packet: AccountingPacket; nextCursor?: string }>;
}
export const odooDiscoveryChecklist = [
  "Company administrator approval",
  "Hosting and exact version",
  "Subscription and API entitlement",
  "Read-only technical user and accounting company access",
  "Model and field discovery",
  "Currency, tax, analytic allocation and account classifications",
  "Paging, update watermark, cancelled entries and deletions",
  "Trial-balance and payment reconciliation fixtures",
];
export function plannedOdooRead(
  config: AccountingConnection,
  model:
    "account.move" | "account.move.line" | "account.payment" | "hr.expense",
  fields: string[],
  afterId = 0,
) {
  if (
    config.provider !== "odoo" ||
    config.protocol === "unknown" ||
    !config.endpoint ||
    !config.version
  )
    throw Error("Odoo version and API discovery are required.");
  if (
    ![
      "account.move",
      "account.move.line",
      "account.payment",
      "hr.expense",
    ].includes(model)
  )
    throw Error("Unsupported read model");
  if (
    !Number.isSafeInteger(Number(config.companyId)) ||
    Number(config.companyId) <= 0
  )
    throw Error("Discover a valid numeric Odoo company ID.");
  if (
    !fields.length ||
    fields.length > 100 ||
    fields.some((f) => !/^\w+$/.test(f))
  )
    throw Error("Use discovered field names.");
  const domain = [
    ["company_id", "=", Number(config.companyId)],
    ["id", ">", afterId],
  ];
  const kwargs = {
    domain,
    fields,
    limit: 200,
    order: "id asc",
    context: { allowed_company_ids: [Number(config.companyId)] },
  };
  if (config.protocol === "json2")
    return {
      protocol: "json2",
      path: "/json/2/" + model + "/search_read",
      method: "POST",
      body: kwargs,
      requires: [
        "version-specific field discovery",
        "API key supplied by server secret resolver",
      ],
    };
  return {
    protocol: config.protocol,
    path: config.protocol === "xmlrpc" ? "/xmlrpc/2/object" : "/jsonrpc",
    method: "execute_kw",
    model,
    modelMethod: "search_read",
    args: [domain],
    kwargs: { fields, limit: 200, order: "id asc", context: kwargs.context },
    requires: [
      "verified database name",
      "authenticated read-only user ID",
      "server secret resolver",
      "version-specific transport and response normalization",
    ],
  };
}
/** Adapter smoke helper. Never mounted as a live sync route without an installed authorized connector. */
export async function collectReadOnly(
  adapter: ReadOnlyAccountingAdapter,
  query: { companyId: string; from: string; to: string },
  signal: AbortSignal,
) {
  if (adapter.readOnly !== true) throw Error("Read-only connector required.");
  const pages: AccountingPacket[] = [];
  let cursor: string | undefined;
  const seen = new Set<string>();
  for (let page = 0; page < 100; page++) {
    if (signal.aborted) throw Error("Synchronization cancelled.");
    const result = await adapter.readPage({ ...query, cursor, signal });
    const packet = (
      await import("../../src/accounting/model")
    ).packetSchema.parse(result.packet);
    if (
      packet.companyId !== query.companyId ||
      packet.periodStart < query.from ||
      packet.periodEnd > query.to
    )
      throw Error(
        "Connector returned data outside the authorized company or period.",
      );
    pages.push(packet);
    if (!result.nextCursor) return pages;
    if (seen.has(result.nextCursor))
      throw Error("Connector repeated its pagination cursor.");
    seen.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  throw Error(
    "Synchronization page limit reached; nothing may be silently truncated.",
  );
}
