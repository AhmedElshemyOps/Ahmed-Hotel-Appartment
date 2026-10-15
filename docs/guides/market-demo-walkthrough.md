# Forty-apartment demonstration

Run the existing app locally, then choose **Geographic Market Intelligence** in its sidebar. This is the same React app and uses the same operational demo apartment IDs. No database seeds, source accounts or rental rates are changed.

1. Confirm the visible **SYNTHETIC DEMONSTRATION — no real market prices** banner. Forty apartment profiles are split across a Yas Island illustrative market and a second Dubai illustrative market. All property positions, building names, operators, price observations, policies and forecasts are synthetic. The example is configurable through the market models and real registry; Yas Island is not hardcoded into the matching engine.
2. Choose a studio, the next seven check-in dates, one-night stay and two guests. Click **Analyze market prices**. The synthetic feed has only one-night/two-guest/flexible examples; another stay length should correctly show insufficient evidence.
3. Review median/mean/P25/P75, physical-unit count, current guest-facing price, range position, collection times and matched-listing trends.
4. Open **Geographic map**. Pan/zoom and inspect managed/comparable markers, radius and uncertainty circles. No background tile data or authoritative community boundary is implied.
5. Open **Comparable evidence**. Inspect wrong-bedroom, stale or otherwise excluded observations, provisional scores, platform labels and synthetic operator disclosures. Multiple platform offers for one physical apartment do not inflate the primary sample count.
6. Open **Forward pricing**, save a supported proposal and review it in **Approval center**. Try an invalid override; it is rejected by the same conceptual guardrails. A valid internal approval changes no rate or schedule. Demo decisions are session-only; cloud decisions use immutable server records.
7. Ask management questions about rate review, cheaper/above-market positioning, matched trends or disclosed operators. Ask about competitor occupancy to see missing-evidence handling. Run an 8% fixed-night scenario and note the demand-response limitation.
8. Generate a daily/weekly/monthly review HTML report. It preserves the synthetic banner, price basis, source IDs and limitations and can be printed to PDF.
9. Change scope to **building**. Because there are no verified same-building synthetic competitors, the engine withholds suggestions rather than widening the sample silently.
10. Cloud-only registry, source, permission and OAuth controls are intentionally not available as fake live connections in the demo. They require an authenticated configured cloud workspace and explicit data review.
