-- RouteHQ admin console (platform admins only): per-business custom plans and a log of every admin action.

alter table public.organizations
  add column if not exists custom_limits jsonb,
  add column if not exists custom_price numeric;

comment on column public.organizations.custom_limits is
  'Admin-set limits that override the plan''s: {"cars":n,"motorbikes":n,"team":n|null,"docReads":n,"lookups":n,"customDomain":bool,"prioritySupport":bool}. Null = the plan''s own limits.';
comment on column public.organizations.custom_price is
  'Admin-set monthly price in the business''s currency for a custom plan. Null = the plan''s list price.';

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  organization_id uuid references public.organizations(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_org_idx on public.admin_audit_log (organization_id, created_at desc);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

-- Platform admins read everything; a business can read what was done to it. Writes only through the service role.
drop policy if exists admin_audit_log_admin_read on public.admin_audit_log;
create policy admin_audit_log_admin_read on public.admin_audit_log
  for select using (public.is_platform_admin());

drop policy if exists admin_audit_log_business_read on public.admin_audit_log;
create policy admin_audit_log_business_read on public.admin_audit_log
  for select using (
    organization_id is not null and exists (
      select 1 from public.organization_members m
      where m.organization_id = admin_audit_log.organization_id and m.user_id = auth.uid() and m.is_active
    )
  );
