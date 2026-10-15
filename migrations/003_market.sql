BEGIN;
CREATE TABLE market_properties (
 organization_id text NOT NULL REFERENCES organizations(id), id uuid NOT NULL, name text NOT NULL,
 revision integer NOT NULL DEFAULT 0, PRIMARY KEY(organization_id,id)
);
CREATE TABLE market_property_grants (
 organization_id text NOT NULL, property_id uuid NOT NULL, uid text NOT NULL REFERENCES memberships(uid), capability text NOT NULL CHECK(capability IN ('read','research')),
 PRIMARY KEY(organization_id,property_id,uid), FOREIGN KEY(organization_id,uid) REFERENCES memberships(organization_id,uid), FOREIGN KEY(organization_id,property_id) REFERENCES market_properties(organization_id,id)
);
CREATE TABLE market_areas (
 organization_id text NOT NULL, id uuid NOT NULL, property_id uuid NOT NULL, country text NOT NULL, city text NOT NULL, emirate text, district text NOT NULL, community text NOT NULL,
 PRIMARY KEY(organization_id,id), FOREIGN KEY(organization_id,property_id) REFERENCES market_properties(organization_id,id), UNIQUE(organization_id,id,property_id)
);
CREATE TABLE market_locations (
 organization_id text NOT NULL, id uuid NOT NULL, property_id uuid NOT NULL, area_id uuid NOT NULL,
 latitude double precision CHECK(latitude BETWEEN -85 AND 85), longitude double precision CHECK(longitude BETWEEN -180 AND 180), accuracy_meters double precision CHECK(accuracy_meters>=0), address text, postal_code text,
 verification_status text NOT NULL CHECK(verification_status IN ('unverified','verified','approximate')), provider text, verified_at timestamptz, evidence_url text,
 PRIMARY KEY(organization_id,id), UNIQUE(organization_id,id,property_id),
 FOREIGN KEY(organization_id,area_id,property_id) REFERENCES market_areas(organization_id,id,property_id),
 CHECK((latitude IS NULL)=(longitude IS NULL)),
 CHECK(verification_status<>'verified' OR (latitude IS NOT NULL AND accuracy_meters IS NOT NULL AND verified_at IS NOT NULL AND evidence_url IS NOT NULL))
);
CREATE INDEX market_location_bounds ON market_locations(organization_id,property_id,latitude,longitude);
CREATE TABLE market_buildings (
 organization_id text NOT NULL,id uuid NOT NULL,property_id uuid NOT NULL,location_id uuid NOT NULL,name text,external_reference text,
 PRIMARY KEY(organization_id,id), UNIQUE(organization_id,id,property_id), FOREIGN KEY(organization_id,location_id,property_id) REFERENCES market_locations(organization_id,id,property_id)
);
CREATE TABLE market_units (
 organization_id text NOT NULL,unit_id text NOT NULL,property_id uuid NOT NULL,building_id uuid NOT NULL,unit_number text NOT NULL,
 category text NOT NULL CHECK(category IN ('entire_unit','private_room','hotel_room')),rental_model text NOT NULL CHECK(rental_model IN ('short_term','long_term')),
 bedrooms integer NOT NULL CHECK(bedrooms>=0),bathrooms double precision NOT NULL CHECK(bathrooms>0),capacity integer NOT NULL CHECK(capacity>0),area_sqm double precision,floor_number integer,furnishing text,condition text,view text,review_score double precision,review_count integer,license_status text,
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,unit_id),UNIQUE(organization_id,unit_id,property_id),FOREIGN KEY(organization_id,building_id,property_id) REFERENCES market_buildings(organization_id,id,property_id)
);
CREATE TABLE market_unit_features (
 organization_id text NOT NULL,unit_id text NOT NULL,kind text NOT NULL CHECK(kind IN ('amenity','accessibility')),value text NOT NULL,
 PRIMARY KEY(organization_id,unit_id,kind,value),FOREIGN KEY(organization_id,unit_id) REFERENCES market_units(organization_id,unit_id)
);
CREATE TABLE market_unit_attractions (
 organization_id text NOT NULL,unit_id text NOT NULL,name text NOT NULL,distance_meters double precision NOT NULL,evidence_url text NOT NULL,
 PRIMARY KEY(organization_id,unit_id,name),FOREIGN KEY(organization_id,unit_id) REFERENCES market_units(organization_id,unit_id)
);
CREATE TABLE market_access_notes (
 organization_id text NOT NULL,unit_id text NOT NULL,instructions text NOT NULL,PRIMARY KEY(organization_id,unit_id),FOREIGN KEY(organization_id,unit_id) REFERENCES market_units(organization_id,unit_id)
);
CREATE TABLE market_policies (
 organization_id text NOT NULL,unit_id text NOT NULL,version integer NOT NULL,minimum_rate numeric(14,2) NOT NULL,maximum_rate numeric(14,2) NOT NULL,target_rate numeric(14,2),max_change_percent double precision NOT NULL,minimum_stay integer NOT NULL,cleaning_fee numeric(14,2) NOT NULL,service_percent double precision NOT NULL,tax_percent double precision NOT NULL,commission_percent double precision NOT NULL,operating_cost numeric(14,2),minimum_contribution numeric(14,2),cancellation text NOT NULL,owner_approval_reference text NOT NULL,weekend_policy text,seasonal_policy text,additional_guest_fee numeric(14,2) NOT NULL,approved_by text NOT NULL,approved_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,unit_id,version),FOREIGN KEY(organization_id,unit_id) REFERENCES market_units(organization_id,unit_id),CHECK(maximum_rate>=minimum_rate)
);
CREATE TABLE market_rates (
 organization_id text NOT NULL,unit_id text NOT NULL,date date NOT NULL,version integer NOT NULL,room_rate numeric(14,2) NOT NULL CHECK(room_rate>=0),available boolean,minimum_stay integer NOT NULL,occupancy_forecast double precision,forecast_evidence text,recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,unit_id,date,version),FOREIGN KEY(organization_id,unit_id) REFERENCES market_units(organization_id,unit_id),CHECK(occupancy_forecast IS NULL OR (occupancy_forecast BETWEEN 0 AND 1 AND forecast_evidence IS NOT NULL))
);
CREATE TABLE market_sources (
 organization_id text NOT NULL,id uuid NOT NULL,property_id uuid NOT NULL,name text NOT NULL,provider text NOT NULL,permission_reference text NOT NULL,expires_at timestamptz NOT NULL,max_age_hours double precision NOT NULL,analysis_allowed boolean NOT NULL,storage_allowed boolean NOT NULL,export_allowed boolean NOT NULL,derivatives_allowed boolean NOT NULL,authorized_by text NOT NULL,authorized_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz,
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,id,property_id),FOREIGN KEY(organization_id,property_id) REFERENCES market_properties(organization_id,id)
);
CREATE TABLE market_physical_properties (
 organization_id text NOT NULL,id uuid NOT NULL,property_id uuid NOT NULL,physical_key text NOT NULL,identity_evidence text NOT NULL,
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,id,property_id),UNIQUE(organization_id,property_id,physical_key),FOREIGN KEY(organization_id,property_id) REFERENCES market_properties(organization_id,id)
);
CREATE TABLE market_operators (organization_id text NOT NULL,id uuid NOT NULL,name text NOT NULL,evidence_url text NOT NULL,PRIMARY KEY(organization_id,id));
CREATE TABLE market_listings (
 organization_id text NOT NULL,id uuid NOT NULL,property_id uuid NOT NULL,source_id uuid NOT NULL,physical_id uuid NOT NULL,location_id uuid NOT NULL,building_id uuid NOT NULL,operator_id uuid,
 external_listing_id text NOT NULL,metadata_hash text NOT NULL,title text NOT NULL,url text NOT NULL,platform text NOT NULL,
 category text NOT NULL,rental_model text NOT NULL,bedrooms integer NOT NULL,bathrooms double precision NOT NULL,capacity integer NOT NULL,area_sqm double precision,floor_number integer,furnishing text,condition text,view text,review_score double precision,review_count integer,license_status text,
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,id,property_id),UNIQUE(organization_id,source_id,external_listing_id,metadata_hash),
 FOREIGN KEY(organization_id,source_id,property_id) REFERENCES market_sources(organization_id,id,property_id),FOREIGN KEY(organization_id,physical_id,property_id) REFERENCES market_physical_properties(organization_id,id,property_id),FOREIGN KEY(organization_id,location_id,property_id) REFERENCES market_locations(organization_id,id,property_id),FOREIGN KEY(organization_id,building_id,property_id) REFERENCES market_buildings(organization_id,id,property_id),FOREIGN KEY(organization_id,operator_id) REFERENCES market_operators(organization_id,id)
);
CREATE TABLE market_listing_features (organization_id text NOT NULL,listing_id uuid NOT NULL,kind text NOT NULL,value text NOT NULL,PRIMARY KEY(organization_id,listing_id,kind,value),FOREIGN KEY(organization_id,listing_id) REFERENCES market_listings(organization_id,id));
CREATE TABLE market_offers (
 organization_id text NOT NULL,id uuid NOT NULL,property_id uuid NOT NULL,source_id uuid NOT NULL,listing_id uuid NOT NULL,observation_id text NOT NULL,payload_hash text NOT NULL,
 check_in date NOT NULL,check_out date NOT NULL,guests integer NOT NULL,available boolean,minimum_stay integer NOT NULL,cancellation text NOT NULL,quote_context text NOT NULL,currency text NOT NULL,
 room_total numeric(14,2),cleaning_fee numeric(14,2),service_fee numeric(14,2),taxes numeric(14,2),guest_total numeric(14,2),all_fees_known boolean NOT NULL,observed_at timestamptz NOT NULL,verification text NOT NULL CHECK(verification IN ('verified','unverified')),source_url text NOT NULL,ingested_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,source_id,observation_id),FOREIGN KEY(organization_id,listing_id,property_id) REFERENCES market_listings(organization_id,id,property_id),FOREIGN KEY(organization_id,source_id,property_id) REFERENCES market_sources(organization_id,id,property_id),CHECK(check_out>check_in)
);
CREATE INDEX market_forward_dates ON market_offers(organization_id,property_id,check_in,check_out,observed_at);
CREATE TABLE market_research_jobs (
 organization_id text NOT NULL,id uuid NOT NULL,property_id uuid NOT NULL,source_id uuid NOT NULL,kind text NOT NULL,status text NOT NULL,attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),created_by text NOT NULL,payload jsonb NOT NULL,result jsonb,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,source_id,property_id) REFERENCES market_sources(organization_id,id,property_id)
);
CREATE INDEX market_job_queue ON market_research_jobs(status,next_attempt_at);
CREATE TABLE market_recommendations (
 organization_id text NOT NULL,id uuid NOT NULL,property_id uuid NOT NULL,unit_id text NOT NULL,property_revision integer NOT NULL,query jsonb NOT NULL,snapshot jsonb NOT NULL,evidence_hash text NOT NULL,created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,id,property_id),FOREIGN KEY(organization_id,unit_id,property_id) REFERENCES market_units(organization_id,unit_id,property_id)
);
CREATE TABLE market_decisions (
 organization_id text NOT NULL,id uuid NOT NULL,property_id uuid NOT NULL,recommendation_id uuid NOT NULL,decision text NOT NULL CHECK(decision IN ('approved','rejected','revision_requested')),approved_rate numeric(14,2),reason text NOT NULL,actor_uid text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,recommendation_id),FOREIGN KEY(organization_id,recommendation_id,property_id) REFERENCES market_recommendations(organization_id,id,property_id)
);
CREATE TABLE market_outcomes (
 organization_id text NOT NULL,id uuid NOT NULL,property_id uuid NOT NULL,recommendation_id uuid NOT NULL,observed_from date NOT NULL,observed_to date NOT NULL,actual_room_revenue numeric(14,2),occupied_nights integer,evidence_reference text NOT NULL,limitations text NOT NULL,recorded_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,recommendation_id,property_id) REFERENCES market_recommendations(organization_id,id,property_id)
);
CREATE TABLE market_reports (organization_id text NOT NULL,id uuid NOT NULL,property_id uuid NOT NULL,report_type text NOT NULL,snapshot jsonb NOT NULL,created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,id),FOREIGN KEY(organization_id,property_id) REFERENCES market_properties(organization_id,id));
COMMIT;
