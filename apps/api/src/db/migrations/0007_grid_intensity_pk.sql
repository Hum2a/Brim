-- Unique key so carbon ingest can upsert (region, valid_from).
-- Public-read and service-role-write policies already exist from 0001/0003.

CREATE UNIQUE INDEX IF NOT EXISTS grid_intensity_region_from
  ON grid_intensity (region, valid_from);
