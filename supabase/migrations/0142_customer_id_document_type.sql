-- A national ID card is accepted in place of a passport for online signing (Rory, 8 Nov 2026).
-- The number and expiry stay in passport_number / passport_expiry; this says which document they belong to.
-- Empty means a passport, as every customer saved before this was.
alter table public.customers
  add column if not exists id_document_type text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'customers_id_document_type_check') then
    alter table public.customers
      add constraint customers_id_document_type_check check (id_document_type is null or id_document_type in ('passport', 'national_id'));
  end if;
end $$;
