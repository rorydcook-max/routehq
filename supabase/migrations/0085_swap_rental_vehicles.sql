-- Two rentals exchange vehicles (customers swapping cars mid-rental). The
-- no-double-booking rule would refuse either half on its own, so both are
-- changed inside one transaction: the first rental steps out of the rule for
-- an instant (the rule ignores deleted rows), the second takes its vehicle,
-- and the first comes back on the other vehicle. If the result would clash
-- with any other booking the whole thing is refused and nothing changes.
create or replace function public.swap_rental_vehicles(p_rental_a uuid, p_rental_b uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  b record;
begin
  select id, organization_id, vehicle_id, deleted_at into a from rentals where id = p_rental_a for update;
  select id, organization_id, vehicle_id, deleted_at into b from rentals where id = p_rental_b for update;
  if a.id is null or b.id is null then raise exception 'Rental not found'; end if;
  if a.organization_id <> b.organization_id then raise exception 'Rentals belong to different businesses'; end if;
  if a.deleted_at is not null or b.deleted_at is not null then raise exception 'Rental not found'; end if;
  if a.vehicle_id = b.vehicle_id then raise exception 'Both rentals are on the same vehicle'; end if;

  update rentals set deleted_at = now() where id = a.id;
  update rentals set vehicle_id = a.vehicle_id, original_vehicle_id = coalesce(original_vehicle_id, b.vehicle_id) where id = b.id;
  update rentals set vehicle_id = b.vehicle_id, original_vehicle_id = coalesce(original_vehicle_id, a.vehicle_id), deleted_at = null where id = a.id;
end;
$$;

revoke all on function public.swap_rental_vehicles(uuid, uuid) from public, anon, authenticated;
grant execute on function public.swap_rental_vehicles(uuid, uuid) to service_role;
