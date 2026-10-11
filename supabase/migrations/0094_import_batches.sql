-- Importer rebuild (11 Oct 2026): every import is a batch. The batch keeps the
-- parsed sheets and the preview the owner saw, so nothing is written until
-- they say so, and the whole import can be undone for 30 days.
create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  source_name text not null default '',
  status text not null default 'previewing' check (status in ('previewing', 'imported', 'undone')),
  sheets jsonb not null default '[]'::jsonb,
  mappings jsonb not null default '[]'::jsonb,
  preview jsonb not null default '{}'::jsonb,
  counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  imported_at timestamptz,
  undone_at timestamptz
);

create index if not exists import_batches_org_idx on public.import_batches (organization_id, created_at desc);

alter table public.import_batches enable row level security;

create policy import_batches_member_select on public.import_batches
  for select using (public.is_org_member(organization_id));
create policy import_batches_member_insert on public.import_batches
  for insert with check (public.is_org_member(organization_id));
create policy import_batches_member_update on public.import_batches
  for update using (public.is_org_member(organization_id));

-- Rows an import created, so an undo knows what to take back.
alter table public.vehicles add column if not exists import_batch_id uuid references public.import_batches (id) on delete set null;
alter table public.customers add column if not exists import_batch_id uuid references public.import_batches (id) on delete set null;
alter table public.rentals add column if not exists import_batch_id uuid references public.import_batches (id) on delete set null;
alter table public.rental_payments add column if not exists import_batch_id uuid references public.import_batches (id) on delete set null;
alter table public.transactions add column if not exists import_batch_id uuid references public.import_batches (id) on delete set null;
alter table public.tasks add column if not exists import_batch_id uuid references public.import_batches (id) on delete set null;

create index if not exists vehicles_import_batch_idx on public.vehicles (import_batch_id) where import_batch_id is not null;
create index if not exists customers_import_batch_idx on public.customers (import_batch_id) where import_batch_id is not null;
create index if not exists rentals_import_batch_idx on public.rentals (import_batch_id) where import_batch_id is not null;
create index if not exists rental_payments_import_batch_idx on public.rental_payments (import_batch_id) where import_batch_id is not null;
create index if not exists transactions_import_batch_idx on public.transactions (import_batch_id) where import_batch_id is not null;
create index if not exists tasks_import_batch_idx on public.tasks (import_batch_id) where import_batch_id is not null;
