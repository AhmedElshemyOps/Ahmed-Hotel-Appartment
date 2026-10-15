-- Optional, reviewed infrastructure migration. Do not run automatically or assume extension availability.
-- Install only with DBA approval; portable range indexes remain available without PostGIS.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE INDEX market_locations_geography ON market_locations USING gist
  ((ST_SetSRID(ST_MakePoint(longitude,latitude),4326)::geography)) WHERE latitude IS NOT NULL;
-- Candidate search: organization/property predicate AND ST_DWithin(geography expression, approved point, radius).
-- Administrative boundaries require a separately licensed authoritative dataset; no boundaries are inferred from circles.
