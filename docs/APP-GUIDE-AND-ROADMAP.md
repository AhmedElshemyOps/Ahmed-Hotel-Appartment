# Ahmed Quality Ops — App Guide, Next Steps and Project Organisation

**One unified beginner’s guide • Reviewed 15 October 2026, Asia/Dubai**

## Assumptions and scope

- I assume “my app” means **AhmedElshemyOps/Ahmed-Hotel-Appartment** on GitHub.
- I assess the latest reviewed development branch, **`feature/readiness-accounting`**, including PR #7. A **branch** is a separate line of development; a **commit** is a saved version of its files. The reviewed commit is **`0e2479b16fabb54689a130e2db0c3df4e253a4c3`**.
- I assume you want to understand and plan the project, rather than move its files or deploy it during this review. Organisation changes below are proposals, not completed changes.
- The page beside this chat is a local demonstration at `127.0.0.1:3045`. I treat that as a synthetic-data presentation, not evidence of public hosting, a live Odoo connection or production acceptance.
- For “how to run it,” I give the easiest local presentation route first. Real-company mode is separate and requires administrator setup.

Where a detail is missing, I retain the safer existing behavior: fictional data stays separate, Odoo stays disconnected, and external permissions are not presumed.

## Read this first

Ahmed Quality Ops is a developing management workspace for holiday homes and serviced apartments. Its strongest implemented workflows are reservation updates, tomorrow’s operations, distribution channels, evidence-based market comparisons, property-readiness reviews and reviewed accounting imports. It is **not yet a fully connected, production-accepted hospitality platform**.

There are two experiences: a fictional 40-apartment demonstration and a separate company workspace with individual login. The demonstration shows more dashboards than the cloud workspace currently provides. A feature appearing in the demonstration does not establish that the same feature is available with real company records.

This review covers development commit **`0e2479b16fabb54689a130e2db0c3df4e253a4c3`**, branch **`feature/readiness-accounting`**. GitHub confirms that [PR #7](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/pull/7) is **open and unmerged**. Its base is main commit `739223e`. That matters: cloning only main will not give you the new readiness/accounting screens. No application code, folder layout, branch, deployment or customer data was changed to produce this guide. [E1, E2]

**Confidence key used throughout**

- **High:** directly visible in the inspected source, constraints, tests or GitHub status. This confirms what the code does, not that a real company has accepted it.
- **Medium:** an engineering assessment supported by code, but needing real data, usability testing or production checks.
- **Unverified:** the repository cannot establish the answer. No guess is substituted.

**Report Center update after the pinned review:** the development branch now includes white A4 Daily, Weekly and Monthly reports, a report date selector with recalculated period metrics, an isolated print document, page numbers and source references. Fixed audit/approval claims and invented report narratives were removed. The PDF remains a synthetic internal draft, not a live owner or Odoo statement. The organisation recommendations below have not been applied as a folder reshuffle.

## 1. What the app does

### Its purpose, in everyday language

A manager should be able to see what needs attention across a portfolio: tomorrow’s arrivals and departures, properties blocked from renting, expiring documents, incomplete listings, financial exceptions and pricing decisions awaiting review. The app brings those records and calculations into one interface. It is intended to work alongside booking and accounting systems, rather than assuming it already replaces them. **Confidence: High for the implemented workflows; Medium for the product’s eventual usefulness until a real pilot.** [E2–E8]

A few useful terms:

| Term | Plain-English meaning |
|---|---|
| PMS | The property-management system that receives bookings and manages stays. |
| OTA | A booking channel such as Airbnb, Expedia or Booking.com. |
| API / connector / adapter | An API is a system’s interface for exchanging information; a connector or adapter translates between that interface and your app. |
| OAuth | A service’s permission-granting process, used here for authorized Google exports. |
| Migration | A versioned script that changes the database structure. |
| UID | The internal user identifier assigned by the login service. |
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
| Reservations | Preview a normalized PMS CSV, accept it, update existing bookings by stable source ID, and handle corrections/cancellations. A signed event-intake endpoint exists—a receiving address that checks the sender’s signature. | No native PMS has been selected/connected by this implementation. An event endpoint needs a real provider adapter and reconciliation process. | High [E5] |
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
3. A legacy demo chat endpoint can call Gemini if configured through ordinary development startup. The dedicated presentation launcher disables that connection. Without a model connection, the server returns an explicit unavailable response. In cloud mode, general `/api/ai` use is deliberately blocked because it does not yet retrieve verified company evidence.

The latest chat welcome explicitly identifies synthetic apartments and is not marked as a live model response. The previous misleading wording has been corrected. This still does not make the generic assistant an evidence-retrieval service for company records. **Confidence: High.** [E16, E21]

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

The original cloud `workspaces` table stores units/reservations/settings inside a JSON document—structured text containing related fields— with a company-level lock and revision. Market, readiness and accounting add dedicated tables; readiness also stores structured per-unit state in JSON, while accounting has separate document and journal-line rows. Audit/history tables record changes. This is a mixed architecture, not a fully normalized enterprise database. It is a practical pilot foundation, but shared JSON locking (one change waiting for another to finish) and explicit record limits will matter as use grows. **High for structure; Medium for the likely scaling impact.** [E4, E10–E13]

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
npm run session:check
npm run session:demo
```

If the project already exists on your computer, open Terminal **inside that repository**. Check `git status` before switching branches so you do not overwrite your own edits. Fetch/select the development branch; do not clone a second copy unless that is intentional.

Open **http://127.0.0.1:3000** in your browser, or the address printed in Terminal if a different port is configured. Keep Terminal running. Press **Ctrl+C** to stop the server. `npm ci` installs the locked dependency versions; you normally need it after first download or dependency-lock changes, not every launch. **Confidence: High.** [E2, E17]

For this demo, you do **not** need PostgreSQL, Docker, Odoo, Google OAuth credentials or a Gemini key. The presentation launcher forces synthetic mode, local-only access and disabled Gemini calls even if your settings mention cloud/production. `session:check` reports configuration without printing secret values; it does not prove external services work.

The existing browser address `http://127.0.0.1:3045` is for the currently prepared local session. A new launch defaults to port 3000 unless `PORT` is set. To choose the presentation port on macOS/Linux:

```sh
PORT=3045 npm run session:demo
```

You can still use `npm run dev` for ordinary development. That command honors your normal environment settings and does not provide the same forced presentation isolation. [E21]

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
| `npm run session:check` | Check local presentation prerequisites; reports no secrets and does not authenticate to cloud services. |
| `npm run session:demo` | Force a local-only synthetic presentation with live Gemini disabled. Recommended for your session. |
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
4. Apply all six migrations with a migration account (a database login allowed to change its structure). Use a separate limited database role for the running app, including the new tables/history permissions in the module guides.
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

**Environment-file loading is now consistent:** the server, migration script and market-worker script load `.env` themselves. If it contains the approved database connection, the usual commands are:

```sh
npm run migrate
npm run market:worker
```

Do not run migrations against an accidental customer/production database. The worker is optional; it processes one queue attempt and cannot invent a missing live adapter. An earlier version of this project needed explicit environment-file loading for these scripts; that issue is fixed in the reviewed commit. **Confidence: High.** [E18, E21]

To see which cloud settings are supplied, without exposing their values:

```sh
npm run session:check -- --cloud
```

A successful report means the checked names have values, not that the values are correct, the database is reachable, login works, billing is configured or the app is deployed. [E21]

For eventual production, build first and start with `NODE_ENV=production APP_MODE=cloud` and real configuration. The Dockerfile does this packaging; the Cloud Run YAML is only a placeholder example. A successful `/healthz` response proves process liveness, not database/login/Odoo health. **Confidence: High.** [E17, E19]

### D. Common beginner errors and remedies

| Symptom | Likely explanation and next action | Confidence |
|---|---|---|
| “package.json not found” / npm cannot find a project | Terminal is in the wrong folder. `cd` into `Ahmed-Hotel-Appartment`; confirm `package.json` is there. | High |
| `node` / `npm` not found or unsupported version | Install Node 22, reopen Terminal and check the version. | High |
| New tabs are missing | You downloaded main rather than `feature/readiness-accounting`; PR #7 is not merged. Confirm `git branch --show-current`. | High |
| Port 3000 is already in use | Stop your previous local server, or choose another port: `PORT=3001 npm run session:demo` on macOS/Linux. Then use that address. | High |
| “Production requires APP_MODE=cloud” during ordinary startup | Use `npm run session:demo` for the presentation; it sets safe demo/development values. Do not weaken the production guard. | High |
| Cloud configuration error at startup | One of database/project/Firebase settings is absent. Return to demo or complete cloud setup. | High |
| Migration says `DATABASE_URL is required` | The current script loads `.env`; confirm that file is in the project root and contains a nonempty approved connection, and that you are on the current branch. Never share its secret value in chat. | High |
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

The repository contains executable workflows, not just presentation mockups: reservation import/replay/correction controls; company/member checks; signed event verification; market evidence filtering; readiness activation blockers; accounting CSV corrections/deduplication; and browser flows that exercise the integrated screens. The latest reviewed GitHub check is [successful run 38729448102](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/actions/runs/38729448102), including the Docker build. [E1, E19]

The recorded local results for this exact source are **48 service/domain/database/API/session tests + 7 browser tests + 1 production smoke test = 56 passing tests**, with TypeScript/build passing and a dependency audit reporting zero vulnerabilities at that check. I verified the GitHub run’s current success status for this review; I did not rerun the unchanged application’s full tests just to write the document. The count and local results are recorded in the progress document. **Confidence: High for those recorded checks.** [E1, E2, E19]

### What remains unfinished, fragile or easy to misunderstand

| Finding | Why it matters | Confidence / evidence |
|---|---|---|
| Demo and cloud have different breadth | A polished synthetic executive/maintenance/owner screen can be mistaken for real-company functionality. | High [E3, E9] |
| AI capabilities need continued scope clarity | The welcome wording is fixed, but cloud general-purpose AI remains unavailable; financial/market findings are primarily explicit rules. Do not advertise autonomous management. | High [E12, E16, E21] |
| Demo refresh changes fictional data | The former “Live Mode” label is now “Demo refresh.” It changes the simulation every 60 seconds; it does not connect reservations. | High [E3, E21] |
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
| Some setup details still need explanation | `.env` loading is fixed. However, `preview` remains an alias for starting the server; sample key/URL comments do not establish working cloud AI or deployment. | High [E17, E18, E21] |
| Large initial browser bundle remains | Recorded final initial JavaScript is about 985 KB minified; new accounting/readiness screens are lazy-loaded. The warning is real; actual customer-device loading time is unmeasured. | High for recorded build; Unverified user latency [E2] |

### What the repository cannot prove

The production smoke test intentionally uses an unreachable placeholder database while checking startup, built assets and denial of unauthenticated access. Therefore, passing that test **does not prove a real database, successful user login or a working backup**. PGlite tests (a PostgreSQL engine embedded inside the tests) also do not establish multi-client behavior on deployed PostgreSQL. **Confidence: High.** [E19]

Still **Unverified**: billing and live resource readiness in project `triple-hour-416118`; current deployment state/content of `ahmedqualityops.com`; a successful real Identity Platform MFA/recovery flow; storage quarantine/scanning; actual Google consent/exports; a live PMS or licensed market feed; Odoo hosting/version/entitlement/permissions; real property/legal evidence; and restore/recovery performance. This was a repository review, not a new external-system acceptance test. A custom domain or successful GitHub merge alone cannot prove any of these.

## 5. Next steps — 15 concrete enhancements in priority order

These are recommendations, not claims that the features already exist. The presentation launcher, clearer demo labels and `.env` loading fixes are **already implemented**, so they are not counted as future features.

**Difficulty with Codex:** **Small** usually fits one focused development session; **Medium** needs several coordinated changes and test/review cycles; **Large** needs multiple phases and independent acceptance. These are planning estimates, not promised dates or prices. Vendor access and administrator approvals can add waiting time even when code is ready.

| Order | Enhancement | What it adds for users | Rough Codex difficulty and what “done” should mean | Evidence / confidence |
|---|---|---|---|---|
| 1 | Friendly employee names and useful cloud date defaults | Staff choose a person rather than remembering a UID; reports start in an appropriate period. | Small–Medium. Keep stable identifiers underneath; test assignment and selected dates. Demo accounting must retain an obvious fixture-period choice. | E8, E11; High need, Medium estimate |
| 2 | A readable import review with precise row errors | Finance/operations can approve understandable columns instead of inspecting raw structured data. | Small–Medium. Explain invalid rows and account classifications without hiding any source detail. | E5, E11, E13; High need, Medium estimate |
| 3 | Separate required OTA channels from optional channels | Preparing a new optional channel need not suspend an otherwise ready apartment. | Medium. Confirm the business rule, add required/optional channel policy, and test that legal gates still cannot be bypassed. | E8; High current behavior, Medium policy/effort |
| 4 | Safer drafts and clearer save/reset behavior | Users know which changes are unsaved and do not lose work unexpectedly when navigating. | Small–Medium. Add navigation warnings and an explicit draft policy; never silently transfer demo drafts into company records. | E8, E11; High behavior, Medium estimate |
| 5 | One evidence-based GM priority list | A manager sees expiring permits, overdue tasks, failed imports, unmatched costs and pending pricing reviews together. | Medium. Start with existing rules, not a language model. Every priority needs a source record, date and responsible person. | E5–E8, E12; Medium design/estimate |
| 6 | Per-property operating times and clearer service tracking | Check-in/out contact deadlines match each property, with an honest record of contact completion. | Medium. Replace fixed planning defaults with approved property settings; keep draft preparation separate from verified delivery. | E6; High gap, Medium estimate |
| 7 | Guided invitations and responsibility management | The GM can invite staff and explain their permissions without administrative database work. | Medium–Large. Preserve the one-GM/ten-seat rule and test invitations arriving at the same time, removal and GM transfer. | E4, E10; High gap, Medium estimate |
| 8 | A controlled staging pilot with recovery checks | Real staff can test login and imports before customer information is at risk. “Staging” means a separate rehearsal environment. | Large foundation. Verify MFA/recovery, two-company isolation, limited database privileges, monitoring and a successful backup restore. Needs cloud administrator access. | E4, E19; High need; external timing Unverified |
| 9 | Protected evidence/media uploads | Staff upload documents/photos safely rather than managing external links and declared file sizes. | Large. Add private storage, quarantine/scanning, real image inspection, expiring download links and retention rules. | E8; High gap, Medium estimate |
| 10 | One real PMS connection with recovery from missed updates | Reservations, corrections and cancellations reach tomorrow’s plan with less manual work. | Large; depends on the actual PMS. Prove initial import, duplicate handling, missed-event recovery, retries and visible update lag. Do not start with many speculative OTA connections. | E5, E6; High prerequisites; connector effort Unverified |
| 11 | The first authorized read-only Odoo connector | Finance refreshes company accounting without repeated CSV exports. | Large. Discover hosting/version/API entitlement and fields first; then implement transport, permissions, account/analytic translations and acceptance. Accounting writes remain disabled. | E11–E13; High prerequisites; exact effort Unverified |
| 12 | Booking-to-accounting and bank/settlement reconciliation | Managers can distinguish earned income, unpaid invoices, refunds, commissions and actual bank differences. | Large. Use stable references, reviewed matching rules and approved shared-cost allocations. Finance must reconcile known statements independently. | E5, E12; High gap, Medium design confidence |
| 13 | Owner access with approved report releases | Each owner sees only approved information for their own apartments. | Large. Separate owner identities, property permissions and released report versions; test attempts to access another owner’s records. | E2, E14; High gap, Medium estimate |
| 14 | Preventive maintenance and evidence-backed management questions | Staff track recurring faults; the GM can ask questions tied to real incident and task records. | Large. First persist complete incidents and responsibility history. Add source retrieval/citations and tested answer quality later; do not promise forecasts without history. | E2, E9, E16; Medium priority/estimate |
| 15 | Licensed market feeds and evaluated pricing suggestions | Better dated comparisons, clearer confidence and measurable outcomes of approved decisions. | Large plus commercial data rights. Validate exact stays, fees, duplicate properties, quotas and results. Any later live rate publisher needs a separate design and approval. | E7; High dependencies; exact vendor effort Unverified |

**Suggested first milestone:** complete items 1–5 and the low-risk organisation changes below. Then prove one real company can securely sign in, import reviewed reservations/accounting and resolve readiness blockers in staging. Prioritize the actual PMS and Odoo environment before adding many integrations. Broad predictions and autonomous external actions should follow reliable records, not precede them.

## 6. How to organise the project better

### What is already helpful, and what is becoming hard to navigate

Feature groups already exist for market, readiness and accounting, each with a model, calculations and screens. Server-side code and SQL migrations are separate from most browser code. Keep those good boundaries.

The less consistent areas are `src/components`, `src/data` and `src/services`, which mix older demonstration code and cross-feature logic. Business rules, database access and web-request handling also meet in large server route files. A beginner can struggle to tell whether a file belongs to the demo, shared calculations or real-company behavior. **Confidence: High for file layout; Medium for the usability impact.** [E3, E8–E13, E20, E22]

Size is a useful maintenance signal, not proof of a defect: `ReadinessCenter.tsx` has **1,348 lines**, `CloudApp.tsx` **1,030**, `AccountingCenter.tsx` **761**, and accounting server routes **651** in this snapshot. Smaller named pieces would make specific changes easier to review. **Confidence: High for counts; Medium for the benefit of each proposed split.** [E22]

### A practical target layout

This is a **proposed destination**, not a claim these folders exist today. It keeps one application and the current tools; it does not require a complex multi-project rewrite.

```text
Ahmed-Hotel-Appartment/
├── README.md                     # Start here: mode, commands, document links
├── package.json                  # Commands and dependency list
├── .env.example                  # Blank/example settings; never real secrets
├── server.ts                     # Thin startup entry; keep initially
├── src/
│   ├── app/                      # Demo/company entry screens and navigation
│   ├── features/
│   │   ├── reservations/
│   │   ├── guest-service/
│   │   ├── revenue/
│   │   ├── market/
│   │   ├── readiness/
│   │   └── accounting/
│   │       ├── components/       # Smaller visible screen pieces
│   │       ├── model.ts          # Data shapes and validation
│   │       ├── engine.ts         # Calculations without screen/database work
│   │       └── demo.ts           # Clearly fictional feature examples
│   └── shared/
│       ├── components/           # Reused form controls and messages
│       ├── api/                  # Browser request helper and safe responses
│       ├── dates/                # Business-date/time rules
│       └── money/                # Currency/rounding helpers
├── server/
│   ├── auth/                     # Identity, company membership, permissions
│   ├── db/                       # Connections, transactions, data access helpers
│   ├── config/                   # Server-only validated settings
│   ├── features/                 # Matching server modules for each feature
│   │   └── accounting/
│   │       ├── routes.ts         # Receive/validate requests; call services
│   │       ├── service.ts        # Import/approval workflow rules
│   │       └── repository.ts     # Queries and saved records
│   └── integrations/             # Authorized external-system adapters
│       ├── google/
│       ├── pms/
│       └── accounting/
├── migrations/                   # Keep existing ordered SQL files stable
├── scripts/                      # Demo, configuration checks, migrations/jobs
├── tests/                        # Keep discovery unchanged initially
├── docs/
│   ├── README.md                 # One index explaining current vs historical docs
│   ├── guides/                   # Beginner, GM, PRO, Finance, OTA walkthroughs
│   ├── reference/                # Settings, schemas, import/integration contracts
│   ├── plans/                    # Approved roadmap and decision records
│   ├── releases/                 # Current completion matrix and acceptance results
│   ├── session/                  # Presentation walkthrough and recovery
│   └── archive/                  # Clearly labeled superseded plans
├── deploy/                       # Hosting templates and operations instructions
└── .github/                      # Automated checks and review templates
```

A **repository** file contains database queries; a **service** carries a workflow such as previewing/accepting an import; a **route** receives a web request. Those names would make server code easier to locate. A “shared” folder should contain genuinely reused functions, not become a new miscellaneous drawer.

### Specific changes, their benefit and their risk

| Proposed change | Current evidence | What it makes easier for you | Effort / care / confidence |
|---|---|---|---|
| Add `docs/README.md` as one documentation index | Many current/historical plans coexist under `docs/`. | Find the latest operating guide without mistaking a plan for a completed feature. Give every document a status, reviewed commit/date and intended reader. | Quick, low risk. High evidence, High confidence. |
| Make the unified guide the owner-facing overview | `docs/APP-GUIDE-AND-ROADMAP.md` exists beside multiple narrower guides. | Read the big picture in one place; follow detailed references only when needed. Remove contradictory copies by labeling historical material. | Quick, low risk; preserve useful history. High confidence. |
| Introduce a short change log and “ready for review” checklist | CI exists; progress records are extensive but distributed. | Know what changed, what was tested and what still needs approval in each release. | Quick. High evidence, Medium estimate. |
| Use descriptive task/PR templates | Existing workflow runs checks, but an index/template can communicate expectations earlier. | Each request states the user problem, acceptance check, data implications and deployment boundary. No silent merges or automatic live actions. | Quick. Medium process judgment. |
| Split the largest screen files into named panels | Readiness combines forms, rules/verification controls, media, briefings and grants; accounting combines setup/import/ledger/mappings/logs. | Find “document editor” or “invoice list” directly instead of scrolling a thousand lines. | Medium; keep saved-state, permissions, lazy loading and accessible labels working. High evidence, Medium estimate. |
| Extract only truly shared form controls | Both accounting/readiness define their own `Field`/`Select` helpers. | Fix labels/errors/styles in one place without changing business rules. | Small–Medium; test keyboard use and accessible names. High evidence, Medium estimate. |
| Put demo data beside its feature and label it | Current demo data is spread across `src/data`, `src/market/demo.ts` and `src/accounting/demo.ts`. | Recognize fictional inputs immediately. Keep production paths from accidentally loading fixtures. | Medium; keep the demo/company separation tests. High confidence. |
| Group browser code by feature gradually | Market/readiness/accounting are already partly feature-based; older screens/rules are in broad folders. | Know that a reservation change belongs to reservations, not an arbitrary component or data file. | Medium; update every import and lazy import. Do not do a bulk rename while adding new behavior. High evidence, Medium estimate. |
| Separate server routes, workflow rules and queries | `server/cloud.ts` and feature route files combine these responsibilities. | Change an import rule without accidentally changing authentication or SQL. | Medium–Large; preserve transaction boundaries and company checks. High evidence, Medium estimate. |
| Extract shared server transactions/errors before moving routers | Feature routers import helpers from `server/cloud.ts`, while it imports those routers. | Reduce circular references—files depending back on each other—and clarify what is safe to reuse. | Medium, needs care. This is structural fragility, not proof of a current runtime failure. High evidence, Medium impact confidence. |
| Centralize validated server settings, separate from public settings | `server.ts`, `cloudPool`, Google code and scripts inspect environment variables in different places. | See which settings are required/optional and get consistent, secret-safe errors. Keep `.env` secret; browser code must never import server secret configuration. | Medium; startup, cloud and OAuth tests required. High evidence, Medium estimate. |
| Keep money/date helpers explicit and tested | Financial engines use cents; guest planning uses business dates; other screens have display defaults. | Reuse agreed rounding and timezone rules without treating all fields as interchangeable. | Medium. Avoid silently changing existing calculations while extracting helpers. High evidence, Medium estimate. |
| Reorganize tests only after changing discovery rules | `npm test` currently targets `tests/*.test.ts`; browser tests have a separate configured directory. | Later group unit/API/integration tests clearly, while knowing none disappeared from the test run. | Needs care. Moving tests into nested folders now could silently skip them. High evidence/confidence. |
| Label legacy code before removing it | `realDataManager.ts` and the old competitor engine can look current even though active flows differ. | Avoid editing an inactive path. Identify its replacement before deletion. | Quick to label; Medium to delete. Search imports, check dynamic use, then run tests. No blanket deletion based only on a filename. High evidence, Medium removal confidence. |
| Keep build/deployment/database files stable during early cleanup | Docker explicitly copies feature paths; migration scripts find SQL relative to their location. | Avoid an app that works locally but fails in its container or cannot find migrations. | Low effort to retain; High care if moved. High confidence. |

### A safe order for the cleanup

1. **Document first, move nothing:** create a clear index, statuses, current feature matrix and release checklist. The application should behave identically.
2. **Extract one small component:** for example, the readiness document form or accounting invoice list. Keep existing entry files so imports do not all change at once. A small forwarding file can temporarily preserve an old import path.
3. **Extract server helpers:** separate transaction and error helpers from `server/cloud.ts`; confirm authorization still occurs inside the right transactions.
4. **Move one feature only:** a later PR can place accounting under the target layout. Update all source imports, tests, dynamic/lazy loading and Docker copy paths together.
5. **Only then consider grouping tests and archiving old files.** Update test commands first and confirm the same tests are still discovered.

For every behavior-preserving cleanup, run TypeScript checks, the complete test command, browser workflows, a production build/smoke test and the Docker build. Add a two-company denial check when permissions/data access are touched. **A refactor means changing organisation while preserving behavior**; keep it separate from adding a feature so a reviewer can tell what caused a regression. [E19, E22, E23]

Do **not** rename or reorder migrations already applied to a database, move secrets into a shared browser/server folder, or assume updating imports is enough for Docker/tests. Leave `dist/`, `node_modules/`, `.env` and generated test output outside committed source, as the ignore file already intends. Do not add a monorepo or a new framework just to make folders look tidier. **Confidence: High for the concrete path/secret risks; Medium for the preferred target layout.**

### Beginner-friendly repository workflow

Use small, descriptive development branches and one clear purpose per pull request—for example `docs/navigation-index`, `refactor/readiness-panels`, then `feature/employee-picker`. A **pull request** is a proposed change you can review before it joins another branch.

Each request should answer: what user problem changed, which files matter, which checks passed, what remains blocked, and whether it changes stored data or external access. Keep one current progress record, preserve historical results with their commit/date, and link to GitHub checks rather than presenting an old successful run as proof for new code.

Maintain the present boundary: **PR #7 is not merged; main changes and deployment still require explicit approval.** The local presentation can be used now without treating the cloud platform, Odoo or owner portal as complete. **Confidence: High for current status; Medium for the proposed working process.** [E1, E2]

## Evidence index — exact source for this document

Links below are pinned to the reviewed commit so future branch changes do not silently change the evidence. A source file shows implementation; an official-looking comment or screen label is not independently verified behavior. Local line counts and reference searches were checked without changing the project. The latest CI result was checked; the unchanged full application suite was not rerun merely to write this document.

- **E1 — Repository/release facts:** [PR #7, open/unmerged at review](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/pull/7); [successful GitHub check run](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/actions/runs/38729448102).
- **E2 — Current scope/results:** [README.md](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/README.md); [docs/IMPLEMENTATION-PROGRESS.md](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/docs/IMPLEMENTATION-PROGRESS.md).
- **E3 — Mode separation/demo refresh:** [src/main.tsx](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/src/main.tsx); [src/App.tsx, mode/refresh](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/src/App.tsx#L46-L83).
- **E4 — Server access/database:** [server/cloud.ts, authentication](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/server/cloud.ts#L221-L271); [cloudPool configuration](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/server/cloud.ts#L537-L557).
- **E5 — Reservations/channels:** [server/pms.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/server/pms.ts); [server/integration.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/server/integration.ts); [src/services/distribution.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/src/services/distribution.ts).
- **E6 — Operations/contact limits:** [src/cloud/OperationsBoard.tsx](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/src/cloud/OperationsBoard.tsx); [30-second refresh](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/src/cloud/CloudApp.tsx#L150-L172); [guest-service policy/limits](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/docs/cloud/guest-service.md).
- **E7 — Market evidence/rules/map/jobs:** [src/market/engine.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/src/market/engine.ts); [MarketMap.tsx](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/src/market/MarketMap.tsx); [server/market/worker.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/server/market/worker.ts).
- **E8 — Readiness implementation and limits:** [src/readiness/engine.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/src/readiness/engine.ts); [server/readiness/routes.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/server/readiness/routes.ts); [ReadinessCenter.tsx](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/src/readiness/ReadinessCenter.tsx); [module guide/runtime grants](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/docs/readiness/README.md).
- **E9 — Demo records/agents:** [src/data/simulationEngine.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/src/data/simulationEngine.ts); [src/services/specialistAgents.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/src/services/specialistAgents.ts).
- **E10 — Accounts and schema:** [migrations/001_cloud.sql](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/migrations/001_cloud.sql); [005_readiness.sql](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/migrations/005_readiness.sql).
- **E11 — Accounting UI/storage/import:** [AccountingCenter.tsx](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/src/accounting/AccountingCenter.tsx); [server/accounting/routes.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/server/accounting/routes.ts); [006_accounting.sql, disconnected/read-only constraints](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/migrations/006_accounting.sql#L1-L7); [accounting guide](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/docs/accounting/README.md).
- **E12 — Financial methodology:** [src/accounting/engine.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/src/accounting/engine.ts); [accounting/model.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/src/accounting/model.ts).
- **E13 — Adapter/CSV contract:** [server/accounting/adapters.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/server/accounting/adapters.ts); [csv.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/server/accounting/csv.ts).
- **E14 — Report boundaries:** [src/components/ReportsView.tsx](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/src/components/ReportsView.tsx); [src/readiness/report.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/src/readiness/report.ts); [src/market/report.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/src/market/report.ts).
- **E15 — Google scope and release gates:** [server/market/google.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/server/market/google.ts); [Google guide](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/docs/market/google-workspace.md).
- **E16 — Current AI wording/endpoint:** [chat welcome](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/src/components/AiManagerChat.tsx); [server.ts, cloud AI block and optional Gemini](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/server.ts#L85-L108).
- **E17 — Runtime/build instructions:** [package.json](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/package.json); [server.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/server.ts); [Dockerfile](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/Dockerfile).
- **E18 — Environment handling:** [.env.example](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/.env.example); [.gitignore](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/.gitignore); [scripts/migrate.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/scripts/migrate.ts); [market-worker.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/scripts/market-worker.ts).
- **E19 — Tests/CI/hosting boundaries:** [tests directory](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/tree/0e2479b16fabb54689a130e2db0c3df4e253a4c3/tests); [production.smoke.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/tests/production.smoke.ts); [check.yml](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/.github/workflows/check.yml); [Cloud Run example](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/deploy/cloud-run.example.yaml).
- **E20 — Legacy files to distinguish from active flows:** [realDataManager.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/src/data/realDataManager.ts); [competitorEngine.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/src/data/competitorEngine.ts).

- **E21 — Current synthetic session and fixed script environment loading:** [scripts/demo-session.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/scripts/demo-session.ts); [scripts/session-check.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/scripts/session-check.ts); [tests/session.test.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/tests/session.test.ts); [presentation runbook](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/docs/session/LIVE-DEMONSTRATION.md).
- **E22 — Organisation, file-size and build-path evidence:** [src tree](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/tree/0e2479b16fabb54689a130e2db0c3df4e253a4c3/src); [server tree](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/tree/0e2479b16fabb54689a130e2db0c3df4e253a4c3/server); [docs tree](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/tree/0e2479b16fabb54689a130e2db0c3df4e253a4c3/docs); [Dockerfile](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/Dockerfile); [playwright.config.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/playwright.config.ts); [package.json test commands](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/package.json). Screen/route line counts refer to the files linked in E4, E8 and E11, not estimates of defect counts.
- **E23 — Server dependency and migration-path evidence:** [server/cloud.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/server/cloud.ts); [server/readiness/routes.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/server/readiness/routes.ts); [server/accounting/routes.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/server/accounting/routes.ts); [scripts/migrate.ts](https://github.com/AhmedElshemyOps/Ahmed-Hotel-Appartment/blob/0e2479b16fabb54689a130e2db0c3df4e253a4c3/scripts/migrate.ts).
