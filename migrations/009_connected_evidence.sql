BEGIN;
CREATE TABLE reservation_accounting_links (
 organization_id text NOT NULL REFERENCES organizations(id), connection_id uuid NOT NULL,
 document_id text NOT NULL, reservation_source text NOT NULL, reservation_external_id text NOT NULL,
 purpose text NOT NULL CHECK(purpose IN('invoice','refund','commission','settlement')),
 evidence_note text NOT NULL CHECK(length(evidence_note) BETWEEN 10 AND 1500),
 reviewed_document_updated_at text NOT NULL, reviewed_reservation_version integer NOT NULL,
 reviewed_by text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,connection_id,document_id),
 FOREIGN KEY(organization_id,connection_id,document_id) REFERENCES accounting_documents(organization_id,connection_id,external_id)
);
CREATE TABLE owner_property_access (
 organization_id text NOT NULL REFERENCES organizations(id), owner_uid text NOT NULL,
 owner_email text NOT NULL, unit_id text NOT NULL, granted_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,owner_uid,unit_id)
);
CREATE TABLE owner_report_releases (
 organization_id text NOT NULL REFERENCES organizations(id), id uuid NOT NULL,
 unit_id text NOT NULL, snapshot jsonb NOT NULL, source_snapshot jsonb NOT NULL, source_hash text NOT NULL,
 approved_by text NOT NULL, approved_at timestamptz NOT NULL DEFAULT now(),
 withdrawn boolean NOT NULL DEFAULT false, PRIMARY KEY(organization_id,id)
);
CREATE FUNCTION protect_owner_release() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.id IS DISTINCT FROM OLD.id
 OR NEW.unit_id IS DISTINCT FROM OLD.unit_id OR NEW.snapshot IS DISTINCT FROM OLD.snapshot
 OR NEW.source_snapshot IS DISTINCT FROM OLD.source_snapshot
 OR NEW.source_hash IS DISTINCT FROM OLD.source_hash OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
 OR NEW.approved_at IS DISTINCT FROM OLD.approved_at OR (OLD.withdrawn AND NOT NEW.withdrawn)
 THEN RAISE EXCEPTION 'Owner releases are immutable; withdraw and create a new release'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER owner_release_immutable BEFORE UPDATE ON owner_report_releases FOR EACH ROW EXECUTE FUNCTION protect_owner_release();
CREATE INDEX owner_access_identity ON owner_property_access(owner_uid);
COMMIT;
