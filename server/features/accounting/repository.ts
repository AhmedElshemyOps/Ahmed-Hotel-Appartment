import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { HttpError, type Actor } from "../../auth/permissions";
import type { AccountingDocument } from "../../../src/features/accounting/model";
export async function access(db: PoolClient, a: Actor) {
  const m = (
    await db.query(
      "SELECT role FROM memberships WHERE organization_id=$1 AND uid=$2 FOR SHARE",
      [a.organization_id, a.uid],
    )
  ).rows[0];
  if (
    !m ||
    m.role !== a.role ||
    !["General Manager", "Finance Manager"].includes(m.role)
  )
    throw new HttpError(
      403,
      "Accounting access requires a current GM or Finance Manager seat.",
    );
}
export async function connection(db: PoolClient, a: Actor, id: string) {
  await access(db, a);
  const r = (
    await db.query(
      "SELECT * FROM accounting_connections WHERE organization_id=$1 AND id=$2 FOR UPDATE",
      [a.organization_id, id],
    )
  ).rows[0];
  if (!r) throw new HttpError(404, "Accounting connection not found.");
  return r;
}
export async function log(
  db: PoolClient,
  a: Actor,
  id: string,
  operation: string,
  status: string,
  message: string,
  details: unknown = {},
) {
  const key = randomUUID();
  await db.query(
    "INSERT INTO accounting_sync_logs(id,organization_id,connection_id,actor_uid,operation,status,message,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [key, a.organization_id, id, a.uid, operation, status, message, details],
  );
  await db.query(
    "INSERT INTO audit_events(organization_id,actor_uid,action,target,details) VALUES($1,$2,$3,$4,$5)",
    [
      a.organization_id,
      a.uid,
      "accounting." + operation,
      key,
      { connectionId: id, status, ...(details as object) },
    ],
  );
}
export async function loadAccounting(db: PoolClient, a: Actor, id: string) {
  await connection(db, a, id);
  const documents = (
    await db.query(
      "SELECT * FROM accounting_documents WHERE organization_id=$1 AND connection_id=$2 ORDER BY posting_date,external_id LIMIT 5001",
      [a.organization_id, id],
    )
  ).rows;
  const lines = (
    await db.query(
      "SELECT * FROM accounting_lines WHERE organization_id=$1 AND connection_id=$2 ORDER BY external_id LIMIT 50001",
      [a.organization_id, id],
    )
  ).rows;
  if (documents.length > 5000 || lines.length > 50000)
    throw new HttpError(
      422,
      "Accounting pilot limit reached. Add server pagination before expanding this ledger; no results are silently truncated.",
    );
  return documents.map((d) => ({
    externalId: d.external_id,
    companyId: "",
    type: d.document_type,
    number: d.number,
    postingDate:
      d.posting_date instanceof Date
        ? d.posting_date.toISOString().slice(0, 10)
        : String(d.posting_date).slice(0, 10),
    currency: d.currency,
    status: d.status,
    sourceUpdatedAt: new Date(d.source_updated_at).toISOString(),
    partnerName: d.partner_name,
    total: Number(d.total),
    outstanding: Number(d.outstanding),
    lines: lines
      .filter((l) => l.document_id === d.external_id)
      .map((l) => ({
        externalLineId: l.external_id,
        accountCode: l.account_code,
        accountClass: l.account_class,
        dimensionKey: l.dimension_key,
        debit: Number(l.debit),
        credit: Number(l.credit),
        description: l.description,
      })),
  })) as AccountingDocument[];
}
