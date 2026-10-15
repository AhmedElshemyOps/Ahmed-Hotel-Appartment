# Hosting recommendation and setup

## Recommended first environment

Use Google Cloud Run (web application), Cloud SQL PostgreSQL (authoritative storage), Identity Platform (email/password plus mandatory authenticator MFA), Secret Manager (database credentials and integration signing secret), and Cloud Logging/Monitoring. Add private Cloud Storage when document uploads are implemented. Keep one company portfolio per membership scope in this version; there are no per-property user grants yet.

Cloud Run and Cloud SQL support Doha (`me-central1`), a practical regional option to evaluate for UAE users. Doha is outside the UAE. Confirm the company's residency requirements, latency and support before choosing it; Google identity, email and future AI services need their own residency review. A UAE-only requirement needs a separately verified hosting/identity architecture. Use HTTPS load balancing for a custom domain where regional direct domain mapping is unsupported. Sources checked 15 October 2026: [Cloud Run locations](https://docs.cloud.google.com/run/docs/locations), [Cloud SQL locations](https://docs.cloud.google.com/sql/docs/postgres/locations).

This is a managed full-stack workload, not static website hosting. PostgreSQL, backups, logging, load balancing and model usage can dominate cost even with ten users. Estimate the actual region/instance/HA/storage/traffic choices using [Cloud Run pricing](https://cloud.google.com/run/pricing) and [Cloud SQL pricing](https://cloud.google.com/sql/pricing). No cloud budget or fixed monthly quote is assumed. Set budget alerts and max instances; budget alerts alone do not cap spending.

## Files supplied

- `Dockerfile`: Node 22 build/runtime image, non-root execution, static frontend plus typed server.
- `deploy/cloud-run.example.yaml`: placeholder service manifest; it is not ready to apply without replacing all values.
- `migrations/`: database schema with constraints, audit history and reservation event tracking.
- `scripts/migrate.ts`: ordered transactional migrations under an advisory lock; run using a separate migration credential before the application release, never on each request.
- `.github/workflows/check.yml`: checks, browser tests and container build. No deployment action.

## Provisioning sequence (requires explicit deployment approval)

1. Create company-owned staging/production projects, billing and region decisions. Create separate service accounts, databases and identity projects. Enable Identity Platform email/password, email verification and TOTP MFA. Configure authorized domains, password/reset policies and a tested lost-authenticator recovery procedure. See [Identity Platform TOTP](https://cloud.google.com/identity-platform/docs/web/totp-mfa).
2. Provision PostgreSQL with encrypted connections, automated backups/PITR and private access or a Cloud SQL connector/socket. Store `DATABASE_URL` in Secret Manager; never disable TLS certificate checking. Use runtime IAM and database permissions limited to this application. Limit the connection pool (5 per instance; maximum 2 instances in the example). Application runtime must not be a superuser or migration owner.
3. Install the locked dependencies with `npm ci`, run `npm run check`, and run `npm run migrate` against staging with a migration account. Apply SQL grants below to a separately created runtime login.
4. Create the GM identity in Identity Platform through trusted administration, then insert the company and seat in one database transaction. Do not enable public signup UI. Unassigned Firebase accounts have no company-data access. Populate UIDs from the actual identity provider, never from submitted browser fields.
5. Example provisioning (replace every identifier/value; run under trusted administration):

```sql
BEGIN;
INSERT INTO organizations(id,name,gm_uid) VALUES ('company-a','Actual company','ACTUAL_GM_UID');
INSERT INTO memberships(uid,organization_id,seat,role) VALUES ('ACTUAL_GM_UID','company-a',1,'General Manager');
COMMIT;
-- Additional seats: unique integers 2–10, roles Finance Manager, Revenue Manager or Read-Only Viewer.
```

Runtime grants, after creating a dedicated runtime role:

```sql
GRANT SELECT ON organizations, memberships TO ahq_runtime;
GRANT SELECT, INSERT, UPDATE ON workspaces, import_batches TO ahq_runtime;
GRANT SELECT, INSERT ON integration_events, audit_events TO ahq_runtime;
GRANT USAGE, SELECT ON SEQUENCE audit_events_id_seq TO ahq_runtime;
```

The runtime has no membership/organization write endpoint and cannot modify audit history. Provisioning is manual in this release, so invitation races do not exist yet; future invitation reservations need an explicit transactional seat policy.

6. Required environment: `APP_MODE=cloud`, `NODE_ENV=production`, `DATABASE_URL`, `GOOGLE_CLOUD_PROJECT`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_WEB_API_KEY`. The Firebase web key is a public application identifier, not the admin credential. Server SDK uses workload identity/ADC. Sessions use in-memory browser tokens, verified and checked for revocation on every server request; sign-in age is limited to 12 hours. Never ship a service-account key to the browser. Enable and test the authenticator UI; after enrollment the user signs in again for an MFA-assured session.
7. Review/build the image; test `/healthz`, `/api/config`, protected API failures, authorized data access and static assets. `/healthz` confirms process liveness, not database health. `/api/workspace` exercises authenticated database access.
8. Run the staging acceptance checklist below. Publish only after explicit approval. There is deliberately no automatic deployment or main merge.

## Membership removal and GM transfer

Removing a team membership immediately blocks future data requests. Revoke the Firebase user's sessions/disable the identity as appropriate; verification checks revocation on each API call. Existing browser content cannot be retracted, so revoke/export access promptly and sign out shared devices. All permissions are at the company portfolio level in this increment.

Transfer GM authority under trusted administration in one transaction with deferred constraints. Swap seats 1 and the successor's existing seat, swap their roles, and update `organizations.gm_uid`; then revoke both users' existing sessions. The deferred trigger/foreign key rejects zero-GM and wrong-seat states. Verify successor identity/MFA before transfer and record an administrative audit event. No self-service transfer or recovery bypass is provided.

## Release gates still required

- Real Identity Platform verification/enrollment/challenge/recovery and immediate account-disable tests.
- Two simultaneous PostgreSQL clients testing conflicting imports, channel changes and constrained membership administration.
- Container build/start and Cloud Run SQL connectivity with runtime-only credentials.
- Signed integration adapter contract tests using the selected PMS sandbox, reconciliation and failure alerts.
- Restore rehearsal; agree RPO/RTO and retention before importing real records.
- Independent security review, company privacy/retention policy, cleanup of expired previews and audit retention. The JSONB workspace is intentionally a small-portfolio implementation with a company-wide lock; split high-volume records into relational tables before scaling beyond the pilot limits.
