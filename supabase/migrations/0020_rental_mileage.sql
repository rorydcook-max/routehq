alter table public.rentals
  add column if not exists mileage_at_delivery integer,
  add column if not exists mileage_at_return integer,
  add column if not exists km_driven integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rentals_mileage_at_delivery_nonnegative'
  ) then
    alter table public.rentals
      add constraint rentals_mileage_at_delivery_nonnegative check (mileage_at_delivery is null or mileage_at_delivery >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'rentals_mileage_at_return_nonnegative'
  ) then
    alter table public.rentals
      add constraint rentals_mileage_at_return_nonnegative check (mileage_at_return is null or mileage_at_return >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'rentals_km_driven_nonnegative'
  ) then
    alter table public.rentals
      add constraint rentals_km_driven_nonnegative check (km_driven is null or km_driven >= 0);
  end if;
end $$;
