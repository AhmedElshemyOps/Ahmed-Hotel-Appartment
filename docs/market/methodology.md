# Comparison, benchmark and pricing methodology

Formula version: `market-v1.0-provisional`. This is transparent decision support, not a scientifically calibrated revenue-optimization model. There is no automated rate publisher.

## Geographical and accommodation admission

The GM chooses building, community, district, nearby or city scope and a radius (500 m/1/2/3/5 km or custom 100 m–50 km). Building comparisons require a verified building reference; community/district checks compare explicit registry fields, not an inferred circle boundary. Other scopes still require the same city/country. Except for explicit wider-city scope, distance plus location-uncertainty margins must fit the radius. Competitor uncertainty above 500 m is excluded. A verified managed location older than a year requires renewal. No community boundary is fabricated.

Hard rules retain bedroom equality (studio = zero), accommodation category, rental model, similar guest capacity (difference no more than one and enough capacity for the query), identical check-in/out, quoted guest count, exact cancellation category and quote-context key, verified availability, minimum stay and AED. Long-term pricing is withheld in this version. Different dates/lengths or incomplete fee totals never substitute for the requested quote. The engine never silently expands geography or accommodation type to make a sample look sufficient.

Every result lists reasons for exclusion. The proprietary/private access instructions and guest records are absent from market data, maps, prompts and reports.

## Provisional comparable score (100 points)

| Factor | Maximum | Behavior |
|---|---:|---|
| Geographic relevance | 30 | Building > community > district > explicitly wider geography |
| Capacity and bathrooms | 20 | Penalize differences after hard capacity checks |
| Floor area | 10 | Relative size difference; unknown values are disclosed rather than fabricated |
| Amenity overlap | 10 | Overlap with managed-unit amenity set |
| Furnishing and view | 10 | Matching disclosed attributes receive more weight |
| Normalized guest review | 10 | Compare only provided scores normalized to 0–10; provider adapter must preserve evidence/scale interpretation |
| Location reliability | 10 | Exact verified versus approximate precision |

Below 55/100 is excluded. Missing optional data lowers scoring support; these weights are ranking heuristics, not an assertion that a pool/view adds a known AED premium. There is no unsupported quality-adjusted price prediction. Seasonal/events/booking pace are not scored as established demand without verified feeds.

## Observation identity, deduplication and history

Supplier observation IDs are immutable. Repeated identical IDs are unchanged; changed content under the same ID is rejected. Listing metadata is versioned by its content hash. A documented physical-unit key links platform offers; addresses/host names/images alone do not auto-merge apartments. A GM must verify the identity evidence supplied by the licensed source. Two platform offers for the same physical unit get one physical-property vote in the primary benchmark.

The latest observation per source listing is selected. Each physical unit contributes the median of its eligible platform guest-night prices, then market statistics are calculated across those physical units. Cross-platform same-time price differences can be legitimate; conflicting observations for the same source listing and collection instant are excluded for review. More platforms do not inflate the physical sample count.

Price-change detection compares the same source listing, profile characteristics, future stay dates, guest count, cancellation and quote context. A current fresh observation may be compared with a historical observation up to seven days older. A changed sample is not described as a market price increase. Source license must still permit the historic use.

## Price basis and statistics

Offer fields are room-total, cleaning, service and taxes plus total guest-facing stay amount. A complete offer must reconcile its components within two fils. Average guest-facing nightly price = guest total / exact stay nights. Null is not zero; only explicit AED complete offers drive the engine. FX conversion is withheld until a separately approved conversion source/policy exists.

Output includes physical-property count, latest source-offer count, minimum/maximum, mean, median, interpolated P25/P75, IQR, relative IQR dispersion, our guest-price percentile/difference, platform medians and collection times. Percentiles are descriptive for the selected sample, not a representative population claim. Source asking prices do not establish achieved ADR, occupancy or revenue.

## Recommendation and approval

Withhold a recommendation when location/policy/rate availability/booking conditions are missing, fewer than five unique valid comparables remain, relative IQR exceeds 50%, or cost/contribution guardrails are missing. Display the exact insufficient-evidence message rather than lowering rates automatically.

Convert the market guest-night median into our room-rate basis by reversing the configured service/tax policy and deducting per-stay cleaning/additional-guest fees across the same length of stay. Our formula applies service to room plus cleaning, then tax to that subtotal; additional-guest fee is an explicitly configured flat per-stay addition. This is a documented initial policy, not a universal hotel tax/accounting rule. Use only matching commercial fee definitions or withhold.

Propose a 25% move from the current internal asking rate toward the fee-normalized equivalent, capped by the policy's movement limit (maximum configurable 20%). Enforce owner minimum/maximum and a contribution floor `(operating cost + required contribution) / (1 − channel commission)`. If bounds conflict with the movement cap, withhold for policy review. Owner target/weekend/seasonal text is recorded for review; it is not invented market demand or automatically parsed into price premiums.

An evidenced own occupancy forecast can prevent directionally inappropriate short-lead moves (under 14 days): above 85% does not trigger a reduction; below 35% does not trigger an increase. Missing forecast/pace evidence creates a limitation and no demand adjustment. No competitor occupancy is inferred.

Five to nine comparable physical units yield `provisional_low`; ten or more yield `provisional_moderate`. These confidence labels are not calibrated probabilities or guarantees. Conditional revenue/net changes assume identical occupied nights; they do not forecast occupancy response or causal profit improvement.

Server-side approval reloads data, checks property revision, recomputes evidence/rate, checks current source freshness/license, and validates GM overrides against the same limits. Only recent-MFA GM decisions can approve/reject/request revision. Decisions append once; revision requires a new recommendation. Approval records a decision and does not update the asking schedule or any live OTA.

Outcome records require an approved proposal, period, supporting reconciliation evidence and limitations. They do not claim causation. A separate controlled price-publication design remains a future phase.

## Management assistant and reports

Numerical answers use deterministic selected evidence. Supported summaries include proposed reviews, positioning, disclosed operators, and matched trends. Unsupported occupancy, district-wide conclusions or event-demand forecasts explain missing evidence. No external LLM or unrestricted web-research result is claimed.

Daily/weekly/monthly review snapshots distinguish asking prices, internal baseline rates, conditional scenarios and unavailable actual financial/forecast data. Source export rights gate downloads and Google exports. The HTML report safely escapes provider text and can be printed to PDF; it remains a review draft unless a separate release/sign-off process is implemented.
