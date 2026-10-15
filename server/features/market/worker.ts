import type { Pool } from "pg";
import type { MarketQuery } from "../../../src/features/market/model";
import { transaction } from "../../db/transaction";
import { activeSource, validatePacket, ingestPacket } from "./repository";
// A connector must be implemented against a purchased, authorized provider contract.
// No generic website fetcher or scraping fallback is installed.
export interface MarketConnector {
  collect(
    query: MarketQuery,
    context: {
      organizationId: string;
      propertyId: string;
      sourceId: string;
      signal: AbortSignal;
    },
  ): Promise<unknown>;
}
export type ConnectorRegistry = ReadonlyMap<string, MarketConnector>;
export async function runMarketWorkerOnce(
  pool: Pool,
  connectors: ConnectorRegistry = new Map(),
) {
  const claimed = await transaction(pool, async (db) => {
    await db.query(
      "UPDATE market_research_jobs SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'retry' END,result=$1 WHERE status='running' AND updated_at<now()-interval '5 minutes'",
      [
        {
          message:
            "Previous worker lease expired. Safe retry requires provider observation idempotency.",
        },
      ],
    );
    const row = (
      await db.query(
        "SELECT * FROM market_research_jobs WHERE kind='provider_collection' AND status IN ('queued','retry') AND next_attempt_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
      )
    ).rows[0];
    if (!row) return null;
    let source;
    try {
      source = await activeSource(
        db,
        row.organization_id,
        row.property_id,
        row.source_id,
      );
    } catch {
      await db.query(
        "UPDATE market_research_jobs SET status='blocked',result=$3,updated_at=now() WHERE organization_id=$1 AND id=$2",
        [
          row.organization_id,
          row.id,
          {
            message:
              "Source authorization expired or was revoked. No data was collected.",
          },
        ],
      );
      return { blocked: true, id: row.id };
    }
    if (!connectors.has(source.provider)) {
      await db.query(
        "UPDATE market_research_jobs SET status='needs_configuration',result=$3,updated_at=now() WHERE organization_id=$1 AND id=$2",
        [
          row.organization_id,
          row.id,
          {
            message:
              "No authorized live connector is installed for this source. Supply an approved feed or configure a licensed provider adapter.",
          },
        ],
      );
      return { missing: true, id: row.id };
    }
    await db.query(
      "UPDATE market_research_jobs SET status='running',attempts=attempts+1,updated_at=now() WHERE organization_id=$1 AND id=$2",
      [row.organization_id, row.id],
    );
    return { ...row, provider: source.provider };
  });
  if (!claimed || claimed.missing || claimed.blocked) return claimed;
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let packet;
    try {
      packet = validatePacket(
        await Promise.race([
          connectors
            .get(claimed.provider)!
            .collect(claimed.payload, {
              organizationId: claimed.organization_id,
              propertyId: claimed.property_id,
              sourceId: claimed.source_id,
              signal: AbortSignal.timeout(30000),
            }),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(
              () => reject(new Error("Provider deadline exceeded")),
              30000,
            );
          }),
        ]),
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
    await transaction(pool, async (db) => {
      // Collection may prepare evidence, but only the GM's commit route can accept it as verified data.
      await activeSource(
        db,
        claimed.organization_id,
        claimed.property_id,
        claimed.source_id,
      );
      const p = (
        await db.query(
          "SELECT revision FROM market_properties WHERE organization_id=$1 AND id=$2 FOR UPDATE",
          [claimed.organization_id, claimed.property_id],
        )
      ).rows[0];
      await db.query(
        "UPDATE market_research_jobs SET kind='authorized_feed',status='preview',payload=$3,result=$4,updated_at=now(),created_at=now() WHERE organization_id=$1 AND id=$2",
        [
          claimed.organization_id,
          claimed.id,
          packet,
          {
            revision: p.revision,
            message:
              "Provider collection complete; General Manager verification required.",
          },
        ],
      );
    });
    return { id: claimed.id, status: "preview" };
  } catch {
    const attempts = claimed.attempts + 1;
    await pool.query(
      "UPDATE market_research_jobs SET status=$3,next_attempt_at=now()+($4*interval '1 second'),result=$5,updated_at=now() WHERE organization_id=$1 AND id=$2",
      [
        claimed.organization_id,
        claimed.id,
        attempts >= 3 ? "failed" : "retry",
        Math.min(3600, 30 * 2 ** attempts),
        {
          message:
            "Collection failed. Credentials, license, quota and provider response require review. No previous prices were marked fresh.",
        },
      ],
    );
    return { id: claimed.id, status: attempts >= 3 ? "failed" : "retry" };
  }
}
