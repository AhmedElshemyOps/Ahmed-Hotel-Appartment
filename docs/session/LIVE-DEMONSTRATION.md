# Live session — synthetic demonstration

This runbook is for a screen-shared demonstration on the presenter's computer. It is not a public website deployment, and attendees do not receive remote access through the localhost address. The owner selected **Demonstration with synthetic data** on 15 October 2026.

## Before the call

1. Use branch `feature/readiness-accounting` (PR #7). Main does not include the new readiness/accounting features until a separately approved merge.
2. Install Node.js 22 and Git. Open Terminal in the project folder.
3. Run:

```sh
npm ci
npm run session:check
npm run session:demo
```

4. Open `http://127.0.0.1:3000`, or the printed address if `PORT` is already configured. Keep Terminal running. If port 3000 is occupied, stop your old local server first. On macOS/Linux you can use `PORT=3001 npm run session:demo`.
5. Share the browser window in your normal meeting application. Do not share a terminal containing unrelated credentials or confidential tabs. Bring the window to the correct size before presenting.

The launcher forces demo mode, development mode, local-only listening and disabled Gemini calls, even if `.env` contains cloud settings. Odoo stays disconnected by database/application design. The demonstration requires no company login, database, PMS, Google OAuth or Odoo key. No secret values are printed by the session check. No customer imports should be attempted in this demo.

## A 15–20 minute presentation route

| Approximate time | Show                                                             | Explain clearly                                                                                                                                                                                                                                                                                                 |
| ---------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–2 minutes      | Synthetic banner and executive dashboard                         | All performance figures are fictional demonstration data. “Demo refresh” changes the simulation; it is not a live PMS feed.                                                                                                                                                                                     |
| 2–5 minutes      | Reservations, revenue/channel view and operations/agent screens  | Show the management idea. The separate authenticated cloud implementation has reviewed reservation imports, tomorrow's operations and draft guest contacts; not every demo screen has a full real-data counterpart.                                                                                             |
| 5–9 minutes      | Compliance, Activation & OTA → Property Activation Center        | Choose an apartment. Show legal, operational and commercial blockers. An unverified permit cannot be replaced by a score. Government approval is not supplied by this app.                                                                                                                                      |
| 9–11 minutes     | OTA Listing Readiness                                            | Add a channel checklist, show content/photo gaps. Media references and declared metadata are not uploaded/scanned files. No real OTA publication occurs.                                                                                                                                                        |
| 11–15 minutes    | Odoo Accounting & Financial Intelligence                         | Select 1–30 September 2026. Show synthetic invoices, bills, payments, expenses and apartment/building contribution. The fixture shows revenue AED 400,000 and expenses AED 88,300 across 40 units; payment totals AED 420,000 are not counted again as revenue. These are example figures, not company results. |
| 15–18 minutes    | Geographic Market Intelligence                                   | Analyze synthetic comparable prices. Show evidence, selected dates, geographic scope and internal proposal approval. No live competitor feed or rate publisher is connected.                                                                                                                                    |
| 18–20 minutes    | General Manager Briefing/internal review download and next steps | Show record references and limitations. Explain what still requires licensed feeds, company configuration, legal/Finance review and production acceptance.                                                                                                                                                      |

## Practical guardrails

- Keep **Demo refresh** off for a stable presentation. Re-seeding changes the fictional operating dataset.
- Module edits may reset after navigating away. Do not promise that demo changes survive a reload or become company records.
- The legacy AI chat has no live model in the session launcher. Explain deterministic insights in the accounting/market modules instead of promising an arbitrary live AI response.
- Start with an existing unit and show a blocked activation first. The demo does not start with legally verified permits.
- Use a download as an internal draft. An owner portal and formal owner release are not implemented by this increment.
- Odoo sync readiness intentionally says blocked. Show that as a controlled boundary, not a connection failure you plan to bypass.
- A successful container build is not a deployed app. Do not apply the placeholder Cloud Run YAML to prepare this call.

## Recovery during the session

| Problem                       | Recovery                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| Blank page/server unavailable | Check the local server is running; reload.                                         |
| Wrong/missing tabs            | Confirm development branch and run `npm ci` after a dependency update.             |
| Empty accounting result       | Set September 2026, the fixture period.                                            |
| Permission/real-data prompt   | Return to the synthetic demo; no production login is needed for this presentation. |
| Download not visible          | Check the browser downloads list; avoid repeatedly creating duplicate files.       |
| Server port busy              | Stop the earlier server or use a different local port.                             |

After the session, press Ctrl+C in Terminal. No public deployment, live integration, merge to main, government submission or rental-price change is part of this runbook.
