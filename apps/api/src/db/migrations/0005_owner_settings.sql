-- Owner defaults and saved places (home / work / favourites). Spec §12.

CREATE TABLE IF NOT EXISTS owner_settings (
  owner_id TEXT PRIMARY KEY,
  default_vehicle_id TEXT REFERENCES vehicles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saved_places (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('home', 'work', 'favourite')),
  label TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS saved_places_one_home_work
  ON saved_places (owner_id, kind)
  WHERE kind IN ('home', 'work');

CREATE INDEX IF NOT EXISTS saved_places_owner_idx ON saved_places (owner_id);

ALTER TABLE owner_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE saved_places FORCE ROW LEVEL SECURITY;

CREATE POLICY owner_settings_owner ON owner_settings
  USING (owner_id = current_setting('brim.owner_id', true))
  WITH CHECK (owner_id = current_setting('brim.owner_id', true));
CREATE POLICY owner_settings_service ON owner_settings
  USING (current_setting('brim.service_role', true) = '1')
  WITH CHECK (current_setting('brim.service_role', true) = '1');

CREATE POLICY saved_places_owner ON saved_places
  USING (owner_id = current_setting('brim.owner_id', true))
  WITH CHECK (owner_id = current_setting('brim.owner_id', true));
CREATE POLICY saved_places_service ON saved_places
  USING (current_setting('brim.service_role', true) = '1')
  WITH CHECK (current_setting('brim.service_role', true) = '1');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'brim_rls') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON owner_settings TO brim_rls;
    GRANT SELECT, INSERT, UPDATE, DELETE ON saved_places TO brim_rls;
  END IF;
END $$;
