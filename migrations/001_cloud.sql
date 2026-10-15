BEGIN;
CREATE TABLE organizations (id text PRIMARY KEY, name text NOT NULL, gm_uid text NOT NULL);
CREATE TABLE memberships (
  uid text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id),
  seat integer NOT NULL CHECK (seat BETWEEN 1 AND 10),
  role text NOT NULL CHECK (role IN ('General Manager','Finance Manager','Revenue Manager','Read-Only Viewer')),
  UNIQUE (organization_id, seat) DEFERRABLE INITIALLY IMMEDIATE, UNIQUE (organization_id, uid),
  CHECK ((seat = 1) = (role = 'General Manager'))
);
ALTER TABLE organizations ADD CONSTRAINT one_gm FOREIGN KEY (id, gm_uid)
  REFERENCES memberships(organization_id, uid) DEFERRABLE INITIALLY DEFERRED;
CREATE FUNCTION enforce_gm_seat() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM organizations o JOIN memberships m ON m.uid=o.gm_uid WHERE m.organization_id<>o.id OR m.seat<>1) THEN
    RAISE EXCEPTION 'Organization must reference its seat-one General Manager';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER organization_gm AFTER INSERT OR UPDATE ON organizations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_gm_seat();
CREATE CONSTRAINT TRIGGER membership_gm AFTER INSERT OR UPDATE OR DELETE ON memberships DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_gm_seat();
CREATE TABLE workspaces (organization_id text PRIMARY KEY REFERENCES organizations(id), revision integer NOT NULL DEFAULT 0, data jsonb NOT NULL);
CREATE TABLE import_batches (
  id uuid PRIMARY KEY, organization_id text NOT NULL REFERENCES organizations(id),
  actor_uid text NOT NULL, source text NOT NULL, file_name text NOT NULL, file_hash text NOT NULL,
  revision integer NOT NULL, preview jsonb NOT NULL, status text NOT NULL DEFAULT 'preview' CHECK (status IN ('preview','committed','rolled_back')),
  created_at timestamptz NOT NULL DEFAULT now(), committed_at timestamptz, rolled_back_at timestamptz
);
CREATE TABLE audit_events (id bigserial PRIMARY KEY, organization_id text NOT NULL REFERENCES organizations(id), actor_uid text NOT NULL, action text NOT NULL, target text NOT NULL, details jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX batches_org ON import_batches (organization_id, created_at DESC);
CREATE INDEX audit_org ON audit_events (organization_id, created_at DESC);
COMMIT;
