# Connected evidence development patch — 15 October 2026

## Changes

- Finance-reviewed, exact booking/document links and a current reconciliation worksheet. Drafts/cancellations, changed source versions, unallocated documents and discrepancies stay visible. No fuzzy allocation, cash-refund assertion, bank settlement certification or automatic approval.
- Separate owner identity/property permissions and an owner-only sign-in route (`#owner`). The GM previews and explicitly releases immutable apartment summaries; stale previews are rejected. Owners receive a strict summary projection, never staff workspace data. Revocation, withdrawal and internal source snapshot protection are tested.
- Three supported GM questions across tomorrow's operations, readiness gaps and posted accounting records. Every fact carries inspectable, company-scoped source references and versions. No unsupported open-ended AI answer or automatic action.
- PMS recovery adapter contract with safe retry, bounded windows/paging, preserved failed attempts, cancellation and mapping recovery. Duplicate booking IDs and conflicting equal-timestamp updates are rejected.
- Read-only Odoo collection validates date windows and in-flight cancellation. Odoo remains disconnected; no vendor API has been assumed or accounting writes enabled.

## Validation

82 checks passed locally: 68 root tests (including three actual disposable PostgreSQL checks), 13 browser checks and one production smoke test. No root tests were skipped in the final full database-enabled run. Additional targeted runs cover property/company owner isolation and booking recovery after mapping correction.

`npm run check` passed structure checks, TypeScript validation, all root tests, production build and production smoke. Browser tests passed separately. Actual PostgreSQL checks cover concurrent invitations, restricted runtime privileges for immutable owner releases, and a real synthetic dump/restore. Synthetic owner-preview and management-evidence screens were visually inspected. The build retains its existing large JavaScript bundle warning.

Test records are explicitly simulated. They do not establish that the client's Firebase MFA, Google Cloud project, Odoo instance, bank statements, booking channels or native PMS connection passed live acceptance.

## Release status and remaining work

Development branch only; no automatic merge or public deployment. Migration 009 requires the migration identity and the added restricted-role grants documented in [Staging](../reference/STAGING.md). Existing migrations 001–008 are unchanged.

The user has confirmed no PMS is selected. A native connector and a scheduled durable recovery worker remain externally dependent. Odoo hosting/version/entitlement/credentials are still unknown; keep it disconnected. Owner accounts require identity administrator provisioning and real MFA/privacy acceptance. Reconciliation supports only whole documents; Finance must approve and extend rules for split/partial/multiple-booking invoices, tax, commissions and actual cash settlement. Management questions are a bounded record-backed first version, not general AI chat.

Google Cloud deployment access remains a separate unresolved prerequisite. A local build, passing tests or a GitHub PR does not mean the public website was deployed.

See [the operating guide and live acceptance gates](../reference/CONNECTED-EVIDENCE.md).
