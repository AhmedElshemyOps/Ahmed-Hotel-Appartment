# Guest-service SLA and message templates

The first service policy covers reservation contact, not a contractual customer guarantee or a complaint-resolution system. Defaults:

| Contact task | Default deadline |
|---|---|
| Request arrival arrangements | 24 hours before policy check-in |
| Check-in reminder | 3 hours before policy check-in |
| Checkout reminder | 18 hours before policy checkout |
| Post-stay follow-up | 24 hours after policy checkout |

Policy check-in is 15:00 and checkout 11:00 in Asia/Dubai for this increment. These are explicit planning defaults, not verified guest times or staff task durations. A GM can change each rule's whole-hour offset, enable/disable rules, select templates and add rules (maximum 20). Supporting arbitrary property check-in/out times is a follow-up requirement.

Tasks derive from stable reservation/rule/date keys, so refreshing does not duplicate them. A canceled reservation no longer appears as an active contact task. A changed anchor date produces a new task. Completed contacts stay in audit history; completion records are staff assertions. SLA policy changes apply to existing active stays and are audited. The board shows the last seven days through the selected operations date; it is not a complete historic SLA-compliance dashboard.

Six initial templates: booking confirmation, pre-arrival request, check-in reminder, welcome/assistance, checkout reminder and post-stay follow-up. GM can add and edit up to 30 templates. Templates use plain text and placeholders. Guest names and the company name require review; this importer intentionally excludes guest contact details. No actual arrival times, access instructions, payment links or delivery claims are invented.

`Prepare message` fills available reservation/unit/date fields and visibly flags missing details. Draft edits are local until copied, not saved as a sent message. No email provider, automatic sends, recipient lookup, delivery receipts or guest notification is implemented. `Record contact completed` requires confirmation and writes actor/time audit, without sending anything. To add outbound delivery later, introduce a verified provider, authorized recipient data, approval policy, idempotent message outbox, retries and actual delivery/bounce events.
