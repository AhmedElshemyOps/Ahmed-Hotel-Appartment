BEGIN;
CREATE TABLE integration_events (
 organization_id text NOT NULL REFERENCES organizations(id), source text NOT NULL, event_id text NOT NULL,
 payload_hash text NOT NULL, status text NOT NULL CHECK(status IN ('applied','review_required','ignored')),
 received_at timestamptz NOT NULL DEFAULT now(), details jsonb NOT NULL,
 PRIMARY KEY(organization_id,source,event_id)
);
CREATE INDEX integration_freshness ON integration_events(organization_id,received_at DESC);
COMMIT;
