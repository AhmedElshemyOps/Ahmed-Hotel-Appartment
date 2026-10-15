# Ahmed Quality Ops

Hospitality operations and management intelligence for serviced apartments and holiday homes. Built with React, TypeScript, Express, PostgreSQL and Firebase/Identity Platform.

**Development status:** cloud operations and market intelligence are on main. The next development increment adds compliance/activation/OTA readiness and a disconnected accounting layer with reviewed CSV imports. It is not deployed. Read [the current progress record](docs/IMPLEMENTATION-PROGRESS.md) for exact boundaries and acceptance gates.

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

Follow [hosting/configuration](docs/cloud/hosting.md), [market security](docs/market/data-security.md) and [the new module installation/security guide](docs/readiness/README.md). Apply all ordered migrations with a migration credential before starting the new application version:

```sh
npm run migrate
```

This requires a securely configured `DATABASE_URL`. Do not put secrets in GitHub or browser code. Production requires `APP_MODE=cloud`, PostgreSQL and real Identity Platform configuration; demo production hosting is deliberately disabled. GM and team account provisioning remains administrative. The current capacity is one GM and nine additional seats.

## Guides

- [Current feature completion matrix and next phases](docs/IMPLEMENTATION-PROGRESS.md)
- [Compliance, activation, OTA and reporting guide](docs/readiness/README.md)
- [Accounting/Odoo setup, CSV contract and financial methodology](docs/accounting/README.md)
- [Reservations, distribution and guest-service integrations](docs/cloud/README.md)
- [Geographic market intelligence](docs/market/README.md)
- [Original readiness plan, retained as planning context](docs/property-readiness-compliance-ota-plan.md)

No Odoo accounting writes, live OTA publication, government submission or live rental-rate publication is implemented. Odoo is deliberately disconnected until administrator approval and environment-specific acceptance. Deployment remains deferred by the owner.
