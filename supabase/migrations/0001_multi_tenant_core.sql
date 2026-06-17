create extension if not exists "pgcrypto";

create type public.organization_role as enum ('owner', 'manager', 'operator', 'accountant', 'driver');
create type public.vehicle_status as enum ('available', 'rented', 'maintenance', 'reserved', 'inactive', 'retired');
create type public.availability_status as enum ('available_now', 'reserved', 'rented', 'blocked', 'offline');
create type public.rental_status as enum ('draft', 'booked', 'active', 'due_soon', 'overdue', 'extended', 'completed', 'cancelled');
create type public.pricing_model as enum ('hourly', 'daily', 'weekly', 'monthly', 'subscription', 'custom');
create type public.payment_status as enum ('scheduled', 'pending', 'paid', 'failed', 'overdue', 'cancelled', 'refunded', 'reconciled');
create type public.transaction_type as enum ('rental_income', 'repair', 'servicing', 'maintenance', 'fuel', 'insurance', 'tax', 'finance', 'fine', 'accessories', 'refund', 'deposit', 'other');
create type public.document_owner_type as enum ('vehicle', 'customer', 'rental', 'transaction', 'inspection', 'contract', 'invoice', 'organization');
create type public.inspection_type as enum ('delivery', 'return', 'maintenance', 'incident', 'periodic');
create type public.reminder_type as enum ('payment', 'compliance', 'maintenance', 'rental', 'inspection', 'contract', 'gps');
create type public.reminder_severity as enum ('low', 'medium', 'high', 'critical');
create type public.activity_entity_type as enum ('vehicle', 'customer', 'rental', 'payment', 'transaction', 'document', 'maintenance', 'compliance', 'inspection', 'contract', 'invoice', 'reminder', 'notification', 'task', 'gps_device', 'organization');
create type public.notification_channel as enum ('whatsapp', 'line', 'messenger', 'email', 'sms', 'push', 'in_app');
create type public.notification_status as enum ('draft', 'queued', 'sent', 'delivered', 'failed', 'cancelled');
create type public.template_type as enum ('notification', 'contract', 'message', 'invoice', 'inspection_form', 'onboarding_form');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  country_code text not null default 'TH',
  timezone text not null default 'Asia/Bangkok',
  default_locale text not null default 'en',
  fallback_locale text not null default 'en',
  currency text not null default 'THB',
  supported_locales text[] not null default array['en','th'],
  supported_currencies text[] not null default array['THB'],
  settings jsonb not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  preferred_locale text not null default 'en',
  timezone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'operator',
  display_name text,
  invited_email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.vehicle_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  icon text,
  sort_order integer not null default 0,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.vehicle_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  category_id uuid not null references public.vehicle_categories(id) on delete cascade,
  code text not null,
  name text not null,
  default_spec_schema jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  display_code text,
  full_name text not null,
  date_of_birth date,
  email text,
  phone text,
  whatsapp text,
  nationality text,
  preferred_locale text not null default 'en',
  preferred_currency text,
  address text,
  hotel_name text,
  license_type text,
  passport_number text,
  passport_expiry date,
  driver_license_number text,
  driver_license_expiry date,
  document_status text not null default 'missing_documents',
  lifetime_value numeric(12,2) not null default 0,
  open_balance numeric(12,2) not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid not null references public.vehicle_categories(id) on delete restrict,
  type_id uuid references public.vehicle_types(id) on delete set null,
  display_code text,
  make text not null,
  model text not null,
  trim text,
  year integer,
  vin text,
  registration_number text not null,
  color text,
  purchase_price numeric(12,2),
  purchase_date date,
  estimated_value numeric(12,2),
  mileage integer not null default 0,
  status public.vehicle_status not null default 'available',
  availability_status public.availability_status not null default 'available_now',
  current_customer_id uuid references public.customers(id) on delete set null,
  current_rental_id uuid,
  daily_rate numeric(12,2) not null default 0,
  weekly_rate numeric(12,2) not null default 0,
  monthly_rate numeric(12,2) not null default 0,
  utilization_12_month numeric(5,2) not null default 0 check (utilization_12_month between 0 and 100),
  utilization_lifecycle numeric(5,2) not null default 0 check (utilization_lifecycle between 0 and 100),
  revenue_generated numeric(12,2) not null default 0,
  profit_generated numeric(12,2) not null default 0,
  health_score integer not null default 80 check (health_score between 0 and 100),
  specifications jsonb not null default '{}',
  metadata jsonb not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, registration_number)
);

create table public.rentals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  display_code text,
  customer_id uuid not null references public.customers(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  start_date date not null,
  end_date date,
  is_indefinite boolean not null default false,
  status public.rental_status not null default 'booked',
  pricing_model public.pricing_model not null default 'monthly',
  recurring_billing boolean not null default false,
  billing_interval text,
  rental_rate numeric(12,2) not null default 0,
  deposit_amount numeric(12,2) not null default 0,
  balance_due numeric(12,2) not null default 0,
  currency text not null default 'THB',
  delivery_location text,
  return_location text,
  contract_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.vehicles
  add constraint vehicles_current_rental_fk foreign key (current_rental_id) references public.rentals(id) on delete set null;

create table public.rental_extensions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rental_id uuid not null references public.rentals(id) on delete cascade,
  previous_end_date date,
  new_end_date date,
  rate_override numeric(12,2),
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.rental_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rental_id uuid not null references public.rentals(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  provider text,
  provider_payment_id text,
  payment_method text,
  scheduled_date date,
  due_date date not null,
  paid_at timestamptz,
  status public.payment_status not null default 'scheduled',
  amount numeric(12,2) not null,
  currency text not null default 'THB',
  attempt_count integer not null default 0,
  reconciliation_reference text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  display_code text,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  rental_id uuid references public.rentals(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  rental_payment_id uuid references public.rental_payments(id) on delete set null,
  type public.transaction_type not null,
  amount numeric(12,2) not null,
  currency text not null default 'THB',
  transaction_date date not null default current_date,
  supplier text,
  mileage integer,
  notes text,
  receipt_document_id uuid,
  metadata jsonb not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.maintenance_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  event_type text not null,
  service_date date not null,
  mileage integer,
  cost numeric(12,2),
  supplier text,
  notes text,
  next_due_date date,
  next_due_mileage integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.compliance_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  compliance_type text not null,
  effective_date date,
  expiry_date date not null,
  cost numeric(12,2),
  provider text,
  policy_number text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rental_id uuid references public.rentals(id) on delete set null,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  inspection_type public.inspection_type not null,
  inspected_at timestamptz not null default now(),
  mileage integer,
  fuel_level text,
  damage_markers jsonb not null default '[]',
  notes text,
  photo_document_ids uuid[] not null default '{}',
  video_document_ids uuid[] not null default '{}',
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rental_id uuid not null references public.rentals(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  locale text not null default 'en',
  status text not null default 'draft',
  template_id uuid,
  document_id uuid,
  signed_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rental_id uuid references public.rentals(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  invoice_number text not null,
  locale text not null default 'en',
  currency text not null default 'THB',
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  balance_due numeric(12,2) not null default 0,
  due_date date,
  status text not null default 'draft',
  document_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, invoice_number)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_type public.document_owner_type not null,
  owner_id uuid,
  storage_bucket text not null default 'documents',
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  category text not null,
  locale text,
  ocr_status text not null default 'not_started',
  ocr_provider text,
  extracted_data jsonb not null default '{}',
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (storage_bucket, storage_path)
);

alter table public.transactions
  add constraint transactions_receipt_document_fk foreign key (receipt_document_id) references public.documents(id) on delete set null;
alter table public.contracts
  add constraint contracts_document_fk foreign key (document_id) references public.documents(id) on delete set null;
alter table public.invoices
  add constraint invoices_document_fk foreign key (document_id) references public.documents(id) on delete set null;

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  rental_id uuid references public.rentals(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  type public.reminder_type not null,
  severity public.reminder_severity not null default 'medium',
  title_key text,
  title text not null,
  due_date date not null,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.gps_devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  provider text not null,
  external_device_id text not null,
  imei text,
  phone_number text,
  status text not null default 'active',
  last_seen_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, provider, external_device_id)
);

create table public.vehicle_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  gps_device_id uuid references public.gps_devices(id) on delete set null,
  latitude numeric(10,7) not null,
  longitude numeric(10,7) not null,
  speed_kph numeric(8,2),
  heading numeric(8,2),
  odometer integer,
  recorded_at timestamptz not null,
  raw_payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  rental_id uuid references public.rentals(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  channel public.notification_channel not null,
  provider text,
  locale text not null default 'en',
  template_id uuid,
  status public.notification_status not null default 'draft',
  recipient text not null,
  subject text,
  body text not null,
  sent_at timestamptz,
  delivered_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  template_type public.template_type not null,
  template_key text not null,
  locale text not null,
  version integer not null default 1,
  title text,
  subject text,
  body text not null,
  variables jsonb not null default '[]',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, template_type, template_key, locale, version)
);

create table public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  channel public.notification_channel not null,
  template_key text not null,
  locale text not null,
  version integer not null default 1,
  subject text,
  body text not null,
  variables jsonb not null default '[]',
  provider_template_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, channel, template_key, locale, version)
);

create table public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  template_key text not null,
  locale text not null,
  version integer not null default 1,
  title text not null,
  body text not null,
  variables jsonb not null default '[]',
  jurisdiction text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, template_key, locale, version)
);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type public.activity_entity_type not null,
  entity_id uuid not null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  rental_id uuid references public.rentals(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  event_type text not null,
  title_key text,
  title text not null,
  detail text,
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  rental_id uuid references public.rentals(id) on delete set null,
  title text not null,
  title_key text,
  task_type text not null,
  due_at timestamptz,
  completed_at timestamptz,
  completion_notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index customers_org_idx on public.customers(organization_id) where deleted_at is null;
create index vehicles_org_status_idx on public.vehicles(organization_id, status, availability_status) where deleted_at is null;
create index vehicles_org_category_idx on public.vehicles(organization_id, category_id) where deleted_at is null;
create index rentals_org_dates_idx on public.rentals(organization_id, start_date, end_date) where deleted_at is null;
create index rental_payments_due_idx on public.rental_payments(organization_id, due_date, status) where deleted_at is null;
create index transactions_org_date_idx on public.transactions(organization_id, transaction_date desc) where deleted_at is null;
create index maintenance_vehicle_idx on public.maintenance_events(organization_id, vehicle_id, service_date desc) where deleted_at is null;
create index compliance_vehicle_expiry_idx on public.compliance_events(organization_id, vehicle_id, expiry_date) where deleted_at is null;
create index inspections_vehicle_idx on public.inspections(organization_id, vehicle_id, inspected_at desc) where deleted_at is null;
create index documents_org_owner_idx on public.documents(organization_id, owner_type, owner_id) where deleted_at is null;
create index reminders_org_due_idx on public.reminders(organization_id, due_date) where deleted_at is null;
create index gps_devices_vehicle_idx on public.gps_devices(organization_id, vehicle_id) where deleted_at is null;
create index vehicle_locations_vehicle_time_idx on public.vehicle_locations(organization_id, vehicle_id, recorded_at desc);
create index notifications_org_status_idx on public.notifications(organization_id, status, created_at desc) where deleted_at is null;
create index message_templates_lookup_idx on public.message_templates(organization_id, template_type, template_key, locale, is_active);
create index notification_templates_lookup_idx on public.notification_templates(organization_id, channel, template_key, locale, is_active);
create index contract_templates_lookup_idx on public.contract_templates(organization_id, template_key, locale, is_active);
create index activity_org_entity_idx on public.activity_events(organization_id, entity_type, entity_id, occurred_at desc);
create index activity_vehicle_idx on public.activity_events(organization_id, vehicle_id, occurred_at desc);
create index tasks_org_assignee_idx on public.tasks(organization_id, assigned_to, due_at) where deleted_at is null;

create trigger organizations_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger users_updated_at before update on public.users for each row execute function public.set_updated_at();
create trigger organization_members_updated_at before update on public.organization_members for each row execute function public.set_updated_at();
create trigger vehicle_categories_updated_at before update on public.vehicle_categories for each row execute function public.set_updated_at();
create trigger vehicle_types_updated_at before update on public.vehicle_types for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger vehicles_updated_at before update on public.vehicles for each row execute function public.set_updated_at();
create trigger rentals_updated_at before update on public.rentals for each row execute function public.set_updated_at();
create trigger rental_payments_updated_at before update on public.rental_payments for each row execute function public.set_updated_at();
create trigger transactions_updated_at before update on public.transactions for each row execute function public.set_updated_at();
create trigger maintenance_events_updated_at before update on public.maintenance_events for each row execute function public.set_updated_at();
create trigger compliance_events_updated_at before update on public.compliance_events for each row execute function public.set_updated_at();
create trigger inspections_updated_at before update on public.inspections for each row execute function public.set_updated_at();
create trigger contracts_updated_at before update on public.contracts for each row execute function public.set_updated_at();
create trigger invoices_updated_at before update on public.invoices for each row execute function public.set_updated_at();
create trigger documents_updated_at before update on public.documents for each row execute function public.set_updated_at();
create trigger reminders_updated_at before update on public.reminders for each row execute function public.set_updated_at();
create trigger gps_devices_updated_at before update on public.gps_devices for each row execute function public.set_updated_at();
create trigger notifications_updated_at before update on public.notifications for each row execute function public.set_updated_at();
create trigger message_templates_updated_at before update on public.message_templates for each row execute function public.set_updated_at();
create trigger notification_templates_updated_at before update on public.notification_templates for each row execute function public.set_updated_at();
create trigger contract_templates_updated_at before update on public.contract_templates for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();
