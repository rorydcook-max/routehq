alter table public.customers
  add column if not exists driver_license_country text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text;
