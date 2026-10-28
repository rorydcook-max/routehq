-- 0110: people who asked for a free resource (a lead magnet) on the website (/resources/<slug>).
-- Inserted server-side with the service role (app/actions/leads.ts), so there is no insert policy.
-- Platform admins read them and export them in the admin console (/platform/leads).
-- ip_hash is sha256(first x-forwarded-for IP + a server salt): enough to rate-limit, never the raw address.
-- consent: the visitor ticked "Send me occasional tips" (unticked by default). Without it, only the requested
-- download may be sent.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  name text,
  business text,
  country text,
  fleet text,
  resource text not null,
  locale text,
  consent boolean not null default false,
  ip_hash text,
  source_path text
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_email_idx on public.leads (email);
create index if not exists leads_ip_hash_created_at_idx on public.leads (ip_hash, created_at);

alter table public.leads enable row level security;

-- One policy: platform admins read (and may correct) leads. Everyone else sees nothing.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'leads' and policyname = 'leads_platform_admin'
  ) then
    create policy leads_platform_admin on public.leads
      for all to authenticated
      using (public.is_platform_admin())
      with check (public.is_platform_admin());
  end if;
end
$$;
