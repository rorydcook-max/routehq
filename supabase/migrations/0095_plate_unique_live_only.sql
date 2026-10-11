-- A removed vehicle kept its plate reserved, so the same plate could never be
-- added again (nor re-imported after an import was taken back). The plate only
-- has to be unique among vehicles that are still in the fleet.
alter table public.vehicles drop constraint if exists vehicles_organization_id_registration_number_key;
create unique index if not exists vehicles_live_plate_key
  on public.vehicles (organization_id, registration_number)
  where deleted_at is null;
