-- Shared inbox: each business connects its own messaging accounts (LINE
-- Official Account, Telegram bot, ...) and customer chats land in one place.

create table if not exists public.messaging_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('line', 'telegram', 'whatsapp', 'messenger', 'instagram')),
  display_name text,
  external_id text,
  -- Random key in the webhook URL, so one business's webhook can't be guessed from another's.
  webhook_key uuid not null default gen_random_uuid() unique,
  status text not null default 'connected' check (status in ('connected', 'error', 'disconnected')),
  last_error text,
  connected_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, external_id)
);

-- Tokens live apart from the channel row and are never readable from the
-- browser: row level security is on with no policies, so only server code
-- using the service role can reach them.
create table if not exists public.messaging_channel_secrets (
  channel_id uuid primary key references public.messaging_channels(id) on delete cascade,
  access_token text not null,
  signing_secret text,
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel_id uuid not null references public.messaging_channels(id) on delete cascade,
  provider text not null,
  external_user_id text not null,
  display_name text,
  avatar_url text,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'closed')),
  unread_count integer not null default 0,
  last_message_at timestamptz,
  last_message_preview text,
  last_message_direction text,
  -- LINE lets a reply to a fresh message go out free; kept briefly for that.
  reply_token text,
  reply_token_at timestamptz,
  created_at timestamptz not null default now(),
  unique (channel_id, external_user_id)
);

create index if not exists conversations_org_recent on public.conversations (organization_id, last_message_at desc);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  message_type text not null default 'text',
  body text,
  external_id text,
  sent_by uuid,
  status text not null default 'sent' check (status in ('sent', 'failed', 'received')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists conversation_messages_thread on public.conversation_messages (conversation_id, created_at);
-- The same provider message delivered twice (webhook retries) is stored once.
create unique index if not exists conversation_messages_external on public.conversation_messages (conversation_id, external_id) where external_id is not null;

alter table public.messaging_channels enable row level security;
alter table public.messaging_channel_secrets enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

drop policy if exists "Members can view messaging channels" on public.messaging_channels;
create policy "Members can view messaging channels" on public.messaging_channels
  for select using (public.is_org_member(organization_id));

drop policy if exists "Members can view conversations" on public.conversations;
create policy "Members can view conversations" on public.conversations
  for select using (public.is_org_member(organization_id));

drop policy if exists "Members can view conversation messages" on public.conversation_messages;
create policy "Members can view conversation messages" on public.conversation_messages
  for select using (public.is_org_member(organization_id));

-- Writes go through server code (service role) after its own membership checks.
