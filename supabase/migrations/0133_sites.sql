-- Website builder, phase 1 (Rory, 7 Nov 2026): each business's booking page becomes a one-page website with a
-- template, palette, fonts, images, editable text and sections. The look lives in its own table rather than in
-- organizations.settings because it has a draft and a published copy: the owner edits the draft (saved as they go)
-- and Publish copies it to what renters see. Keeping it out of the settings blob means a settings save elsewhere can
-- never overwrite a half-finished draft, and the public page reads one small row.
-- A business with no row keeps working: the page draws the default template from its settings (lib/sites/config.ts).
-- Additive only; safe to run twice.

create table if not exists public.booking_sites (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  -- What the owner is editing (lib/sites/config.ts, SiteConfig). Saved as they go.
  draft jsonb not null default '{}'::jsonb,
  -- What renters see. null until the first Publish (the page then uses the default template).
  published jsonb,
  published_at timestamptz,
  draft_updated_at timestamptz not null default now(),
  updated_by uuid,
  created_at timestamptz not null default now()
);

comment on table public.booking_sites is 'Each business''s booking website: the draft being edited and the published copy renters see.';

alter table public.booking_sites enable row level security;

drop policy if exists "Members can view their booking site" on public.booking_sites;
create policy "Members can view their booking site" on public.booking_sites
  for select using (public.is_org_member(organization_id));
-- Writes go through server code (service role) after its own owner check; the public page reads with the service role.

-- The website's contact form: each message lands in the business's Inbox as a "Website" conversation. This log keeps
-- only a salted hash of the sender's address, to turn away floods (a few messages an hour per address).
create table if not exists public.booking_site_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists booking_site_messages_ip on public.booking_site_messages (ip_hash, created_at desc);
create index if not exists booking_site_messages_org on public.booking_site_messages (organization_id, created_at desc);

alter table public.booking_site_messages enable row level security;

drop policy if exists "Members can view website messages" on public.booking_site_messages;
create policy "Members can view website messages" on public.booking_site_messages
  for select using (public.is_org_member(organization_id));

-- "website" joins the Inbox's channel kinds: one per business, made the first time someone writes from its site.
-- It has no platform token; replies go back by email when the sender left one (app/actions/inbox.ts).
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'messaging_channels_provider_check'
      and pg_get_constraintdef(oid) not like '%website%'
  ) then
    alter table public.messaging_channels drop constraint messaging_channels_provider_check;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'messaging_channels_provider_check') then
    alter table public.messaging_channels
      add constraint messaging_channels_provider_check
      check (provider in ('line', 'telegram', 'whatsapp', 'messenger', 'instagram', 'website'));
  end if;
end $$;
