alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.organization_members enable row level security;
alter table public.vehicle_categories enable row level security;
alter table public.vehicle_types enable row level security;
alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.rentals enable row level security;
alter table public.rental_extensions enable row level security;
alter table public.rental_payments enable row level security;
alter table public.transactions enable row level security;
alter table public.maintenance_events enable row level security;
alter table public.compliance_events enable row level security;
alter table public.inspections enable row level security;
alter table public.contracts enable row level security;
alter table public.invoices enable row level security;
alter table public.documents enable row level security;
alter table public.reminders enable row level security;
alter table public.gps_devices enable row level security;
alter table public.vehicle_locations enable row level security;
alter table public.notifications enable row level security;
alter table public.message_templates enable row level security;
alter table public.notification_templates enable row level security;
alter table public.contract_templates enable row level security;
alter table public.activity_events enable row level security;
alter table public.tasks enable row level security;

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = org_id
      and member.user_id = auth.uid()
      and member.is_active = true
  );
$$;

create or replace function public.has_org_role(org_id uuid, allowed_roles public.organization_role[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = org_id
      and member.user_id = auth.uid()
      and member.is_active = true
      and member.role = any(allowed_roles)
  );
$$;

create policy "Users can view own profile" on public.users
  for select using (id = auth.uid());
create policy "Users can update own profile" on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "Members can view organizations" on public.organizations
  for select using (public.is_org_member(id));
create policy "Owners can update organizations" on public.organizations
  for update using (public.has_org_role(id, array['owner']::public.organization_role[]))
  with check (public.has_org_role(id, array['owner']::public.organization_role[]));

create policy "Members can view organization members" on public.organization_members
  for select using (public.is_org_member(organization_id));
create policy "Owners can manage organization members" on public.organization_members
  for all using (public.has_org_role(organization_id, array['owner']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner']::public.organization_role[]));

create policy "Members can view vehicle categories" on public.vehicle_categories
  for select using (organization_id is null or public.is_org_member(organization_id));
create policy "Managers can manage vehicle categories" on public.vehicle_categories
  for all using (organization_id is not null and public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]))
  with check (organization_id is not null and public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]));

create policy "Members can view vehicle types" on public.vehicle_types
  for select using (organization_id is null or public.is_org_member(organization_id));
create policy "Managers can manage vehicle types" on public.vehicle_types
  for all using (organization_id is not null and public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]))
  with check (organization_id is not null and public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]));

create policy "Members can view customers" on public.customers
  for select using (deleted_at is null and public.is_org_member(organization_id));
create policy "Managers can manage customers" on public.customers
  for all using (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]));

create policy "Members can view vehicles" on public.vehicles
  for select using (deleted_at is null and public.is_org_member(organization_id));
create policy "Managers can manage vehicles" on public.vehicles
  for all using (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]));

create policy "Members can view rentals" on public.rentals
  for select using (deleted_at is null and public.is_org_member(organization_id));
create policy "Managers can manage rentals" on public.rentals
  for all using (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]));

create policy "Members can view rental extensions" on public.rental_extensions
  for select using (public.is_org_member(organization_id));
create policy "Managers can create rental extensions" on public.rental_extensions
  for insert with check (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]));

create policy "Finance roles can view rental payments" on public.rental_payments
  for select using (deleted_at is null and public.has_org_role(organization_id, array['owner','manager','accountant']::public.organization_role[]));
create policy "Finance roles can manage rental payments" on public.rental_payments
  for all using (public.has_org_role(organization_id, array['owner','manager','accountant']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner','manager','accountant']::public.organization_role[]));

create policy "Finance roles can view transactions" on public.transactions
  for select using (deleted_at is null and public.has_org_role(organization_id, array['owner','manager','accountant']::public.organization_role[]));
create policy "Finance roles can manage transactions" on public.transactions
  for all using (public.has_org_role(organization_id, array['owner','manager','accountant']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner','manager','accountant']::public.organization_role[]));
create policy "Operators can submit transactions" on public.transactions
  for insert with check (public.has_org_role(organization_id, array['operator','driver']::public.organization_role[]));

create policy "Members can view maintenance events" on public.maintenance_events
  for select using (deleted_at is null and public.is_org_member(organization_id));
create policy "Managers can manage maintenance events" on public.maintenance_events
  for all using (public.has_org_role(organization_id, array['owner','manager','operator']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner','manager','operator']::public.organization_role[]));

create policy "Members can view compliance events" on public.compliance_events
  for select using (deleted_at is null and public.is_org_member(organization_id));
create policy "Managers can manage compliance events" on public.compliance_events
  for all using (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]));

create policy "Members can view inspections" on public.inspections
  for select using (deleted_at is null and public.is_org_member(organization_id));
create policy "Operators can manage inspections" on public.inspections
  for all using (public.has_org_role(organization_id, array['owner','manager','operator','driver']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner','manager','operator','driver']::public.organization_role[]));

create policy "Members can view contracts" on public.contracts
  for select using (deleted_at is null and public.is_org_member(organization_id));
create policy "Managers can manage contracts" on public.contracts
  for all using (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]));

create policy "Finance roles can view invoices" on public.invoices
  for select using (deleted_at is null and public.has_org_role(organization_id, array['owner','manager','accountant']::public.organization_role[]));
create policy "Finance roles can manage invoices" on public.invoices
  for all using (public.has_org_role(organization_id, array['owner','manager','accountant']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner','manager','accountant']::public.organization_role[]));

create policy "Members can view documents" on public.documents
  for select using (deleted_at is null and public.is_org_member(organization_id));
create policy "Members can upload documents" on public.documents
  for insert with check (public.is_org_member(organization_id));
create policy "Managers can manage documents" on public.documents
  for update using (public.has_org_role(organization_id, array['owner','manager','operator']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner','manager','operator']::public.organization_role[]));

create policy "Members can view reminders" on public.reminders
  for select using (deleted_at is null and public.is_org_member(organization_id));
create policy "Managers can manage reminders" on public.reminders
  for all using (public.has_org_role(organization_id, array['owner','manager','operator']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner','manager','operator']::public.organization_role[]));

create policy "Members can view gps devices" on public.gps_devices
  for select using (deleted_at is null and public.is_org_member(organization_id));
create policy "Managers can manage gps devices" on public.gps_devices
  for all using (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]));

create policy "Members can view vehicle locations" on public.vehicle_locations
  for select using (public.is_org_member(organization_id));
create policy "Managers can insert vehicle locations" on public.vehicle_locations
  for insert with check (public.has_org_role(organization_id, array['owner','manager','operator']::public.organization_role[]));

create policy "Members can view notifications" on public.notifications
  for select using (deleted_at is null and public.is_org_member(organization_id));
create policy "Managers can manage notifications" on public.notifications
  for all using (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]));

create policy "Members can view message templates" on public.message_templates
  for select using (organization_id is null or public.is_org_member(organization_id));
create policy "Managers can manage message templates" on public.message_templates
  for all using (organization_id is not null and public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]))
  with check (organization_id is not null and public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]));

create policy "Members can view notification templates" on public.notification_templates
  for select using (organization_id is null or public.is_org_member(organization_id));
create policy "Managers can manage notification templates" on public.notification_templates
  for all using (organization_id is not null and public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]))
  with check (organization_id is not null and public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]));

create policy "Members can view contract templates" on public.contract_templates
  for select using (organization_id is null or public.is_org_member(organization_id));
create policy "Managers can manage contract templates" on public.contract_templates
  for all using (organization_id is not null and public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]))
  with check (organization_id is not null and public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]));

create policy "Members can view activity events" on public.activity_events
  for select using (public.is_org_member(organization_id));
create policy "Members can insert activity events" on public.activity_events
  for insert with check (public.is_org_member(organization_id));

create policy "Members can view assigned tasks" on public.tasks
  for select using (
    deleted_at is null
    and public.is_org_member(organization_id)
    and (
      public.has_org_role(organization_id, array['owner','manager','operator']::public.organization_role[])
      or assigned_to = auth.uid()
    )
  );
create policy "Managers can manage tasks" on public.tasks
  for all using (public.has_org_role(organization_id, array['owner','manager','operator']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner','manager','operator']::public.organization_role[]));
create policy "Drivers can complete assigned tasks" on public.tasks
  for update using (assigned_to = auth.uid() and public.has_org_role(organization_id, array['driver']::public.organization_role[]))
  with check (assigned_to = auth.uid() and public.has_org_role(organization_id, array['driver']::public.organization_role[]));
