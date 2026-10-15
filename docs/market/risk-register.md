# Risk register

| Risk | Consequence | Implemented control | Remaining release requirement |
|---|---|---|---|
| Source agreement prohibits competitor analytics/storage | Commercial/legal exposure | Source permission/expiry/rights gates; no scraper or native adapter assumed; Airbnb restriction documented | Written use-case license review; provider contract/sample and retention/deletion schedule |
| Stale or partial source | Misleading “live” market | Timestamps, TTL exclusion, queued/failure/configuration status, insufficient-evidence withholding | Real feed heartbeat/coverage watermark and missed-observation reconciliation |
| Advertised price mistaken for achieved revenue/occupancy | Bad forecasts/owner statements | Asking-price classifications, complete-fee normalization, no competitor occupancy inference | Separate reconciled performance/PMS/ledger sources |
| Duplicate unit across channels | Inflated sample/confidence | Physical-key evidence, one physical-property vote, distinct platform offers retained | Licensed identity proof review; ambiguous identity queue and vendor-quality audit |
| Poor coordinates / false building | Wrong comparable market, privacy exposure | Accuracy/status/evidence, chosen administrative scope and conservative radius, map without external tiles | Real building/geocoder verification; authoritative licensed boundaries |
| Price basis/FX/fees mismatch | Incorrect under/overpricing | Exact dates/guests/terms/context, explicit component reconciliation, AED-only comparisons | Contract-specific fee definitions, verified FX if introduced |
| Provisional model mistaken for optimum pricing | Unjustified revenue claims | Transparent weights, conservative movement cap, no probability/causal guarantee | Backtesting, local calibration and outcome evaluation |
| Cost/owner constraints absent | Unprofitable or unauthorized proposals | Mandatory bounds/cost floor; conflicting policies withhold; GM overrides constrained | Verified cost allocation/commission policies and owner approval records |
| Unauthorized property or private access detail | Confidentiality breach | Existing MFA plus property grants, composite relationships, separate GM-only note endpoint | Real DB privilege/concurrency testing; independent security review and optional RLS |
| Stale or forged approval | Unauthorized decision/execution | Server recomputation, revision/evidence/freshness check, recent MFA, immutable once-only decisions | Production multi-client races and identity recovery tests |
| OAuth credential exposure or callback takeover | Company Google compromise | AES-GCM tokens, PKCE, state plus HttpOnly binding, membership recheck, no browser tokens | Secret rotation/recovery, actual consent/provider penetration tests |
| Duplicate/partial external exports | Repeated meetings/files or inconsistent report | Operation keys, deterministic calendar ID, Drive app-property lookup and completed replay handling | Real ambiguous-success/crash/concurrent-modification tests; provider limitations documented |
| API costs or rate limits grow unexpectedly | Uncontrolled spend / missing evidence | Bounded data/query sizes, limited retries, no provider calls without an installed connector | Commercial quotes, per-source budgets/quotas, alerts and accountable operator |
| Temporary preview/license data retained too long | Contract/privacy breach | Permission needed before preview storage; stored source references | Scheduled cleanup, deletion lineage, backup retention and contract expiry process |
| Legacy simulated competitor narratives mistaken for live data | False management conclusions | New engine never imports legacy competitor engine; new fixtures clearly synthetic | Keep old demo banner visible and review broader legacy report wording before production expansion |
| Local tests mistaken for production certification | Premature launch | Validation record distinguishes mocks/PGlite/local smoke from external tests | Staging account/MFA, Postgres concurrency, PostGIS/containers, Google, restore, load and pilot acceptance |

No live rate write exists, so a source error cannot directly change an OTA price in this implementation. Approval and export are still consequential management actions and require their stated review/permission controls.
