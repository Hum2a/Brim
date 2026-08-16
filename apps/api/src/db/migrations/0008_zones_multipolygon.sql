-- ULEZ and the Congestion Charge are MultiPolygon. GIST for intersection queries.
ALTER TABLE zones
  ALTER COLUMN geometry TYPE geography(MultiPolygon, 4326)
  USING CASE
    WHEN geometry IS NULL THEN NULL
    ELSE ST_Multi(geometry::geometry)::geography
  END;

ALTER TABLE zones ADD COLUMN IF NOT EXISTS operator_url TEXT;
ALTER TABLE tolls ADD COLUMN IF NOT EXISTS operator_url TEXT;

CREATE INDEX IF NOT EXISTS zones_geometry_gix ON zones USING GIST (geometry);
CREATE INDEX IF NOT EXISTS tolls_location_gix ON tolls USING GIST (location);
