-- Geography index for nearby-station queries, plus an ingest watermark.
-- stations.location already exists from 0001_init.sql.

CREATE INDEX IF NOT EXISTS stations_location_gix ON stations USING GIST (location);

CREATE TABLE IF NOT EXISTS ingestion_state (
  source TEXT PRIMARY KEY,
  watermark TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ingestion_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_state FORCE ROW LEVEL SECURITY;

CREATE POLICY ingestion_state_read ON ingestion_state FOR SELECT USING (true);
CREATE POLICY ingestion_state_service ON ingestion_state
  USING (current_setting('brim.service_role', true) = '1')
  WITH CHECK (current_setting('brim.service_role', true) = '1');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'brim_rls') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ingestion_state TO brim_rls;
  END IF;
END $$;
