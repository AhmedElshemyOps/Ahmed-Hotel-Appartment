BEGIN;
CREATE TABLE team_invitations (
 organization_id text NOT NULL REFERENCES organizations(id), id uuid NOT NULL, token_hash text NOT NULL UNIQUE,
 email text NOT NULL, display_name text NOT NULL, role text NOT NULL CHECK(role IN ('Finance Manager','Revenue Manager','Read-Only Viewer')),
 seat integer NOT NULL CHECK(seat BETWEEN 2 AND 10), capabilities jsonb NOT NULL, status text NOT NULL CHECK(status IN ('pending','accepted','revoked','expired')),
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, accepted_by text,
 PRIMARY KEY(organization_id,id)
);
CREATE UNIQUE INDEX reserved_team_seat ON team_invitations(organization_id,seat) WHERE status='pending';
CREATE UNIQUE INDEX pending_team_email ON team_invitations(organization_id,email) WHERE status='pending';
CREATE TABLE management_reports (
 organization_id text NOT NULL REFERENCES organizations(id), id uuid NOT NULL, report_type text NOT NULL, period_start date NOT NULL, period_end date NOT NULL,
 methodology text NOT NULL, source_hash text NOT NULL, snapshot jsonb NOT NULL, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id)
);
CREATE TABLE protected_files (
 organization_id text NOT NULL REFERENCES organizations(id), id uuid NOT NULL, unit_id text NOT NULL, category text NOT NULL CHECK(category IN ('document','photo')),
 name text NOT NULL, mime text NOT NULL, byte_count integer NOT NULL CHECK(byte_count BETWEEN 1 AND 5242880), sha256 text NOT NULL, object_key text NOT NULL,
 status text NOT NULL CHECK(status IN ('quarantined','clean','rejected','deleted')), scanner text, width integer, height integer,
 uploaded_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), retention_until timestamptz NOT NULL,
 PRIMARY KEY(organization_id,id)
);
CREATE INDEX report_history_scope ON management_reports(organization_id,created_at DESC);
CREATE INDEX protected_file_scope ON protected_files(organization_id,unit_id,status);
CREATE FUNCTION preserve_management_report() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Saved management reports are immutable'; END; $$;
CREATE TRIGGER immutable_management_reports BEFORE UPDATE OR DELETE ON management_reports FOR EACH ROW EXECUTE FUNCTION preserve_management_report();
COMMIT;
