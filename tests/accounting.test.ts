import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { packetSchema, type AccountingDocument } from "../src/accounting/model";
import { accountingDemo } from "../src/accounting/demo";
import { financialAnalysis } from "../src/accounting/engine";
import { parseAccountingCsv, CSV_COLUMNS } from "../server/accounting/csv";
import {
  plannedOdooRead,
  collectReadOnly,
} from "../server/accounting/adapters";
import { marketFixture, apartments } from "./helpers/market";
import { createCloudRouter, HttpError } from "../server/cloud";
function docs() {
  const demo = accountingDemo(apartments.slice(0, 1));
  return demo.documents.map((d) => ({
    ...d,
    companyId: "1",
    externalId: d.externalId.replace("SIM-", "TEST-"),
    lines: d.lines.map((l) => ({
      ...l,
      externalLineId: l.externalLineId.replace("SIM-", "TEST-"),
    })),
  }));
}
function csvFor(documents: AccountingDocument[]) {
  const cell = (v: unknown) =>
    '"' + String(v ?? "").replaceAll('"', '""') + '"';
  return (
    CSV_COLUMNS.join(",") +
    "\n" +
    documents
      .flatMap((d) =>
        d.lines.map((l) =>
          CSV_COLUMNS.map((k) => cell(({ ...d, ...l } as any)[k])).join(","),
        ),
      )
      .join("\n")
  );
}
const config = {
  label: "Test disconnected source",
  provider: "odoo" as const,
  hosting: "unknown" as const,
  version: "",
  protocol: "unknown" as const,
  endpoint: "",
  companyId: "1",
  credentialSecretRef: "",
  discoveryNotes: "",
};
test("simulated accounting contains balanced invoices, bills, payments and expenses without double-counting payments", () => {
  const d = accountingDemo(apartments);
  packetSchema.parse({
    companyId: "SYNTHETIC-ONLY",
    simulated: true,
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    coverage: "partial",
    documents: d.documents,
  });
  const a = financialAnalysis(
    d.documents,
    d.mappings,
    "2026-09-01",
    "2026-09-30",
  );
  assert.equal(a.revenueAED, 400000);
  assert.equal(a.paymentDocumentTotalsAED, 420000);
  assert.equal(a.expenseAED, 88300);
  assert.equal(a.profitability.length, 41);
  assert.equal(a.exceptions.length, 0);
  assert.equal(a.profitability.at(-1)?.building, "Synthetic building A");
});
test("draft/unbalanced records are excluded, refunds reverse income, and unallocated costs stay visible", () => {
  const ds = docs();
  ds[1].status = "draft";
  ds[2].lines[0].debit = 1;
  const refund = structuredClone(ds[0]);
  refund.externalId = "refund";
  refund.type = "credit_note";
  refund.lines = refund.lines.map((l) => ({
    ...l,
    externalLineId: "refund-" + l.externalLineId,
    debit: l.credit,
    credit: l.debit,
  }));
  const a = financialAnalysis([...ds, refund], [], "2026-09-01", "2026-09-30");
  assert.equal(a.revenueAED, 0);
  assert.equal(a.excludedDocuments, 2);
  assert.equal(a.profitability[0].key, "unallocated");
  assert.equal(a.expenseAED, 500);
  assert.equal(a.paymentDocumentTotalsAED, 0);
});
test("CSV validation rejects mixed companies, foreign currency, source-line duplicates, conflicting metadata and formulas", () => {
  const records = docs();
  const meta = {
    companyId: "1",
    simulated: false,
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    coverage: "partial" as const,
  };
  assert.equal(parseAccountingCsv(csvFor(records), meta).documents.length, 4);
  const wrong = structuredClone(records);
  wrong[0].companyId = "other";
  assert.throws(
    () => parseAccountingCsv(csvFor(wrong), meta),
    /Mixed accounting/,
  );
  assert.throws(() =>
    parseAccountingCsv(csvFor(records).replaceAll('"AED"', '"USD"'), meta),
  );
  const duplicate = structuredClone(records);
  duplicate[1].lines[0].externalLineId = duplicate[0].lines[0].externalLineId;
  assert.throws(
    () => parseAccountingCsv(csvFor(duplicate), meta),
    /multiple documents/,
  );
  assert.throws(
    () =>
      parseAccountingCsv(csvFor(records).replace('"10500"', '"=100+10"'), meta),
    /Amounts/,
  );
  const conflicting = csvFor(records).split("\n");
  conflicting[2] = conflicting[2].replace('"10500"', '"10400"');
  assert.throws(
    () => parseAccountingCsv(conflicting.join("\n"), meta),
    /Conflicting document/,
  );
});
test("version-specific Odoo plans contain read-only methods and never assume an unknown API", async () => {
  assert.throws(
    () => plannedOdooRead(config, "account.move", ["id"]),
    /discovery/,
  );
  const json = plannedOdooRead(
    {
      ...config,
      version: "19 (fixture)",
      protocol: "json2",
      endpoint: "https://company.example.test",
    },
    "account.move",
    ["id", "write_date"],
  );
  assert.equal(json.path, "/json/2/account.move/search_read");
  assert.equal(JSON.stringify(json).includes("create"), false);
  const rpc = plannedOdooRead(
    {
      ...config,
      version: "18 (fixture)",
      protocol: "xmlrpc",
      endpoint: "https://company.example.test",
    },
    "account.move.line",
    ["id"],
  );
  assert.equal(rpc.modelMethod, "search_read");
  assert.throws(
    () =>
      plannedOdooRead(
        {
          ...config,
          version: "18",
          protocol: "jsonrpc",
          endpoint: "https://company.example.test",
        },
        "res.users" as any,
        ["id"],
      ),
    /Unsupported/,
  );
  const p = {
    companyId: "1",
    simulated: true,
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    coverage: "partial" as const,
    documents: docs(),
  };
  let count = 0;
  const result = await collectReadOnly(
    {
      provider: "simulated-test",
      readOnly: true,
      discover: async () => ({
        version: "simulated",
        companies: [],
        capabilities: ["read"],
      }),
      readPage: async () => ({
        packet: p,
        nextCursor: count++ === 0 ? "page2" : undefined,
      }),
    },
    { companyId: "1", from: "2026-09-01", to: "2026-09-30" },
    new AbortController().signal,
  );
  assert.equal(result.length, 2);
  await assert.rejects(
    () =>
      collectReadOnly(
        {
          provider: "simulated-test",
          readOnly: true,
          discover: async () => ({
            version: "simulated",
            companies: [],
            capabilities: [],
          }),
          readPage: async () => ({ packet: p, nextCursor: "repeat" }),
        },
        { companyId: "1", from: "2026-09-01", to: "2026-09-30" },
        new AbortController().signal,
      ),
    /repeated/,
  );
});
test("accounting API isolates companies, requires MFA, reviews imports, deduplicates, preserves corrections and remains disconnected", async () => {
  const f = await marketFixture({ ingest: false });
  const app = express();
  app.use(express.json({ limit: "3mb" }));
  app.use(
    "/api",
    createCloudRouter(f.pool, async (token) => ({
      uid: token === "finance" ? "finance" : token === "stale" ? "gm" : token,
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000) - (token === "stale" ? 700 : 0),
      firebase: { sign_in_second_factor: "totp" },
    })),
  );
  app.use((e: any, _q: any, r: any, _n: any) =>
    r
      .status(e instanceof HttpError ? e.status : 500)
      .json({ error: e.message }),
  );
  await f.db.query(
    "INSERT INTO memberships VALUES('finance','a',4,'Finance Manager')",
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base =
    "http://127.0.0.1:" + (server.address() as any).port + "/api/accounting";
  const call = (path = "", uid = "gm", body?: unknown) =>
    fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + uid,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  try {
    assert.equal((await call("", "viewer")).status, 403);
    assert.equal(
      (await call("/connections", "finance", { config })).status,
      403,
    );
    assert.equal((await call("/connections", "stale", { config })).status, 401);
    const created = await call("/connections", "gm", { config });
    assert.equal(created.status, 200);
    const { id } = await created.json();
    assert.equal(
      (await call("/" + id + "?start=2026-09-01&end=2026-09-30", "other"))
        .status,
      404,
    );
    assert.equal((await call("/" + id + "/sync", "gm", {})).status, 200);
    assert.equal(
      (await (await call("/" + id + "/sync", "gm", {})).json()).status,
      "blocked",
    );
    const data = docs();
    const preview = async (ds = data) => {
      const r = await call("/" + id + "/imports/preview", "finance", {
        csv: csvFor(ds),
        fileName: "AUTHORIZED-TEST-FIXTURE.csv",
        periodStart: "2026-09-01",
        periodEnd: "2026-09-30",
        coverage: "partial",
      });
      assert.equal(r.status, 200);
      return r.json();
    };
    const p = await preview();
    assert.equal(p.packet.documents.length, 4);
    assert.equal(
      (
        await call("/" + id + "/imports/" + p.id + "/commit", "finance", {
          reviewConfirmed: false,
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await call("/" + id + "/imports/" + p.id + "/commit", "finance", {
          reviewConfirmed: true,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await (
          await call("/" + id + "/imports/" + p.id + "/commit", "finance", {
            reviewConfirmed: true,
          })
        ).json()
      ).replayed,
      true,
    );
    assert.equal(
      (await f.db.query("SELECT external_id FROM accounting_documents")).rows
        .length,
      4,
    );
    assert.equal(
      (
        await call("/" + id + "/mappings", "finance", {
          mappings: [
            {
              dimensionKey: "SIM-UNIT-101",
              unitId: "wrong-company-unit",
              building: "A",
            },
          ],
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await call("/" + id + "/mappings", "finance", {
          mappings: [
            {
              dimensionKey: "SIM-UNIT-101",
              unitId: "u0",
              building: "Reviewed building",
            },
          ],
        })
      ).status,
      200,
    );
    let ledger = await (
      await call("/" + id + "?start=2026-09-01&end=2026-09-30", "finance")
    ).json();
    assert.equal(ledger.analysis.revenueAED, 10000);
    assert.equal(ledger.analysis.expenseAED, 2500);
    assert.equal(ledger.analysis.profitability[0].unitId, "u0");
    assert.equal(ledger.status, "disconnected");
    const same = await preview();
    const unchanged = await (
      await call("/" + id + "/imports/" + same.id + "/commit", "finance", {
        reviewConfirmed: true,
      })
    ).json();
    assert.equal(unchanged.unchanged, 4);
    const corrected = structuredClone(data);
    corrected[0].status = "cancelled";
    corrected[0].sourceUpdatedAt = "2026-10-02T00:00:00Z";
    const corr = await preview(corrected);
    assert.equal(
      (
        await call("/" + id + "/imports/" + corr.id + "/commit", "finance", {
          reviewConfirmed: true,
        })
      ).status,
      200,
    );
    const older = await preview(data);
    assert.equal(
      (
        await call("/" + id + "/imports/" + older.id + "/commit", "finance", {
          reviewConfirmed: true,
        })
      ).status,
      409,
    );
    ledger = await (
      await call("/" + id + "?start=2026-09-01&end=2026-09-30", "finance")
    ).json();
    assert.equal(ledger.analysis.revenueAED, 0);
    assert.equal(ledger.analysis.excludedDocuments, 1);
    assert.equal(
      (await f.db.query("SELECT id FROM accounting_document_history")).rows
        .length,
      5,
    );
    const sim = await preview();
    await f.db.query("UPDATE accounting_imports SET packet=$2 WHERE id=$1", [
      sim.id,
      { ...sim.packet, simulated: true },
    ]);
    assert.equal(
      (
        await call("/" + id + "/imports/" + sim.id + "/commit", "finance", {
          reviewConfirmed: true,
        })
      ).status,
      422,
    );
    await assert.rejects(() =>
      f.db.query(
        "UPDATE accounting_connections SET status='connected' WHERE id=$1",
        [id],
      ),
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await f.db.close();
  }
});
