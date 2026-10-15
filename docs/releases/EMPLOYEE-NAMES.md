# Enhancement 1 — employee names

## Result

Managers select a named employee for compliance documents, assigned readiness tasks and team responsibilities. Names also appear in current renewal alerts, overdue-task briefings, reviewer/history labels and newly generated readiness reports. Each choice includes the account's role and seat, so duplicate names remain distinguishable. Accounts without a saved name show “Name not set” with their role/seat. Removed or unavailable assignees show a clear reassignment message rather than silently selecting another person.

In **Compliance, Activation & OTA → Team responsibilities**, the General Manager can select an existing employee, set their display name and save it. This does not invite employees, change their identity-provider profile, rename login accounts, alter roles or grant permissions. The GM must have signed in with MFA within ten minutes. A conflicting name edit is rejected; use **Refresh team directory** and select the employee again. This refresh preserves the current unit draft.

The synthetic demonstration includes three explicitly fictional people. Demo name changes live only in mounted component memory and reset on reload or leaving the module; company names are saved in the database. Existing assignments, permissions and audit actors continue using their original account IDs. Previously saved/downloaded report snapshots do not change when an employee is renamed. An old report may still contain the identifiers it originally captured.

## Installation for company mode

Apply migration `007_member_names.sql` using the existing `npm run migrate` workflow before starting this version in company mode. Older migrations are unchanged. The new `member_profiles` table references a current company membership and cascades profile removal when that membership is deleted. It does not create members, change the one-GM/nine-team capacity or seed fictional records.

For a separate runtime database role, add only:

```sql
GRANT SELECT, INSERT, UPDATE ON member_profiles TO ahq_runtime;
```

Retain the existing minimal grants documented in the readiness reference. No membership-writing, schema-owner, superuser or new credential privilege is needed by this feature. Verify grants and concurrent behavior with the actual PostgreSQL environment before production acceptance.

## Checks and inspection

- 53 root tests passed, including new employee-label/report-escaping and company/API security tests.
- 9 browser workflows passed, including duplicate names, GM display-name editing, document/task selectors, saved assignment IDs, briefing names and demo reset.
- 1 production smoke test passed. Total: 63 automated tests.
- TypeScript, production build, documentation/boundary audit and whitespace checks passed. Existing large-bundle warning remains.
- Security tests cover current-company membership, cross-company read/write refusal, GM and recent MFA, invalid names, unexpected permission fields, stale changes, audit records, unchanged membership rows, removal, and rejection of display names or foreign IDs as assignees.
- Report names are escaped as untrusted text. Browser labels use React text rendering. No account emails, credentials or identity-provider directory lookup were introduced.

Portable database tests do not establish actual PostgreSQL races or deployed database-role grants. Live identity acceptance, hosting and external integrations remain separate gates. GitHub CI independently verifies the container build. No merge, deployment or other enhancement is included.
