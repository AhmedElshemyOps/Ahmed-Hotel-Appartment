# Property Readiness, PRO Compliance and OTA Launch — Implementation Plan

Status: Planning baseline. No feature is considered implemented merely because it is documented.
Branch: `feature/property-readiness-compliance-ota`
Base: `feature/distribution-pms-cloud`
Never merge to main or deploy without explicit owner approval.

## Product goal
An online-only, authenticated property intelligence platform for one General Manager and up to nine team members. Add three distinct readiness decisions: legal/contractual eligibility, operational readiness, and per-channel OTA publication readiness. Prevent activation when a mandatory legal gate is not verified. Link tasks, documents, media, reports, approvals and financial impact to the same apartment record.

## Required modules
1. **PRO & Compliance:** jurisdiction-specific requirement templates, permits, owner authorization, management agreements, inspections, expiry reminders, verified documents, responsible PRO and immutable audit records.
2. **Property Activation:** property onboarding workflow, separate legal/operational readiness results, blocking reasons, approval history, server-enforced activation rules.
3. **OTA Listing Readiness:** photo/video library, file metadata, image coverage and quality checks, verified amenities, descriptions, policies, platform-specific checklists, approval and submission status. Distinguish ready-for-submission from confirmed-published.
4. **Distribution:** authorized platform connectors, listing identifiers, sync status, channel-specific restrictions and discrepancies; no publishing without explicit approval.
5. **GM Intelligence:** blocked units, renewals, content gaps, overdue tasks, revenue exposure (labeled estimate), owner-ready reporting.
6. **Google Workspace:** OAuth integrations with Calendar for deadlines, Drive for authorized evidence/media, Sheets for controlled import/export. Do not assume connectors exist until verified.

## Initial repository audit
- `src/main.tsx` selects demo or cloud application via `/api/config`.
- `src/app/App.tsx` runs synthetic demo data.
- `src/app/CloudApp.tsx` implements a cloud workspace UI.
- `server.ts` requires `APP_MODE=cloud` in production and routes cloud API requests.
- `server/cloud.ts` checks verified Firebase sessions with MFA and membership; inspect full role rules and seat enforcement.
- `scripts/migrate.ts` applies database migrations.
- `package.json` defines lint, unit tests, build, production smoke test and browser tests.
- Google Workspace, PRO readiness and OTA media workflows are NOT verified as implemented.

## Work packages and acceptance gates

### Phase 0 — Baseline verification
- Check latest source and branch history; inspect current schema, tests, cloud UI and APIs.
- Run `npm run lint`, `npm test`, `npm run build`, `npm run test:production` and relevant browser tests.
- Record exact outputs; fix blocking failures before adding features.

### Phase 1 — Property and compliance data
- Add building/community/geo records, owner and agreement references, compliance requirements, permits, evidence metadata and expiration dates.
- Create configurable jurisdiction and rental-model rules; no fabricated legal mandates.
- Enforce organization isolation and user permissions server-side.
- Test missing/expired/revoked requirements and tenant separation.

### Phase 2 — Activation and approvals
- Add explicit legal, operational and channel-specific readiness states.
- Prevent activation on missing mandatory legal evidence; record reviewer, timestamps, reasons and version.
- Add onboarding tasks and approval workflow with server-side checks.
- Test concurrent changes, permission bypasses and state transitions.

### Phase 3 — OTA media and content
- Add authorized image/video upload and secure object storage with file limits, malware scanning and access controls.
- Add room-by-room photo coverage, verified amenity checklist, description/policy fields and versioned approvals.
- Support per-channel configurable requirements and separate submitted/published statuses.
- Do not invent official platform ranking criteria or video requirements.

### Phase 4 — GM dashboard and reporting
- Show blocked units, permit/contract expirations, OTA gaps, assigned owners and deadlines.
- Estimate revenue exposure with transparent assumptions, never as realized loss.
- Add weekly readiness and monthly owner summaries with source references.

### Phase 5 — Google Workspace
- Investigate OAuth app registration, scopes and consent requirements.
- Connect authorized Drive files, Calendar reminders and Sheets import/export.
- Store refresh tokens securely on the server, not in browser storage.
- Test token revocation, permission changes and duplicate synchronization.

### Phase 6 — Pilot acceptance
- Verify 10-active-user cap and General Manager privileges.
- Test demo vs cloud separation, audit history, backups, error recovery and role boundaries.
- Demonstrate 40 fictional units across legal, operational and OTA states.
- Produce owner-facing release notes listing completed, unverified and blocked features.
- Require explicit approval before any live deployment or OTA publishing.

## Cross-cutting rules
- Treat uploaded files as unverified until authorized review.
- Never expose access codes, guest IDs or owner private documents in public OTA exports.
- Store file bytes in protected object storage, not ordinary database JSON.
- Require explicit approval before government submissions, live price changes or OTA publication.
- Preserve existing reservation, revenue, AI and reporting functionality.
- Keep synthetic and real data strictly separated.
- Document source, status, freshness, limitations and evidence for every AI finding.

## Definition of done
A feature is complete only when its UI, server-side authorization, persistence, failure handling, tests, audit logging and user documentation are verified. A checklist or prototype alone is not production-ready.
