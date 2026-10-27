-- Choosing a plan from the plans page (27 Oct 2026). Until a payment provider is connected, a paid
-- plan is a request: the business pays by PromptPay or transfer and the RouteHQ team switches it on.
alter table public.organizations
  add column if not exists pending_plan text check (pending_plan is null or pending_plan in ('starter', 'pro', 'business')),
  add column if not exists pending_interval text check (pending_interval is null or pending_interval in ('monthly', 'yearly')),
  add column if not exists pending_amount numeric(14, 2),
  add column if not exists pending_currency text,
  add column if not exists plan_requested_at timestamptz,
  -- No foreign key: one from organizations to support_threads makes Help's embeds ambiguous (0106).
  add column if not exists plan_request_thread_id uuid,
  add column if not exists founding_member boolean not null default false;

comment on column public.organizations.pending_plan is 'Paid plan the business chose and has not been switched to yet (waiting for payment or renewal).';
comment on column public.organizations.pending_amount is 'What the business was asked to pay for the pending plan, in pending_currency.';
comment on column public.organizations.founding_member is 'One of the first 100 paying businesses: half price for as long as they stay.';
