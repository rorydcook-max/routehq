-- Partner network, reworked (Rory, 7 Nov 2026). A business that shares its fleet can search other sharing
-- businesses' free vehicles and copy a booking link for a customer, tagged with the referring business. When the
-- customer books through that link, the referrer earns 10% of EACH rental payment, paid by the vehicle's operator.
-- RoveHQ takes no cut. Settled between the two businesses and marked settled here for now; Stripe Connect transfers
-- come later (settlement_method / stripe_transfer_id are the hook).
-- Additive only, safe to run on a live database and safe to run twice.

-- How the referral started: 'manual' (the old "create a link for the customer" flow) or 'link' (the customer booked
-- through a copied partner link).
alter table public.referrals add column if not exists channel text not null default 'manual';
-- The currency the commission is in: the vehicle operator's.
alter table public.referrals add column if not exists currency text;
-- fee_amount is now the running total of all commissions on the booking; this is how much of it has been settled.
alter table public.referrals add column if not exists fee_settled_amount numeric(12,2) not null default 0;

-- One row per rental payment on a referred booking: 10% of that payment, owed by the operator to the referrer.
create table if not exists public.referral_commissions (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals (id) on delete cascade,
  from_organization_id uuid not null references public.organizations (id) on delete cascade,
  to_organization_id uuid not null references public.organizations (id) on delete cascade,
  rental_id uuid references public.rentals (id) on delete set null,
  rental_payment_id uuid references public.rental_payments (id) on delete set null,
  payment_amount numeric(12,2) not null default 0,
  fee_pct numeric(5,2) not null default 10,
  fee_amount numeric(12,2) not null default 0,
  currency text not null default 'THB',
  settled_at timestamptz,
  settled_by uuid references auth.users (id) on delete set null,
  -- 'manual' (marked settled by one of the businesses) or, later, 'stripe_connect'.
  settlement_method text,
  stripe_transfer_id text,
  created_at timestamptz not null default now()
);

create index if not exists referral_commissions_referral_idx on public.referral_commissions (referral_id, created_at);
create index if not exists referral_commissions_from_idx on public.referral_commissions (from_organization_id) where settled_at is null;
create index if not exists referral_commissions_to_idx on public.referral_commissions (to_organization_id) where settled_at is null;
-- A payment earns its commission once.
create unique index if not exists referral_commissions_payment_uidx on public.referral_commissions (rental_payment_id) where rental_payment_id is not null;

alter table public.referral_commissions enable row level security;
-- Both businesses can read their commissions; writes go through server code (service role).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'referral_commissions' and policyname = 'referral_commissions_member_select') then
    create policy referral_commissions_member_select on public.referral_commissions
      for select using (public.is_org_member(from_organization_id) or public.is_org_member(to_organization_id));
  end if;
end $$;

-- Fees recorded under the old one-time rule become one commission row each, so the totals carry over.
insert into public.referral_commissions (referral_id, from_organization_id, to_organization_id, rental_id, payment_amount, fee_pct, fee_amount, currency, settled_at, settlement_method, created_at)
select r.id, r.from_organization_id, r.to_organization_id, r.rental_id,
       case when coalesce(r.fee_pct, 0) > 0 then round(r.fee_amount * 100 / r.fee_pct, 2) else r.fee_amount end,
       coalesce(r.fee_pct, 10), r.fee_amount, coalesce(o.currency, 'THB'), r.fee_paid_at,
       case when r.fee_paid_at is not null then 'manual' end, r.created_at
from public.referrals r
join public.organizations o on o.id = r.to_organization_id
where r.fee_amount is not null
  and not exists (select 1 from public.referral_commissions c where c.referral_id = r.id);

update public.referrals r
set fee_settled_amount = r.fee_amount
where r.fee_paid_at is not null and r.fee_amount is not null and r.fee_settled_amount = 0;

update public.referrals r
set currency = o.currency
from public.organizations o
where o.id = r.to_organization_id and r.currency is null;
