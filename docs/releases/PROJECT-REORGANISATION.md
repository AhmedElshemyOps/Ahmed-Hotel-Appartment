# Project reorganisation — 15 October 2026

## Delivered

The frontend now groups screens and rules by feature, with app navigation separated from shared controls, data contracts, dates and currency display. Server login checks, database helpers, configuration checks and connectors have dedicated folders. Accounting has separate router composition, workflow handlers and shared repository operations. Documentation has an index and separate guides, reference, plans, releases, session and archive folders.

Imports and relative documentation links were updated. Browser components now use shared API contracts rather than importing server-only modules for types. Foundational server modules no longer depend on the company route composer. Docker runtime source copying follows the reorganised tree. The structural audit is included in the normal check command.

Database migration scripts, test locations, dependencies, API URLs and entrypoints are unchanged. No main merge, deployment, real connector activation or accounting write operation forms part of this change.

## Validation

- `npm run check`: structure audit, TypeScript, 51 domain/service/database/API/session/report tests, production build and 1 production smoke test passed.
- `npm run test:browser`: all 8 browser workflows passed, covering revenue, company sign-in boundaries, operations, channels, market, readiness, accounting and reports. Total: 60 automated tests passed.
- `npm run session:check`: local synthetic configuration passed; Odoo remains disabled.
- `git diff --check`: passed. Existing migration files and package-lock are unchanged.
- Container build cannot be run locally because Docker is not installed; the pull-request CI container check remains required.
- These checks use synthetic records and a portable test database. Live PostgreSQL concurrency, configured identity/OAuth, real provider access and production recovery remain unverified.

## Remaining risks and enhancement readiness

The organisation is a foundation for enhancements, not a rewrite or a production-readiness certificate. Larger app screens and market/readiness routes remain candidates for smaller modules. Accounting service handlers retain some SQL and HTTP coupling. Existing bundle-size warnings remain. Live Firebase, Google OAuth, PMS and Odoo credentials and company approvals are still separate acceptance gates. Odoo remains disconnected and read-only.

Proceed with one enhancement at a time, adding meaningful behaviour checks and running the full existing suite. Start with clearer member names and safer draft editing before adding new live connections. Keep main and deployment approval separate.
