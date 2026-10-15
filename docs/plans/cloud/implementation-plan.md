> Historical source assessment before this feature branch. Statements about no repository changes/tests describe that assessment only; see README.md for current implementation and validation.

# Ahmed Quality Ops — secure cloud implementation plan

Assessment date: 15 October 2026. Scope: online-only application for one General Manager and up to nine additional team users, Google Workspace connections, and evidence-based management intelligence.

## 1. Recommendation and assessment boundaries

Retain the React interface and the useful pure calculation functions. Replace browser-owned records, simulated permissions, and temporary approvals with an authenticated server and a transactional database. Build a modular application with background workers; microservices are unnecessary for ten users. Establish trustworthy data and security before expanding AI features.

This is a read-only source assessment, not a penetration test or a certification of the running application. No repository files, branches, infrastructure, account settings, or deployments were changed. No dependencies were installed and no build, runtime, integration, or security tests were executed. Findings below are established by inspected source; proposed tests are future release gates. The earlier conversation was treated as product context, not proof of implemented capabilities.

Inspected feature head: `57228e646aedfe3b095f8a478222f464dc0699f6`; main snapshot: `8c727008c75ad2f42d24a1ca48daf7658ba948d9`. GitHub comparison reports feature is eight commits ahead and one behind main, with six changed paths in the comparison. The main-only commit is a merge of executive-management phase 1; do not assume its fixes are missing from feature merely from the behind count. Compare actual content and reconcile in a separate working branch, preserving both sets of fixes.

Repository evidence links below are pinned to the inspected feature commit. The complete tree contains no test files, database migrations, CI workflow, deployment manifest, or AGENTS.md. Existing `docs/plans/executive-management-plan.md` correctly describes its work as foundation in progress.

## 2. Existing code: retain, repair, replace

| Area | What is implemented | Gap and consequence |
|---|---|---|
| Application | React/TypeScript/Vite interface with dashboards, apartments, reservations, operations, finance, reports and imports | `App.tsx` owns data, roles and approval state. No authenticated session boundary. |
| Backend | Express health endpoint and Gemini chat endpoint | No authentication, MFA, RBAC, membership service, database, integration endpoints or durable audit. Anonymous callers can trigger configured model usage. |
| Roles | Eight role labels, role matrix, header/settings role switchers | Presentation only. Browser starts as General Manager; no enforced ten-user limit or unique GM. |
| Real data | Browser storage and reservation CSV parsing/preview | Shared cloud records, concurrency and durable recovery absent. First run silently creates 40 units with assumed configuration and marks them real. |
| Property intelligence | Unit contribution/risk, channel totals, recorded budget comparison, health score and scenario calculator | Useful foundations, but estimates and incomplete records cannot support audited-profit claims. |
| Specialists | Deterministic findings with evidence IDs, limitations and approval markers | These are rule-based analyses, not autonomous coordinated agents. Source completeness and durable workflow absent. |
| AI chat | API key stays server-side; unverified client context is no longer promoted to verified facts; safe unavailable-data fallback | Model has no trusted property retrieval path. System prompt still hardcodes 40 units and example incidents. Output constraints are prompt instructions, not enforced evidence validation. |
| Reports | Browser print and CSV export | No immutable report version, financial sign-off, access-controlled report delivery or publication audit. |

Evidence: [application state](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/57228e646aedfe3b095f8a478222f464dc0699f6/src/App.tsx), [server](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/57228e646aedfe3b095f8a478222f464dc0699f6/server.ts), [settings](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/57228e646aedfe3b095f8a478222f464dc0699f6/src/components/SettingsView.tsx), [storage/import engine](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/57228e646aedfe3b095f8a478222f464dc0699f6/src/data/realDataManager.ts), [package scripts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/57228e646aedfe3b095f8a478222f464dc0699f6/package.json).

### Release blockers, in priority order

1. **P0 — Identity and authorization:** protect all data, chat, exports and mutation endpoints. Remove production role switching. Never accept a role or actor ID supplied by the browser as authority.
2. **P0 — Browser storage:** move real records and import history to server storage. Current records are editable by the browser and unavailable to colleagues on another device. Do not automatically migrate unknown local records as trusted data.
3. **P0 — Demo leakage:** `generateAgentRecommendations()` returns fixed recommendations and coordination stories with `isDemo: true`; `App.tsx` calls it for both operating modes. Isolate demo in a separate environment and block demo records from production findings and owner reports.
4. **P0 — False rollback:** `handleRollbackImport()` marks history “Rolled Back” but leaves reservations in the active dataset. Replace with transactional batch attribution and genuine reversal semantics.
5. **P1 — Financial consistency:** KPI arithmetic checks only prove internal identities, not reconciliation to invoices, bank records or a ledger. Remove “strict GAAP & USALI compliance” and audited/reconciled labels unless independently substantiated. Standardize commission treatment, tax exclusions, refunds and shared costs.
6. **P1 — Dates and completeness:** “LAST_30_DAYS” maps to all of October 2026; specialists use a fixed October period and a UTC business date. Real housekeeping/utilities arrays are empty. A missing feed must produce “unavailable,” never a successful operational condition.
7. **P1 — Durable approvals:** current recommendation statuses are React state and reset when recommendations regenerate. `transitionAction()` accepts any nonempty actor ID and checks transition sequence only. Put role, scope, version and evidence validation in the server transaction.
8. **P1 — Production operation:** add repeatable installation/build/typecheck/tests, production start smoke test, migrations, backups, monitoring and incident procedures. Production static serving uses `__dirname` while the package declares ESM; verify and resolve its runtime behavior rather than assuming Vite build proves the server starts.

Evidence: [legacy agent engine](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/57228e646aedfe3b095f8a478222f464dc0699f6/src/data/agentEngine.ts), [KPI engine](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/57228e646aedfe3b095f8a478222f464dc0699f6/src/data/kpiEngine.ts), [executive services](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/57228e646aedfe3b095f8a478222f464dc0699f6/src/services/executiveIntelligence.ts).

### Specific calculation repairs

- KPI out-of-order nights are summed without clipping dates or merging overlapping outages; the source contains a production TODO. Available nights currently use units × days. Approve the sellable-inventory denominator policy, maintain daily availability intervals, and prevent double counting or occupancy above capacity.
- ALOS divides period occupied nights by period completed stays, mixing cohorts. Define completed-stay ALOS separately from in-period occupancy.
- Complaint timestamps are compared directly to a date-only end boundary; end-day timestamped complaints can be excluded. Use property business dates or half-open timestamp intervals.
- Missing budgets and denominators often become zero. Use nullable metrics plus a reason and coverage percentage; distinguish zero from unknown.
- Unassigned transactions are included for every unit/type filter in the KPI engine while budgets are scaled by unit count. Introduce explicit allocation policy and an unallocated bucket; never imply this is unit profit.
- Unit contribution uses estimated commissions; missing rates default to zero. Actual channel commission totals, when supplied, cover full bookings while gross is clipped to period nights. Choose a documented nightly/accrual allocation and reconcile invoices.
- `compareApprovedBudget()` groups by category without separating transaction type, and the schema has no actual budget approval/version record. Separate income and expense comparisons; select an approved immutable budget version.
- Specialist channel findings use whole-booking totals for bookings overlapping the period, unlike unit calculations. Route every view and specialist through one canonical metric engine.
- Health dimensions have empty evidence arrays, ad hoc scoring and fixed missing finance/action dimensions. Show completeness and component evidence; do not market the composite as validated predictive risk.
- Reservation import strips nonnumeric characters, potentially turning a negative rate positive, infers commissions from channel, assigns every imported reservation “Completed,” and uses a line-based CSV parser that cannot reliably handle multiline quoted fields. Replace with strict schemas, explicit mappings and a maintained parser.

Evidence: [property calculations](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/57228e646aedfe3b095f8a478222f464dc0699f6/src/services/propertyIntelligence.ts), [specialists](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/57228e646aedfe3b095f8a478222f464dc0699f6/src/services/specialistAgents.ts), [intelligence UI](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/57228e646aedfe3b095f8a478222f464dc0699f6/src/components/PropertyIntelligenceView.tsx).

## 3. Target architecture

Recommended deployment shape, subject to region, budget and provider validation:

```text
Browser → HTTPS application / server API → PostgreSQL
                     │                      │
                     ├→ managed identity    └→ versioned evidence / audit
                     ├→ private object storage
                     └→ transactional outbox → background workers
                                                ├→ Google APIs
                                                ├→ scheduled metric snapshots
                                                └→ AI interpretation + claim validation
```

Use the existing React application and a modular TypeScript backend. Suggested modules: identity/memberships, property operations, finance, imports, integrations, intelligence, actions/approvals and reports. Keep pure domain calculations independent of React so server jobs and tests use exactly the same logic.

A coherent cloud option is Cloud Run for application/workers, Cloud SQL PostgreSQL, private Cloud Storage, Secret Manager/KMS, Cloud Tasks/Scheduler and centralized monitoring. A managed identity provider must prove mandatory MFA and server-verifiable MFA assurance for the chosen login method. Google documents Identity Platform integration with Cloud Run and MFA, but provider selection requires a working security spike, not assumptions about Google sign-in. See [Cloud Run identity tutorial](https://docs.cloud.google.com/run/docs/tutorials/identity-platform) and [Identity Platform MFA](https://docs.cloud.google.com/identity-platform/docs/web/mfa).

Use separate development, staging and production identities, databases, OAuth clients and secrets. Prefer one company in the first release, while including `organization_id` and `property_id` throughout the schema for future licensing. A property owner need not have an app login; a future owner login would consume one of the nine team seats unless the commercial requirement changes.

Core tables: organizations (including required GM membership reference), memberships, invitations, role grants/property assignments, units and dated availability, reservations and nightly charges, transactions/invoices/allocations, budget versions/lines, maintenance, housekeeping, complaints, attachments, source connections, external mappings, sync cursors/jobs, import batches/rows, evidence versions, metric snapshots, findings, management actions, approvals, action events and report versions.

Use foreign keys, unique external IDs and tenant-aware constraints. Store money as decimal or integer fils, retain original currency/FX provenance when needed, and round only at documented boundaries. Use UTC instants for events and explicit `Asia/Dubai` business dates for property reporting. Add optimistic row versions for concurrent edits and an outbox committed with approved external actions.

Online-only means cloud-authoritative operation: no offline database, offline writes, service-worker data cache, or background browser sync. Sensitive responses use `Cache-Control: no-store`; logout clears in-memory data. Connectivity loss blocks mutations and labels any still-visible view stale. Static assets may be cached. Exported reports and screenshots can exist outside the app; online-only cannot prevent that.

## 4. Exactly one GM; at most nine team users

Define one organization with exactly one active GM and zero to nine active additional human memberships. Invitation reservations count against the nine seats until accepted, revoked or expired. Multiple roles for one membership do not consume extra seats. Service identities cannot log into the UI or hold GM status.

- Bootstrap organization and first GM atomically through a controlled provisioning process; do not enable the organization until the GM has verified identity and enrolled MFA.
- Store a non-null GM membership reference on the organization; require it to point to an active member of that same organization. Enforce this through database constraints plus deferred constraint triggers where needed. A unique constraint alone prevents two GMs but does not guarantee at least one.
- Lock the organization row for invitations, acceptance, reactivation and transfer. Within one transaction count active members plus reserved invitations and enforce the cap. Recheck eligibility at acceptance; never rely on a UI count.
- Transfer GM authority atomically with recent MFA: promote the enrolled successor, update the required reference, demote the predecessor and revoke affected sessions. A full organization transfers authority among existing members without creating an eleventh seat.
- Prevent GM deletion/demotion/deactivation unless a valid transfer completes in the same transaction. Emergency recovery requires documented identity checks, recorded administrator action and immediate credential/session revocation; never create a second GM. Infrastructure support has no standing app access.
- Disabled/expired members cannot use old sessions; reactivation must reacquire a seat. Protect invitation acceptance against reuse, email mismatch and expired links.

Suggested permission policy:

| Capability | GM | Finance | Revenue | Operations / department | Viewer |
|---|---|---|---|---|---|
| Manage users, roles, connections | Yes | No | No | No | No |
| Read scoped operational records | All | Required subset | Required subset | Assigned scope | Explicitly published subset |
| Edit operational work | Yes | No | Revenue scope | Assigned scope | No |
| Import/edit financial records | Yes | Yes | No | No | No |
| Propose action | Yes | Yes | Yes | Yes | No |
| Approve expenditure, external publication, operational execution | Yes | No | No | No | No |
| Generate draft reports | Yes | Financial drafts | Commercial drafts | Scoped drafts | No |
| Release owner report/export sensitive data | Yes | Only specifically granted | No by default | No by default | No by default |

Enforce deny-by-default RBAC plus organization/property scope and record ownership where appropriate. Middleware authenticates the session; services authorize each command and query; PostgreSQL row-level policies provide defense in depth using a non-bypass application role. Test background workers separately. Client hiding is only a convenience. Never retrieve unrestricted data and filter it after sending it to the browser.

Require MFA for every human user before any property data is accessible. Prefer phishing-resistant factors when supported; use provider-managed authenticator MFA as a supported baseline. Prove enrollment, challenge, reset, lost-device recovery and MFA assurance checks end to end. Require recent MFA for GM transfer, role changes, connection changes and sensitive approvals. Google API OAuth consent is separate from app authentication and is not proof that MFA occurred.

Use secure, HttpOnly, SameSite session cookies, session rotation, bounded idle/absolute lifetimes and immediate revocation after disablement/privilege changes. Validate issuer, audience, expiry and MFA assurance on server session issuance. Protect state-changing requests with CSRF defenses and origin validation. Rate-limit sign-in, recovery, chat, imports and exports. Enforce TLS, CSP, safe rendering and input schemas; restrict upload size/type, scan attachments and issue short-lived authorized download URLs. Log sanitized error IDs, not raw provider exceptions, tokens or guest records.

Audit actor, scope, action, target, before/after version, evidence, approval and correlation ID in the same transaction. Application users cannot edit audit events; export copies to retention-controlled storage. Define privacy, retention, deletion and backup policies with the company before live guest-data onboarding.

## 5. Google Calendar, Drive and Sheets

Implement company-authorized connections, with GM-controlled resource selection and explicit per-role permissions. Team members must not gain access to a GM's entire personal Google account. Background access uses the authorized company connection, checks app scope and resource allowlists, and records the initiating user or approved scheduled policy. Show connection owner, granted capabilities, last success, freshness and reconnect status.

Use server-side authorization-code OAuth, strong single-use state bound to the session, exact HTTPS redirect allowlists and PKCE where supported by the chosen client flow. Request scopes incrementally. Store refresh tokens encrypted with managed keys, never in browser storage or logs; serialize refreshes, preserve an existing refresh token when Google omits a new one, and stop jobs on revocation/`invalid_grant`. Disconnect cancels queued work, revokes tokens where appropriate and deletes credentials under the retention policy. Google describes server-side offline access and token refresh in its [web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server).

| Integration | First useful workflow | Access and synchronization policy |
|---|---|---|
| Calendar | Read approved operational calendars; publish approved action deadlines/inspection events | Start read-only with `calendar.events.readonly` for selected calendars; request suitable event-write scope only when publishing is enabled. Prefer a dedicated app calendar and narrow compatible scope. `calendar.events.owned` only applies to calendars the authorizing user owns. Keep calendar IDs on a server allowlist. |
| Drive | Select evidence documents; upload approved report versions | Prefer Google Picker plus `drive.file` for chosen/app-created files. Record file ID, version/checksum, property, provenance and app ACL. Do not request broad Drive browsing for convenience. Recheck Google permissions and app authorization on retrieval. |
| Sheets | Preview approved operational/budget inputs; export approved report snapshots | Prefer selected files accessible through `drive.file` where supported. Map explicit spreadsheet IDs, tabs, columns, data types, timezone and external IDs. Preview/validate/approve imports; write only app-owned output tabs/files. Never silently overwrite source formulas. |

Google recommends per-file Drive access and documents scope verification requirements in its [Drive scope guide](https://developers.google.com/workspace/drive/api/guides/api-specific-auth). Sheets authorization applies to a spreadsheet file and cannot be confined to a tab; tab allowlists are an application control, not a Google security boundary. See [Sheets scopes](https://developers.google.com/workspace/sheets/api/scopes) and [Calendar scopes](https://developers.google.com/workspace/calendar/api/auth).

Use stable external mappings and idempotency keys to prevent duplicate events, imports and exports. Handle pagination, cancellations/deletions, timezones, recurring events and API rate limits. Calendar incremental synchronization needs durable cursors; an invalid sync token (HTTP 410) requires a full resync. Webhook channels must be validated and renewed, with periodic reconciliation for missed notifications. See [Calendar synchronization](https://developers.google.com/workspace/calendar/api/guides/sync).

Use retries with exponential backoff/jitter, bounded attempts, dead-letter review and per-connection locking. Use ETags or a source-version/hash check before overwrites; surface conflicts for review. Sheets imports use stable row IDs and batch lineage rather than row position. Google edits remain external input, not automatically approved financial truth. Drive sharing outside the app can bypass app role restrictions, so company-controlled sharing must align with the intended audience. Revoking app access cannot retract previously downloaded copies.

Before production, configure the company-owned Google Cloud project, verified domains, privacy policy, redirect URIs, enabled APIs and production consent status. Determine internal Workspace eligibility versus external OAuth verification from the actual customer audience and scopes. External OAuth projects in Testing commonly receive seven-day refresh tokens for these data scopes; that is unsuitable as the permanent production setup. See [Google OAuth token policy](https://developers.google.com/identity/protocols/oauth2). Do not assume a ten-user product limit removes verification obligations.

## 6. Stronger evidence-based General Manager insights

The differentiator should be a traceable management decision loop: observation → supporting records → proposed action → approval → completion → measured outcome.

Every metric/finding should carry organization/property, reporting interval, business timezone, source IDs and versions, source freshness, coverage, formula/rule version, assumptions, limitations, and links to authorized evidence. Store actual, estimate and scenario as distinct value classes. An evidence count or client-supplied ID is not verification; the server must resolve it to permitted source records.

Priority product increments:

1. **Daily GM briefing:** five highest-priority exceptions, what changed since the last comparable period, financial exposure ranges where defensible, owner, deadline, evidence and missing data. Deduplicate repeated alerts and allow acknowledgement/snooze with audit.
2. **Unit contribution waterfall:** room/ancillary revenue → actual or estimated channel costs → direct costs → separately identified shared allocation → contribution. Show unallocated costs and completeness. Label hypothetical vacancy loss as an opportunity estimate with stated rate/demand assumptions.
3. **Revenue variance bridge:** explain the arithmetic contribution of occupied nights, price and mix using matched periods and consistent inventory. Separate mathematical decomposition from hypotheses about causation. Add booking pace only when historical snapshots exist.
4. **Cross-department investigation:** join repeat maintenance, complaints, readiness and unavailable nights by unit and time. Show the timeline and competing explanations. A correlation is a lead for management review, not a proven root cause.
5. **Budget and cost control:** approved version comparisons, missing invoice/commission checks, duplicate-charge candidates, recurring cost anomalies and allocation coverage. Finance signs off exceptions before owner publication.
6. **Action effectiveness:** track approved baseline, expected improvement, implementation date, measurement window, actual change and confounders. Completion alone does not mean verified savings. Preserve rejected recommendations and rationale.
7. **Decision scenarios:** save assumptions and model version; compare base/downside/upside, one-time and ongoing costs, break-even and payback where defined. Add forecasts only after enough historical data and backtesting against a simple baseline.
8. **Health score:** expose weights, thresholds, evidence, missing dimensions and trend. Suppress the overall score below an approved completeness threshold; calibrate weights with management before relying on it for decisions.

Run calculations on server-validated records first. Give the language model only an authorized evidence bundle and ask for a structured explanation referencing its IDs. Validate every numeric claim against deterministic metrics; reject unsupported numbers/citations and present a safe unavailable-data response. Keep knowledge articles separate from operational facts, treat document instructions as untrusted data, minimize guest personal data and give the model no direct execution credentials. Model availability, price, retention terms and the hardcoded model identifier must be verified during integration; do not make production depend on an untested model name.

## 7. Delivery phases and gates

Indicative effort for a small experienced engineering team with part-time QA/security support: roughly 12–18 calendar weeks, excluding external OAuth review delays, procurement and data cleanup. This is a planning estimate, not a fixed quote; validate after phase 0. Identity and Google approval work should begin early.

| Phase | Indicative duration | Deliverables | Exit gate |
|---|---|---|---|
| 0. Baseline and decisions | 1 week | Pin/reconcile branch content; reproduce build/start; data inventory; role matrix; metric definitions; threat model; hosting/MFA/OAuth spike | Signed scope, reproducible baseline and failing regression fixtures for known defects |
| 1. Identity and cloud foundation | 2–3 weeks | Organization schema, GM invariants, invitations, server RBAC, mandatory MFA, revocation, audit, environment/IaC definitions | Concurrent seat/GM tests and API authorization/MFA tests pass; no real-data rollout |
| 2. Authoritative operations and finance | 2–3 weeks | Database APIs, client migration, canonical metrics, staged imports, real rollback, persistent actions and evidence | Approved fixture totals reconcile; independent browsers share correct authorized data; demo isolation holds |
| 3. Google integrations | 2–3 weeks | OAuth lifecycle, Calendar read/approved publish, Drive selection/reports, Sheets preview/import/export, worker retries/conflicts | End-to-end sandbox tests cover revocation, quotas, duplicates and recovery; consent readiness confirmed |
| 4. GM intelligence and owner reporting | 3–4 weeks | Daily briefing, unit waterfall, variance bridge, investigations, action outcomes, saved scenarios, evidence-constrained AI, versioned reports | Numeric claim validation and role-scoped evidence tests pass; GM/finance accept report fixtures |
| 5. Hardening and controlled pilot | 2–3 weeks | Security review, restore rehearsal, load/accessibility tests, runbooks/training, UAT and release package | All acceptance criteria below pass; explicit owner approval before main modification/merge and deployment |

Phase dependencies: identity precedes real-data APIs; authoritative data precedes factual AI and owner reporting; approved workflows precede Google writes. Start with deterministic briefings if AI or Google approval is delayed. Each phase should end in a reviewable feature-branch change and evidence pack. This plan does not authorize implementation, merging or deployment.

## 8. Testing and operational readiness

- **Domain tests:** month/year/leap boundaries, cross-period stays, cancellation/no-show policy, duplicate and overlapping reservations, overlapping outages, partial refunds, missing/negative amounts, taxes and commission allocation. Check component sums against independently authored fixture expectations, not just the same formula rearranged.
- **Authorization matrix:** direct API calls for every role, verb and scope; forged IDs/roles/actors; cross-property and cross-organization access; exports, evidence downloads, AI retrieval and background jobs. Test stale sessions immediately after revocation.
- **Identity and race tests:** MFA bypass/enrollment/recovery, expired sessions, stolen/reused invitations, simultaneous last-seat requests, acceptance/reactivation races, concurrent GM transfers and attempts to remove the sole GM. Use the real database transaction model.
- **Import tests:** quoted multiline CSV, strict date/status/currency validation, external ID reuse, duplicate imports, approval after source change, partial failure and rollback after downstream edits. Reversal must target batch-owned versions or produce an explicit conflict; never delete unrelated later work.
- **Integration tests:** OAuth state mismatch/replay, partial consent, missing refresh token, reconnect, revocation, permission loss, selected-file tampering, pagination, expired Calendar sync token, webhook expiry, retry after ambiguous success and concurrent edits.
- **AI evaluations:** unsupported number/citation rejection, missing/stale data, malicious instructions embedded in Drive/Sheets, unauthorized evidence references and model outage. Re-run the evaluation set on model/prompt changes.
- **End-to-end tests:** GM onboarding and nine users; invite through MFA; operations case → approval → Calendar task → outcome; Sheet import → briefing → finance review → approved Drive report. Verify ten simultaneous users with separate sessions.
- **Release checks:** locked dependency install, typecheck, actual lint, unit/integration/E2E checks, secret/dependency/container scans, production start smoke test and migration rehearsal in CI. Protect main and require review/checks; inspect actual repository rules before changing them.
- **Operations:** structured redacted logs, error/latency alerts, sync lag, failed jobs, AI usage budgets, backup failures, DB connection limits and availability dashboards. Define staffed incident ownership and severity escalation.

Proposed initial service targets for approval: 99.5% monthly availability; core API p95 under 1 second and principal screens under 3 seconds for the agreed pilot dataset and ten concurrent users; completed scheduled sync within 15 minutes under healthy provider conditions; AI responses measured separately. Proposed recovery targets: RPO ≤1 hour and RTO ≤4 hours. Confirm provider capability/cost and prove a restore; a backup checkbox is insufficient.

## 9. Owner-ready acceptance criteria

Production release requires a dated evidence pack and GM/company-owner sign-off:

1. A fresh company has exactly one MFA-enrolled GM. Nine additional users can join; a further invite/accept/reactivation is rejected under concurrent load. No transaction can leave an active company with zero or two GMs.
2. Every user must complete MFA. Direct unauthenticated, wrong-role and wrong-property requests are denied for data, files, AI, reports and mutations. Revocation invalidates existing access within the documented immediate-revocation design.
3. Real records persist centrally and appear correctly in two separate authorized browsers. Offline mutations are blocked. No guest records, auth secrets or Google refresh tokens are stored in browser persistence or logged.
4. Demo records and fixed narratives never appear in production metrics, recommendations or owner exports. No assumed forty-unit inventory is silently labeled actual.
5. An approved representative dataset reconciles nightly revenue, actual/estimated commission, expenses, inventory and approved budgets to agreed source totals within a documented rounding tolerance. Missing data appears unavailable; estimates remain labeled.
6. Import preview cannot mutate live data. Approval commits once; retry does not duplicate records. Rollback actually reverses the batch or reports a clear conflict, with evidence of the resulting totals.
7. Google permissions are least-privilege and resources are allowlisted. Disconnect/revocation stops jobs; retries do not duplicate writes. OAuth consent and production refresh behavior work beyond a short test session.
8. Every briefing number links to a permitted, versioned source/metric and states its period. Unsupported AI claims are blocked in the evaluation suite. Model failure preserves deterministic reporting and never executes an action.
9. Every operational/external action has an authorized approval, immutable event history and idempotent execution. Changed cost/scope/evidence invalidates approval and requires review. Completed and verified outcomes are separate states.
10. Owner reports contain approved period, property, formula/data versions, preparation/approval identity, actual-versus-estimate labels and limitations. Finance reconciles; GM approves publication. Exports omit unnecessary guest data and prevent spreadsheet-formula injection.
11. Security review has no unresolved critical/high findings; migrations, rollback, restore, monitoring and incident runbooks are demonstrated. Performance and recovery targets pass on the agreed dataset.
12. Company owns the domain, cloud project, repository, billing and Google OAuth application. Handover includes architecture, data dictionary, permissions, support responsibilities, runbooks, known limitations, retention policy and operating-cost forecast. Main modification/merge and deployment each require explicit approval.

## 10. Decisions to confirm during phase 0

Recommended defaults are one company with multiple property scopes, all users MFA-enrolled, invitation-reserved seats, GM-only external publication/expenditure approval, company-owned Google connection, dedicated operational calendar, Picker-selected Drive/Sheets resources and database-authoritative financial records.

Confirm actual inventory/PMS and source quality; exact departmental access and export needs; Workspace domain and shared-resource ownership; approved metric/accounting policies; data region and retention obligations; cloud budget/support coverage; pilot dataset and performance scale; and emergency GM succession custodian. These decisions refine the plan without changing the core security requirements.
