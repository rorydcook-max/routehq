-- Plans decided 11 Oct 2026: a Free plan (up to 2 vehicles) joins Starter, Growth, Pro and Business.
-- Yearly billing and the directory add-on are recorded on the organisation too.
alter table public.organizations drop constraint if exists organizations_subscription_tier_check;
alter table public.organizations
  add constraint organizations_subscription_tier_check
  check (subscription_tier = any (array['free'::text, 'starter'::text, 'growth'::text, 'pro'::text, 'business'::text]));

alter table public.organizations
  add column if not exists billing_interval text not null default 'monthly'
    check (billing_interval in ('monthly', 'yearly')),
  add column if not exists directory_addon boolean not null default false;

comment on column public.organizations.billing_interval is 'monthly or yearly (yearly costs 11 months).';
comment on column public.organizations.directory_addon is 'Pays the directory listing add-on (plans that do not include it).';
