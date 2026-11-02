-- Assistant chats are kept (Rory, 2 Nov 2026): a reload no longer loses the conversation, and earlier chats can be
-- opened again. Read and written only through server actions (admin client, scoped to the member's business).
create table if not exists public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid,
  kind text not null default 'fleet',
  title text,
  shown jsonb not null default '[]'::jsonb,
  turns jsonb not null default '[]'::jsonb,
  draft jsonb not null default '[]'::jsonb,
  rentals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assistant_conversations_org_user on public.assistant_conversations (organization_id, user_id, updated_at desc);
alter table public.assistant_conversations enable row level security;
