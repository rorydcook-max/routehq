-- 0109: messages sent from the website's contact form (/contact).
-- Inserted server-side with the service role (app/actions/contact.ts), so there is no insert policy.
-- Platform admins read them and mark them handled in the admin console (/platform/messages).
-- ip_hash is sha256(first x-forwarded-for IP + a server salt): enough to rate-limit, never the raw address.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text,
  business text,
  fleet text,
  topic text,
  message text not null,
  locale text,
  ip_hash text,
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null
);

create index if not exists contact_messages_created_at_idx on public.contact_messages (created_at desc);
create index if not exists contact_messages_ip_hash_created_at_idx on public.contact_messages (ip_hash, created_at);

alter table public.contact_messages enable row level security;

-- One policy: platform admins read and update (mark handled). Everyone else sees nothing.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'contact_messages' and policyname = 'contact_messages_platform_admin'
  ) then
    create policy contact_messages_platform_admin on public.contact_messages
      for all to authenticated
      using (public.is_platform_admin())
      with check (public.is_platform_admin());
  end if;
end
$$;
