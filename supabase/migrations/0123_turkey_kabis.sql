-- Türkiye (4 Nov 2026). Additive only.
-- KABİS (Kiralık Araç Bildirim Sistemi, the police rental-vehicle register): the renter details a Turkish rental
-- business enters for each rental that RoveHQ didn't already keep (lib/kabis.ts). Name, nationality, passport, licence
-- number/country/expiry/categories, date of birth, address and phone already have columns.

-- T.C. Kimlik No for Turkish citizens (11 digits, checksum checked by the app before saving).
alter table public.customers add column if not exists national_id_number text;
-- The date the driving licence was issued (KABİS and the Ministry of Trade's contract rules ask for licence details).
alter table public.customers add column if not exists driver_license_issued date;

-- Deleting a customer (erase_customer_data, migration 0119) blanks their record by setting it to 'Deleted customer';
-- these newer columns (and the UK DVLA check code from 0120) are blanked with it.
create or replace function public.blank_erased_customer_extras()
returns trigger language plpgsql as $$
begin
  if new.full_name = 'Deleted customer' and new.deleted_at is not null and (old.full_name is distinct from new.full_name) then
    new.national_id_number := null;
    new.driver_license_issued := null;
    new.dvla_check_code := null;
  end if;
  return new;
end; $$;

drop trigger if exists customers_blank_erased_extras on public.customers;
create trigger customers_blank_erased_extras
  before update on public.customers
  for each row execute function public.blank_erased_customer_extras();
