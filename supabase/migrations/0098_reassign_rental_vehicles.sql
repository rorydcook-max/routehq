-- Several rentals change vehicles at once, e.g. a customer on rent takes a car that
-- has a future booking, and that booking moves to the car they gave up. Done in one
-- step so the double-booking rule never sees a half-finished state: the rentals are
-- set aside, given their new vehicles, then put back one by one.
create or replace function public.reassign_rental_vehicles(p_organization_id uuid, p_moves jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  ids uuid[];
  m jsonb;
begin
  select array_agg((x->>'rental_id')::uuid) into ids from jsonb_array_elements(p_moves) x;
  if ids is null or array_length(ids, 1) = 0 then return; end if;
  if (select count(*) from rentals where id = any(ids) and organization_id = p_organization_id and deleted_at is null) <> array_length(ids, 1) then
    raise exception 'Rental not found';
  end if;
  perform 1 from rentals where id = any(ids) for update;
  update rentals set deleted_at = now() where id = any(ids);
  for m in select * from jsonb_array_elements(p_moves) loop
    update rentals
      set vehicle_id = (m->>'vehicle_id')::uuid,
          original_vehicle_id = coalesce(original_vehicle_id, vehicle_id),
          deleted_at = null
      where id = (m->>'rental_id')::uuid;
  end loop;
end;
$function$;

revoke all on function public.reassign_rental_vehicles(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.reassign_rental_vehicles(uuid, jsonb) to service_role;
