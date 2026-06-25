alter table public.rentals
  add column if not exists upfront_periods integer default 0,
  add column if not exists upfront_rate numeric,
  add column if not exists upfront_total numeric,
  add column if not exists upfront_accepted boolean default false;

alter table public.organizations
  add column if not exists upfront_discount_enabled boolean default false,
  add column if not exists upfront_discount_min_periods integer default 3,
  add column if not exists upfront_discount_rate numeric,
  add column if not exists upfront_discount_label text;
