-- Stripe Billing for RoveHQ's own plans (phase 1, 7 Nov 2026). Additive only.
-- organizations stays the single source of truth for the plan (subscription_tier, subscription_status,
-- billing_interval, next_payment_due); the Stripe webhook keeps these columns in step with Stripe.

alter table public.organizations
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_status text,
  add column if not exists subscription_cancel_at_period_end boolean not null default false,
  add column if not exists subscription_currency text,
  -- A smaller plan (or Free) chosen while paid up: it starts on scheduled_change_at.
  add column if not exists scheduled_plan text,
  add column if not exists scheduled_interval text,
  add column if not exists scheduled_change_at timestamptz,
  -- The vehicles the owner chose to keep active when moving to a plan with fewer vehicles.
  add column if not exists plan_keep_vehicle_ids uuid[];

create unique index if not exists organizations_stripe_customer_id_key on public.organizations (stripe_customer_id) where stripe_customer_id is not null;
create index if not exists organizations_stripe_subscription_id_idx on public.organizations (stripe_subscription_id) where stripe_subscription_id is not null;

-- Parked: over the plan's vehicle limit after a downgrade. Still visible, read-only, no new bookings,
-- not listed on the booking page, rove.rent or the partner network. Rentals already running finish normally.
alter table public.vehicles
  add column if not exists parked_at timestamptz;

create index if not exists vehicles_parked_idx on public.vehicles (organization_id) where parked_at is not null;

-- Every Stripe event handled once (webhook idempotency). Service role only: RLS on, no policies.
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);
alter table public.stripe_events enable row level security;

-- No new booking on a parked vehicle, whichever path creates it (team, booking page, links, partners, import).
-- Moving an existing rental onto a parked vehicle is blocked too; the rental already on it carries on.
create or replace function public.block_parked_vehicle_rental()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.vehicle_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.vehicle_id is not distinct from old.vehicle_id then
    return new;
  end if;
  if exists (select 1 from vehicles v where v.id = new.vehicle_id and v.parked_at is not null) then
    raise exception 'vehicle_parked: this vehicle is parked and cannot take new bookings' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'rentals_block_parked_vehicle') then
    create trigger rentals_block_parked_vehicle
      before insert or update of vehicle_id on public.rentals
      for each row execute function public.block_parked_vehicle_rental();
  end if;
end $$;
