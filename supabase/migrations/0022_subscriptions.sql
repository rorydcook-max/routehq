alter table public.organizations
  add column if not exists trial_started_at timestamptz default now(),
  add column if not exists trial_ends_at timestamptz default (now() + interval '30 days'),
  add column if not exists subscription_status text default 'trial'
    check (subscription_status in ('trial', 'active', 'past_due', 'paused', 'cancelled', 'expired')),
  add column if not exists subscription_tier text default 'growth'
    check (subscription_tier in ('starter', 'growth', 'pro', 'business')),
  add column if not exists subscription_started_at timestamptz,
  add column if not exists next_payment_due timestamptz,
  add column if not exists payment_method text;
