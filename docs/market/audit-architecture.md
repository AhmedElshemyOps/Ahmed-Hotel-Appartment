# Existing-code audit and architecture assessment

Audit date: 15 October 2026. Remote branch head verified read-only at `c877ce026c9f55cdd0f95c2d69fd5cbef03f0e7a`. Local baseline tree matched the remote tree (`4b114ad94f4c49e290c533feca367d0a2c134e88`). No repository AGENTS.md was found in the working tree or available project directory listing.

## Actual baseline

| Baseline file / area | Verified implementation | Reuse / gap |
|---|---|---|
| `server/cloud.ts`, migrations 001/002 | Firebase Admin token verification, verified email/MFA/revocation, 12-hour session age, membership role checks, organization workspace, import history and audit | Reuse admission and transactions. Organization scope alone is insufficient for market property restrictions. |
| `src/cloud/CloudApp.tsx` | Authenticated operations/revenue/import/unit workspace; in-memory authentication tokens | Add market navigation through the same authenticated API client. No separate login/app. |
| `src/services/distribution.ts`, `propertyIntelligence.ts` | Channel catalog and pure date-overlap calculations | Reuse date conventions and distinguish estimated commission from guest prices. |
| `src/App.tsx`, `simulationEngine.ts` | Existing synthetic operational demonstration | Add a market demonstration linked to the same unit IDs; never persist its fixtures to cloud. |
| `src/data/competitorEngine.ts` | Fixed named competitor figures, multipliers, occupancy, forward events and revenue-opportunity narratives | Not verified market data. Keep outside the new engine, which never imports it. Existing demo label must remain visible. No claim of real STR/USALI validation follows from source comments. |
| `src/services/executiveIntelligence.ts` | Pure health/scenario/action foundations | Reuse the principle of deterministic figures with limitations, not its client-only approval state as authority. |
| No market tables/connectors/OAuth/geocoder | No exact-date comparable database or live licensed competitor collection | Implement normalized market storage and explicit permission gates. Native live sources remain external prerequisites. |

The referenced public website currently presents Ahmed Mahmoud's portfolio and articles, not evidence that the repository's authenticated cloud workspace is deployed there. It was inspected read-only and was not altered. [Public website](https://ahmedqualityops.com/).

## Target and implemented shape

```text
Existing React app
  ├─ Existing simulation → lazy market module → synthetic fixtures only
  └─ Existing cloud login / MFA → authorized /api/market routes
       ├─ property grants and normalized registry
       ├─ source permission and feed preview → GM verification
       ├─ immutable offer observations / listing versions
       ├─ deterministic matching → benchmarks → proposal snapshots
       ├─ fresh MFA / GM decision → immutable decision (no rate write)
       ├─ outcome observations → review-report snapshots
       └─ encrypted Google OAuth → approved review export / meeting

Background research worker
  └─ durable queue → installed licensed connector → validated preview
       (no connector by default; unavailable is an explicit job state)
```

The operational workspace remains JSONB to preserve the prior feature's behavior. New geographical and competitor entities are normalized relational tables; we do not rewrite existing reservation records or finance data. Market unit IDs link to registered organization units and cannot silently transfer between market properties.

Candidate geographies use authorized property scope and portable coordinate indexing; the engine enforces radius/administrative-name constraints and uncertainty. Optional `deploy/optional/postgis.sql` adds a GiST geography index for licensed high-volume deployments. It is outside automatic migrations because extension availability and DBA permission are not assumed. A basemap and authoritative boundary feed remain deliberate provider decisions.

## Operational tradeoffs

The first market query is bounded to 5,000 stored observations per property and 90 check-in dates. It fails clearly above the evidence cap instead of silently truncating a sample. This pilot favors inspectable calculations over a data warehouse. Before scaling: SQL date-window queries/pagination, provider quotas, per-source schedules, retention/contract deletion, distributed worker supervision, and index/load benchmarks are required.

Core market pages load on demand. Existing initial bundle size remains a build warning; the market bundle is split from it. Cloud database migrations and container deployment were not executed against live infrastructure.
