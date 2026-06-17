-- LINE integration columns on organizations
alter table public.organizations
  add column if not exists line_oa_id text,
  add column if not exists line_channel_access_token text,
  add column if not exists line_notifications_enabled boolean default false,
  add column if not exists line_daily_summary_enabled boolean default true,
  add column if not exists line_daily_summary_time text default '08:00',
  add column if not exists line_user_id text;

-- LINE message log table
create table if not exists public.line_messages (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organizations(id),
  type text not null,
  recipient_line_id text,
  message_content jsonb not null,
  status text default 'pending' check (status in ('pending','sent','failed')),
  sent_at timestamptz,
  error text,
  rental_id uuid references public.rentals(id),
  vehicle_id uuid references public.vehicles(id),
  customer_id uuid references public.customers(id),
  created_at timestamptz default now()
);

-- RLS
alter table public.line_messages enable row level security;

create policy "Members can view line messages"
  on public.line_messages for select
  using (public.is_org_member(organisation_id));

create policy "Members can insert line messages"
  on public.line_messages for insert
  with check (public.is_org_member(organisation_id));

create policy "Members can update line messages"
  on public.line_messages for update
  using (public.is_org_member(organisation_id))
  with check (public.is_org_member(organisation_id));
