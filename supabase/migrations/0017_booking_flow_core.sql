create table if not exists public.booking_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rental_id uuid references public.rentals(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  contract_id uuid references public.contracts(id) on delete set null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'viewed', 'details_submitted', 'documents_uploaded', 'contract_signed', 'completed', 'expired', 'cancelled')),
  data_type text not null default 'rental_booking',
  booking_data jsonb not null default '{}',
  included_items jsonb not null default '[]',
  special_conditions text,
  share_channels jsonb not null default '[]',
  public_url text,
  expires_at timestamptz,
  sent_at timestamptz,
  viewed_at timestamptz,
  customer_details_submitted_at timestamptz,
  documents_uploaded_at timestamptz,
  contract_signed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'booking_links'
      and column_name = 'organisation_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'booking_links'
      and column_name = 'organization_id'
  ) then
    alter table public.booking_links rename column organisation_id to organization_id;
  end if;
end $$;

alter table public.booking_links
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists rental_id uuid references public.rentals(id) on delete cascade,
  add column if not exists vehicle_id uuid references public.vehicles(id) on delete set null,
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists contract_id uuid references public.contracts(id) on delete set null,
  add column if not exists token text,
  add column if not exists status text not null default 'pending',
  add column if not exists data_type text not null default 'rental_booking',
  add column if not exists booking_data jsonb not null default '{}',
  add column if not exists included_items jsonb not null default '[]',
  add column if not exists special_conditions text,
  add column if not exists share_channels jsonb not null default '[]',
  add column if not exists public_url text,
  add column if not exists expires_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists viewed_at timestamptz,
  add column if not exists customer_details_submitted_at timestamptz,
  add column if not exists documents_uploaded_at timestamptz,
  add column if not exists contract_signed_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists deleted_at timestamptz;

update public.booking_links
set token = encode(gen_random_bytes(24), 'hex')
where token is null;

alter table public.booking_links
  alter column token set not null,
  alter column organization_id set not null;

alter table public.contracts
  alter column rental_id drop not null,
  alter column customer_id drop not null,
  add column if not exists booking_link_id uuid references public.booking_links(id) on delete set null,
  add column if not exists content_html text,
  add column if not exists content_pdf_url text,
  add column if not exists customer_signature text,
  add column if not exists customer_signed_at timestamptz,
  add column if not exists customer_signed_name text,
  add column if not exists customer_signed_ip text,
  add column if not exists owner_signature text,
  add column if not exists owner_signed_at timestamptz;

alter table public.contract_templates
  add column if not exists name text,
  add column if not exists content_html text,
  add column if not exists is_default boolean not null default false,
  add column if not exists language text;

update public.contract_templates
set
  name = coalesce(name, title, template_key),
  content_html = coalesce(content_html, body),
  language = coalesce(language, locale, 'en')
where name is null or content_html is null or language is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'booking_links_status_check'
  ) then
    alter table public.booking_links
      add constraint booking_links_status_check check (status in ('pending', 'sent', 'viewed', 'details_submitted', 'documents_uploaded', 'contract_signed', 'completed', 'expired', 'cancelled'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'booking_links_token_unique'
  ) then
    alter table public.booking_links
      add constraint booking_links_token_unique unique (token);
  end if;
end $$;

create index if not exists booking_links_org_status_idx
  on public.booking_links(organization_id, status, created_at desc)
  where deleted_at is null;

create index if not exists booking_links_rental_idx
  on public.booking_links(organization_id, rental_id)
  where deleted_at is null;

create index if not exists booking_links_token_idx
  on public.booking_links(token)
  where deleted_at is null;

create index if not exists contracts_booking_link_idx
  on public.contracts(organization_id, booking_link_id)
  where deleted_at is null;

drop trigger if exists booking_links_updated_at on public.booking_links;
create trigger booking_links_updated_at
  before update on public.booking_links
  for each row execute function public.set_updated_at();

alter table public.booking_links enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_templates enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'booking_links'
      and policyname = 'Public can read booking links by token'
  ) then
    create policy "Public can read booking links by token"
      on public.booking_links for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'booking_links'
      and policyname = 'Managers can manage booking links'
  ) then
    create policy "Managers can manage booking links"
      on public.booking_links for all
      using (public.has_org_role(organization_id, array['owner','manager','operator']::public.organization_role[]))
      with check (public.has_org_role(organization_id, array['owner','manager','operator']::public.organization_role[]));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'contracts'
      and policyname = 'Members can view contracts'
  ) then
    create policy "Members can view contracts" on public.contracts
      for select using (deleted_at is null and public.is_org_member(organization_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'contracts'
      and policyname = 'Managers can manage contracts'
  ) then
    create policy "Managers can manage contracts" on public.contracts
      for all using (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]))
      with check (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'contract_templates'
      and policyname = 'Members can view contract templates'
  ) then
    create policy "Members can view contract templates" on public.contract_templates
      for select using (organization_id is null or public.is_org_member(organization_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'contract_templates'
      and policyname = 'Managers can manage contract templates'
  ) then
    create policy "Managers can manage contract templates" on public.contract_templates
      for all using (organization_id is not null and public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]))
      with check (organization_id is not null and public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]));
  end if;
end $$;
