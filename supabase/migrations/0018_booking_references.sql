alter table public.rentals
  add column if not exists reference text;

with numbered as (
  select
    id,
    organization_id,
    created_at,
    row_number() over (
      partition by organization_id, extract(year from created_at)
      order by created_at, id
    ) as sequence_number
  from public.rentals
  where reference is null
)
update public.rentals r
set reference = 'FL-' || to_char(numbered.created_at, 'YYYY') || '-' || lpad(numbered.sequence_number::text, 4, '0')
from numbered
where r.id = numbered.id
  and r.organization_id = numbered.organization_id
  and r.reference is null;

create unique index if not exists rentals_org_reference_unique
  on public.rentals(organization_id, reference)
  where reference is not null;

create or replace function public.generate_booking_reference(org_id uuid)
returns text as $$
declare
  year_part text := to_char(now(), 'YYYY');
  seq_num integer;
begin
  perform pg_advisory_xact_lock(hashtext(org_id::text), year_part::integer);

  select count(*) + 1 into seq_num
  from public.rentals
  where organization_id = org_id
    and extract(year from created_at) = extract(year from now());

  return 'FL-' || year_part || '-' || lpad(seq_num::text, 4, '0');
end;
$$ language plpgsql;

create or replace function public.set_rental_reference()
returns trigger as $$
begin
  if new.reference is null or btrim(new.reference) = '' then
    new.reference := public.generate_booking_reference(new.organization_id);
  end if;

  if new.display_code is null or btrim(new.display_code) = '' then
    new.display_code := new.reference;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists rentals_reference_before_insert on public.rentals;
create trigger rentals_reference_before_insert
  before insert on public.rentals
  for each row
  execute function public.set_rental_reference();
