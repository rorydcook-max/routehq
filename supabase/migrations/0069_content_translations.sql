-- 0069: cached translations of text people type.
--
-- A driver may write damage notes in Burmese that the owner reads in
-- English. The original text is always what is stored and signed; this table
-- only caches reading-aid translations of it, so each piece of text is
-- translated once per business per reader language.
--
-- Rows are keyed by a SHA-256 of the original text, not the text itself, so
-- nothing typed is duplicated here. They are scoped to the organisation so one
-- business can never look up another's translations. Members can read their
-- own business's rows; only the server (service role) writes them.

create table if not exists public.content_translations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  source_language text,
  target_language text not null,
  translated_text text not null,
  model text,
  created_at timestamptz not null default now(),
  unique (organization_id, source_hash, target_language)
);

alter table public.content_translations enable row level security;

drop policy if exists "Members can read their business translations" on public.content_translations;
create policy "Members can read their business translations"
  on public.content_translations for select
  using (public.is_org_member(organization_id));
