-- A vehicle can be added without its number plate and the plate filled in later (Rory, 31 Oct 2026).
-- Plates stay unique per business, but an empty plate no longer counts as a duplicate.
drop index if exists public.vehicles_live_plate_key;
create unique index vehicles_live_plate_key on public.vehicles (organization_id, registration_number)
  where deleted_at is null and registration_number <> '';
