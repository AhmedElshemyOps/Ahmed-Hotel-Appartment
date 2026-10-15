# Cloud workspace: distribution, PMS updates and guest service

This feature adds a separate authenticated cloud workspace to Ahmed Quality Ops. It is a review branch, not a deployed service. The earlier dashboards remain a demo; real-data switching and the old browser import wizard are inaccessible there.

## Working features

- Add, rename, alias and archive distribution channels; historic channel rows remain in totals. Channel creation does not establish an OTA connection.
- Revenue allocation by stay night for selected dates, with estimated commission explicitly labeled. Fixed strategy/savings claims were removed from this view.
- Empty real inventory with GM-controlled unit registration.
- Normalize and preview PMS reservation CSVs, approve additions/corrections/cancellations, retry safely, and reverse batches with conflict protection.
- Accept authenticated normalized booking events; ignore older updates, deduplicate retries and record review-required failures.
- Derive tomorrow's arrivals, departures, stayovers, checkout turnovers and same-day arrival priorities from current records.
- Guest-contact SLA rules, six editable email/message templates, draft preview/copy and durable contact-completion records.
- Server-verified Identity Platform authentication, email verification and authenticator MFA. Company membership determines role; client role fields cannot grant access.
- PostgreSQL constraints reserve seat 1 for the sole GM and allow only nine other seats. These are provisioned memberships, not an invitation or account-administration product yet.

Read [hosting and setup](hosting.md), [PMS and live booking integration](integrations.md), [guest-service rules](guest-service.md), and the [original assessment](../../plans/cloud/implementation-plan.md).

## Current limits

No PMS is connected. The signed intake is a provider-neutral contract, not a native Lodgify/Airbnb/Expedia adapter. No provider credentials, webhook subscriptions, cloud resources or deployments have been created. Provider mapping, API polling/reconciliation, retries/dead-letter handling and actual provider webhook verification require a follow-up adapter after PMS selection. Do not point a raw provider webhook at the normalized endpoint.

Google Calendar/Drive/Sheets OAuth, staff assignment, housekeeping completion feeds, guest contacts, outbound email/SMS, payments, complaints SLA and evidence-backed cloud AI are not implemented. The operations schedule is inside this app, not a Google Calendar sync. Booking data alone cannot verify room cleanliness or exact guest arrival time. Messages require human review and delivery through an approved external channel. Contact completion is an auditable staff assertion, not a delivery receipt.

This release intentionally keeps the new cloud workspace focused on reservations, revenue and guest-contact planning. It does not relabel the demo's finance or owner reports as production-ready. Read the release gates before a pilot.

## Verification

`npm run check` runs TypeScript checking, domain/PostgreSQL-engine/API tests and a production frontend build. `npm run test:browser` checks the UI; some browser scenarios stub identity and data responses and are not proof of live provider integration. PostgreSQL-engine tests use PGlite, including real PostgreSQL constraints/triggers, not a deployed Cloud SQL instance. Multi-client database races, managed MFA enrollment/recovery, actual PMS data, container startup, Cloud Run, backup restore and OAuth flows require staging acceptance. CI builds the container but never deploys.

`npm` and `package-lock.json` are the supported reproducible dependency workflow. A grpc override pins a patched compatible release to address the Firebase dependency advisories found during implementation. Revisit it as upstream packages update. The historical Bun lock is removed to avoid two inconsistent dependency baselines.
