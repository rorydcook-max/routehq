-- Phase 1: additive rental document pack schema.
-- This migration intentionally does not modify legacy contract generation,
-- public booking-link behaviour, or existing contract rows.

-- ---------------------------------------------------------------------------
-- Branding storage bucket used by current settings/logo/signature code.
-- Existing code uploads organization-scoped files to storage.from('branding'),
-- but earlier migrations only create the documents bucket.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'branding',
  'branding',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Organization members can read branding files'
  ) then
    create policy "Organization members can read branding files" on storage.objects
      for select using (
        bucket_id = 'branding'
        and public.is_org_member((storage.foldername(name))[1]::uuid)
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Organization members can upload branding files'
  ) then
    create policy "Organization members can upload branding files" on storage.objects
      for insert with check (
        bucket_id = 'branding'
        and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','manager']::public.organization_role[])
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Managers can update branding files'
  ) then
    create policy "Managers can update branding files" on storage.objects
      for update using (
        bucket_id = 'branding'
        and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','manager']::public.organization_role[])
      )
      with check (
        bucket_id = 'branding'
        and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','manager']::public.organization_role[])
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Organization contract/business settings. Existing logo_url and
-- owner_signature_url are preserved as legacy fields.
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column if not exists trading_name text,
  add column if not exists legal_name text,
  add column if not exists registration_or_tax_number text,
  add column if not exists business_address text,
  add column if not exists business_phone text,
  add column if not exists business_email text,
  add column if not exists whatsapp text,
  add column if not exists line_id text,
  add column if not exists contract_accent_colour text,
  add column if not exists authorised_signatory_name text,
  add column if not exists authorised_signatory_title text,
  add column if not exists authorised_signature_storage_bucket text,
  add column if not exists authorised_signature_storage_path text,
  add column if not exists signature_authorised_at timestamptz,
  add column if not exists signature_authorisation_text_version text,
  add column if not exists default_contract_locale text,
  add column if not exists default_contract_template_id uuid references public.contract_templates(id) on delete set null,
  add column if not exists contract_footer_text text,
  add column if not exists powered_by_routehq_enabled boolean not null default true;

-- ---------------------------------------------------------------------------
-- Rental pricing/contract fields. Money follows the existing numeric(12,2)
-- convention used by rentals, transactions, and payments.
-- ---------------------------------------------------------------------------

alter table public.rentals
  add column if not exists contracted_rate numeric(12,2),
  add column if not exists billing_period text,
  add column if not exists standard_daily_rate numeric(12,2),
  add column if not exists early_termination_minimum_days integer default 3,
  add column if not exists delivery_fee numeric(12,2),
  add column if not exists collection_fee numeric(12,2),
  add column if not exists cancellation_admin_fee numeric(12,2),
  add column if not exists insurance_excess numeric(12,2),
  add column if not exists mileage_allowance integer,
  add column if not exists excess_mileage_rate numeric(12,2);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rentals_early_termination_minimum_days_check'
  ) then
    alter table public.rentals
      add constraint rentals_early_termination_minimum_days_check
      check (early_termination_minimum_days is null or early_termination_minimum_days >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'rentals_standard_daily_rate_nonnegative'
  ) then
    alter table public.rentals
      add constraint rentals_standard_daily_rate_nonnegative
      check (standard_daily_rate is null or standard_daily_rate >= 0);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Versioned rental documents.
-- ---------------------------------------------------------------------------

create table if not exists public.rental_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  rental_id uuid not null references public.rentals(id) on delete restrict,
  legacy_contract_id uuid references public.contracts(id) on delete set null,
  document_type text not null,
  status text not null default 'draft',
  current_version_id uuid,
  source_event_type text,
  source_event_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finalised_at timestamptz,
  constraint rental_documents_document_type_check check (
    document_type in (
      'rental_agreement',
      'agreement_amendment',
      'delivery_report',
      'return_report',
      'vehicle_substitution',
      'extension_amendment',
      'early_termination_statement',
      'incident_report',
      'deposit_reconciliation',
      'final_rental_pack'
    )
  ),
  constraint rental_documents_status_check check (
    status in ('draft', 'generated', 'partially_signed', 'signed', 'finalised', 'voided', 'superseded')
  )
);

create table if not exists public.rental_document_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  document_id uuid not null references public.rental_documents(id) on delete restrict,
  version_number integer not null,
  template_id uuid references public.contract_templates(id) on delete set null,
  template_version integer,
  rendered_html_snapshot text not null,
  rendered_data_snapshot jsonb not null default '{}',
  business_snapshot jsonb not null default '{}',
  pdf_storage_bucket text,
  pdf_storage_path text,
  content_hash text not null,
  status text not null default 'draft',
  generated_at timestamptz not null default now(),
  finalised_at timestamptz,
  supersedes_version_id uuid references public.rental_document_versions(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint rental_document_versions_number_positive check (version_number > 0),
  constraint rental_document_versions_status_check check (
    status in ('draft', 'rendered', 'finalised', 'signed', 'superseded', 'voided')
  ),
  constraint rental_document_versions_unique_number unique (document_id, version_number)
);

alter table public.rental_documents
  add constraint rental_documents_current_version_fk
  foreign key (current_version_id)
  references public.rental_document_versions(id)
  on delete set null;

create table if not exists public.rental_document_signatures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  document_version_id uuid not null references public.rental_document_versions(id) on delete restrict,
  signer_role text not null,
  signer_name text not null,
  signer_user_id uuid references auth.users(id) on delete set null,
  signature_storage_bucket text,
  signature_storage_path text,
  signature_data_url text,
  signed_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  verification_method text,
  consent_text_version text,
  content_hash_at_signing text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint rental_document_signatures_role_check check (
    signer_role in (
      'authorised_business_signatory',
      'operator',
      'renter',
      'additional_driver',
      'witness'
    )
  )
);

create table if not exists public.rental_amendments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  rental_id uuid not null references public.rentals(id) on delete restrict,
  document_id uuid references public.rental_documents(id) on delete set null,
  amendment_type text not null,
  original_values jsonb not null default '{}',
  amended_values jsonb not null default '{}',
  reason text,
  effective_at timestamptz,
  approval_status text not null default 'pending',
  customer_signature_required boolean not null default true,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rental_amendments_approval_status_check check (
    approval_status in ('pending', 'approved', 'rejected', 'cancelled', 'superseded')
  )
);

create table if not exists public.deposit_reconciliations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  rental_id uuid not null references public.rentals(id) on delete restrict,
  document_id uuid references public.rental_documents(id) on delete set null,
  deposit_amount_held numeric(12,2) not null default 0,
  deductions jsonb not null default '[]',
  amount_refunded numeric(12,2) not null default 0,
  amount_retained numeric(12,2) not null default 0,
  pending_assessment_amount numeric(12,2) not null default 0,
  retention_reason text,
  status text not null default 'held',
  supporting_document_ids jsonb not null default '[]',
  finalised_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deposit_reconciliations_status_check check (
    status in (
      'held',
      'partially_refunded',
      'fully_refunded',
      'retained_pending_assessment',
      'reconciled'
    )
  ),
  constraint deposit_reconciliations_amounts_nonnegative check (
    deposit_amount_held >= 0
    and amount_refunded >= 0
    and amount_retained >= 0
    and pending_assessment_amount >= 0
  )
);

create table if not exists public.inspection_media_manifest (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  inspection_id uuid not null references public.inspections(id) on delete restrict,
  document_id uuid references public.documents(id) on delete set null,
  media_type text not null,
  storage_bucket text not null default 'documents',
  storage_path text not null,
  thumbnail_storage_path text,
  captured_at timestamptz,
  uploaded_by uuid references auth.users(id) on delete set null,
  file_size_bytes bigint,
  duration_seconds numeric(12,3),
  checksum text,
  customer_visible boolean not null default true,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint inspection_media_manifest_media_type_check check (
    media_type in ('photo', 'video', 'odometer_photo', 'fuel_photo', 'damage_photo', 'walkaround_video', 'other')
  ),
  constraint inspection_media_manifest_size_check check (file_size_bytes is null or file_size_bytes >= 0),
  constraint inspection_media_manifest_duration_check check (duration_seconds is null or duration_seconds >= 0)
);

-- ---------------------------------------------------------------------------
-- Relationship validation keeps organization_id aligned across new legal/audit
-- tables without changing existing legacy tables.
-- ---------------------------------------------------------------------------

create or replace function public.validate_rental_document_relationships()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.rentals
    where id = new.rental_id
      and organization_id = new.organization_id
  ) then
    raise exception 'Rental document organization mismatch.';
  end if;

  if new.legacy_contract_id is not null and not exists (
    select 1 from public.contracts
    where id = new.legacy_contract_id
      and organization_id = new.organization_id
  ) then
    raise exception 'Legacy contract organization mismatch.';
  end if;

  if new.current_version_id is not null and not exists (
    select 1 from public.rental_document_versions
    where id = new.current_version_id
      and document_id = new.id
      and organization_id = new.organization_id
  ) then
    raise exception 'Current version organization mismatch.';
  end if;

  return new;
end;
$$;

create or replace function public.validate_rental_document_version_relationships()
returns trigger
language plpgsql
as $$
declare
  parent_document_id uuid;
begin
  select id into parent_document_id
  from public.rental_documents
  where id = new.document_id
    and organization_id = new.organization_id;

  if parent_document_id is null then
    raise exception 'Document version organization mismatch.';
  end if;

  if new.template_id is not null and not exists (
    select 1 from public.contract_templates
    where id = new.template_id
      and (organization_id is null or organization_id = new.organization_id)
  ) then
    raise exception 'Template organization mismatch.';
  end if;

  if new.supersedes_version_id is not null and not exists (
    select 1 from public.rental_document_versions
    where id = new.supersedes_version_id
      and organization_id = new.organization_id
      and document_id = new.document_id
  ) then
    raise exception 'Superseded version organization mismatch.';
  end if;

  return new;
end;
$$;

create or replace function public.validate_rental_document_signature_relationships()
returns trigger
language plpgsql
as $$
declare
  expected_hash text;
begin
  select content_hash into expected_hash
  from public.rental_document_versions
  where id = new.document_version_id
    and organization_id = new.organization_id;

  if expected_hash is null then
    raise exception 'Document signature organization mismatch.';
  end if;

  if new.content_hash_at_signing <> expected_hash then
    raise exception 'Signature content hash does not match document version.';
  end if;

  return new;
end;
$$;

create or replace function public.validate_rental_amendment_relationships()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.rentals
    where id = new.rental_id
      and organization_id = new.organization_id
  ) then
    raise exception 'Rental amendment organization mismatch.';
  end if;

  if new.document_id is not null and not exists (
    select 1 from public.rental_documents
    where id = new.document_id
      and organization_id = new.organization_id
  ) then
    raise exception 'Rental amendment document organization mismatch.';
  end if;

  return new;
end;
$$;

create or replace function public.validate_deposit_reconciliation_relationships()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.rentals
    where id = new.rental_id
      and organization_id = new.organization_id
  ) then
    raise exception 'Deposit reconciliation organization mismatch.';
  end if;

  if new.document_id is not null and not exists (
    select 1 from public.rental_documents
    where id = new.document_id
      and organization_id = new.organization_id
  ) then
    raise exception 'Deposit reconciliation document organization mismatch.';
  end if;

  return new;
end;
$$;

create or replace function public.validate_inspection_media_manifest_relationships()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.inspections
    where id = new.inspection_id
      and organization_id = new.organization_id
  ) then
    raise exception 'Inspection media organization mismatch.';
  end if;

  if new.document_id is not null and not exists (
    select 1 from public.documents
    where id = new.document_id
      and organization_id = new.organization_id
  ) then
    raise exception 'Inspection media document organization mismatch.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Immutability guards.
-- ---------------------------------------------------------------------------

create or replace function public.prevent_protected_rental_document_version_update()
returns trigger
language plpgsql
as $$
declare
  has_signature boolean;
begin
  select exists (
    select 1 from public.rental_document_signatures
    where document_version_id = old.id
  ) into has_signature;

  if old.finalised_at is not null
    or old.status in ('finalised', 'signed')
    or has_signature
  then
    if old.rendered_html_snapshot is distinct from new.rendered_html_snapshot
      or old.rendered_data_snapshot is distinct from new.rendered_data_snapshot
      or old.business_snapshot is distinct from new.business_snapshot
      or old.pdf_storage_bucket is distinct from new.pdf_storage_bucket
      or old.pdf_storage_path is distinct from new.pdf_storage_path
      or old.content_hash is distinct from new.content_hash
      or old.template_id is distinct from new.template_id
      or old.template_version is distinct from new.template_version
      or old.version_number is distinct from new.version_number
      or old.document_id is distinct from new.document_id
    then
      raise exception 'Finalised or signed document versions are immutable.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_protected_rental_document_version_delete()
returns trigger
language plpgsql
as $$
begin
  if old.finalised_at is not null
    or old.status in ('finalised', 'signed')
    or exists (
      select 1 from public.rental_document_signatures
      where document_version_id = old.id
    )
  then
    raise exception 'Finalised or signed document versions cannot be deleted.';
  end if;

  return old;
end;
$$;

create or replace function public.prevent_rental_document_signature_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Document signature records are immutable.';
end;
$$;

drop trigger if exists validate_rental_documents_relationships on public.rental_documents;
create trigger validate_rental_documents_relationships
  before insert or update on public.rental_documents
  for each row execute function public.validate_rental_document_relationships();

drop trigger if exists validate_rental_document_versions_relationships on public.rental_document_versions;
create trigger validate_rental_document_versions_relationships
  before insert or update on public.rental_document_versions
  for each row execute function public.validate_rental_document_version_relationships();

drop trigger if exists protect_rental_document_version_updates on public.rental_document_versions;
create trigger protect_rental_document_version_updates
  before update on public.rental_document_versions
  for each row execute function public.prevent_protected_rental_document_version_update();

drop trigger if exists protect_rental_document_version_deletes on public.rental_document_versions;
create trigger protect_rental_document_version_deletes
  before delete on public.rental_document_versions
  for each row execute function public.prevent_protected_rental_document_version_delete();

drop trigger if exists validate_rental_document_signatures_relationships on public.rental_document_signatures;
create trigger validate_rental_document_signatures_relationships
  before insert on public.rental_document_signatures
  for each row execute function public.validate_rental_document_signature_relationships();

drop trigger if exists protect_rental_document_signature_updates on public.rental_document_signatures;
create trigger protect_rental_document_signature_updates
  before update on public.rental_document_signatures
  for each row execute function public.prevent_rental_document_signature_mutation();

drop trigger if exists protect_rental_document_signature_deletes on public.rental_document_signatures;
create trigger protect_rental_document_signature_deletes
  before delete on public.rental_document_signatures
  for each row execute function public.prevent_rental_document_signature_mutation();

drop trigger if exists validate_rental_amendments_relationships on public.rental_amendments;
create trigger validate_rental_amendments_relationships
  before insert or update on public.rental_amendments
  for each row execute function public.validate_rental_amendment_relationships();

drop trigger if exists validate_deposit_reconciliations_relationships on public.deposit_reconciliations;
create trigger validate_deposit_reconciliations_relationships
  before insert or update on public.deposit_reconciliations
  for each row execute function public.validate_deposit_reconciliation_relationships();

drop trigger if exists validate_inspection_media_manifest_relationships on public.inspection_media_manifest;
create trigger validate_inspection_media_manifest_relationships
  before insert or update on public.inspection_media_manifest
  for each row execute function public.validate_inspection_media_manifest_relationships();

drop trigger if exists rental_documents_updated_at on public.rental_documents;
create trigger rental_documents_updated_at
  before update on public.rental_documents
  for each row execute function public.set_updated_at();

drop trigger if exists rental_amendments_updated_at on public.rental_amendments;
create trigger rental_amendments_updated_at
  before update on public.rental_amendments
  for each row execute function public.set_updated_at();

drop trigger if exists deposit_reconciliations_updated_at on public.deposit_reconciliations;
create trigger deposit_reconciliations_updated_at
  before update on public.deposit_reconciliations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Indexes.
-- ---------------------------------------------------------------------------

create index if not exists rental_documents_org_idx
  on public.rental_documents(organization_id, created_at desc);
create index if not exists rental_documents_rental_idx
  on public.rental_documents(organization_id, rental_id, created_at desc);
create index if not exists rental_documents_status_idx
  on public.rental_documents(organization_id, status, created_at desc);
create index if not exists rental_documents_legacy_contract_idx
  on public.rental_documents(organization_id, legacy_contract_id)
  where legacy_contract_id is not null;

create index if not exists rental_document_versions_org_idx
  on public.rental_document_versions(organization_id, created_at desc);
create index if not exists rental_document_versions_document_idx
  on public.rental_document_versions(organization_id, document_id, version_number desc);
create index if not exists rental_document_versions_status_idx
  on public.rental_document_versions(organization_id, status, generated_at desc);

create index if not exists rental_document_signatures_org_idx
  on public.rental_document_signatures(organization_id, created_at desc);
create index if not exists rental_document_signatures_version_idx
  on public.rental_document_signatures(organization_id, document_version_id, signed_at desc);
create index if not exists rental_document_signatures_role_idx
  on public.rental_document_signatures(organization_id, signer_role, signed_at desc);

create index if not exists rental_amendments_org_idx
  on public.rental_amendments(organization_id, created_at desc);
create index if not exists rental_amendments_rental_idx
  on public.rental_amendments(organization_id, rental_id, created_at desc);
create index if not exists rental_amendments_status_idx
  on public.rental_amendments(organization_id, approval_status, created_at desc);

create index if not exists deposit_reconciliations_org_idx
  on public.deposit_reconciliations(organization_id, created_at desc);
create index if not exists deposit_reconciliations_rental_idx
  on public.deposit_reconciliations(organization_id, rental_id, created_at desc);
create index if not exists deposit_reconciliations_status_idx
  on public.deposit_reconciliations(organization_id, status, created_at desc);

create index if not exists inspection_media_manifest_org_idx
  on public.inspection_media_manifest(organization_id, created_at desc);
create index if not exists inspection_media_manifest_inspection_idx
  on public.inspection_media_manifest(organization_id, inspection_id, created_at desc);
create index if not exists inspection_media_manifest_document_idx
  on public.inspection_media_manifest(organization_id, document_id)
  where document_id is not null;

-- ---------------------------------------------------------------------------
-- RLS. No broad public policies are added for legal document tables.
-- ---------------------------------------------------------------------------

alter table public.rental_documents enable row level security;
alter table public.rental_document_versions enable row level security;
alter table public.rental_document_signatures enable row level security;
alter table public.rental_amendments enable row level security;
alter table public.deposit_reconciliations enable row level security;
alter table public.inspection_media_manifest enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rental_documents'
      and policyname = 'Members can view rental documents'
  ) then
    create policy "Members can view rental documents" on public.rental_documents
      for select using (public.is_org_member(organization_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rental_documents'
      and policyname = 'Operators can create rental documents'
  ) then
    create policy "Operators can create rental documents" on public.rental_documents
      for insert with check (public.has_org_role(organization_id, array['owner','manager','operator']::public.organization_role[]));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rental_documents'
      and policyname = 'Operators can update rental documents'
  ) then
    create policy "Operators can update rental documents" on public.rental_documents
      for update using (public.has_org_role(organization_id, array['owner','manager','operator']::public.organization_role[]))
      with check (public.has_org_role(organization_id, array['owner','manager','operator']::public.organization_role[]));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rental_document_versions'
      and policyname = 'Members can view rental document versions'
  ) then
    create policy "Members can view rental document versions" on public.rental_document_versions
      for select using (public.is_org_member(organization_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rental_document_versions'
      and policyname = 'Operators can create rental document versions'
  ) then
    create policy "Operators can create rental document versions" on public.rental_document_versions
      for insert with check (public.has_org_role(organization_id, array['owner','manager','operator']::public.organization_role[]));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rental_document_versions'
      and policyname = 'Operators can update rental document versions'
  ) then
    create policy "Operators can update rental document versions" on public.rental_document_versions
      for update using (public.has_org_role(organization_id, array['owner','manager','operator']::public.organization_role[]))
      with check (public.has_org_role(organization_id, array['owner','manager','operator']::public.organization_role[]));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rental_document_signatures'
      and policyname = 'Members can view rental document signatures'
  ) then
    create policy "Members can view rental document signatures" on public.rental_document_signatures
      for select using (public.is_org_member(organization_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rental_document_signatures'
      and policyname = 'Operators can create rental document signatures'
  ) then
    create policy "Operators can create rental document signatures" on public.rental_document_signatures
      for insert with check (public.has_org_role(organization_id, array['owner','manager','operator']::public.organization_role[]));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rental_amendments'
      and policyname = 'Members can view rental amendments'
  ) then
    create policy "Members can view rental amendments" on public.rental_amendments
      for select using (public.is_org_member(organization_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rental_amendments'
      and policyname = 'Operators can create rental amendments'
  ) then
    create policy "Operators can create rental amendments" on public.rental_amendments
      for insert with check (public.has_org_role(organization_id, array['owner','manager','operator']::public.organization_role[]));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rental_amendments'
      and policyname = 'Operators can update rental amendments'
  ) then
    create policy "Operators can update rental amendments" on public.rental_amendments
      for update using (public.has_org_role(organization_id, array['owner','manager','operator']::public.organization_role[]))
      with check (public.has_org_role(organization_id, array['owner','manager','operator']::public.organization_role[]));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'deposit_reconciliations'
      and policyname = 'Members can view deposit reconciliations'
  ) then
    create policy "Members can view deposit reconciliations" on public.deposit_reconciliations
      for select using (public.is_org_member(organization_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'deposit_reconciliations'
      and policyname = 'Finance roles can create deposit reconciliations'
  ) then
    create policy "Finance roles can create deposit reconciliations" on public.deposit_reconciliations
      for insert with check (public.has_org_role(organization_id, array['owner','manager','accountant','operator']::public.organization_role[]));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'deposit_reconciliations'
      and policyname = 'Finance roles can update deposit reconciliations'
  ) then
    create policy "Finance roles can update deposit reconciliations" on public.deposit_reconciliations
      for update using (public.has_org_role(organization_id, array['owner','manager','accountant','operator']::public.organization_role[]))
      with check (public.has_org_role(organization_id, array['owner','manager','accountant','operator']::public.organization_role[]));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'inspection_media_manifest'
      and policyname = 'Members can view inspection media manifest'
  ) then
    create policy "Members can view inspection media manifest" on public.inspection_media_manifest
      for select using (public.is_org_member(organization_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'inspection_media_manifest'
      and policyname = 'Operators can create inspection media manifest'
  ) then
    create policy "Operators can create inspection media manifest" on public.inspection_media_manifest
      for insert with check (public.has_org_role(organization_id, array['owner','manager','operator','driver']::public.organization_role[]));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'inspection_media_manifest'
      and policyname = 'Operators can update inspection media manifest'
  ) then
    create policy "Operators can update inspection media manifest" on public.inspection_media_manifest
      for update using (public.has_org_role(organization_id, array['owner','manager','operator','driver']::public.organization_role[]))
      with check (public.has_org_role(organization_id, array['owner','manager','operator','driver']::public.organization_role[]));
  end if;
end $$;
