# PMS connections and automatic reservation updates

## Which connections do we need?

Start with one PMS/channel manager as the booking source of truth. Connect Airbnb, Booking.com, Expedia and other booking sites to that PMS through its supported commercial integrations. Connect Ahmed Quality Ops to the PMS. Avoid importing the same bookings directly from every OTA and again from the PMS.

Lodgify documents channel-manager synchronization for Airbnb, Booking.com, Vrbo and Expedia; verify the exact channels, account eligibility, data fields and synchronization latency for the purchased plan. Its public documentation can contain different capabilities by channel. See [Lodgify channel manager](https://www.lodgify.com/vacation-rental-channel-manager/) and [official API reference](https://docs.lodgify.com/reference). Other PMSs require separate adapters and contract tests; adding their name to the directory does not implement an API connection.

Additional connections should solve a missing requirement: Google Calendar for approved schedule publication; Drive for evidence and reports; Sheets for controlled supplements; a transactional email provider for approved guest communications; housekeeping/maintenance feeds for task completion and readiness. These are not prerequisites for deriving an internal arrivals/departures plan from reservations. iCal availability alone is insufficient for reliable financial or guest-service automation.

No PMS was selected during implementation. Therefore this branch supplies a working signed normalized event intake and a schedule, but does not claim a native live PMS connector. A provider adapter is required to translate its real API fields, status rules, webhook authentication and source update timestamps. No API keys should be pasted into chat or source control.

## File migration and later updates

1. Register actual unit numbers and channel aliases.
2. Export reservations from the authorized prior/current company source. Prefer CSV; convert XLSX to CSV using an approved process. This release rejects PDF/XLSX rather than guessing their contents.
3. Normalize into `public/templates/pms-reservations.csv` columns. Map exact source IDs, dates/status/currency and room-only rate. Lodgify financial reservation exports use checkout/cancellation periods and include tax/fee components: do not equate a gross booking total with nightly room revenue. See [Lodgify financial export announcement](https://updates.lodgify.com/announcements/reservation-reports-export-key-financial-data).
4. Use a stable account ID (`lodgify-company-a`) for subsequent uploads from the same account. The same booking ID updates that booking; a repeated file becomes unchanged. Another PMS account uses another source namespace. A PMS replacement needs an explicit crosswalk for existing bookings; dates/guest names alone are unsafe duplicate keys.
5. Preview all changes, correct validation errors and approve. Cancellations must be explicit; absent rows remain unchanged. Source-owned live reservations cannot be corrected by manual file updates.
6. Keep historical and future data coverage explicit. An empty file or missing rows never proves no bookings exist. Finance reconciliation and completeness remain separate from parser validation.

## Normalized automatic event API

`POST /integrations/reservations` is enabled only in cloud mode with server-controlled `PMS_ORGANIZATION_ID`, `PMS_SOURCE_ID` and a high-entropy `PMS_WEBHOOK_SECRET` of at least 32 characters. Store the secret in Secret Manager. One configured source/company per running service is supported initially. Other companies cannot choose tenancy in the request body. A direct provider webhook must first pass through its verified adapter.

Headers:

- `Content-Type: application/json`
- `X-AHQ-Timestamp`: Unix seconds, within five minutes of server time.
- `X-AHQ-Signature`: `sha256=` followed by lowercase hex HMAC-SHA256 over `timestamp + '.' + raw request bytes` using the signing secret.

Example normalized payload (synthetic):

```json
{
  "eventId": "provider-event-20261015-1",
  "reservations": [{
    "externalId": "booking-123", "unitNumber": "101",
    "checkInDate": "2026-10-16", "checkOutDate": "2026-10-18",
    "bookingDate": "2026-10-15", "status": "Confirmed", "channel": "Expedia",
    "dailyRateAED": 500, "commissionRatePercent": 18, "currency": "AED",
    "updatedAt": "2026-10-15T09:00:00Z"
  }]
}
```

Use the source's true modification timestamp; do not replace it with event delivery time. Map providers' tentative/enquiry/rejected statuses explicitly instead of treating all inbox items as confirmed stays. Unknown financial values must not be invented as zero; this first contract requires known room rate and commission, and rejects unsupported/incomplete records for review. A future operational-only adapter needs a separate unknown-financial-data model before accepting incomplete financial records.

Processing verifies the signature and timestamp, locks the company workspace, checks the event ID/hash, ignores strictly older or same-version records, validates units/channels/statuses/dates/currency/overlaps, and applies the entire valid batch atomically. New valid source versions update existing reservations without changing their stable IDs. Explicit cancellation removes derived arrival/departure/contact tasks automatically. Missing rows never delete a booking.

Response `200`: applied, duplicate replay or older event ignored. `202`: review required; event is recorded but no reservation changes are applied. Retrying the same event returns the recorded result. Resolve the mapping/record problem and resubmit as a new event ID/version. `401`: invalid signature; `409`: reused event ID with different contents. The adapter must monitor `202`, retry transient 5xx/429 with backoff, retain failed deliveries and periodically reconcile against the source API to catch missed notifications.

The current board refreshes every 30 seconds. This is not a guarantee of instantaneous end-to-end updates: provider delivery, adapter processing, rate limits and reconciliation determine freshness. The UI shows no-feed/stale status and recent review-required events. Last accepted event time is not proof that every source booking has been fetched. A production adapter must additionally publish its reconciliation watermark/coverage before a live-completeness claim is allowed.

## Next adapter acceptance test

For the selected PMS: test authorized property mappings; initial historical/future sync; new booking; changed dates/unit; cancellation; reinstatement; duplicate/out-of-order notification; missing invoice data; pagination; rate limit/retry; source revocation; missed-event reconciliation; and zero-booking periods. Prove tomorrow's board changes without a person entering a reservation. Keep PMS writes, OTA pricing changes, emails and Google Calendar publishing disabled until their specific approved workflows exist.
