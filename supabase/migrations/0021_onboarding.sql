alter table public.organizations
  add column if not exists onboarding_completed boolean default false,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_skipped boolean default false;

create table if not exists public.onboarding_checklist (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  step text not null,
  completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now(),
  unique(organization_id, step)
);

alter table public.onboarding_checklist enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'onboarding_checklist'
      and policyname = 'Members can view onboarding checklist'
  ) then
    create policy "Members can view onboarding checklist"
      on public.onboarding_checklist for select
      using (public.is_org_member(organization_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'onboarding_checklist'
      and policyname = 'Managers can manage onboarding checklist'
  ) then
    create policy "Managers can manage onboarding checklist"
      on public.onboarding_checklist for all
      using (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]))
      with check (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]));
  end if;
end $$;
