# Geographic Market & Revenue Intelligence

This module extends the existing Ahmed Quality Ops application and its cloud authentication. It is not a separate app. Development base: `c877ce026c9f55cdd0f95c2d69fd5cbef03f0e7a`, the merged integration branch after PR #5. Work is on local `feature/geographic-market-pricing`. No main modification, remote publication, merge, deployment, live competitor connection or channel-price change is authorized by this implementation request.

## Implemented scope

- Market property registry linked to existing registered units, with structured locations, unit characteristics, separate amenities/accessibility, restricted access notes and immutable correction history.
- Per-property deny-by-default grants on top of existing individual MFA accounts and one-GM/ten-seat database constraints.
- Source permission records with expiry, freshness, analysis/storage/derivative/export rights and revocation.
- Structurally validated feed preview and GM acceptance; immutable dated offers, physical-unit identity evidence, versioned listing metadata, duplicate observation handling and collection audit.
- Durable background research queue, connector interface, retry/lease handling and honest unavailable-provider status. No live provider adapter is installed by default.
- Exact-date/guest/type/booking-condition matching, chosen geographical scope, haversine distance and coordinate uncertainty, provisional transparent comparable scores and explicit exclusion reasons.
- Fee-normalized asking-price benchmarks, one vote per evidenced physical unit, matched-observation trends and guarded room-rate proposals.
- Immutable proposal/decision/outcome records. Approval never alters internal schedules or publishes an OTA price.
- One integrated dashboard in both existing cloud navigation and the 40-apartment synthetic simulation, including pan/zoom map, price calendar, evidence table, management questions, scenarios, review reports and owner-policy controls.
- OAuth/token-encryption and approved-review Google Drive/Sheets/Calendar workflows, disabled without company configuration and consent. External behavior requires staging verification.

## Deliberately unavailable without external evidence or configuration

No Airbnb, Booking.com, Vrbo, Agoda, Expedia or licensed data account is connected. No live competitor asking price, owner identity, forecast, event demand, geocoding result or administrative boundary is fabricated. Unknown fields remain null. No native booking-channel price publisher exists. External OTA/API access requires the applicable contract, licensing, credentials and end-to-end testing. No scraper, CAPTCHA bypass or arbitrary remote URL collector is included.

The map uses local geographic overlays without a third-party basemap, automatic geocoding or administrative boundaries. The absence of a basemap is explicit. PostGIS acceleration is an optional DBA-reviewed migration, not a tested assumption in portable database tests.

The research assistant currently produces deterministic answers from the selected evidence. It is not a live LLM/web-research claim. Actual property cash revenue, audited contribution, booking-pace forecasts, verified events and causal backtests need reconciled source records; asking rates cannot establish them. Reports are management-review drafts, not automatically released owner statements.

## Deliverable guide

| Requested deliverable | Location |
|---|---|
| Existing-code audit; current versus target | [Audit and architecture](audit-architecture.md) |
| Platform feasibility, permissions, costs, refresh limitations | [Source matrix](source-feasibility.md) |
| Normalized schema, location management, dated offers and authorization | [Data and security design](data-security.md), migrations 003/004 |
| Comparable scoring, benchmarking, pricing, AI methodology | [Methodology](methodology.md) |
| Google Workspace integration and setup | [Workspace integration](google-workspace.md) |
| Phases, file manifest, completed/pending status and advanced enhancements | [Roadmap](roadmap.md) |
| Automated tests and pilot acceptance | [Acceptance and validation](acceptance.md) |
| Risk register, licensing/data/finance/security/API costs | [Risk register](risk-register.md) |
| Forty-unit professional demonstration | Geographic Market Intelligence in the existing simulation navigation; [demo walkthrough](demo-walkthrough.md) |

## Local development

Use `npm ci`, `npm run check`, then `npm run test:browser`. `npm run dev` opens the existing demo application; choose **Geographic Market Intelligence**. The module is lazy-loaded. Cloud mode uses the existing database and Identity Platform setup plus migrations 003 and 004. Run migrations only against an approved environment using a migration role. See the previous [cloud hosting guide](../cloud/hosting.md), then apply the additional runtime grants in [data-security](data-security.md).

No migration or seed ran against the user's cloud database. Demo fixtures exist in browser memory and are never seeded into cloud tables. The browser cannot authorize a pricing decision by changing its role, evidence bundle or proposed amount; the server reloads and recalculates before approval.
