# Validation record — 15 October 2026

Local checks completed:

- TypeScript checking passed.
- 14 domain/PostgreSQL-engine/API tests passed. These cover GM/seat constraints, transactional import/rollback, stale preview rejection, authorization/MFA admission, signed event idempotency/order, CSV validation, period allocation, next-day scheduling and SLA-policy validation.
- 4 Playwright browser tests passed: demo isolation/revenue, cloud sign-in, operations/draft/contact-completion/rule-editor UI and channel creation UI. Authenticated UI feature tests use synthetic component fixtures; server authorization is tested separately with stubbed identity verification.
- Production frontend build passed. A large-bundle optimization warning remains; it is not a failing build.
- Production server smoke test passed: compiled assets served, security header present, anonymous company data denied, unconfigured automated intake refused. It uses synthetic config, no live database or cloud deployment.
- Dependency installation audit reported zero known vulnerabilities after the grpc patch override.

Not validated here: Docker build (Docker unavailable locally), Cloud Run/Cloud SQL, real multi-client Postgres races, actual Identity Platform MFA/recovery, native PMS adapters, external provider webhooks, email delivery, Google OAuth and backup restore. CI includes a container build but its remote outcome must be checked separately. These limitations are release gates, not implied successes.
