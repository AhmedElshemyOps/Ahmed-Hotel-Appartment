# Ahmed Quality Ops — Understand Your App and Choose Its Next Steps

**One unified beginner’s guide • Reviewed 15 October 2026, Asia/Dubai**

> **Session-preparation update:** This guide reviews source commit `8fd899a`. A later change on the same development branch adds `npm run session:demo` / `session:check`, corrects the demo refresh/chat labels, and makes migration/worker scripts load `.env`. Those specific issues below are historical findings for the pinned review, not unresolved defects in the updated session branch. Follow `docs/session/LIVE-DEMONSTRATION.md` for the current presentation instructions.

## Read this first

Ahmed Quality Ops is a developing management workspace for holiday homes and serviced apartments. Its strongest implemented workflows are reservation updates, tomorrow’s operations, distribution channels, evidence-based market comparisons, property-readiness reviews and reviewed accounting imports. It is **not yet a fully connected, production-accepted hospitality platform**.

There are two experiences: a fictional 40-apartment demonstration and a separate company workspace with individual login. The demonstration shows more dashboards than the cloud workspace currently provides. A feature appearing in the demonstration does not establish that the same feature is available with real company records.

This review covers development commit **`8fd899a38b8bd549462981fa216614a7f416bfe1`**, branch **`feature/readiness-accounting`**. GitHub confirms that [PR #7](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/pull/7) is **open and unmerged**. Its base is main commit `739223e`. That matters: cloning only main will not give you the new readiness/accounting screens. No application code, branch, deployment or customer data was changed to produce this guide. [E1, E2]

**Confidence key used throughout**

- **High:** directly visible in the inspected source, constraints, tests or GitHub status. This confirms what the code does, not that a real company has accepted it.
- **Medium:** an engineering assessment supported by code, but needing real data, usability testing or production checks.
- **Unverified:** the repository cannot establish the answer. No guess is substituted.

## 1. What the app does

### Its purpose, in everyday language

A manager should be able to see what needs attention across a portfolio: tomorrow’s arrivals and departures, properties blocked from renting, expiring documents, incomplete listings, financial exceptions and pricing decisions awaiting review. The app brings those records and calculations into one interface. It is intended to work alongside booking and accounting systems, rather than assuming it already replaces them. **Confidence: High for the implemented workflows; Medium for the product’s eventual usefulness until a real pilot.** [E2–E8]

A few useful terms:

| Term | Plain-English meaning |
|---|---|
| PMS | The property-management system that receives bookings and manages stays. |
| OTA | A booking channel such as Airbnb, Expedia or Booking.com. |
| API / connector | An authorized connection through which two systems exchange data. |
| MFA | A second login check, such as an authenticator code, alongside your password. |
| ADR | Room revenue divided by occupied apartment-nights, under the selected reporting rules. |
| RevPAR | Room revenue divided by available apartment-nights. |
| Contribution | Revenue minus the costs included in the calculation; it is not automatically complete net profit. |
| Reconciliation | Checking records against one another. A journal balancing mathematically is a narrower check than reconciling bank statements. |

### What a user can actually do

“Cloud” below means the functionality is implemented for authenticated company records **after** database, identity and account provisioning. It does not mean the app is already deployed or externally connected.

| Area | What works in the code | Important boundary | Confidence / evidence |
|---|---|---|---|
| Demo dashboards | Explore 40 synthetic apartments, reservations, financial/operational views, agent suggestions, scenarios and report screens. | These are fictional figures. The demo role selector is a presentation tool, not company authorization. | High [E3, E9] |
| Company login | Sign in individually; server checks verified email, MFA, session age and company membership. | Real identity-provider setup and recovery are not proven by source code alone. | High for checks; Unverified for live setup [E4] |
| Team access | One GM and up to nine additional membership seats; four core roles. Readiness responsibilities can be combined. | The capacity is currently a fixed database rule, not a configurable commercial subscription setting. | High [E4, E10] |
| Distribution | Add channel names/aliases and keep channel reporting coherent, including archived or unfamiliar channels. | Adding “Expedia” to the directory does not connect Expedia’s API. | High [E5] |
| Reservations | Preview a normalized PMS CSV, accept it, update existing bookings by stable source ID, and handle corrections/cancellations. A signed event-intake endpoint exists. | No native PMS has been selected/connected by this implementation. An event endpoint needs a real provider adapter and reconciliation process. | High [E5] |
| Tomorrow’s operations | View arrivals, departures, stayovers and turnovers derived from saved reservations. The operations tab refreshes company data every 30 seconds while active. | This is periodic refresh, not guaranteed instant end-to-end booking synchronization. It can only show updates that reach the database. | High [E5, E6] |
| Guest contact | Prepare editable booking/check-in/check-out/follow-up drafts; configure contact deadlines; record staff-asserted completion. | No recipient directory, automatic sending, delivery receipt or full complaint-resolution SLA is connected. | High [E6] |
| Geographic market intelligence | Record units/locations, inspect a coordinate map, review permitted dated offers, compare like-for-like stays and create guarded pricing proposals. | Demo offers are synthetic. Live licensed sources are not installed. The map has no external street basemap. Approval does not publish rates. | High [E7] |
| PRO/compliance — PR #7 | Configure reviewed jurisdiction requirements, record private evidence references and dates, verify documents as GM, see renewal/expiry alerts and assigned responsibilities. | No legal checklist is presumed universally complete. A link or staff verification is not government approval. File bytes are not uploaded/scanned by this module. | High [E8] |
| Activation — PR #7 | Evaluate legal, operational and commercial blockers; record a GM decision with evidence and revision history. Expired evidence can make effective rentability Suspended. | It does not automatically switch PMS inventory, cancel bookings or file government applications. | High [E8] |
| OTA readiness — PR #7 | Prepare channel-specific content, declared photo/video metadata, approved media references and factual quality checks. | Published is a human-attested status requiring a reference, not an independently confirmed live OTA feed. No listing is sent to an OTA. | High [E8] |
| Accounting — PR #7 | Configure a disconnected source; preview and accept accounting CSVs; inspect invoices, bills, payments and expenses; map analytic/property keys to apartments/buildings. | Odoo remains disconnected. The adapter contract/request planners are preparation, not an operational native connector. | High [E11–E13] |
| Financial analysis — PR #7 | Calculate contribution from posted, balanced revenue/expense lines; show exceptions and unallocated costs; retain source IDs/history. | Payments are not added to revenue. Missing costs, FX, bank matching and full invoice-payment reconciliation are not solved. | High [E12] |
| Reports | Produce market and readiness internal HTML drafts; the demo also has printable owner/management views. | A demo owner report is not a secure owner portal or an approved statement released to an owner. | High [E8, E14] |
| Google | OAuth/token-storage and approved market-review Drive/Sheets/Calendar export code exists. | Real-account behavior still needs acceptance. It is not a general Drive browser, Sheet importer or synchronization of all tasks. | High for code; Unverified live [E15] |

### What “AI” currently means

There are several different mechanisms, not one verified autonomous manager:

1. Calculators and rule-based findings explain recorded evidence in market, readiness and accounting modules. These do not require a paid language-model key.
2. The demo contains agent/scenario interfaces with synthetic inputs.
3. A legacy demo chat endpoint can call Gemini if configured. Without it, the server returns an explicit unavailable response. In cloud mode, general `/api/ai` use is deliberately blocked because it does not yet retrieve verified company evidence.

The chat’s welcome message nevertheless says it is grounded in “verified property data” and marks the welcome as live. That wording overstates the implementation and should be corrected. Do not use this label as evidence of a live AI connection. **Confidence: High.** [E16]

### A practical first walkthrough

Start in the local demo using section 3. Explore the executive dashboard, then:

1. Open **Compliance, Activation & OTA**. Choose an apartment, inspect why activation is blocked, and review the separate legal/operational/commercial checks.
2. Open **OTA Listing Readiness** and add a channel checklist. Observe the missing-content and approved-photo warnings.
3. Open **Odoo Accounting & Financial Intelligence**. Keep September 2026 selected for the supplied accounting demonstration. Compare invoices, expenses and payments; payment totals should not inflate revenue.
4. Open **Geographic Market Intelligence**, analyze synthetic comparable prices, and inspect supporting evidence and approvals.

These exercises use fictional data. Readiness demo edits last only for the mounted session; leaving/re-entering the screen can reset them. They do not populate real company tables. **Confidence: High.** [E3, E8, E11]

## 2. How the app is built

### The basic flow

```text
Browser
  → Express server serves the app and /api/config
  → src/main.tsx chooses demo App or authenticated CloudApp
  → Cloud requests carry the signed-in user's token
  → Server verifies identity and company/role permissions
  → PostgreSQL stores company records, revisions and audit history
  → External systems are called only by specifically implemented integrations
```

React draws the screens. TypeScript describes data types. Express receives requests. PostgreSQL persists data. Firebase/Identity Platform supplies identity tokens; your database supplies company membership and permissions. Vite builds the browser files. Docker packages the application for hosting. These are distinct responsibilities. **Confidence: High.** [E3, E4, E17]

### A navigation map of the repository

All paths below are relative to the repository folder; the evidence index links to the exact reviewed commit.

| File/folder | Responsibility | When you would open it |
|---|---|---|
| `README.md`, `package.json`, `.env.example` | Starting instructions, available commands, dependencies and configuration names. | First setup; finding the correct command. |
| `src/main.tsx` | Asks the server which mode to display. | Understanding why you see a demo instead of login. |
| `src/App.tsx` | Larger synthetic demonstration and its navigation/state. | Changing demo dashboards or labels. |
| `src/cloud/CloudApp.tsx`, `src/cloud/api.ts` | Sign-in, MFA screens, company tabs and authenticated requests. | Changing the real-company user experience. |
| `src/components/Sidebar.tsx`, `src/components/` | Demo navigation and individual dashboards/report/chat components. | Finding a visible screen in the demo. |
| `src/data/`, `src/services/` | Demo datasets, KPI calculations, distribution rules and guest-service calculations. | Understanding where numbers or task deadlines come from. |
| `server.ts` | Starts Express, loads `.env`, sets security headers, selects cloud mode and serves assets/API entry points. | Startup errors, server configuration and API routing. |
| `server/cloud.ts`, `server/pms.ts`, `server/integration.ts` | Auth/member checks, company workspace, reservation imports and signed event intake. | Data access, booking corrections and integration security. |
| `src/market/`, `server/market/` | Market UI, matching/scoring, evidence persistence, jobs and Google review exports. | Pricing suggestions or comparable-data questions. |
| `src/readiness/`, `server/readiness/` | Compliance/activation/OTA UI, validated shapes, blocking rules, permissions and internal reports. | Readiness questions and approval changes. |
| `src/accounting/`, `server/accounting/` | Accounting UI/calculations/demo, normalized validation, CSV handling, routes and adapter preparation. | Accounting imports and contribution calculations. |
| `migrations/001`–`006` | Ordered SQL files that create/change database structures. | Updating a database after a code update. Never edit an already-applied migration casually. |
| `scripts/migrate.ts` | Applies unapplied migrations transactionally under a migration lock. | Preparing a new/staging database. |
| `scripts/market-worker.ts` | Runs one market queue-processing attempt. | Understanding collection jobs; it is not itself a perpetual scheduler. |
| `tests/`, `tests/browser/` | Domain/API/database tests and browser workflows. | Checking that a change preserves behavior. |
| `.github/workflows/check.yml` | GitHub checks: install, tests/build, audit, browser tests and Docker build. | Investigating a failed PR check. It does not deploy. |
| `Dockerfile`, `deploy/` | Container packaging and example hosting configuration. | Preparing staging/production later. |
| `docs/` | Module guides, assumptions, acceptance gates and progress records. | Understanding boundaries before changing a feature. |

**Confidence: High.** [E2–E19]

### Where records live

The original cloud `workspaces` table stores units/reservations/settings inside a JSON document, with a company-level lock and revision. Market, readiness and accounting add dedicated tables; readiness also stores structured per-unit state in JSON, while accounting has separate document and journal-line rows. Audit/history tables record changes. This is a mixed architecture, not a fully normalized enterprise database. It is a practical pilot foundation, but shared JSON locking and explicit record limits will matter as use grows. **High for structure; Medium for the likely scaling impact.** [E4, E10–E13]

Some older files remain. For example, `src/data/realDataManager.ts` contains browser-local “real data” storage, and `src/data/competitorEngine.ts` contains older forecast logic. In the reviewed app, `App` is fixed to simulation, demo real imports are blocked, and a source-reference search found no import of that legacy competitor engine outside its own file. Those files do not establish an active real-data pipeline. **Confidence: High for this snapshot; search scope is this repository.** [E3, E20]

## 3. How to run it

### A. Start the demo first — no cloud account or API key needed

Install **Git** and **Node.js 22** with npm. Node runs the application; npm installs its dependencies. Node 22 matches the repository’s CI/container target. Use official installers appropriate for your computer. Check installation in Terminal:

```sh
node --version
npm --version
git --version
```

Download the correct branch:

```sh
git clone --branch feature/readiness-accounting https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment.git
cd Ahmed-Hotel-Appartment
npm ci
npm run dev
```

If the project already exists on your computer, open Terminal **inside that repository**. Check `git status` before switching branches so you do not overwrite your own edits. Fetch/select the development branch; do not clone a second copy unless that is intentional.

Open **http://127.0.0.1:3000** in your browser, or the address printed in Terminal if a different port is configured. Keep Terminal running. Press **Ctrl+C** to stop the server. `npm ci` installs the locked dependency versions; you normally need it after first download or dependency-lock changes, not every launch. **Confidence: High.** [E2, E17]

For this demo, you do **not** need PostgreSQL, Docker, Odoo, Google OAuth credentials or a Gemini key. If your shell already has `APP_MODE=cloud` or `NODE_ENV=production`, clear those settings or explicitly choose development/demo mode. A POSIX/macOS example is:

```sh
APP_MODE=demo NODE_ENV=development npm run dev
```

For optional persistent local settings, create `.env` in the repository root with only what you need:

```dotenv
APP_MODE=demo
PORT=3000
APP_HOST=127.0.0.1
```

The server reads `.env` automatically. You may copy `.env.example` as a starting point, but its `MY_...` strings are placeholders, not working credentials. `.env` files are excluded from Git. Never put real secrets in frontend code, screenshots or GitHub commits. **Confidence: High.** [E17, E18]

### B. Know what the commands actually do

| Command | Meaning / prerequisite |
|---|---|
| `npm run dev` | Start the local Express/Vite development server. |
| `npm start` | Start the same TypeScript server; behavior depends on environment variables. It does not independently deploy anything. |
| `npm run lint` | TypeScript checking (`tsc --noEmit`), not a comprehensive stylistic/security linter. |
| `npm test` | Service/domain/API/portable database tests; isolated fixtures, no live company account required. |
| `npm run build` | Create optimized frontend files in `dist/`; this does not start hosting. |
| `npm run check` | Type checking + unit/API/database tests + build + production smoke test. |
| `npx playwright install chromium` | Install the browser used by browser tests. |
| `npm run test:browser` | Run UI workflows using a test web server on port 3010. |
| `npm audit --audit-level=high` | Check dependencies for reported vulnerabilities at the time run. A clean result is not proof the whole app is secure. |
| `npm run migrate` | Update the configured PostgreSQL database. Needs a migration credential and explicit environment loading described below. |
| `npm run market:worker` | Process one market-job attempt; needs database environment and configured adapters for actual collection. |

`npm run preview` is an alias for `npm start` in this project; it is not the usual standalone Vite preview command. **Confidence: High.** [E17, E19]

### C. Company/cloud mode is a separate setup

You need a developer or administrator for initial cloud provisioning. The repository does not supply a default GM password or a self-service company creation flow.

1. Provision a dedicated PostgreSQL database and the identity project. Configure email/password login, verified email and authenticator MFA. Confirm authorized login domains and a recovery process.
2. Give the local server trusted Google application-default credentials, or use workload identity in the eventual host. Merely setting a Firebase web API key does not provide server administration access.
3. Configure environment values below. The Firebase web key is a public app identifier; server credentials and database secrets are separate.
4. Apply all six migrations with a migration account. Use a separate limited database role for the running app, including the new tables/history permissions in the module guides.
5. Create the actual GM identity, then provision its organization/member records using its real identity-provider UID in one database transaction. Enroll MFA and verify the email. Add extra company seats administratively as needed.
6. Start the application with `APP_MODE=cloud`, sign in and test company isolation with at least two test organizations before customer data.

**Configuration checklist**

| Setting | When needed | What to provide |
|---|---|---|
| `APP_MODE` | Cloud vs demo selection | `cloud` for company mode; otherwise development defaults to demo. |
| `NODE_ENV` | Production hosting | `production`; production intentionally refuses demo mode. Leave development for the first local demo. |
| `PORT`, `APP_HOST` | Optional local/host settings | Default development host is loopback and port 3000; hosting supplies its expected port. |
| `DATABASE_URL` | Cloud, migrations, market worker | Approved PostgreSQL connection, with properly verified transport/socket access. |
| `GOOGLE_CLOUD_PROJECT` | Cloud | Identity/project ID; `triple-hour-416118` was supplied in this conversation, but that does not prove its services are configured. |
| `FIREBASE_AUTH_DOMAIN`, `FIREBASE_WEB_API_KEY` | Cloud | Actual registered Firebase web app settings. |
| Google application-default credentials | Server-side cloud identity checks | Trusted developer authentication or host workload identity. Do not download/share a service-account key as a beginner workaround. |
| `PMS_ORGANIZATION_ID`, `PMS_SOURCE_ID`, `PMS_WEBHOOK_SECRET` | Optional signed reservation intake | Values agreed with an implemented, authorized PMS adapter. A Lodgify key is not interchangeable with this signing secret. |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` | Optional Google exports | Actual OAuth application credentials and registered callback. Redirect points to `/integrations/google/callback`. |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | Optional Google exports | A securely generated 32-byte key encoded as base64, held server-side. Changing it without a rotation plan makes old encrypted tokens unreadable. |
| `GEMINI_API_KEY` | Optional legacy demo chat only | An authorized model-service key. It is not required for deterministic insights and does not enable cloud AI. Live model availability was not tested in this review. |
| `APP_URL` | Listed in sample configuration | The inspected `server.ts` does not use it to establish these connections. Setting it alone does not deploy or register OAuth. |
| Odoo credentials | Not needed now | Keep disconnected. The app accepts only a Secret Manager resource reference for later use, not an API password/key in the form. |

**Important setup trap:** `server.ts` calls `dotenv.config()`, but `scripts/migrate.ts` and `scripts/market-worker.ts` do not. Simply placing `DATABASE_URL` in `.env` will not make plain `npm run migrate` load that file. With Node 22, explicitly load it:

```sh
node --env-file=.env --import tsx scripts/migrate.ts
node --env-file=.env --import tsx scripts/market-worker.ts
```

Run those only against an intentionally selected development/staging database. The worker command is optional and cannot invent a missing live adapter. A simpler future improvement is to make the npm scripts load environment consistently. **Confidence: High, directly inspected and Node’s environment-file flag confirmed locally.** [E4, E18, E19]

For eventual production, build first and start with `NODE_ENV=production APP_MODE=cloud` and real configuration. The Dockerfile does this packaging; the Cloud Run YAML is only a placeholder example. A successful `/healthz` response proves process liveness, not database/login/Odoo health. **Confidence: High.** [E17, E19]

### D. Common beginner errors and remedies

| Symptom | Likely explanation and next action | Confidence |
|---|---|---|
| “package.json not found” / npm cannot find a project | Terminal is in the wrong folder. `cd` into `Ahmed-Hotel-Appartment`; confirm `package.json` is there. | High |
| `node` / `npm` not found or unsupported version | Install Node 22, reopen Terminal and check the version. | High |
| New tabs are missing | You downloaded main rather than `feature/readiness-accounting`; PR #7 is not merged. Confirm `git branch --show-current`. | High |
| Port 3000 is already in use | Stop your previous local server, or choose another port: `PORT=3001 npm run dev` on macOS/Linux. Then use that address. | High |
| “Production requires APP_MODE=cloud” | You selected production while trying the demo. Return to development mode; do not weaken the guard. | High |
| Cloud configuration error at startup | One of database/project/Firebase settings is absent. Return to demo or complete cloud setup. | High |
| Migration says `DATABASE_URL is required` despite `.env` | Use the explicit `--env-file` command above; the migration script does not auto-load `.env`. | High |
| Login says no company seat | Creating an identity is insufficient. An administrator must assign that exact UID to a company seat. | High |
| Verified email/MFA required, or recent sign-in required | Complete verification/enrollment; sign out/in for an MFA-assured session. Sensitive decisions require sign-in within ten minutes. | High |
| Browser-test executable missing | Run `npx playwright install chromium`, then retry. Linux may additionally need Playwright’s documented system dependencies. | High for browser installation; platform-specific dependencies need local diagnosis |
| Demo accounting shows no figures | Use September 2026, the period of its fixtures. Cloud accounting needs accepted source records and correct dates. | High |
| Accounting preview is rejected | Use the exact blank template, repeated consistent document metadata, matching company ID, AED amounts and valid dates. Correct the source/export; do not bypass validation. | High |
| Market recommendation says insufficient evidence | The policy, fees, freshness or comparable count may not qualify. Review the stated reasons; a missing recommendation is not automatically a defect. | High |
| Market collection/Odoo says blocked or needs configuration | The live connector is not installed/approved. Use the supported reviewed import path; do not enter credentials in notes. | High |
| Message prepared but guest received nothing | It is a draft workflow; there is no outbound provider connected. | High |
| Frontend bundle-size warning | The build can still pass. This flags loading-performance work, not a failed deployment by itself. | High |

## 4. Where the app stands today

### What has useful implementation and test evidence

The repository contains executable workflows, not just presentation mockups: reservation import/replay/correction controls; company/member checks; signed event verification; market evidence filtering; readiness activation blockers; accounting CSV corrections/deduplication; and browser flows that exercise the integrated screens. The latest reviewed GitHub check is [successful run 38704414516](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/actions/runs/38704414516), including the Docker build. [E1, E19]

The recorded local results for this exact source are **46 service/domain/database/API tests + 7 browser tests + 1 production smoke test = 54 passing tests**, with TypeScript/build passing and a dependency audit reporting zero vulnerabilities at that check. I verified the GitHub run’s current success status for this review; I did not rerun the unchanged application’s full tests just to write the document. The count and local results are recorded in the progress document. **Confidence: High for those recorded checks.** [E1, E2, E19]

### What remains unfinished, fragile or easy to misunderstand

| Finding | Why it matters | Confidence / evidence |
|---|---|---|
| Demo and cloud have different breadth | A polished synthetic executive/maintenance/owner screen can be mistaken for real-company functionality. | High [E3, E9] |
| Several “AI” labels are stronger than the actual evidence path | Chat welcome says verified/live; cloud generic AI is unavailable. Financial/market findings are primarily explicit rules. | High [E12, E16] |
| Demo “Live Mode” only refreshes fictional data | It increments the simulation seed every 60 seconds. It does not connect reservations. | High [E3] |
| Google code is narrower than “Google Workspace integrated” | The implemented path exports approved market reviews; general evidence/document/import/task synchronization is not complete. | High for scope; live behavior Unverified [E15] |
| Odoo is deliberately blocked at database and routing level | There is no installed live transport or credential resolver. A prepared adapter is not a working integration. | High [E11, E13] |
| Accounting reconciliation is limited | It checks journal arithmetic and source residuals, not banks, settlements or complete accounts. Unknown costs remain unknown. | High [E12] |
| PMS intake is provider-neutral | Native booking synchronization, backfill and missed-update reconciliation require a selected PMS and acceptance. | High [E5] |
| Evidence/media use links and declared metadata | There is no protected file-byte upload, scanning or verified pixel inspection for these new screens. | High [E8] |
| Every recorded channel currently participates in the activation gate | One draft/incomplete optional channel can block activation or make an active unit effectively Suspended. Confirm this business rule; mandatory channels and optional expansion channels may need separate treatment. | High [E8] |
| Readiness “Published” is recorded confirmation | It cannot establish the listing is still live on the actual OTA. | High [E8] |
| No owner-scoped portal in this increment | A printed owner draft does not isolate one owner’s access from another’s data. | High [E2, E14] |
| Core account roles/capacity remain narrow | Four core roles and ten membership seats; multiple readiness responsibilities help, but the original ten-title departmental vision is not fully implemented. | High [E10] |
| Some screens expose technical IDs and long forms | Staff may struggle with UIDs, dimension keys, raw preview JSON and long single components. Actual usability needs observation. | High for UI presence; Medium for impact [E8, E11] |
| Some defaults are fixed | Guest contact planning defaults to Dubai time and 15:00/11:00; accounting demo dates are fixed. Per-property operational timing needs more work. | High [E6, E11] |
| Pilot scaling limits exist | Shared workspace locking and whole-ledger reads impose limits; large accounting results are explicitly rejected rather than silently truncated. | High for limits; Medium for performance at a future load [E4, E11] |
| Audit immutability depends partly on deployment privileges | Code appends history; a migration-owner/superuser can still alter database tables. Runtime-only grants must actually be applied and tested. | High for schema/design; Unverified deployment [E8, E11] |
| Setup instructions have environment/placeholder traps | `.env` loading differs by entry point; `preview` is an alias; model/URL comments can imply capabilities not available in cloud mode. | High [E17, E18] |
| Large initial browser bundle remains | Recorded final initial JavaScript is about 985 KB minified; new accounting/readiness screens are lazy-loaded. The warning is real; actual customer-device loading time is unmeasured. | High for recorded build; Unverified user latency [E2] |

### What the repository cannot prove

The production smoke test intentionally uses an unreachable placeholder database while checking startup, built assets and denial of unauthenticated access. Therefore, passing that test **does not prove a real database, successful user login or a working backup**. PGlite tests also do not establish multi-client behavior on deployed PostgreSQL. **Confidence: High.** [E19]

Still **Unverified**: billing and live resource readiness in project `triple-hour-416118`; current deployment state/content of `ahmedqualityops.com`; a successful real Identity Platform MFA/recovery flow; storage quarantine/scanning; actual Google consent/exports; a live PMS or licensed market feed; Odoo hosting/version/entitlement/permissions; real property/legal evidence; and restore/recovery performance. This was a repository review, not a new external-system acceptance test. A custom domain or successful GitHub merge alone cannot prove any of these.

## 5. Concrete next steps, from quick wins to larger efforts

Difficulty refers to building with Codex, including sensible tests—not to how long an external vendor will take. **Small** usually means a focused, contained change. **Medium** crosses several screens/services and needs fixtures. **Large** needs several phases, security review and real-system acceptance. These are estimates, not delivery promises.

| Order | Improvement | What it adds for users | Codex difficulty and acceptance target | Basis / confidence |
|---|---|---|---|---|
| 1 | Correct mode/AI/integration wording | Users immediately know whether a number is synthetic, imported, calculated or externally confirmed. | Small. Rename demo Live Mode; correct chat welcome; show source/freshness beside key figures. Accept when no unsupported verified/live claim remains. | E3, E16; High need, High effort confidence |
| 2 | One reliable first-run command and configuration check | Beginners can start the demo and diagnose missing cloud settings without trial and error. | Small. Standardize `.env` loading for scripts; explain preview; add a secret-safe status/check command. Test demo startup and missing-variable messages. | E17, E18; High |
| 3 | Improve date, assignee and import forms | Staff pick employee names and useful periods rather than remembering UIDs or fixed dates. | Small–Medium. Friendly labels, sensible cloud date defaults, clear unsaved-change warnings and a readable import review. Confirm whether an optional new channel should block an otherwise ready unit; implement a required-channel policy if needed. Preserve stable IDs internally. | E8, E11; High presence, Medium effort |
| 4 | Add persistent source/freshness and exception panels | The manager sees stale PMS data, unmatched accounting lines and expiring evidence before trusting a dashboard. | Medium. Source timestamps, job status, responsible employee and explicit missing-data states across modules. Test stale/disconnected cases. | E5–E8, E11; High need, Medium effort |
| 5 | Link the existing records into one GM priority list | One list connects blocked apartments, overdue tasks, renewals, failed imports and pricing reviews. | Medium. Use real saved records and links; no LLM required initially. Accept when every priority has an evidence ID, owner and timestamp. | Separate existing engines E7, E8, E12; Medium design/effort |
| 6 | Complete the repeatable CSV operating path | The company can operate while Odoo/PMS details are unavailable. | Medium. Saved approved mappings, precise row-level errors, sample-free templates, correction/cancellation guides and period completeness review. Finance signs off known fixtures. | E5, E11–E13; High value, Medium effort |
| 7 | Secure staging and recovery rehearsal | Real users can test login, isolation and restore without risking production information. | Large foundational effort; needs cloud admin access. Apply runtime DB roles, enroll two test companies, test revocation/MFA recovery, restore a backup and monitor failures. | E4, E19; High need; external timing Unverified |
| 8 | Add protected document/media storage | Staff can upload evidence safely instead of maintaining external links and declared sizes. | Large. Quarantine/scanning, signed downloads, metadata inspection, retention and access tests. Requires a company storage environment. | E8; High need, Medium effort estimate |
| 9 | Choose one PMS connection and prove its full update cycle | Bookings/corrections/cancellations feed tomorrow’s plan with minimal re-entry. | Large, dependent on authorized provider API. Prove initial backfill, idempotent events, missed-event recovery, retries and visible sync lag. Start with the actual PMS, not separate speculative OTA connectors. | E5, E6; High dependency; exact connector effort Unverified |
| 10 | Implement the first real read-only Odoo adapter | Finance can refresh verified company records without exporting files manually. | Large; version/hosting/entitlement/ACL discovery first. Implement actual transport, safe host controls, model/account/analytic normalization and source reconciliation. Administrator approves activation; writes remain disabled. | E11–E13; High prerequisites; exact effort Unverified |
| 11 | Reconcile bookings, invoices, settlements and costs | The manager can distinguish earned revenue, unpaid balances, commissions, refunds and bank differences. | Large. Stable cross-system references, explicit matching rules, exception resolution and approved shared-cost allocations. Accept against Finance-reviewed statements, not just balanced journals. | E5, E12; High gap, Medium design confidence |
| 12 | Build an owner portal with released report snapshots | Each owner sees only approved information for their properties. | Large. Independent owner identities/grants, approved immutable report versions, evidence release controls and adversarial privacy tests. | E2, E14; High gap, Medium effort estimate |
| 13 | Expand maintenance and evidence-backed AI | Recurring faults, real complaint response times and management questions become actionable across departments. | Large. First persist complete real incident/task records; then add source retrieval, citation checks and evaluations. Do not promise forecasts or savings without historical validation. | E2, E9, E16; Medium priorities/effort |
| 14 | Licensed market feeds and calibrated pricing | More reliable comparisons and better-tested recommendations for future dates. | Large plus commercial data rights. Validate fees, duplicates, exact stays, quotas and recommendation outcomes. Retain GM approval; any live rate publisher needs its own later approval. | E7; High prerequisite, exact vendor effort Unverified |

### Suggested release sequence

**First:** ship items 1–4 as clarity/usability fixes on the development branch. They reduce misunderstanding without waiting for external credentials.

**Then:** combine items 5–6 with a controlled staging pilot from item 7. A useful early milestone is: one real company can log in securely, import reviewed reservations/accounting, see tomorrow’s work and resolve readiness blockers with traceable evidence.

**After that:** select the actual PMS and Odoo environment, add protected storage, and prove a reliable end-to-end update/reconciliation cycle. Build owner access on approved data. Treat broad predictive AI and automated external actions as later work.

Before any production release, require real login/recovery, company-isolation tests, database privileges, backup restore, monitoring, a named support owner and a rollback procedure. Preserve the current owner instruction: development-branch work may continue, but **main changes, merges and deployment need explicit approval**. Odoo remains disconnected until authorized company administration approves its separately tested connection.

## Evidence index — exact source for this document

Links below are pinned to the reviewed commit so future branch changes do not silently change the evidence. A source file shows implementation; an official-looking comment or screen label is not independently verified behavior.

- **E1 — Repository/release facts:** [PR #7, open/unmerged at review](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/pull/7); [successful GitHub check run](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/actions/runs/38704414516).
- **E2 — Current scope/results:** [README.md](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/README.md); [docs/IMPLEMENTATION-PROGRESS.md](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/docs/IMPLEMENTATION-PROGRESS.md).
- **E3 — Mode separation/demo refresh:** [src/main.tsx](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/src/main.tsx); [src/App.tsx, mode/refresh](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/src/App.tsx#L46-L83).
- **E4 — Server access/database:** [server/cloud.ts, authentication](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/server/cloud.ts#L221-L271); [cloudPool configuration](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/server/cloud.ts#L537-L557).
- **E5 — Reservations/channels:** [server/pms.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/server/pms.ts); [server/integration.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/server/integration.ts); [src/services/distribution.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/src/services/distribution.ts).
- **E6 — Operations/contact limits:** [src/cloud/OperationsBoard.tsx](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/src/cloud/OperationsBoard.tsx); [30-second refresh](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/src/cloud/CloudApp.tsx#L150-L172); [guest-service policy/limits](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/docs/cloud/guest-service.md).
- **E7 — Market evidence/rules/map/jobs:** [src/market/engine.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/src/market/engine.ts); [MarketMap.tsx](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/src/market/MarketMap.tsx); [server/market/worker.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/server/market/worker.ts).
- **E8 — Readiness implementation and limits:** [src/readiness/engine.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/src/readiness/engine.ts); [server/readiness/routes.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/server/readiness/routes.ts); [ReadinessCenter.tsx](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/src/readiness/ReadinessCenter.tsx); [module guide/runtime grants](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/docs/readiness/README.md).
- **E9 — Demo records/agents:** [src/data/simulationEngine.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/src/data/simulationEngine.ts); [src/services/specialistAgents.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/src/services/specialistAgents.ts).
- **E10 — Accounts and schema:** [migrations/001_cloud.sql](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/migrations/001_cloud.sql); [005_readiness.sql](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/migrations/005_readiness.sql).
- **E11 — Accounting UI/storage/import:** [AccountingCenter.tsx](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/src/accounting/AccountingCenter.tsx); [server/accounting/routes.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/server/accounting/routes.ts); [006_accounting.sql, disconnected/read-only constraints](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/migrations/006_accounting.sql#L1-L7); [accounting guide](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/docs/accounting/README.md).
- **E12 — Financial methodology:** [src/accounting/engine.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/src/accounting/engine.ts); [accounting/model.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/src/accounting/model.ts).
- **E13 — Adapter/CSV contract:** [server/accounting/adapters.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/server/accounting/adapters.ts); [csv.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/server/accounting/csv.ts).
- **E14 — Report boundaries:** [src/components/ReportsView.tsx](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/src/components/ReportsView.tsx); [src/readiness/report.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/src/readiness/report.ts); [src/market/report.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/src/market/report.ts).
- **E15 — Google scope and release gates:** [server/market/google.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/server/market/google.ts); [Google guide](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/docs/market/google-workspace.md).
- **E16 — AI wording/endpoint:** [chat welcome](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/src/components/AiManagerChat.tsx#L40-L50); [server.ts, cloud AI block and optional Gemini](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/server.ts#L85-L108).
- **E17 — Runtime/build instructions:** [package.json](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/package.json); [server.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/server.ts); [Dockerfile](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/Dockerfile).
- **E18 — Environment handling:** [.env.example](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/.env.example); [.gitignore](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/.gitignore); [scripts/migrate.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/scripts/migrate.ts); [market-worker.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/scripts/market-worker.ts).
- **E19 — Tests/CI/hosting boundaries:** [tests directory](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/tree/8fd899a38b8bd549462981fa216614a7f416bfe1/tests); [production.smoke.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/tests/production.smoke.ts); [check.yml](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/.github/workflows/check.yml); [Cloud Run example](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/deploy/cloud-run.example.yaml).
- **E20 — Legacy files to distinguish from active flows:** [realDataManager.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/src/data/realDataManager.ts); [competitorEngine.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/8fd899a38b8bd549462981fa216614a7f416bfe1/src/data/competitorEngine.ts).
