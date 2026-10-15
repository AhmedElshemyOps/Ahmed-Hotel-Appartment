# Secure rehearsal environment — preparation and acceptance

**Status:** repository setup and isolated database tests are implemented. No cloud staging project has been provisioned or verified by this patch. The known project `triple-hour-416118` is not assumed to be a safe separate rehearsal environment. Do not point practice tests at a company's production records.

## Prepare separate resources

Use a distinct Google Cloud project, PostgreSQL database, Firebase/Identity Platform configuration, private storage bucket, runtime identity and secrets. Start with synthetic staff and records. Use `deploy/staging.env.example` for names and the existing Cloud Run manifest as a review template; placeholders are not deployable configuration. Keep real values out of GitHub. No automatic deployment workflow is enabled.

The runtime must use the declared staging project/database/bucket. Enable the identity features needed for verified email, TOTP MFA, invited account creation and authorized domains. Provide current ClamAV signatures and an approved scanner executable. Configure private bucket public-access prevention, uniform access, logging, backups and an approved retention policy. Restrict the runtime identity to its staging resources, without service-account-key files or broad project administration.

Apply migrations 001–008 with a separate migration identity. Keep schema ownership away from the runtime. In addition to earlier feature grants, review these new minimum grants with the real database role:

```sql
GRANT SELECT,INSERT ON team_invitations TO ahq_runtime;
GRANT UPDATE(status,accepted_by) ON team_invitations TO ahq_runtime;
GRANT SELECT,INSERT,DELETE ON memberships TO ahq_runtime;
GRANT UPDATE(role) ON memberships TO ahq_runtime;
GRANT SELECT,INSERT,UPDATE ON member_profiles TO ahq_runtime;
GRANT SELECT,INSERT,DELETE ON readiness_grants TO ahq_runtime;
GRANT UPDATE(capability) ON readiness_grants TO ahq_runtime;
GRANT SELECT,DELETE ON market_property_grants TO ahq_runtime;
GRANT SELECT,INSERT ON management_reports TO ahq_runtime;
GRANT SELECT,INSERT,UPDATE ON protected_files TO ahq_runtime;
```

Retain existing scoped workspace/audit/sequence grants. The readiness-grant column update privilege permits PostgreSQL row locking; app capability edits still use checked workflows. Team serialization uses transaction advisory locks, so no organization-table write privilege is added just to lock a seat allocation. The one-GM/seat constraints remain in force. Database privileges do not replace application company checks.

## Commands and limits

Copy the example to an ignored `.env.staging` file (never to a tracked file), fill it securely, and use `DOTENV_CONFIG_PATH=.env.staging npm run staging:check`. The command prints setting names/status only. It compares declared staging project/identity and runtime project/database/bucket and rejects a declared production/staging project match. It does not authenticate cloud resources, inspect IAM, prove MFA, prove a resource's actual owning project or certify readiness.

For the isolated PostgreSQL rehearsal, install matching `pg_dump`/`pg_restore` client tools. Set `APP_ENV=staging`, distinct project identifiers, `STAGING_DATABASE_URL`, and an empty `STAGING_RESTORE_DATABASE_URL`. The source database name must identify staging (or the disposable automated fixture); the target name must contain `_restore_check_` and a suffix. Source/target must be different; the destination public namespace must have no tables, relations or functions.

Run `DOTENV_CONFIG_PATH=.env.staging npm run staging:restore`. It exports a consistent read-only database snapshot, captures table row hashes/counts, dumps without ownership/ACL copying, restores transactionally into the guarded empty destination, and compares every captured table. Temporary files are private and deleted afterwards. Secrets and subprocess output are withheld; a failed phase is reported. Verification deliberately stops above 10,000 rows per table; use an approved larger-database process for bigger datasets. No production database is created, migrated or selected automatically.

The restore proves data/schema reproduction within that isolated database. It does not restore Firebase users, secrets, bucket objects, ACLs or external integrations. Test those separately.

## Acceptance record before real operation

Record evidence for each check with environment identity, app commit, reviewer and timestamp:

1. Real staff registration, invited verified email, TOTP enrollment, fresh MFA acceptance, expired/revoked/used invite rejection and recovery.
2. Two company identities cannot read/write one another's units, reports, invitations or private files.
3. Simultaneous invitations/acceptance do not exceed ten seats; role changes/removal take effect on subsequent requests; one GM remains.
4. Production-like runtime DB grants and cloud identity can perform intended operations while denied operations stay denied.
5. Public file access is denied; actual ClamAV scanner detects its approved test fixture and missing/outdated signatures fail closed; download and deletion races are checked.
6. Run the restore against isolated **cloud staging** and record its result; separately restore/check private object backups and identity recovery.
7. Confirm secrets, HTTPS, logs, budget/instance limits, domain and recovery/runbook ownership.

Automated CI now starts disposable PostgreSQL, tests simultaneous invitations under a restricted role, and performs a real dump/restore of synthetic records. Local PostgreSQL 17 and CI PostgreSQL 16 provide code evidence, not proof that the client's cloud environment passed these gates. Existing live PMS, Google Workspace, Odoo and production deployment acceptance remain separate.
