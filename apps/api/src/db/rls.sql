-- RLS-first. Apply in the same migration that creates owner-scoped tables.
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fill_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY vehicles_owner ON vehicles USING (owner_id = current_setting('brim.owner_id', true));
CREATE POLICY tariffs_owner ON tariffs USING (
  vehicle_id IN (SELECT id FROM vehicles WHERE owner_id = current_setting('brim.owner_id', true))
);
CREATE POLICY fill_ups_owner ON fill_ups USING (
  vehicle_id IN (SELECT id FROM vehicles WHERE owner_id = current_setting('brim.owner_id', true))
);
CREATE POLICY journeys_owner ON journeys USING (owner_id = current_setting('brim.owner_id', true));
CREATE POLICY calibrations_owner ON calibrations USING (
  vehicle_id IN (SELECT id FROM vehicles WHERE owner_id = current_setting('brim.owner_id', true))
);

ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE tolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE vca_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE grid_intensity ENABLE ROW LEVEL SECURITY;

CREATE POLICY stations_read ON stations FOR SELECT USING (true);
CREATE POLICY station_prices_read ON station_prices FOR SELECT USING (true);
CREATE POLICY zones_read ON zones FOR SELECT USING (true);
CREATE POLICY tolls_read ON tolls FOR SELECT USING (true);
CREATE POLICY vca_read ON vca_vehicles FOR SELECT USING (true);
CREATE POLICY grid_read ON grid_intensity FOR SELECT USING (true);
