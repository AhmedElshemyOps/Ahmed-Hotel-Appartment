BEGIN;
CREATE TABLE readiness_grants (
 organization_id text NOT NULL, uid text NOT NULL, capability text NOT NULL CHECK(capability IN ('compliance','operations','distribution')),
 PRIMARY KEY(organization_id,uid,capability), FOREIGN KEY(organization_id,uid) REFERENCES memberships(organization_id,uid) ON DELETE CASCADE
);
CREATE TABLE readiness_units (
 organization_id text NOT NULL REFERENCES organizations(id), unit_id text NOT NULL, revision integer NOT NULL DEFAULT 0 CHECK(revision>=0), data jsonb NOT NULL,
 PRIMARY KEY(organization_id,unit_id)
);
CREATE TABLE readiness_history (
 id bigserial PRIMARY KEY, organization_id text NOT NULL, unit_id text NOT NULL, revision integer NOT NULL, actor_uid text NOT NULL, action text NOT NULL, snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,unit_id,revision), FOREIGN KEY(organization_id,unit_id) REFERENCES readiness_units(organization_id,unit_id)
);
CREATE INDEX readiness_history_scope ON readiness_history(organization_id,unit_id,id DESC);
CREATE TABLE readiness_reports (
 id uuid PRIMARY KEY, organization_id text NOT NULL REFERENCES organizations(id), actor_uid text NOT NULL, source_revisions jsonb NOT NULL, html text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
