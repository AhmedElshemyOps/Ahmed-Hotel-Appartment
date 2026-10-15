# Implementation progress — 15 October 2026

Branch: `feature/readiness-accounting`. Base: main `739223e04a8bdacf36471a1d8a2ff8924c5f3753`. The original readiness plan is retained in `docs/property-readiness-compliance-ota-plan.md`; this file is the current execution record. The owner's latest instruction permits development-branch GitHub publication and forbids main modification, merging and deployment without separate approval.

## This increment

Implemented linked compliance/activation/OTA readiness and a Universal Accounting Integration Layer with disconnected Odoo configuration and reviewed CSV operation. All modules live in the existing application/navigation/authentication rather than a separate prototype. No real customer data, Odoo account or external document store is supplied by the demonstration.

| Area                                           | Implemented                                                                                                                                                      | Remaining / external gate                                                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Individual login / MFA                         | Existing server-verified identities, one GM / nine team-seat constraints, recent-MFA sensitive operations                                                        | Actual provider recovery tests; invitation management; configurable commercial capacity                                    |
| Property master / geography                    | Existing real unit registry and market profiles, new linked readiness state                                                                                      | Full owner/contract master and verified real-property records                                                              |
| PRO / compliance                               | Configurable reviewed requirements, dated evidence references, verification, expiry/renewal alerts, responsibility grants, revision history                      | Legal applicability review by authorized staff; protected file bytes/scanning; government submission is disabled           |
| Activation                                     | Saved-record legal/operational/commercial gates, GM decision reasons, immutable snapshots, effective suspension                                                  | PMS/inventory publisher and production concurrency acceptance                                                              |
| OTA readiness                                  | Per-channel content/policies/fees, declared photo/video metadata, approved references, factual quality checks, human confirmation reference                      | Secure uploads/byte inspection; native publication verification; multilingual LLM generation; live OTA publishing disabled |
| GM readiness intelligence                      | Saved-record blockers/expiry/tasks, source revision references and redacted internal report snapshot                                                             | Unified live cross-module executive model and owner report release                                                         |
| Reservations / next-day operations / guest SLA | Existing normalized intake, reviewed imports, operations calendar and message drafts                                                                             | PMS selection/native adapter; outbound delivery not connected                                                              |
| Geographic pricing                             | Existing permitted-feed pipeline, matching, transparent pricing proposals and approvals                                                                          | Licensed live feed, credentials and staging acceptance                                                                     |
| Universal accounting                           | Source configuration, normalized ledger/history, apartment/building mappings, reviewed CSV workflow, arithmetic reconciliation, deterministic financial findings | Live Odoo environment/version/entitlement/ACL discovery and administrator authorization                                    |
| Google                                         | Existing market-review OAuth/export implementation                                                                                                               | Real-account staging; readiness task/doc and accounting sync integration                                                   |
| Maintenance / guest experience                 | Existing operations/cases and guest-service planning                                                                                                             | Preventive recurring schedules, calibrated predictions, contractor analytics and full incident lifecycle                   |
| Financial leakage / simulations                | Existing market scenarios; source-based accounting contribution/exceptions in this increment                                                                     | Unified leakage estimates, verified booking/GL matching, calibrated forecasts and causal validation                        |
| Owner portal                                   | Not delivered by this increment                                                                                                                                  | Separate owner identity, grants, released statement snapshots and privacy tests                                            |
| Deployment                                     | Existing Docker/Cloud Run examples, CI, ordered migrations; no deployment in this increment                                                                      | Cloud access/billing/configuration, live identity/database/storage, backup restore and owner approval                      |

## Added/modified files

- `migrations/005_readiness.sql`, `006_accounting.sql`: additive, no main/customer-data rewrite.
- `src/readiness/{model,engine,report,ReadinessCenter}.ts(x)` and `server/readiness/routes.ts`.
- `src/accounting/{model,engine,demo,AccountingCenter}.ts(x)` and `server/accounting/{routes,csv,adapters}.ts`.
- Existing `server/cloud.ts`, React App/CloudApp/Sidebar and Dockerfile integrate the modules.
- New service/database/API tests; extended integrated browser tests; README and module guides.

## Validation record

Final exact counts and CI outcome are recorded below when the implementation is published. Local database tests use PGlite; Odoo transport and real Google credentials are never exercised. Browser fixtures are synthetic. Existing bundle-size warning remains a performance item. No result may be described as a successful live Odoo synchronization or production acceptance.

## Security and operational limits

Existing company/member isolation is extended with company readiness capabilities and GM/Finance accounting access. New modules use row locks, optimistic readiness revisions, immutable source/decision snapshots and audit trails. Runtime DB privileges must be applied and tested independently of migration-owner tests. Retention, scanning/storage, real MFA/recovery, licensed feeds, secure live transports, monitoring and restoration are still release gates.

## Next phases

1. Secure evidence/media object-storage pipeline with quarantine/scanning and signed downloads, once a company storage environment is available.
2. Owner/contract master and an owner-scoped released-report portal with independent identities and approval snapshots.
3. Verified reservation-to-ledger matching, shared-cost allocation policies and evidence-based unified executive briefings.
4. Select and validate live PMS/accounting/Google/market adapters using authorized company sandbox fixtures.
5. Production acceptance, security review, backups and final owner-approved deployment. No automatic release from a merge is configured.

## Verified local results for this increment

- TypeScript: passed.
- Service/domain/portable-database/authenticated-API tests: **46 passed, 0 failed**.
- Integrated browser workflows: **7 passed, 0 failed**.
- Production build and production-server smoke: passed (**1 smoke test**).
- **54 automated tests passed in total.** Dependency audit: **0 vulnerabilities**.
- Readiness/activation and accounting screenshots visually inspected. Synthetic labels are visible; no live data is implied.
- Final frontend build lazily loads readiness (~30 KB minified) and accounting (~22 KB). Existing initial application bundle remains about 985 KB and emits a size warning.
- GitHub CI independently checks these workflows and the Docker image after publication. Production PostgreSQL role/concurrency, live Odoo/Google, backup restore and hosting are not proven by local tests.

Test-development failures were corrected: the readiness form controls needed explicit accessible labels; an accounting test selected both a banner and a same-named option; and an unsupported-model planner test initially stopped earlier at missing endpoint discovery. Only the final passing results are counted above.

## Synthetic live-session preparation

The owner selected a **demonstration with synthetic data**. This is a local, screen-shared presentation, not a cloud production launch.

- Added the single beginner guide at `docs/APP-GUIDE-AND-ROADMAP.md` and the presentation/recovery route at `docs/session/LIVE-DEMONSTRATION.md`.
- Added `npm run session:check` (secret-safe configuration-only report) and `npm run session:demo` (forced synthetic, loopback-only mode with live Gemini disabled).
- Clarified demo-refresh and chat wording so synthetic figures are not presented as verified company data.
- Migration and market-worker scripts now load `.env` consistently; the pinned historical guide flags the correction.
- Revalidated TypeScript, frontend build, 46 existing service/database/API tests, seven browser workflows, one production smoke test and two new session isolation/secret-output tests: **56 passing tests across these checks**. GitHub CI reruns the complete suite and container build on publication.
- Main remains unchanged. No Odoo activation, public hosting, real company imports or deployment is part of this preparation.

## Report Center print redesign and organisation guide

- Added a dedicated white A4 report preview/print stylesheet and isolated print document, with daily/weekly/monthly selection and real date-window calculations.
- Removed unsupported fixed audit/approval statements, invented report narratives and mismatched CSV benchmarks. Source IDs and explicit current-state/synthetic limitations remain visible.
- Corrected a footer-only trailing page found during PDF inspection. Daily sample is two pages; weekly/monthly samples are three pages for the reviewed fixture. Rendered PDF pages and counters checked.
- Extended the unified beginner guide with 15 enhancements, folder/repository organisation proposals, risks and pinned evidence. No folder reorganisation was applied.
- TypeScript, production build, 51 service/domain/database/API/session/report tests, one production smoke test and eight browser workflows passed: **60 automated tests total**. GitHub CI independently checks the final branch and Docker build.
- Local synthetic session remains on port 3045. No main merge, public deployment or live data connection.
