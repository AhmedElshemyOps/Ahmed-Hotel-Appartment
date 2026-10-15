# Connected records, Finance review and owner reports

This development patch builds independently testable functionality for roadmap items 11–15. It does **not** claim that a native PMS, live Odoo, owner identity provider or cloud deployment has passed acceptance.

## Current scope

| Roadmap item | Available in this patch | Still required |
| --- | --- | --- |
| 11: real PMS | Signed normalized intake already existed. New recovery adapter contract replays a bounded source-update window; retries, duplicate IDs, cancellations and equal-timestamp conflicts are checked. | No PMS selected. Install and verify its actual adapter, access rights, field/unit/channel mappings, cancellation semantics, polling/webhook delivery, durable recovery scheduling and monitoring. |
| 12: read-only Odoo | Existing version-specific read request planners and CSV stay available. The page collector additionally rejects invalid date windows and cancellation after an in-flight response. | Administrator discovery, API entitlement, authorized read-only technical user, version-specific transport, model/field normalization and real company reconciliation. Connection remains disconnected; no accounting write route is introduced. |
| 13: reservation/accounting reconciliation | GM/Finance can explicitly link one whole accounting document to one source booking, inspect differences, unlink with an audit reason, and see unallocated/orphan records. | Finance-approved tax, fee, partial allocation, shared settlement, payment direction, actual cash refund and bank settlement rules. No automatic fuzzy matching or final reconciliation approval. |
| 14: owner portal | Separate verified identity + MFA route, property grants by verified email, approved immutable apartment summaries, withdrawal and access revocation. | Authorized identity administrator provisions owner identities; staging identity/MFA/privacy tests, cloud hosting, retention and recovery acceptance. No self-service owner signup or owner invitations are added. |
| 15: management questions | Three supported questions use current operational, readiness and accounting records, with source references, versions and an inspect-source action. | Open-ended language-model questions, independent accuracy evaluation, stronger financial analysis and verified live source freshness. Unsupported questions are rejected. |

## Where to find it

Company GM: **Connected records & evidence**, or Management Centre → Connected records. Finance: Connected records & evidence → Reconciliation. The demo Management Centre shows a disconnected description and cannot create real links, owner access or reports.

Owner: open the same company app with `#owner`, then sign in using the separate account and authenticator. This uses the existing identity provider. Owners have no staff seat and cannot fetch the company workspace. Staff identities are refused by the owner route. An owner can be authorized for several apartments and companies; only approved reports for those grants are returned.

### Finance workflow

1. Import and accept validated accounting records through the existing Accounting Centre. Import reservations through the existing validated flow while no native PMS is selected.
2. Load reconciliation sources, choose the accounting connection and review differences.
3. Select the document and exact source booking, choose invoice/refund/commission/settlement, and record the evidence and accounting scope. Reauthentication with MFA within ten minutes is required to link/unlink.
4. One document can have only one booking allocation. Correct a link by removing it with an audit reason, then create a new reviewed link. Both actions are retained in the audit trail.
5. Document/booking versions are captured when linking. Subsequent source changes produce a review warning. Draft/cancelled documents are excluded; their evidence stays visible.

All amounts use integer cents internally. Invoice/credit-note totals can include tax while booking room estimates exclude tax: differences are flagged, not automatically explained away. A credit note is not proof of a cash refund. A payment record is not proof of a net bank settlement or its direction. Zero differences still require review. Journal balance is never treated as evidence that a booking has been financially reconciled. The worksheet is current-state; it is not an immutable Finance-approved reconciliation statement.

### Owner workflow

1. The authorized identity administrator provisions a separate owner account in the selected Firebase/Identity Platform environment. The email must be verified, the account enabled and MFA completed for access. No credentials belong in source code.
2. GM uses the verified email and apartment to grant access. The server resolves identity; the user never types an internal identity ID. Fresh MFA is required.
3. GM chooses apartment/report period/date and previews the values. Approval is explicit. If booking records changed since the preview, approval is rejected until previewed again.
4. The server stores an immutable summary and its internal source snapshot/hash. Owner responses use a strict summary projection: no guest identity, source booking arrays, internal notes, private file references or other apartments. Synthetic booking data is labelled synthetic.
5. GM can withdraw a release permanently or revoke an apartment grant. Subsequent reads honor revocation/withdrawal. Previously downloaded or displayed copies cannot be recalled. Owner report history above 100 active authorized releases fails explicitly pending pagination; GM lists the newest 100 releases.

Owner summaries contain recorded stay-night room revenue, commission, after-commission revenue and occupied nights for the period and its predecessor. They are **management estimates, not reconciled owner statements, audited profit or amounts payable to owners**. Source history is internal; owners receive approved summaries only. No owner notifications are sent automatically.

### Management questions

Supported questions:

- Tomorrow's recorded arrivals/departures and guest-service deadlines, with task status.
- Apartment readiness review status and counts of legal, operating and commercial gaps, with overdue tasks. Private-file availability is rechecked. This does not certify legal compliance.
- Posted accounting document totals/outstanding values, for a selected authorized connection. This does not sum payments as revenue or infer profit.

Each answer records generation time, workspace revision and evidence versions. Inspect source retrieves the **current** record; compare versions because it may have changed since the answer. No supporting facts means missing evidence, not a clean bill of health. More than 500 facts fails explicitly; date filtering/pagination remains future work. There is no external model call, arbitrary SQL or automatic management action.

## Implementation map

- `migrations/009_connected_evidence.sql`: explicit Finance links, separate owner-property permissions and immutable owner releases.
- `server/features/connected-evidence/routes.ts`: company-scoped workflows, MFA/role checks, approval and owner-only response projection.
- `src/features/connected-evidence/`: user screens, owner summaries and current reconciliation calculations.
- `server/integrations/pms/recovery.ts`: provider-neutral read-only recovery contract, not a vendor implementation.
- `server/integrations/pms/webhook.ts`: existing signed event application plus duplicate and conflicting timestamp protection.
- `server/integrations/accounting/adapters.ts`: version-dependent read-only planning and bounded validated collection.
- `tests/connected-evidence.test.ts`, `tests/browser/connected.spec.ts`, `tests/postgres-rehearsal.test.ts`: labelled synthetic tests and real disposable database checks.

Apply migration 009 using the migration identity. Follow the added least-privilege grants in [Staging](STAGING.md). The runtime must not own the schema or have UPDATE/DELETE rights over owner report content. The trigger also protects internal source snapshots and prevents reactivating withdrawn reports.

No new API key is required for independent tests. Live company operation still requires the existing database, Firebase/Identity Platform, HTTPS, secret handling and staging acceptance. Public deployment remains separately blocked by the Google project's Cloud Run enablement permissions.

## Live acceptance gates

PMS: select provider and document authorized API; prove source-company scoping and mappings with actual test bookings; compare complete source totals; test duplicates, missed events/backfill, out-of-order and same-timestamp conflicts, cancellations, corrections, outages and replay. Persist provider-specific cursor/watermark only after complete success. Never remove bookings merely because they were absent from a partial page. The new recovery helper never advances a watermark and may have committed earlier pages before a later failure: retry the full same window and attempt ID. A validation failure is retained under its event ID; after correcting unit/channel mappings, use a new named `attemptId` to re-evaluate the same source window without erasing the failed attempt. Source APIs must return all corrections/cancellations; hard deletions require an explicitly designed tombstone/full reconciliation workflow.

Odoo: administrator confirms host/version/subscription/company permissions, read-only credential, supported models/fields and tax/currency/allocation semantics. Normalize and compare authoritative totals in a controlled period, including revisions, credits, cancelled entries, paging, outages and recovery. Do not change the database's disconnected constraint before completing a separately reviewed live connector. Never enable accounting writes.

Finance: approve definitions with actual booking and accounting examples, including fees/taxes, refunds, commission credits, partial/multi-booking invoices and net settlements. Until allocation semantics are implemented, handle these cases outside the whole-document pilot and record the limitation.

Owners: test two real owner identities and two companies; direct endpoint attempts must not expose other properties or staff workspace; verify MFA, revoked/disabled identity tokens, email changes, permission revocation, withdrawal, original snapshot stability and backups. Identity setup is deliberately separate from the ten internal staff seats.

Questions: independently check source references and every numeric answer against controlled records; verify unknown/empty/stale inputs, company boundaries and source updates. Open-ended AI remains future work.
