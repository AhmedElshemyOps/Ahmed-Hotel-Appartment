# Compliance, activation and OTA readiness — implemented development increment

## What works

The existing cloud workspace and 40-unit synthetic app now expose a common readiness center. Company-scoped PostgreSQL records store jurisdiction settings, requirement reviews, evidence references, document dates and verification, operational/commercial checks, assigned tasks, per-channel content/media metadata, decisions and append-only history. The briefing uses saved records, source apartment IDs and revisions. Its downloadable HTML report is an internal draft that can be printed to PDF.

Only the GM can configure jurisdiction rules, grant responsibilities, verify changed compliance evidence, approve media/verified amenities and channel reviews, or record activation/status decisions. These sensitive operations require MFA sign-in within ten minutes. Existing individual memberships and the ten-seat constraint remain unchanged. A GM may grant compliance, operations and distribution responsibilities independently to current members; a person may have multiple responsibilities. Staff are denied until granted. The server rechecks membership and capabilities inside the transaction. This is company-level readiness access, not a new owner portal or per-property readiness permission system.

Operational/commercial staff can record evidence-backed checks and assigned tasks. Distribution staff can prepare draft media/content records. Compliance staff can record unverified documents. Private document URLs, reference numbers, notes and restriction details are hidden from staff without compliance responsibility. History access requires compliance responsibility. Reports exclude private document links/notes/references and restriction details.

## General Manager and PRO walkthrough

1. Add real units through **Property units**, then open **Compliance, Activation & OTA**. Select an apartment. New apartments start in Draft with no assumed legal eligibility.
2. In **PRO & Compliance Center**, expand jurisdiction settings. Identify the exact rental model, official authority/source, review date and review-valid-until date for each mandatory requirement. Configure reminder days and any unresolved restriction. Save rules. No legal requirement is auto-seeded into real company records.
3. Add document records with the matching requirement, issuing authority, reference, issue/expiry/renewal dates, assigned team UID and an authorized private HTTPS evidence link. Save them unverified. Record verification only after an authorized GM reviews the actual evidence. Uploading or linking a file is not government approval.
4. In **Property Activation Center**, record each operational/commercial check with an evidence URL. Required check labels cannot simply be removed to bypass the gate. Assign renewal, photography or inspection tasks to current members.
5. In **OTA Listing Readiness**, configure each actual channel separately. Record permitted photo/video references and metadata; the GM approves media and verified amenities. Prepare factual descriptions, policies and fees. The assistant flags missing content, unverified amenities, missing/undersized approved photos and unsupported video assumptions. Required photo categories and minimum width are company-configured review policies, not asserted official OTA rules.
6. A GM review is required for Ready for Submission, Submitted and Published. Published additionally requires a confirmation URL and reference. This is an internal, human-attested record; the app has not independently queried an OTA to confirm it. No platform submission/publishing request is sent.
7. Save all evidence first. Choose a status and give a decision reason. The server checks saved evidence and rejects stale revisions, mandatory legal gaps, future/expired evidence, incomplete operational checks and commercial gaps. A readiness score never replaces a legal gate.
8. Review the saved-record briefing, expiry/renewal alerts and overdue responsibilities. Download the internal review draft. It is not an owner-released report or legal opinion.

A change that invalidates an already-active unit persists Suspended. Time passing beyond evidence validity immediately changes its **effective** status to Suspended when evaluated; the old recorded decision stays in history. There is no background government notification, PMS inventory switch or automatic cancellation of existing reservations. Existing guest arrival/turnover work remains visible.

## Official source review

DCT Abu Dhabi publishes a holiday-homes licensing system and operator/owner guidance: [DCT licensing and classifications](https://dct.gov.ae/en/what.we.do/tourism/licensing.classifications.aspx), [operator manual](https://dct.gov.ae/DataFolder/Files/User%20Manual_Holiday%20Homes_Operator_EN_v1.045.pdf), [owner manual](https://dct.gov.ae/DataFolder/Files/User%20Manual_Holiday%20Homes_Owner_EN.pdf). These establish official guidance exists; they do not justify treating one generic list as complete for every rental model, building and jurisdiction. Staff must verify current applicable obligations with the authority. Dubai and other jurisdictions use the same configurable structure after their own review.

## Installation and runtime permissions

Apply migration `005_readiness.sql` after the existing migrations using `npm run migrate` and a separate migration owner. It introduces company/unit state with optimistic revision checks, grants, immutable-history records and internal report snapshots. Unit IDs are validated against the existing authoritative company workspace under its transaction lock; that workspace currently stores units as JSON, so there is no misleading relational FK to a nonexistent unit table. Readiness sections are validated independently; no client-supplied approval actor/time is trusted.

Add these grants for the dedicated runtime DB role (replace role name):

```sql
GRANT SELECT,INSERT,UPDATE ON readiness_units TO ahq_runtime;
GRANT SELECT,INSERT,DELETE ON readiness_grants TO ahq_runtime;
GRANT SELECT,INSERT ON readiness_history,readiness_reports TO ahq_runtime;
GRANT USAGE,SELECT ON SEQUENCE readiness_history_id_seq TO ahq_runtime;
```

Retain existing minimal workspace, membership-read and audit-insert grants. Do not give the runtime schema ownership, membership writes, history updates/deletes or database superuser access. These privileges require verification with the actual deployed PostgreSQL role; the portable tests do not prove production IAM or DB grants.

## Pending before production acceptance

Protected object-storage uploads, byte-level image inspection, antivirus scanning and signed download authorization are **not** implemented. This increment manages evidence/media references and declared metadata only. Do not paste bearer credentials or expiring secret tokens into evidence URLs. Reminders are computed in the app; external email/Calendar delivery for readiness tasks is not connected. Existing Google market-review exports do not automatically synchronize these new tasks. Real MFA/recovery tests, multi-client DB races, retention/deletion policy, backup restore and authorized legal-rule review remain pilot gates. Regulatory submissions, OTA publication and live price changes stay disabled.

## Employee names

Document/task assignees, team responsibilities and current readiness views use named company members. The GM manages display names in Team responsibilities after recent MFA. Apply migration 007 and grant SELECT/INSERT/UPDATE on member_profiles to the runtime role. See the [employee-name release and installation record](../../releases/EMPLOYEE-NAMES.md) for unknown/departed-member labels, snapshot history, validation and scope. Names are labels; account IDs and role/capability checks remain authoritative.
