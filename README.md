# Ahmed Quality Ops

Hospitality operations and management intelligence for serviced apartments and holiday homes. Built with React, TypeScript, Express, PostgreSQL and Firebase/Identity Platform.

**Development status:** GitHub main includes cloud operations, market intelligence, compliance/activation/OTA readiness, disconnected accounting and the redesigned Report Center. This development increment reorganises the source and documentation. Deployment has not been verified. Read [the current progress record](docs/releases/IMPLEMENTATION-PROGRESS.md) for exact boundaries and acceptance gates.

## Prepare a live presentation

Use `npm run session:check` followed by `npm run session:demo`. The launcher forces a local-only synthetic demonstration and disables live Gemini calls. Follow [the session runbook](docs/session/LIVE-DEMONSTRATION.md) for the presentation route and recovery steps. Read [the unified app guide and roadmap](docs/guides/APP-GUIDE-AND-ROADMAP.md) for the full beginner explanation.

## Run a local synthetic demonstration

Use Node.js 22. No company credentials are required for the demo.

```sh
npm ci
npm run dev
```

Open the local address printed by the server. The demo is labeled synthetic and cannot switch into real company data. New readiness/accounting demo edits last only for the mounted session and never seed cloud tables. Choose **Compliance, Activation & OTA** or **Odoo Accounting & Financial Intelligence** in the existing navigation.

## Run checks

```sh
npm run check
npx playwright install chromium
npm run test:browser
npm audit --audit-level=high
```

`check` includes TypeScript, service/domain/database/API tests, a frontend production build and a production-server smoke test. Portable database tests use PGlite; live PostgreSQL concurrency, backups and actual identity-provider recovery still require staging.

## Configure a cloud environment later

Follow [hosting/configuration](docs/reference/cloud/hosting.md), [market security](docs/reference/market/data-security.md) and [the new module installation/security guide](docs/reference/readiness/README.md). Apply all ordered migrations with a migration credential before starting the new application version:

```sh
npm run migrate
```

This requires a securely configured `DATABASE_URL`. Do not put secrets in GitHub or browser code. Production requires `APP_MODE=cloud`, PostgreSQL and real Identity Platform configuration; demo production hosting is deliberately disabled. GM and team account provisioning remains administrative. The current capacity is one GM and nine additional seats.

## Guides

- [Current feature completion matrix and next phases](docs/releases/IMPLEMENTATION-PROGRESS.md)
- [Compliance, activation, OTA and reporting guide](docs/reference/readiness/README.md)
- [Accounting/Odoo setup, CSV contract and financial methodology](docs/reference/accounting/README.md)
- [Reservations, distribution and guest-service integrations](docs/reference/cloud/README.md)
- [Geographic market intelligence](docs/reference/market/README.md)
- [Original readiness plan, retained as planning context](docs/plans/property-readiness-compliance-ota-plan.md)

No Odoo accounting writes, live OTA publication, government submission or live rental-rate publication is implemented. Odoo is deliberately disconnected until administrator approval and environment-specific acceptance. Deployment remains deferred by the owner.

## Find your way around

Start at the [documentation index](docs/README.md), then read the [current folder guide](docs/reference/PROJECT-STRUCTURE.md). Run `npm run audit:structure` to check documentation links and browser/server boundaries.

## Management controls development patch

The Management Centre adds evidence priorities, apartment operating policies, saved period comparisons and guided staff access. Private upload code fails closed until private storage and a real scanner are configured. Cloud staging remains unprovisioned; see [setup and boundaries](docs/releases/MANAGEMENT-CONTROLS.md). Run the normal checks with `TEST_POSTGRES_URL` pointing only to a disposable local `ahq_test` database to include concurrent-seat and backup/restore rehearsals; CI supplies its own temporary PostgreSQL service.
