-- RouteHQ admin console, steps 3-5 (needs 0107 first). Applied 2026-10-27.
-- Written without DROP statements so it can be applied unattended and re-run safely.
--   1. admin_view_sessions: "View as this business". The admin gets a temporary organization_members row
--      (role manager, display name "RouteHQ support") for at most 2 hours; this table says when it started
--      and when it ends. The app only honours that membership while its session here is live.
--   2. resolve_booking_host_v2: like resolve_booking_host (0097) plus custom_limits, so a custom plan can
--      include the own domain. A new name because changing a function's return columns needs a DROP.
--   3. admin_purge_organization(): "Delete permanently" for a business soft-deleted 30+ days ago.

create table if not exists public.admin_view_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reason text not null,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  ended_at timestamptz,
  return_organization_id uuid references public.organizations(id) on delete set null,
  previous_membership jsonb
);
create index if not exists admin_view_sessions_org_idx on public.admin_view_sessions (organization_id) where ended_at is null;
create index if not exists admin_view_sessions_admin_idx on public.admin_view_sessions (admin_user_id) where ended_at is null;
alter table public.admin_view_sessions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='admin_view_sessions' and policyname='admin_view_sessions_admin_read') then
    create policy admin_view_sessions_admin_read on public.admin_view_sessions for select using (public.is_platform_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename='admin_view_sessions' and policyname='admin_view_sessions_business_read') then
    create policy admin_view_sessions_business_read on public.admin_view_sessions for select using (
      exists (select 1 from public.organization_members m
              where m.organization_id = admin_view_sessions.organization_id and m.user_id = auth.uid() and m.is_active));
  end if;
end $$;

create or replace function public.resolve_booking_host_v2(p_label text, p_host text)
returns table (slug text, tier text, status text, has_domain boolean, custom_limits jsonb)
language sql security definer set search_path = public stable as $$
  select o.slug, o.subscription_tier, coalesce(o.subscription_status, 'trial'),
    (o.custom_domain is not null and lower(o.custom_domain) = lower(coalesce(p_host, ''))),
    o.custom_limits
  from public.organizations o
  where o.deleted_at is null
    and ((p_label is not null and lower(o.booking_subdomain) = lower(p_label))
      or (p_host is not null and lower(o.custom_domain) = lower(p_host)))
  limit 1
$$;
grant execute on function public.resolve_booking_host_v2(text, text) to anon, authenticated;

-- Delete a business for good. Only for one soft-deleted at least 30 days ago. Tables that point at it
-- with ON DELETE CASCADE go with it; tables whose link blocks the delete (no action / restrict) have
-- this business's rows deleted first, retried in passes because some of them point at each other.
-- People's sign-in accounts are never deleted here. Callable by the server (service role) only.
create or replace function public.admin_purge_organization(p_organization_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_deleted_at timestamptz; r record; pass integer; blocked integer;
begin
  select deleted_at into v_deleted_at from public.organizations where id = p_organization_id;
  if not found then raise exception 'Business not found'; end if;
  if v_deleted_at is null or v_deleted_at > now() - interval '30 days' then
    raise exception 'Only a business closed more than 30 days ago can be deleted permanently';
  end if;
  for pass in 1..10 loop
    blocked := 0;
    for r in
      select c.conrelid::regclass as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and c.confrelid = 'public.organizations'::regclass
        and c.conrelid <> 'public.organizations'::regclass
        and c.confdeltype in ('a', 'r') and array_length(c.conkey, 1) = 1
    loop
      begin
        execute format('delete from %s where %I = $1', r.tbl, r.col) using p_organization_id;
      exception when foreign_key_violation then blocked := blocked + 1;
      end;
    end loop;
    exit when blocked = 0;
  end loop;
  delete from public.organizations where id = p_organization_id;
end;
$$;
revoke all on function public.admin_purge_organization(uuid) from public, anon, authenticated;
grant execute on function public.admin_purge_organization(uuid) to service_role;

notify pgrst, 'reload schema';
