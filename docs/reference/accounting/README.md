# Universal accounting layer — Odoo prepared, disconnected

## Current operating modes

- **Cloud:** Finance Manager and GM can view a company-scoped normalized ledger, preview/accept authorized CSV exports, review mappings, inspect invoice/bill/payment/expense records, review arithmetic reconciliation and read evidence-based financial findings. Sensitive writes to this app's configuration/imports/mappings require a recent MFA sign-in. No write is ever sent to an accounting system.
- **Synthetic demonstration:** 40 fictional units, 121 labeled invoice/bill/payment/expense fixtures, unit/building mappings and fixed September 2026 examples. Nothing is imported into cloud storage. These are not real financial results.
- **Live Odoo:** disconnected by design. Database constraints permit only `status=disconnected` and `read_only=true`; no live transport, secret resolution, scheduler or authorized connection is mounted. The readiness-check action logs a blocked status and lists prerequisites. It does not silently pretend to synchronize.

## Administrator setup

In **Odoo Accounting & Financial Intelligence → Connection setup**, save a disconnected source. Hosting, version and protocol may remain unknown. Enter the externally supplied accounting company ID and a label. Endpoint is optional and must be a clean HTTPS base URL. Credentials never go in this form: only a Secret Manager resource reference may be stored. Configuration is server-side, and GET responses hide the secret resource reference. No secret is fetched or transmitted to Odoo in this increment. Source company/provider/endpoint cannot be reassigned once previews/imports exist; this preserves ledger provenance. A new source is required for a different accounting environment.

The version-specific request planners in `server/integrations/accounting/adapters.ts` construct only allowlisted `search_read` requests for `account.move`, `account.move.line`, `account.payment` and `hr.expense`; they cannot dispatch arbitrary write methods. These are **draft request plans**, not tested native Odoo connectors. The generic read-only adapter contract supports discovery, normalized pages, cancellation checks, repeated-cursor rejection, company/period constraints and an explicit page cap. It is exercised with injected simulated adapters only. Missing version, API entitlement, models/fields or normalization cannot be guessed.

Official sources: [Odoo external JSON-2 API](https://www.odoo.com/documentation/master/developer/api/external_api.html) identifies JSON-2 as new in version 19 and describes external API plan restrictions. [Odoo 18 external API](https://www.odoo.com/documentation/18.0/developer/reference/external_api.html) documents legacy RPC authentication and `execute_kw` read methods. Verify actual hosting, subscription and custom modules before choosing either. A protocol selection in this app is not entitlement verification.

## CSV import contract

Download the **blank CSV template** in the accounting tab. There are deliberately no fake cloud accounting rows in the template. Export/transform the authorized company's records into one row per journal line with exact headers:

```text
externalId,companyId,type,number,postingDate,currency,status,sourceUpdatedAt,partnerName,total,outstanding,externalLineId,accountCode,accountClass,dimensionKey,debit,credit,description
```

- Repeat identical document metadata for every line. Use stable source document and source journal-line IDs, not display numbers as identity. A source line can belong to only one document per connection.
- `type`: invoice, supplier_bill, payment, expense, journal, credit_note or supplier_credit. `status`: draft, posted or cancelled. Dates are valid ISO `YYYY-MM-DD`; the source update is an ISO timestamp with timezone.
- AED only, no implicit FX. Amounts are nonnegative, at most two decimals; no thousands separators, formulas, NaN or negative debit/credit values. A line cannot have both debit and credit. Reversals use the proper debit/credit side and credit-note document type.
- `accountClass`: revenue, expense or balance. Map accounts using reviewed company accounting policy. VAT/receivable/payable/cash/bank lines are normally balance, with no invented tax treatment. Classifications are accepted source declarations reviewed by Finance, not independently discovered facts.
- Supply an analytic/property `dimensionKey` for attributed lines. Map that exact key to a registered apartment or an explicitly identified building. Shared building costs remain building-level; unallocated lines remain visible. Multiple analytic allocations must be normalized upstream with stable, nonoverlapping allocated-line IDs whose amounts reconcile; native Odoo analytic percentage normalization is not installed.
- `total` is the source document total; `outstanding` is the source-reported residual and cannot exceed total. It is not calculated by matching imported payments. Metadata totals are displayed, not falsely reconciled against bank statements.
- Declare the export period and partial/period-export coverage. Every document must lie within that period. A declared full-period export does not establish independent completeness. Files are limited to 1.5 MB / 10,000 rows; packets to 2,000 documents and 2,000 lines per document.

Preview displays every normalized document and line. Review company, dates, account classes and amounts, then explicitly accept. The preview expires after 30 minutes or a connection configuration change. Commit is transactional, idempotent and revision-aware. Same source records are unchanged; newer corrections replace current lines and append immutable history. Older or conflicting equal-timestamp updates fail the entire transaction. Omitted documents are not deleted. Import explicit newer cancellation records to supersede source cancellations. CSV user review provides provenance, not cryptographic authenticity of an external accounting export.

## Financial methodology and reconciliation

Only posted documents whose debit/credit cents balance contribute to analysis. Draft, cancelled or unbalanced documents remain visible as exceptions. Revenue is credits minus debits on revenue lines; expenses are debits minus credits on expense lines. Refunds/reversals therefore reduce the appropriate amount. Contribution is imported revenue minus imported expenses, not audited net profit. Payment document totals are informational and never added to revenue; payment records with P&L-classified lines are excluded pending normalization review. VAT/balance-sheet entries are excluded from contribution.

Reports are selected by posting date and one accounting connection. Do not combine duplicate exports of the same ledger in separate connections. Account classifications, shared costs, coverage and analytic allocation need independent Finance review. Missing sources, payroll, accruals, depreciation, allocations or FX cannot be treated as zero cost. Occupancy, ADR and RevPAR are not inferred from accounting invoices; reservation-to-ledger reconciliation remains a separate future integration.

The financial assistant is deterministic: its findings carry source document IDs and explicit limitations. It does not call a live LLM, invent transactions, claim causal savings or certify financial results. Arithmetic journal checks and imported outstanding balances are available; bank reconciliation, settlement matching, invoice-payment allocation, statement/trial-balance comparison and statutory accounting validation are not implemented.

## Database and security

Migration `006_accounting.sql` adds connections, dimensions, normalized current documents/lines, immutable document versions, reviewed import previews and sync/audit logs. All keys/queries are scoped by organization and connection. Only current GM/Finance memberships pass server authorization; no Revenue Manager or viewer access is implied. Transactions serialize connection changes and imports. Unit mapping is checked against the actual company unit registry. Server totals explicitly reject the pilot cap above 5,000 documents / 50,000 lines rather than silently truncating.

Runtime role additions (migration owner is separate):

```sql
GRANT SELECT,INSERT,UPDATE ON accounting_connections,accounting_imports,accounting_documents TO ahq_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON accounting_lines TO ahq_runtime;
GRANT SELECT,INSERT,DELETE ON accounting_mappings TO ahq_runtime;
GRANT SELECT,INSERT ON accounting_document_history,accounting_sync_logs TO ahq_runtime;
GRANT USAGE,SELECT ON SEQUENCE accounting_document_history_id_seq TO ahq_runtime;
```

Existing audit insert and membership/workspace permissions remain required. Do not grant history/audit update/delete. Source URLs/secret references are not credentials; use Secret Manager IAM, rotation and logs when a real resolver is later added. Configure retention for preview packets, partner names and financial history before real customer imports. No bank account/guest ID collection is needed by this schema.

## Live acceptance checklist — blocked by administrator environment details

1. Confirm hosting, exact version, company IDs, currency, custom modules, subscription and API entitlement with authorized administration.
2. Discover installed models/fields and available API using the approved host; do not presume either JSON-2 or RPC exists. Confirm multi-company scoping and source permissions with a dedicated read-only technical user.
3. Provision credentials securely with rotation, minimal secret-reader IAM and administrator connection approval. Never send them in chat or repository files.
4. Implement the selected transport and field/account/analytic/tax/refund normalization against actual fixtures. Enforce host allowlisting, DNS/IP SSRF controls, redirect rejection, timeouts, payload/page quotas and secret-safe error logging before any live network call.
5. Test read-only ACLs, pagination, changes during collection, update/deletion/cancellation reconciliation, retries, checkpointing, overlap windows and stale data alerts. Staging must prove no accounting mutation method can be called.
6. Reconcile authorized period exports against invoices, supplier bills, payments, GL/trial balances and bank/settlement statements with Finance. Record coverage and unresolved differences.
7. Run security/retention review, backup/restore and two-client production PostgreSQL concurrency tests. Obtain administrator approval before enabling a separately reviewed live path.
