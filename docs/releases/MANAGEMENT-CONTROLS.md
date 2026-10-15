# Development patch — enhancements 5–10

## Delivered code

- **5:** General Manager priorities with employee labels, stable source IDs/revisions, evidence inspection and source navigation.
- **6:** Apartment check-in/out policy, per-contact-rule offsets and preferences; company revision checks; shared board/server deadline calculations; explicit Dubai timezone scope.
- **7:** Immutable company report versions with captured current/prior periods, inputs, methodology and source/import references. Existing report snapshots cannot silently change with later booking edits.
- **8:** Guided private invitation creation/acceptance, fixed GM/ten-seat capacity, MFA/email/token checks, staff role/responsibility editing, invitation revocation and company-access removal. No automatic emails or global identity deletion.
- **9:** Private document/photo upload code, byte/image inspection, quarantine/scanner contract, authenticated checksummed downloads, retention/delete/rescan workflows and private-evidence readiness checks. Real scanner/bucket acceptance remains pending.
- **10:** Separate staging settings/checks, guarded backup/restore command, acceptance runbook and disposable real-PostgreSQL CI rehearsal. **Live cloud staging is not provisioned or verified.**

## Verification and boundaries

Local verification passed: 60 root tests (including both real PostgreSQL rehearsals), 11 browser workflows and 1 production smoke test: **72 automated tests**. TypeScript, production build, structure/link checks and whitespace checks passed. Dependency audit reported zero vulnerabilities. The priority and comparison screens were visually inspected. GitHub CI independently reruns these checks and container packaging; its result is recorded in the pull request. Local real PostgreSQL tests exercise competing invitations and duplicate acceptance under a restricted runtime role, plus a full isolated dump/restore with synthetic data hashes. Browser checks cover the Management Centre, apartment-policy separation, report-version creation and invitation URL handling. Portable/API tests cover permissions, company scope, quarantine, availability and immutable records. The new image decoder was added; no live accounting or OTA write operation was enabled.

Company setup requires migration 008 and the reviewed grants in the staging reference. Actual Firebase onboarding/recovery, private bucket IAM, a running up-to-date virus scanner, cloud restore, live providers and deployment have not been accepted. The synthetic demo explicitly disables invitation/file/cloud actions. Existing large-bundle warning remains. This patch is published on a development branch for review; it does not authorize merging or deploying itself.

See [management workflows](../reference/MANAGEMENT-CONTROLS.md), [private files](../reference/PRIVATE-UPLOADS.md) and [staging acceptance](../reference/STAGING.md).
