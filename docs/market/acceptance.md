# Automated validation and pilot acceptance

## Local verification scope

The suite includes the previous cloud/reservation regressions plus market-domain, normalized PostgreSQL-engine, direct API authorization, source expiry/ingestion, immutable approval, worker availability/revocation, OAuth encryption/browser state and mocked approved-review exports. Browser coverage uses the actual simulation navigation and forty-unit market module for analysis, invalid/valid GM approval, map, comparable evidence, report download and insufficient same-building evidence.

Database tests use PGlite, which executes PostgreSQL constraints/queries but does not establish real multi-client Cloud SQL behavior or PostGIS extension compatibility. Google tests use mocked responses and test credentials. No vendor source was contacted with real credentials. The production smoke test starts the built server locally and checks compiled assets, anonymous access denial and security headers. It is not a cloud deployment or container-build certification.

Commands:

```text
npm ci
npm run check
npm run test:browser
npm audit --audit-level=high
```

`npm run check` runs TypeScript checking, service/domain/database/API tests, frontend production build and production-server smoke test. The existing large initial-bundle warning is retained; the new market module is lazy-loaded separately. Test failures encountered during development were corrected rather than reported as passing. The final execution summary records final counts/results.

## Acceptance gates before real-data pilot

1. GM and nine additional accounts are individually provisioned and MFA-enrolled. Test expired/revoked sessions, recent-MFA policy/decision/connection changes, recovery and membership changes with the real identity provider.
2. Two organizations and several properties demonstrate no direct-API cross-scope access. Test forged property/unit/source IDs, report exports and Google actions, not just hidden navigation. Private entry instructions never appear in any market response available to a non-GM, report, prompt or provider payload.
3. Verify actual property coordinates/building/community with evidence; check uncertainty and manual-correction history. Confirm no example building or synthetic record entered cloud tables.
4. Obtain the selected source agreement, written analytics/storage/derivative/export permission, UAE coverage, quota/price/retention terms and representative dated offers. No direct Airbnb analytics use is presumed permitted.
5. Verify source listing/physical-unit/operator identity and metadata. Cross-platform duplicates contribute one physical-property vote. Unknown or conflicting identities must not inflate confidence.
6. Independently reconcile quoted room totals, cleaning/service fees/taxes and guest totals for exact dates/guests/terms/quote context. Test fees missing, USD/other currencies, unavailable listings and mismatched stay lengths; no recommendation should be fabricated.
7. Validate studio versus studio and all supported bedroom/category/capacity matches. Test close-but-different communities, exact chosen scope, radius with uncertainty and city widening. No silent type or geographic expansion is permitted.
8. Reconcile benchmark fixtures independently: latest listing observations, physical medians, market quantiles, mean/range, percentile, closest-unit comparison and same-condition historical trends. Sample changes cannot be described as observed same-listing price movement.
9. When evidence is small/stale/unreliable, show the exact insufficient-evidence message. No automatic lowering is allowed. Verify current-rate completeness, cost floor, owner bounds and movement cap. Test zero/unknown values and conflicting policies.
10. Change source permission, profile, policy, current rate or evidence after saving a proposal; approval must be rejected. A team user cannot approve. A GM override outside guardrails is rejected. A decision cannot be overwritten. Prove an approval changes no rental schedule or OTA rate.
11. Worker tests cover installed connector authentication, invalid licenses, source failures, pagination, quotas, timeout, retry/dead-letter states, lease recovery, stable observation IDs and missed-update reconciliation. Missing providers must report configuration needs, not “live research complete.”
12. Google staging verifies actual consent, scope denial, PKCE, callback replay, browser binding, refresh/revocation/key rotation, permissions, app-owned Sheet creation, RAW values, Drive upload and deterministic Calendar IDs. Test crashes after ambiguous provider success and concurrent edits; inspect Google resource sharing.
13. Review reports distinguish competitor asking prices, internal planning rates, actual reconciled records, estimates/scenarios and unavailable forecasts. A source without export rights blocks download and external export. Private guest/access data never appears.
14. Outcome observations have a real approved decision, reporting period, reconciliation source and confounders. No causal savings claim is inferred from correlation or a staff-entered number.
15. Apply runtime-only database privileges; prove offer/policy/proposal/decision/audit immutability with the actual DB role. Test transactions with simultaneous clients and optional PostGIS on the selected host.
16. Complete security review, source retention/deletion procedures, supervised jobs/monitoring, usage budgets, load tests and backup/restore rehearsal. Establish who responds to expired permissions, failed collection and missed exports.
17. Obtain explicit publication/merge/deployment approval. Live price synchronization requires a separate approved design and test suite; no rate publisher is part of this increment.

## Non-goals that must not be described as completed

Native live OTA/market-data adapters, licensed administrative boundaries, automatic geocoding, FX conversion, demand/event forecasting, calibrated model probabilities, causally validated backtesting, unrestricted generative research, selected-existing-Sheet imports, owner report release/signature and live rate publication are not proven by the local tests.
