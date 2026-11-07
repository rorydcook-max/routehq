-- New businesses no longer start out Thai (e2e-fix3, 8 Nov 2026).
--
-- create_my_organization inserts only a name and slug, so a new business took the column defaults: Thailand,
-- baht and Bangkok time, until setup saved its real country. Setup (saveBusinessProfile) sets all of them
-- explicitly, so these defaults only matter for a business that has not finished setup:
--   * country_code '' : "not chosen yet". The column stays NOT NULL; the app reads '' as no country
--                       (lib/regional.ts orgCountry, lib/business-units.ts), so no Thai-only choices appear.
--   * currency 'USD', supported_currencies {USD}, timezone 'UTC': neutral until setup.
-- Existing businesses keep their saved values: only defaults change here.
--
-- Rentals, payments and transactions: the currency is always the business's own. The 'THB' default is cleared and a
-- trigger fills a missing currency from the business, so an insert that forgets it can never record baht for a
-- business elsewhere (NOT NULL is checked after the trigger, so a value is still always there).

alter table public.organizations alter column country_code set default '';
alter table public.organizations alter column currency set default 'USD';
alter table public.organizations alter column supported_currencies set default array['USD']::text[];
alter table public.organizations alter column timezone set default 'UTC';

create or replace function public.fill_currency_from_organization()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.currency is null or btrim(new.currency) = '' then
    select coalesce(nullif(btrim(o.currency), ''), 'USD') into new.currency
    from public.organizations o
    where o.id = new.organization_id;
    if new.currency is null then
      new.currency := 'USD';
    end if;
  end if;
  return new;
end;
$$;

alter table public.rentals alter column currency set default null;
alter table public.rental_payments alter column currency set default null;
alter table public.transactions alter column currency set default null;

create or replace trigger rentals_fill_currency before insert on public.rentals
  for each row execute function public.fill_currency_from_organization();

create or replace trigger rental_payments_fill_currency before insert on public.rental_payments
  for each row execute function public.fill_currency_from_organization();

create or replace trigger transactions_fill_currency before insert on public.transactions
  for each row execute function public.fill_currency_from_organization();
