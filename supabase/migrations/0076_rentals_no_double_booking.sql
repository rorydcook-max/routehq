-- A vehicle can only be held by one live booking at a time.
-- A booking holds the car from start_date up to (not including) end_date, so a
-- same-day handover is allowed; a one-day booking (start = end) holds that day;
-- a booking with no end date holds the car until one is set.
create extension if not exists btree_gist with schema extensions;

alter table public.rentals
  add constraint rentals_no_double_booking
  exclude using gist (
    vehicle_id with =,
    daterange(start_date, greatest(coalesce(end_date, 'infinity'::date), start_date + 1), '[)') with &&
  )
  where (
    deleted_at is null
    and vehicle_id is not null
    and start_date is not null
    and status in ('booked', 'active', 'due_soon', 'overdue', 'extended')
  );
