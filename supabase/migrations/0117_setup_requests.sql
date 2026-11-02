-- "We'll set it up for you" (2 Nov 2026): a business sends its records (notebook photos, spreadsheets, chat exports, a note);
-- RoveHQ support brings them in with the importer (the AI reads them, a person checks) and marks the request done.
create table if not exists public.setup_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid,
  note text,
  files jsonb not null default '[]'::jsonb,
  status text not null default 'new' check (status in ('new', 'in_progress', 'done')),
  handled_by uuid,
  handled_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now()
);
create index if not exists setup_requests_status_idx on public.setup_requests (status, created_at desc);
-- No policies: written and read through the server (service role) only.
alter table public.setup_requests enable row level security;
comment on table public.setup_requests is 'A business asking RoveHQ to set up its records from files it sent (photos, spreadsheets, notes). Written and read through the server only.';
