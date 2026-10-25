-- RouteHQ's own list of renters who said yes to partner offers (Rory, 25 Oct 2026). With the renter's permission
-- (renter_consents, wording version 2026-10-25b, which says RouteHQ keeps their details and rental history), RouteHQ
-- keeps its own copy: one renter across every business they rented from, matched by the same keyed hashes of phone
-- and document numbers as shared customer history, so it survives a business deleting its customer record.
--
-- Withdrawal: the renter's contact details and rental history are deleted; the row stays with its match keys and
-- dates only, so the proof of what they agreed to (renter_consents) still makes sense and a later yes re-links them.
--
-- RouteHQ team only: row level security on, no policies, read and written by the server (service role).

create table if not exists public.renters (
  id uuid primary key default gen_random_uuid(),
  match_keys text[] not null default '{}',
  full_name text,
  phone text,
  email text,
  whatsapp text,
  line_id text,
  nationality text,
  licence_country text,
  language text,
  date_of_birth date,
  offers boolean not null default false,
  consented_at timestamptz,
  consent_version text,
  withdrawn_at timestamptz,
  first_rental_on date,
  last_rental_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists renters_keys_idx on public.renters using gin (match_keys);

-- Which business's customer record each renter came from (a renter can have several).
create table if not exists public.renter_sources (
  renter_id uuid not null references public.renters(id) on delete cascade,
  organization_id uuid not null,
  customer_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, customer_id)
);
create index if not exists renter_sources_renter_idx on public.renter_sources (renter_id);

-- One row per rental, a snapshot refreshed daily while the renter's answer is yes. No foreign keys to the business's
-- tables on purpose: the copy stays when the business deletes its records.
create table if not exists public.renter_rentals (
  rental_id uuid primary key,
  renter_id uuid not null references public.renters(id) on delete cascade,
  organization_id uuid not null,
  operator_name text,
  town text,
  region text,
  booked_via text,
  vehicle text,
  vehicle_type text,
  vehicle_year integer,
  start_date date,
  end_date date,
  days integer,
  status text,
  active boolean not null default false,
  rate_type text,
  open_ended boolean not null default false,
  rate numeric(12, 2),
  currency text,
  extras jsonb not null default '[]',
  extras_total numeric(12, 2),
  total_paid numeric(12, 2),
  deposit numeric(12, 2),
  deposit_outcome text,
  deposit_returned numeric(12, 2),
  deposit_kept numeric(12, 2),
  ended_early boolean not null default false,
  days_early integer,
  damage_items integer not null default 0,
  damage_charged numeric(12, 2),
  km_driven integer,
  delivery_place text,
  updated_at timestamptz not null default now()
);
create index if not exists renter_rentals_renter_idx on public.renter_rentals (renter_id, start_date desc);

alter table public.renters enable row level security;
alter table public.renter_sources enable row level security;
alter table public.renter_rentals enable row level security;

-- Everything worth knowing about a set of customers' rentals, worked out from the business's tables. For the server's
-- renter sync only.
create or replace function public.renter_rental_facts(p_customer_ids uuid[])
returns table (
  rental_id uuid, customer_id uuid, organization_id uuid, operator_name text, town text, region text, booked_via text,
  vehicle text, vehicle_type text, vehicle_year integer, start_date date, end_date date, days integer, status text,
  active boolean, rate_type text, open_ended boolean, rate numeric, currency text, extras jsonb, extras_total numeric,
  total_paid numeric, deposit numeric, deposit_outcome text, deposit_returned numeric, deposit_kept numeric,
  ended_early boolean, days_early integer, damage_items integer, damage_charged numeric, km_driven integer, delivery_place text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.customer_id,
    r.organization_id,
    coalesce(nullif(o.trading_name, ''), o.name),
    coalesce(o.settings->'main_location'->>'town', o.settings->>'location'),
    o.settings->'main_location'->>'region',
    (select bl.booking_data->>'source' from public.booking_links bl where bl.rental_id = r.id and bl.deleted_at is null order by bl.created_at limit 1),
    nullif(concat_ws(' ', v.make, v.model, v.trim), ''),
    vc.name,
    v.year,
    r.start_date,
    r.end_date,
    greatest(1, coalesce(r.end_date, current_date) - r.start_date)::integer,
    r.status::text,
    r.status::text in ('active', 'due_soon', 'overdue', 'extended'),
    coalesce(r.pricing_model::text, r.billing_interval::text),
    coalesce(r.is_indefinite, false),
    coalesce(r.contracted_rate, r.rental_rate),
    r.currency,
    coalesce((select jsonb_agg(e) from jsonb_array_elements(case when jsonb_typeof(r.extras) = 'array' then r.extras else '[]'::jsonb end) e where e->>'removed_at' is null), '[]'::jsonb),
    r.extras_total,
    -- What they paid for the rental itself; the deposit is shown on its own.
    (select coalesce(sum(p.amount), 0) from public.rental_payments p where p.rental_id = r.id and p.status = 'paid' and coalesce(p.voided, false) = false and p.deleted_at is null and coalesce(p.metadata->>'type', '') not in ('deposit', 'deposit_top_up') and coalesce(p.metadata->>'is_deposit', 'false') <> 'true'),
    coalesce(r.deposit_amount, r.deposit_held),
    case r.deposit_status::text
      when 'fully_returned' then 'returned_in_full'
      when 'forfeited' then 'kept'
      when 'partially_forfeited' then 'partly_kept'
      when 'received' then 'held'
      else case when coalesce(r.deposit_amount, 0) > 0 then 'not_yet_paid' else 'none' end
    end,
    r.deposit_refunded_amount,
    r.deposit_forfeited_amount,
    exists (select 1 from public.communication_log c where c.rental_id = r.id and c.metadata->>'adjustment_type' = 'early_return'),
    (select max((c.metadata->>'days_early')::integer) from public.communication_log c where c.rental_id = r.id and c.metadata->>'adjustment_type' = 'early_return' and (c.metadata->>'days_early') ~ '^\d+$'),
    (select coalesce(sum((select count(*) from jsonb_array_elements(i.damage_items) d where coalesce((d->>'is_pre_existing')::boolean, false) = false)), 0)::integer
       from public.inspections i where i.rental_id = r.id and i.deleted_at is null and coalesce(i.type, i.inspection_type::text) = 'return' and jsonb_typeof(i.damage_items) = 'array'),
    (select sum(p.amount) from public.rental_payments p where p.rental_id = r.id and p.metadata->>'type' = 'charge' and coalesce(p.voided, false) = false and p.deleted_at is null),
    coalesce(r.km_driven, case when r.mileage_at_return > r.mileage_at_delivery then r.mileage_at_return - r.mileage_at_delivery end)::integer,
    r.delivery_location
  from public.rentals r
  join public.organizations o on o.id = r.organization_id
  left join public.vehicles v on v.id = r.vehicle_id
  left join public.vehicle_categories vc on vc.id = v.category_id
  where r.customer_id = any(p_customer_ids)
    and r.deleted_at is null
    and r.status::text not in ('draft', 'cancelled');
$$;

revoke all on function public.renter_rental_facts(uuid[]) from public, authenticated, anon;
grant execute on function public.renter_rental_facts(uuid[]) to service_role;
