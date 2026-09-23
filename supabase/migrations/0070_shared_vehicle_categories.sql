-- 0070: shared vehicle categories for every business.
--
-- The app lists categories that are either shared (organization_id is null)
-- or the business's own, and the RLS policy lets every member read shared
-- ones. But nothing ever created shared categories: seed.sql only creates them
-- for one demo business. So a newly signed-up business had an empty "Vehicle
-- category" list and could not add a vehicle.
--
-- This creates the standard six as shared, system categories. The
-- (organization_id, code) unique constraint does not apply to rows with a null
-- organisation, so each insert checks for an existing shared row itself and
-- the migration is safe to run more than once.

insert into public.vehicle_categories (organization_id, code, name, description, icon, sort_order, is_system)
select null, v.code, v.name, v.description, v.icon, v.sort_order, true
from (values
  ('car',        'Car',        'Passenger cars and sedans',        'car',     10),
  ('motorcycle', 'Motorcycle', 'Motorcycles and motorbikes',       'bike',    20),
  ('scooter',    'Scooter',    'Scooters and mopeds',              'scooter', 30),
  ('ebike',      'E-bike',     'Electric bicycles and light EVs',  'battery', 40),
  ('van',        'Van',        'Vans and people movers',           'van',     50),
  ('atv',        'ATV',        'ATVs and off-road vehicles',       'atv',     60)
) as v(code, name, description, icon, sort_order)
where not exists (
  select 1 from public.vehicle_categories existing
  where existing.organization_id is null and existing.code = v.code
);
