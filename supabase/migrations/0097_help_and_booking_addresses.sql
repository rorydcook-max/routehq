-- Help: conversations between a business and the RouteHQ team, with files.
create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  topic text not null default 'question' check (topic in ('question', 'problem', 'import', 'billing', 'domain', 'idea')),
  subject text not null,
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  last_message_at timestamptz not null default now(),
  unread_by_team boolean not null default true,
  unread_by_business boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists support_threads_org_idx on public.support_threads (organization_id, last_message_at desc);
create index if not exists support_threads_team_idx on public.support_threads (status, last_message_at desc);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  from_team boolean not null default false,
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_thread_idx on public.support_messages (thread_id, created_at);

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;

create policy support_threads_read on public.support_threads for select
  using (public.is_platform_admin() or exists (
    select 1 from public.organization_members m
    where m.organization_id = support_threads.organization_id and m.user_id = auth.uid() and m.is_active
  ));

create policy support_messages_read on public.support_messages for select
  using (public.is_platform_admin() or exists (
    select 1 from public.organization_members m
    where m.organization_id = support_messages.organization_id and m.user_id = auth.uid() and m.is_active
  ));
-- Writes go through server actions with the service role, after checking membership or team role.

insert into storage.buckets (id, name, public)
values ('support-files', 'support-files', false)
on conflict (id) do nothing;

-- Booking addresses: theirshop.routehq.app (Growth and above) and their own domain (Business).
alter table public.organizations add column if not exists booking_subdomain text;
alter table public.organizations add column if not exists custom_domain text;
alter table public.organizations add column if not exists custom_domain_status text;
create unique index if not exists organizations_booking_subdomain_key on public.organizations (lower(booking_subdomain)) where booking_subdomain is not null and deleted_at is null;
create unique index if not exists organizations_custom_domain_key on public.organizations (lower(custom_domain)) where custom_domain is not null and deleted_at is null;

-- Which business a booking address belongs to. Read by the middleware with the public key, so it only says the
-- slug, plan and status, nothing else.
create or replace function public.resolve_booking_host(p_label text, p_host text)
returns table (slug text, tier text, status text, has_domain boolean)
language sql
security definer
set search_path = public
stable
as $$
  select o.slug, o.subscription_tier, coalesce(o.subscription_status, 'trial'), (o.custom_domain is not null and lower(o.custom_domain) = lower(coalesce(p_host, '')))
  from public.organizations o
  where o.deleted_at is null
    and (
      (p_label is not null and lower(o.booking_subdomain) = lower(p_label))
      or (p_host is not null and lower(o.custom_domain) = lower(p_host))
    )
  limit 1
$$;
grant execute on function public.resolve_booking_host(text, text) to anon, authenticated;
