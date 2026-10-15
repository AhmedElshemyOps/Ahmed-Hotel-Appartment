# Data model, registry and security

## Normalized entities

| Entity | Implemented storage | Purpose |
|---|---|---|
| Property / property grant | `market_properties`, `market_property_grants` | Organization-owned market portfolio and per-member read/research access |
| Geography / building | `market_areas`, `market_locations`, `market_buildings` | Administrative names, coordinate precision/status/evidence, building identity |
| Apartment / amenities | `market_units`, `market_unit_features`, `market_unit_attractions` | Existing registered unit ID, individual characteristics, amenities/accessibility and evidenced attraction distances |
| Private operational details | `market_access_notes` | Separate GM-only endpoint; absent from market datasets/reports |
| Registry revisions | `market_profile_history` | Append-only snapshots when a profile is corrected |
| Pricing policy / rate / availability | `market_policies`, `market_rates` | Versioned owner limits, costs/fees and per-date internal rates/availability/own forecast evidence |
| Competitor source | `market_sources` | Permission URL, use rights, expiry, freshness, authorizer/revocation |
| Physical competitor / operator | `market_physical_properties`, `market_operators` | Documented physical-unit linkage and separately disclosed operator evidence |
| Platform listing / characteristics | `market_listings`, `market_listing_features` | Versioned listing metadata, profile, platform and public URL; distinct from its physical entity |
| Dated offer / historical snapshot | `market_offers` | Immutable observation ID/hash, dates, guests, terms, currency, components, collection and verification |
| Research job / collection audit | `market_research_jobs`, existing `audit_events` | Durable preview/collection/retry/configuration/failure states and actor/hash/count audit |
| Benchmark / comparable match | Deterministic output; copied into recommendation/report snapshots | Formula version, inclusion/exclusion, source IDs and derived statistics |
| Recommendation / approval decision | `market_recommendations`, `market_decisions` | Immutable query/evidence/property revision and once-only GM decision |
| Outcome / report snapshot | `market_outcomes`, `market_reports` | Evidence-backed recorded outcome and versioned internal report draft |
| Google connection / state / export | `market_google_connections`, `market_google_states`, `market_google_exports` | Encrypted credentials, browser-bound single-use consent and export operation history |

`organization_id` plus property-aware foreign keys protect relationships. Source/listing/offer identity is scoped to its organization and market property. Existing cloud unit records are not rewritten; new registry records reference their IDs. Registered units cannot silently transfer between market properties. Changes to profiles, policy, rates, source permission or accepted evidence increment a property revision and invalidate older pending approvals.

A location is not considered verified without coordinates, an accuracy value, verification timestamp and evidence URL. Manual map clicks set it back to unverified. Approximate competitor coordinates retain their uncertainty. The illustrative “Water World Apartments” is never created as a real building.

The domain supports all specified core profile fields via normalized columns/features and commercial policy/rate tables. Historical actual ADR/RevPAR/contribution and actual booking availability require reconciled operational/PMS records; zero is not substituted when missing. Weekend/seasonal policies are recorded text, not automatically interpreted as market demand. Attraction distances need explicit evidence. No basemap, geocoder or boundaries are acquired automatically.

## Authorization

Existing cloud admission verifies signed Identity Platform tokens, revoked sessions, email verification, an MFA assurance claim, membership role and bounded sign-in age. The market module then rechecks the live membership inside its database transaction and applies property grants. GM has organization-wide market access; other members receive no market property by default. `read` permits inspection; `research` plus an eligible Finance/Revenue role permits preparation. A viewer cannot gain mutation rights through a forged body role or a research grant alone.

Source authorization/revocation, policy approval, property grants, private notes, pricing decisions and Google connection/publication require GM authority; sensitive endpoints require MFA sign-in within ten minutes. Source-feed preparation can be delegated, but accepting observations as verified evidence requires the GM. Every mutation is audited. No browser role, proposed value, comparison bundle or approval actor is accepted as authority.

Use a non-superuser runtime credential. Add these grants to the previous cloud runtime role after an approved migration:

```sql
GRANT SELECT, INSERT, UPDATE ON market_properties, market_property_grants,
  market_units, market_access_notes, market_research_jobs,
  market_google_connections, market_google_exports TO ahq_runtime;
GRANT DELETE ON market_property_grants, market_unit_features,
  market_unit_attractions, market_google_states TO ahq_runtime;
GRANT SELECT, INSERT ON market_areas, market_locations, market_buildings,
  market_unit_features, market_unit_attractions, market_profile_history,
  market_policies, market_rates, market_sources, market_physical_properties,
  market_operators, market_listings, market_listing_features, market_offers,
  market_recommendations, market_decisions, market_outcomes, market_reports,
  market_google_states TO ahq_runtime;
GRANT UPDATE(revoked_at) ON market_sources TO ahq_runtime;
```

There is no runtime UPDATE/DELETE grant for offers, policies, recommendations, decisions, outcomes or audit history. The migration/DBA role remains separate. Row-level security is not installed in this increment; application transaction checks and composite relationships are the enforcement layer. A production DBA review must test grants, cross-company access and backup/restore. Optional RLS is defense in depth and must not be claimed as active.

## Feed contract and immutability

Upload a JSON object with `competitors` and `offers` arrays conforming to `src/market/model.ts`. A source ID is selected separately from an authorized permission record. Each listing needs a source listing ID, documented physical key/linkage reference, public URL, characteristics, location precision and any disclosed operator evidence. Each offer references that source listing ID and supplies a unique observation ID, exact dates/guests/conditions, timestamp, verification and explicit price components.

No raw user-entered URL is requested by the server. Stored permission/evidence URLs are references, not crawler instructions. The packet is schema-validated; a GM must independently review source legitimacy and accuracy. There is no claim that a parsed JSON record alone proves its facts.

Preview jobs expire after thirty minutes or a property revision. Commit runs in a transaction and rechecks the source license. Existing observation IDs cannot be overwritten; a later price is a new observation. Raw competitor packages are temporarily stored in authorized preview jobs, subject to the same source storage permission. Retention/deletion and license expiry must be scheduled operationally before a real-data pilot.

## Background jobs

`npm run market:worker` processes one durable queued job using an installed `MarketConnector`. Claims use `FOR UPDATE SKIP LOCKED`; the network request occurs outside the claim transaction. A missing connector reports `needs_configuration`, expired permission reports `blocked`, transient failures use exponential backoff and stop after three attempts, and expired five-minute leases can retry. A successful collection becomes a review preview rather than automatically publishing evidence or prices. Provider output must have stable observation IDs for safe retries.

No licensed native connector is installed. The worker must be supervised/scheduled and equipped with contract-specific quotas, credentials and retention rules before production collection. This is deliberately different from claiming a working multi-platform live feed.
