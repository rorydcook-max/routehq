-- Devices that asked for alerts (phone or computer), one row per browser.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz
);
create index if not exists push_subscriptions_org_idx on public.push_subscriptions (organization_id);
-- Only the server (service role) reads or writes these.
alter table public.push_subscriptions enable row level security;
