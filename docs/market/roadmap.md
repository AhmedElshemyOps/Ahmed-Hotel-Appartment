# Phases, changed files and advanced enhancements

The user authorized local implementation, not publishing/merging/deploying or changing rental prices. Each stage preserves the existing application and differentiates test fixtures from live evidence.

| Phase | Implemented development scope | External / pilot dependency |
|---|---|---|
| 1 Audit and feasibility | Baseline inspected, source matrix, risk/architecture plan | Actual source agreements, sample offers, legal/commercial review |
| 2 Geographic registry | Normalized registry, coordinate correction, manual evidence verification, map, property grants | Approved geocoder/basemap/boundaries if wanted; real inventory verification |
| 3 Research infrastructure | Permission records, immutable offer ingestion, physical linking, queue/connector interface/retries/audit | Native licensed adapters, worker supervision, quotas and retention |
| 4 Comparable matching | Hard type/date/guest/terms matching, chosen geography and provisional scoring/exclusions | Local quality calibration and approved source metadata |
| 5 Benchmarks | Fee-normalized same-date statistics, deduplication, positioning, matched trends | Genuine dated samples, coverage/refresh validation, optional FX source |
| 6 Recommendations | Guarded conservative proposals, immutable GM approval/revision/rejection and outcomes | Owner policies/costs, backtesting, demand response evaluation; no rate publisher |
| 7 Dashboard/assistant | One integrated lazy module, map/evidence/calendar/alerts/scenarios, deterministic management summaries, 40-unit fixtures | Optional grounded LLM with numerical validation, portfolio heatmaps and calibrated demand forecasts |
| 8 Workspace/reports | Review report snapshots/HTML and configuration-gated OAuth/approved-review exports | Actual Google configuration/consent/provider tests, selected-Sheet imports, event relevance and report-release workflow |
| 9 Tests/pilot readiness | Domain, normalized DB, scope/API, encryption/state and integrated browser workflows | Production database races/grants/PostGIS, external contract tests, security review, restore/load/retention rehearsals |

## Main files

- `src/market/model.ts`: typed schemas, geography, characteristics, policies, rates, source permissions, offers and query/result contracts.
- `src/market/engine.ts`: comparability, geographic distance, deduplication/statistics, provisional proposals, approval guardrails, scenarios and deterministic answers.
- `src/market/demo.ts`: forty-unit synthetic market fixtures, separate from cloud records.
- `src/market/MarketWorkspace.tsx`, `MarketMap.tsx`, `RegistryEditor.tsx`, `report.ts`: integrated market interface, local overlays and safe review reports.
- `server/market/repository.ts`, `routes.ts`: normalized storage, property grants, source ingestion, fresh-evidence approvals and reports.
- `server/market/worker.ts`, `scripts/market-worker.ts`: durable connector collection and unavailable-provider handling.
- `server/market/google.ts`: encrypted server OAuth and approved-review exports.
- `migrations/003_market.sql`, `004_market_google.sql`: market tables, relationship constraints, indexes and token/workflow storage.
- `deploy/optional/postgis.sql`: optional geography acceleration requiring DBA approval.
- Existing `src/App.tsx`, `Sidebar.tsx`, `src/cloud/CloudApp.tsx`, `server/cloud.ts`, `server.ts`, `Dockerfile`, dependency manifests and environment example: integration into the actual app and runtime.
- `tests/market-domain.test.ts`, `market-database.test.ts`, `tests/helpers/market.ts`, existing browser suite: new acceptance coverage plus regression checks.

## Advanced enhancements, ranked

Cost labels describe relative ongoing engineering/data cost; no vendor quote or operating-cost claim is implied.

| Enhancement | Value | Difficulty / cost | Data dependency and reliability | Priority / status |
|---|---|---|---|---|
| Reliable stale-source and fee/price anomaly checks | High | Medium / low compute | Explicit collection time and components; implemented conservative gates | P0 implemented foundation |
| Owner-specific bounds and decision history | High | Medium / low | Verified owner policy/cost references; implemented append-only workflow | P0 implemented |
| Channel-net contribution estimates | High | Medium / low | Actual commissions/costs; estimate labels and conditional scenario implemented, ledger reconciliation pending | P0 partial |
| Same-listing price-change alerts | High | Medium / licensed history | Same stay/context/property identity; matched trends implemented, scheduled notifications pending | P1 partial |
| Property quality adjustment | High | High / data/calibration | Verified size/amenities/review scale; ranking implemented, AED quality premiums not fabricated | P1 partial |
| Event-aware pricing | High | High / licensed/local feed | Verified event/location/date relevance and backtested demand; not inferred from a calendar title | P1 pending |
| Booking pace / historical pickup | High | High / PMS snapshots | Dated booking-version history and fair cohorts; current asking offers cannot establish it | P1 pending |
| Price-recommendation backtesting | High | High / history | Historic rate/availability/outcome/counterfactual limits; causation remains uncertain | P1 pending |
| Opportunity prioritization | High | Medium / low | Conditional effect plus confidence; selected-date management ranking implemented, portfolio-wide queue pending | P1 partial |
| Authorized scheduled research | High | Medium/high / vendor quota | Worker infrastructure implemented; native contract adapter and schedules unavailable | P1 partial |
| Portfolio/district heat map | Medium | Medium / coverage | Sufficient balanced district samples; coordinate map implemented, economic heatmap withheld | P2 pending |
| Geographic expansion analysis | Medium | High / licensed representative data | Acquisition costs, regulations and demand coverage; not supported by current sample | P2 pending |
| Calibrated risk/reliability scores | High | High / validation | Current provisional gates exist; probabilities need held-out evaluation | P1 pending calibration |
| Controlled live price publication | High but high risk | High / PMS contract | Separate outbox, owner limits, approval, idempotency, reconciliation and rollback | Later, explicitly disabled |

## Suggested pilot order

First verify a small actual portfolio and one licensed source with complete dated offers. Reconcile price components and identity linkage before enabling suggestions. Then calibrate quality/movement thresholds using withheld historic examples, obtain management acceptance, test Google exports, and run a read-only advisory pilot. Only after measured accuracy and operational controls should live rate-publication work be separately authorized.
