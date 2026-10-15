BEGIN;
CREATE TABLE member_profiles (
  organization_id text NOT NULL,
  uid text NOT NULL,
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 100),
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, uid),
  FOREIGN KEY (organization_id, uid) REFERENCES memberships(organization_id, uid) ON DELETE CASCADE
);
COMMIT;
