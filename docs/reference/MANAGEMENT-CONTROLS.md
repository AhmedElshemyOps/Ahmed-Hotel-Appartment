# Management Centre — priorities, policies, report versions and staff access

Open **Management Centre** as the General Manager. The company server rechecks current membership for each request. The fictional demonstration is separate and labels disconnected staff/file/staging actions explicitly.

## Priority list

Combines recorded document-renewal alerts, overdue readiness tasks, incomplete channel checklists, failed reservation CSV previews, accounting error/blocked logs and undecided market proposals. Items retain stable source references, apartment revisions, dates and an assigned member. Portfolio import/proposal/listing issues default to the GM for triage; this is not an assertion that a specific employee caused an error. Departed assignees are clearly marked unavailable.

**Inspect evidence** loads a company-scoped source record; private document URLs are omitted from that inspector. **Open source record** opens its existing workflow and selects the apartment for readiness records. Market/import pages still retain their existing filters; the displayed recommendation/import reference identifies the specific record. Refresh loads current recorded sources; this is not a live PMS feed or automatic resolution. Historical failed previews/logs remain visible until addressed at the source. No alerts, email or messages are sent externally.

## Apartment operating policy

Select an apartment, set check-in/out times, per-rule contact offsets (-168 to +168 whole hours), and preferences. Current timezone support is explicitly **Asia/Dubai, UTC+04:00**. Other timezones/DST are rejected rather than guessed. The default remains 15:00 arrival / 11:00 departure. Offsets refer to existing company guest-service rules.

Company settings use optimistic workspace revisions, recent GM MFA, company-unit validation and an audit record. The operations board and server contact-completion checks use the same policy. Existing task IDs and completed-contact history are retained. A changed policy changes calculated due times, not a guest's verified arrival time. Preferences are staff instructions, not automatically enforced controls. Demo policy edits stay in the Management Centre and do not change real company operations.

## Immutable report versions

Save a daily, trailing-seven-day weekly, or full-calendar-month version. Each version includes its selected/prior dates, methodology, recorded reservation fields, applied stay nights, source revision/import identifiers and capture timestamp. It compares room revenue, recorded commission, after-commission revenue and occupied nights under one method. Cancellation and checkout-night exclusions are consistent. The previous period is calculated from the **same captured record versions**, not claimed historical booking pace. Unequal calendar months are not normalized.

Snapshots are stored independently of later reservation changes; a database trigger prohibits updates/deletes. Later bookings/corrections require a new version. After-commission revenue is **not net profit**: operating expenses, tax and missing costs are excluded. This is a new company report-history workflow, not a claim that legacy demo reports now contain live accounts. The history list shows the newest 100 versions; existing older IDs remain individually retrievable. Report Center PDF styling is unchanged.

## Staff invitations and permissions

The GM can reserve one of seats 2–10 for 72 hours. One GM remains fixed in seat 1. Pending, unexpired invitations count toward capacity; revoked/expired reservations can be reused. A company-specific PostgreSQL transaction lock serializes seat creation, acceptance, role changes and removal. Database constraints additionally enforce one GM and seat uniqueness.

Create an invitation with the intended email, name, staff role and readiness responsibilities. The resulting high-entropy link is shown only when created; only its hash is saved. Share it through an approved private channel. No automatic email delivery is installed. Opening the link removes the token from the browser URL into component memory.

The recipient signs in or creates an account through the configured Firebase project, verifies the invited email, enrolls TOTP MFA, then signs out/in with that factor. Acceptance requires a verified matching email, an MFA token authenticated within ten minutes, an unexpired pending invitation, and no existing company seat. The code is single-use; roles/responsibilities come from the invitation in the database, not the recipient's request.

GM can edit staff roles/readiness responsibilities or remove company access after recent MFA. General Manager replacement is excluded. Removal deletes the membership, associated readiness/member-profile/market-access grants; future requests fail even if an old identity token still exists. Source assignments and audit history are retained and may need reassignment. Global Firebase accounts are not deleted. Existing in-flight requests retain the usual authorization-at-check boundary. Live MFA, email delivery and account recovery remain staging acceptance requirements.
