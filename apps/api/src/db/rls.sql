-- RLS-first. Policies live in 0001_init.sql and 0003_rls_force.sql.
-- This file is a readable stub of the owner-scoped rules after FORCE.

ALTER TABLE vehicles FORCE ROW LEVEL SECURITY;
ALTER TABLE tariffs FORCE ROW LEVEL SECURITY;
ALTER TABLE fill_ups FORCE ROW LEVEL SECURITY;
ALTER TABLE journeys FORCE ROW LEVEL SECURITY;
ALTER TABLE calibrations FORCE ROW LEVEL SECURITY;

CREATE POLICY vehicles_owner ON vehicles
  USING (owner_id = current_setting('brim.owner_id', true))
  WITH CHECK (owner_id = current_setting('brim.owner_id', true));
CREATE POLICY tariffs_owner ON tariffs
  USING (
    vehicle_id IN (SELECT id FROM vehicles WHERE owner_id = current_setting('brim.owner_id', true))
  )
  WITH CHECK (
    vehicle_id IN (SELECT id FROM vehicles WHERE owner_id = current_setting('brim.owner_id', true))
  );
CREATE POLICY fill_ups_owner ON fill_ups
  USING (
    vehicle_id IN (SELECT id FROM vehicles WHERE owner_id = current_setting('brim.owner_id', true))
  )
  WITH CHECK (
    vehicle_id IN (SELECT id FROM vehicles WHERE owner_id = current_setting('brim.owner_id', true))
  );
CREATE POLICY journeys_owner ON journeys
  USING (owner_id = current_setting('brim.owner_id', true))
  WITH CHECK (owner_id = current_setting('brim.owner_id', true));
CREATE POLICY calibrations_owner ON calibrations
  USING (
    vehicle_id IN (SELECT id FROM vehicles WHERE owner_id = current_setting('brim.owner_id', true))
  )
  WITH CHECK (
    vehicle_id IN (SELECT id FROM vehicles WHERE owner_id = current_setting('brim.owner_id', true))
  );
