-- FORCE RLS so the table owner cannot bypass policies.
-- Recreate owner policies with WITH CHECK. Service-role writes for public tables
-- (VCA sync, later Fuel Finder) and owner-id rewrites (claim-on-signup).

ALTER TABLE vehicles FORCE ROW LEVEL SECURITY;
ALTER TABLE tariffs FORCE ROW LEVEL SECURITY;
ALTER TABLE fill_ups FORCE ROW LEVEL SECURITY;
ALTER TABLE journeys FORCE ROW LEVEL SECURITY;
ALTER TABLE calibrations FORCE ROW LEVEL SECURITY;
ALTER TABLE stations FORCE ROW LEVEL SECURITY;
ALTER TABLE station_prices FORCE ROW LEVEL SECURITY;
ALTER TABLE zones FORCE ROW LEVEL SECURITY;
ALTER TABLE tolls FORCE ROW LEVEL SECURITY;
ALTER TABLE vca_vehicles FORCE ROW LEVEL SECURITY;
ALTER TABLE grid_intensity FORCE ROW LEVEL SECURITY;
ALTER TABLE route_cache FORCE ROW LEVEL SECURITY;
ALTER TABLE anon_profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vehicles_owner ON vehicles;
CREATE POLICY vehicles_owner ON vehicles
  USING (owner_id = current_setting('brim.owner_id', true))
  WITH CHECK (owner_id = current_setting('brim.owner_id', true));
CREATE POLICY vehicles_service ON vehicles
  USING (current_setting('brim.service_role', true) = '1')
  WITH CHECK (current_setting('brim.service_role', true) = '1');

DROP POLICY IF EXISTS tariffs_owner ON tariffs;
CREATE POLICY tariffs_owner ON tariffs
  USING (
    vehicle_id IN (SELECT id FROM vehicles WHERE owner_id = current_setting('brim.owner_id', true))
  )
  WITH CHECK (
    vehicle_id IN (SELECT id FROM vehicles WHERE owner_id = current_setting('brim.owner_id', true))
  );
CREATE POLICY tariffs_service ON tariffs
  USING (current_setting('brim.service_role', true) = '1')
  WITH CHECK (current_setting('brim.service_role', true) = '1');

DROP POLICY IF EXISTS fill_ups_owner ON fill_ups;
CREATE POLICY fill_ups_owner ON fill_ups
  USING (
    vehicle_id IN (SELECT id FROM vehicles WHERE owner_id = current_setting('brim.owner_id', true))
  )
  WITH CHECK (
    vehicle_id IN (SELECT id FROM vehicles WHERE owner_id = current_setting('brim.owner_id', true))
  );
CREATE POLICY fill_ups_service ON fill_ups
  USING (current_setting('brim.service_role', true) = '1')
  WITH CHECK (current_setting('brim.service_role', true) = '1');

DROP POLICY IF EXISTS journeys_owner ON journeys;
CREATE POLICY journeys_owner ON journeys
  USING (owner_id = current_setting('brim.owner_id', true))
  WITH CHECK (owner_id = current_setting('brim.owner_id', true));
CREATE POLICY journeys_service ON journeys
  USING (current_setting('brim.service_role', true) = '1')
  WITH CHECK (current_setting('brim.service_role', true) = '1');

DROP POLICY IF EXISTS calibrations_owner ON calibrations;
CREATE POLICY calibrations_owner ON calibrations
  USING (
    vehicle_id IN (SELECT id FROM vehicles WHERE owner_id = current_setting('brim.owner_id', true))
  )
  WITH CHECK (
    vehicle_id IN (SELECT id FROM vehicles WHERE owner_id = current_setting('brim.owner_id', true))
  );
CREATE POLICY calibrations_service ON calibrations
  USING (current_setting('brim.service_role', true) = '1')
  WITH CHECK (current_setting('brim.service_role', true) = '1');

DROP POLICY IF EXISTS anon_profiles_self ON anon_profiles;
CREATE POLICY anon_profiles_self ON anon_profiles
  USING (id = current_setting('brim.owner_id', true))
  WITH CHECK (id = current_setting('brim.owner_id', true));
CREATE POLICY anon_profiles_service ON anon_profiles
  USING (current_setting('brim.service_role', true) = '1')
  WITH CHECK (current_setting('brim.service_role', true) = '1');

DROP POLICY IF EXISTS route_cache_service ON route_cache;
CREATE POLICY route_cache_service ON route_cache
  USING (current_setting('brim.service_role', true) = '1')
  WITH CHECK (current_setting('brim.service_role', true) = '1');

CREATE POLICY stations_service_write ON stations
  USING (current_setting('brim.service_role', true) = '1')
  WITH CHECK (current_setting('brim.service_role', true) = '1');
CREATE POLICY station_prices_service_write ON station_prices
  USING (current_setting('brim.service_role', true) = '1')
  WITH CHECK (current_setting('brim.service_role', true) = '1');
CREATE POLICY zones_service_write ON zones
  USING (current_setting('brim.service_role', true) = '1')
  WITH CHECK (current_setting('brim.service_role', true) = '1');
CREATE POLICY tolls_service_write ON tolls
  USING (current_setting('brim.service_role', true) = '1')
  WITH CHECK (current_setting('brim.service_role', true) = '1');
CREATE POLICY vca_service_write ON vca_vehicles
  USING (current_setting('brim.service_role', true) = '1')
  WITH CHECK (current_setting('brim.service_role', true) = '1');
CREATE POLICY grid_service_write ON grid_intensity
  USING (current_setting('brim.service_role', true) = '1')
  WITH CHECK (current_setting('brim.service_role', true) = '1');
