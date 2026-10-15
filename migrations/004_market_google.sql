BEGIN;
CREATE TABLE market_google_states (
 state_hash text PRIMARY KEY, organization_id text NOT NULL, property_id uuid NOT NULL, actor_uid text NOT NULL, cookie_hash text NOT NULL, verifier_ciphertext text NOT NULL, expires_at timestamptz NOT NULL,
 FOREIGN KEY(organization_id,property_id) REFERENCES market_properties(organization_id,id)
);
CREATE TABLE market_google_connections (
 organization_id text NOT NULL,property_id uuid NOT NULL,token_ciphertext text,actor_uid text NOT NULL,scopes text[] NOT NULL,connected_at timestamptz NOT NULL DEFAULT now(),disconnected_at timestamptz,
 PRIMARY KEY(organization_id,property_id),FOREIGN KEY(organization_id,property_id) REFERENCES market_properties(organization_id,id)
);
CREATE TABLE market_google_exports (
 organization_id text NOT NULL,property_id uuid NOT NULL,recommendation_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('sheets','drive','calendar')),provider_id text,url text,status text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,property_id,recommendation_id,kind),FOREIGN KEY(organization_id,recommendation_id,property_id) REFERENCES market_recommendations(organization_id,id,property_id)
);
CREATE TABLE market_profile_history (organization_id text NOT NULL,id uuid NOT NULL,unit_id text NOT NULL,property_id uuid NOT NULL,snapshot jsonb NOT NULL,actor_uid text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,unit_id,property_id) REFERENCES market_units(organization_id,unit_id,property_id));
COMMIT;
