# Google Workspace workflows

## Implemented, configuration-gated paths

- Server authorization-code OAuth with state, PKCE, single-use browser binding, exact configured redirect and a ten-minute consent-state expiry.
- GM/recent-MFA start and connection changes; server rechecks GM/property access during callback.
- AES-256-GCM encrypted refresh/access tokens in PostgreSQL; no Google token is returned to the browser or saved in browser storage. Encryption requires a dedicated 32-byte key from secret storage.
- Refresh-token preservation when a token response omits a replacement, refresh before expiry, explicit reconnect errors and local disconnect with best-effort provider revocation.
- Scope-minimized `drive.file` and `calendar.events.owned` for the enabled approved-review workflows. No full-Drive scope.
- Export an internally approved recommendation as an app-created Google Sheet (RAW cell values), save a review report to an app-created Drive file, or create a 30-minute pricing-review event tomorrow at 09:00 Asia/Dubai in the consenting company account's owned primary calendar.
- Idempotent application export records, Drive app-property lookup and deterministic Calendar event IDs protect normal retries. External crash/retry, quota and concurrent-change behavior require real-provider contract tests; no exactly-once external-delivery guarantee is claimed.
- Current source expiry/revocation/export rights are rechecked before exporting an approved historic review. No guest details or private building instructions are exported. No live rental rate is changed.

Primary references: [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Drive scope selection](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Sheets scopes](https://developers.google.com/workspace/sheets/api/scopes), [Calendar scopes](https://developers.google.com/workspace/calendar/api/auth).

## Required setup — not executed against any company account

After deployment approval, create a company-owned OAuth application with the applicable consent/verification status, enable Drive/Sheets/Calendar APIs and configure:

```text
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_OAUTH_REDIRECT_URI=https://APPROVED_APP_HOST/integrations/google/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=<base64 of a securely generated 32-byte key>
```

Put secrets in Secret Manager, not the repository. Use separate clients and keys in staging/production. Register the redirect exactly. Use a company-managed Google identity whose primary calendar is appropriate for pricing reviews; no personal-calendar ingestion exists. The app can create its own export files only; it cannot browse all company documents with `drive.file`.

The user-facing **Google Workspace review workflow** reports whether setup/consent is present. “Configured” is not proof of a live tested integration. Connect starts explicit OAuth consent. Publish requires an already approved proposal plus a separate explicit user action. External sharing permissions remain controlled in Google; copying/downloading can outlive app access. Disconnect stops this app's token use and reports whether provider revocation was confirmed.

Google verification requirements depend on actual audience and scopes. External OAuth Testing can issue seven-day refresh tokens for Workspace scopes, so it is not a permanent production configuration. [Google token policy](https://developers.google.com/identity/protocols/oauth2).

## Still pending

No real Google project, secret, consent, account or file was connected during implementation. Mocked security tests do not establish actual provider compatibility. Staging must verify consent, scope denial, token rotation/revocation, callback replay, Drive-created spreadsheet behavior, RAW values, Calendar permissions, duplicate/ambiguous response recovery and all source-export restrictions.

Verified event ingestion/relevance scoring, stale-research reminders, selected existing Sheet rate-schedule import, owner-report folder organization, controlled evidence-document picking and arbitrary company resource allowlists are future integrations. The current review-meeting action is not a demand-event feed; a calendar event never creates a price premium automatically.
