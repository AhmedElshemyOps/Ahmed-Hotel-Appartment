# Project structure

## Where to find things

| Location | Responsibility |
| --- | --- |
| `src/main.tsx` | Asks the server whether to open the demonstration or company app |
| `src/app/` | App entry screens, navigation and application-wide header/sidebar |
| `src/features/` | Screens, models and rules grouped by the user activity they support |
| `src/shared/components/Field.tsx` | Form input shared by accounting and readiness |
| `src/shared/api/` | Company request helper and browser/server data contracts; no secrets or database code |
| `src/shared/types/` | General property, reservation and user role types |
| `src/shared/dates/` | Existing Dubai business-day rules |
| `src/shared/money/` | Existing AED display formatting; this does not change accounting precision |
| `src/index.css` | Global styles; reports retain dedicated print styles in their feature |
| `server.ts` | Express startup, security headers, global request handling and app hosting |
| `server/cloud.ts` | Company route composition and existing workspace operations; compatibility exports remain |
| `server/auth/` | Verified sign-in, MFA, session-age checks and core role permissions |
| `server/config/` | Required cloud-setting validation; settings come from the environment |
| `server/db/` | Database pool, transactions and locked workspace access |
| `server/features/` | Accounting, readiness and market server workflows |
| `server/integrations/` | Google OAuth, PMS import/webhook and planned read-only accounting adapters |
| `migrations/` | Existing ordered database changes; filenames and contents have not changed |
| `scripts/` | Startup, database migration, worker, demonstration and audit commands |
| `tests/` | Existing unit, database, browser and production checks, kept in place |
| `deploy/` | Hosting configuration examples; no deployment performed |
| `.github/workflows/` | Automated checks on GitHub |

Features include reservations, guest-service, operations, revenue, market, readiness, accounting, reports, properties, property-intelligence, imports, management, settings and simulation. Extra folders reflect existing screens rather than forcing unrelated screens into the seven original example folders.

## Accounting server separation

- `routes.ts` creates the router and connects the workflow registration.
- `service.ts` registers the existing HTTP workflow handlers and retains their validation, authorisation and transaction order.
- `repository.ts` contains shared connection access, ledger loading and sync/audit-log queries, including company isolation and row locks.

This is an incremental separation. Some workflow-specific SQL still lives in `service.ts`, and those handlers still use Express request/response objects. Extracting every query or introducing a framework-independent service layer is future work, not a completed claim. Market and readiness also retain larger handlers; move one tested workflow at a time when enhancing them.

## Dependency rules

Browser code must not import server modules, even just for types: put shared request/response types in `src/shared/api/contracts.ts`. Server authentication, database helpers and integrations must not import the company router composer. Browser-visible configuration must never include credentials. New shared helpers should be used by more than one area or have an explicit cross-feature purpose.

Some older feature modules re-export date, money and type helpers for compatibility. New imports should point directly to the shared helper. No rule, currency, time-zone, financial calculation or permission was intentionally changed by the reorganisation.

## Safe development commands

Run `npm ci`, then `npm run check` and `npm run test:browser` using Node 22 or later. The existing local demonstration remains `npm run session:demo`. `npm run audit:structure` checks local documentation links and critical dependency boundaries and is now included in `npm run check`.

The Docker runtime copies the complete `src/` directory because the typed server consumes shared models and feature rules. New features therefore no longer require another manual feature-specific Docker COPY entry. Dependencies, startup entrypoints, migration paths and test discovery remain unchanged.

Use the documentation index rather than guessing old paths. Links pinned to older GitHub commits in the beginner guide deliberately describe that historical reviewed snapshot; they should not be rewritten to imply a new audit of that earlier commit.

## Management controls patch

`src/features/management-controls/` groups the GM priority list, property policies, report versions, staff access and file controls. Server composition, shared authorization, team workflows and file workflows are separated in `server/features/management-controls/`. Byte inspection, scanner and private storage adapters are in `server/integrations/storage/`. The staging commands stay in `scripts/`; migration 008 adds the new records without changing earlier migrations. Start from the documentation index for the management, upload and staging guides.
