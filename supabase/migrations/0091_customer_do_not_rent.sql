-- A customer the business does not want to rent to again (unpaid damage, a vehicle
-- returned late with no word, trouble). The app warns when they are picked for a booking.
alter table public.customers
  add column if not exists do_not_rent boolean not null default false,
  add column if not exists do_not_rent_reason text,
  add column if not exists do_not_rent_at timestamptz;
