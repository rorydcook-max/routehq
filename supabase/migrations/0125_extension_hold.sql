-- Hold for extension (Rory, 7 Nov 2026). Monthly renters often extend at the last minute, and by then the dates
-- after their rental may be booked by someone else. With Settings > Holds and notice > "Hold for extension" on, a
-- monthly rental keeps its vehicle off new bookings for N days after it ends, until the renter says they are returning
-- (or doesn't answer by 2 days before the end, or the owner releases it).
--
-- rentals.extension_hold_until is the first day the vehicle can be booked again (exclusive end, like end_date), or
-- null when there is no hold. It is worked out here, in one place, by public.rental_extension_hold(), and kept up to
-- date by triggers: on every insert/update of a rental, and for all of a business's rentals when its booking rules
-- change. The app only reads the column (lib/rental-conflicts.ts bookableEnd) wherever availability is shown.
--
-- A "monthly rental": priced or billed monthly, or 28 days or longer.
-- The renter's answer (and the owner's release, and the automatic lapse) is kept with the end date it was about, so
-- an extension that moves the end date starts afresh.
-- Additive only: new columns, functions and triggers.

alter table public.rentals add column if not exists extension_hold_until date;
alter table public.rentals add column if not exists extension_check_token text;
alter table public.rentals add column if not exists extension_check_end date;
alter table public.rentals add column if not exists extension_check_sent_at timestamptz;
alter table public.rentals add column if not exists extension_answer text;
alter table public.rentals add column if not exists extension_answered_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rentals_extension_answer_check') then
    alter table public.rentals add constraint rentals_extension_answer_check
      check (extension_answer is null or extension_answer in ('extend', 'returning', 'released', 'lapsed'));
  end if;
end $$;

create unique index if not exists rentals_extension_check_token_key on public.rentals (extension_check_token) where extension_check_token is not null;
create index if not exists rentals_extension_hold_until_idx on public.rentals (organization_id, extension_hold_until) where extension_hold_until is not null;

create or replace function public.rental_extension_hold(r public.rentals)
returns date
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rules jsonb;
  days integer;
begin
  if r.end_date is null or r.start_date is null or r.deleted_at is not null then return null; end if;
  if r.status::text not in ('booked', 'active', 'due_soon', 'overdue', 'extended') then return null; end if;
  if not (r.pricing_model::text = 'monthly' or coalesce(r.billing_interval, '') = 'monthly' or coalesce(r.billing_period, '') = 'monthly' or (r.end_date - r.start_date) >= 28) then
    return null;
  end if;
  select o.settings -> 'booking_rules' into rules from public.organizations o where o.id = r.organization_id;
  if rules is null or coalesce(rules ->> 'extension_hold', 'false') <> 'true' then return null; end if;
  days := case when coalesce(rules ->> 'extension_hold_days', '') ~ '^[0-9]{1,3}$' then (rules ->> 'extension_hold_days')::integer else 7 end;
  if days < 1 then return null; end if;
  if days > 30 then days := 30; end if;
  -- Answered (or released, or lapsed) for this end date: no hold, except "extend", which keeps it.
  if r.extension_check_end = r.end_date and r.extension_answer in ('returning', 'released', 'lapsed') then return null; end if;
  return r.end_date + days;
end;
$$;

create or replace function public.rentals_set_extension_hold()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.extension_hold_until := public.rental_extension_hold(new);
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'rentals_extension_hold' and tgrelid = 'public.rentals'::regclass) then
    create trigger rentals_extension_hold
      before insert or update on public.rentals
      for each row execute function public.rentals_set_extension_hold();
  end if;
end $$;

create or replace function public.organizations_refresh_extension_holds()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.settings -> 'booking_rules') is distinct from (new.settings -> 'booking_rules') then
    update public.rentals r
       set extension_hold_until = public.rental_extension_hold(r)
     where r.organization_id = new.id
       and r.deleted_at is null
       and (r.extension_hold_until is not null or (r.status::text in ('booked', 'active', 'due_soon', 'overdue', 'extended') and r.end_date is not null))
       and r.extension_hold_until is distinct from public.rental_extension_hold(r);
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'organizations_extension_holds' and tgrelid = 'public.organizations'::regclass) then
    create trigger organizations_extension_holds
      after update of settings on public.organizations
      for each row execute function public.organizations_refresh_extension_holds();
  end if;
end $$;

revoke all on function public.organizations_refresh_extension_holds() from public, anon, authenticated;
