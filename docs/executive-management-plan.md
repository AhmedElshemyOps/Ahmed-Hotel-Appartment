# Executive Management — phased delivery

Status: Phase 1 foundation in progress. This document is a delivery checklist, not a claim of production readiness.

## Scope
AI General Manager, Daily Briefing, Health Score, Root Cause Analysis, Decision Simulator, Cross-Department Intelligence, Management Action Tracker.

## Architecture
- Deterministic calculation layer: `src/services/executiveIntelligence.ts`.
- Existing React views and agent engine will consume typed service results.
- Real property data must eventually be served from an authenticated property-scoped backend; browser localStorage is not production storage.
- AI must interpret source-backed evidence, never invent financial facts.
- Every action requires authorized human approval before operational execution.

## Phases
1. Correct financial metrics and test date boundaries; implement evidence and data-quality contracts.
2. Build executive snapshots, AI General Manager and dated daily briefings.
3. Build weighted health score and evidence-backed root-cause investigation.
4. Add cross-department case linking and durable action/approval workflow.
5. Add scenario modeling, sensitivities, comparison and saved assumptions.
6. Add integration/e2e/security tests and local acceptance preview.

## Release gates
- All monetary outputs reconcile with fixture source records.
- All AI numeric claims have evidence IDs or explicitly report missing evidence.
- No cross-property access, no guest data in repository or client logs.
- Role enforcement and durable audit trail exist before real-data production use.
- No changes to main or deployment without explicit approval at release review.

## Article alignment
Map each verified article title/URL to a knowledge entry with topic, approved principle, relevant departments, feature, and version. Articles supply guidance; property records supply facts. Do not infer article content from titles alone.
