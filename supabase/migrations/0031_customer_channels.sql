alter table public.customers
  add column if not exists whatsapp_number text,
  add column if not exists messenger_id text,
  add column if not exists line_id text,
  add column if not exists telegram_username text,
  add column if not exists instagram_handle text,
  add column if not exists preferred_contact_method text
    check (preferred_contact_method in ('whatsapp','messenger','line','telegram','sms','email','phone'));

create table if not exists public.communication_log (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organizations(id),
  rental_id uuid references public.rentals(id),
  customer_id uuid references public.customers(id),
  type text not null check (type in ('automated_reminder','manual_note','customer_portal_action','booking_link_activity','operator_message','system_event')),
  channel text,
  direction text check (direction in ('outbound','inbound','internal')),
  content text,
  status text default 'sent' check (status in ('pending','sent','failed','read')),
  metadata jsonb default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.customer_portal_actions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organizations(id),
  rental_id uuid not null references public.rentals(id),
  customer_id uuid references public.customers(id),
  booking_link_token text,
  action_type text not null check (action_type in ('extension_request','return_confirmation','problem_report','question','info_request')),
  content jsonb not null,
  status text default 'pending' check (status in ('pending','acknowledged','resolved')),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz default now()
);

alter table public.organizations
  add column if not exists reminder_settings jsonb default '{}';

alter table public.communication_log enable row level security;
alter table public.customer_portal_actions enable row level security;

create policy "Members can view communication log" on public.communication_log
  for select using (public.is_org_member(organisation_id));
create policy "Members can insert communication log" on public.communication_log
  for insert with check (public.is_org_member(organisation_id));
create policy "Managers can update communication log" on public.communication_log
  for update using (public.has_org_role(organisation_id, array['owner','manager','operator']::public.organization_role[]))
  with check (public.has_org_role(organisation_id, array['owner','manager','operator']::public.organization_role[]));

create policy "Members can view customer portal actions" on public.customer_portal_actions
  for select using (public.is_org_member(organisation_id));
create policy "Members can insert customer portal actions" on public.customer_portal_actions
  for insert with check (public.is_org_member(organisation_id));
create policy "Managers can update customer portal actions" on public.customer_portal_actions
  for update using (public.has_org_role(organisation_id, array['owner','manager','operator']::public.organization_role[]))
  with check (public.has_org_role(organisation_id, array['owner','manager','operator']::public.organization_role[]));
