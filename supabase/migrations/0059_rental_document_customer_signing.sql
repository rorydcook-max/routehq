-- Phase 10: customer signing integration for the immutable rental-document engine.
-- Additive only. Existing legacy contracts remain authoritative unless an operator
-- explicitly selects rental_document_engine authority for a rental.

alter table public.rentals
  add column if not exists contract_authority_mode text not null default 'legacy',
  add column if not exists rental_document_executed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rentals_contract_authority_mode_check'
  ) then
    alter table public.rentals
      add constraint rentals_contract_authority_mode_check
      check (contract_authority_mode in ('legacy', 'rental_document_engine'));
  end if;
end $$;

create index if not exists rentals_contract_authority_mode_idx
  on public.rentals(organization_id, contract_authority_mode, created_at desc)
  where deleted_at is null;

create table if not exists public.rental_document_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  rental_id uuid not null references public.rentals(id) on delete restrict,
  document_version_id uuid not null references public.rental_document_versions(id) on delete restrict,
  booking_link_id uuid references public.booking_links(id) on delete set null,
  signer_role text not null,
  acknowledgement_type text not null,
  acknowledgement_text_version text not null,
  acknowledgement_text_snapshot text not null,
  content_hash text not null,
  accepted_at timestamptz not null default now(),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint rental_document_acknowledgements_role_check check (signer_role in ('renter')),
  constraint rental_document_acknowledgements_type_check check (
    acknowledgement_type in (
      'agreement_reviewed',
      'early_termination',
      'damage_responsibility',
      'insurance',
      'electronic_signature_records',
      'gps_dashcam',
      'data_handling'
    )
  )
);

create unique index if not exists rental_document_acknowledgements_unique_idx
  on public.rental_document_acknowledgements(document_version_id, signer_role, acknowledgement_type);

create index if not exists rental_document_acknowledgements_rental_idx
  on public.rental_document_acknowledgements(organization_id, rental_id, created_at desc);

create table if not exists public.rental_document_execution_certificates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  rental_id uuid not null references public.rentals(id) on delete restrict,
  document_id uuid not null references public.rental_documents(id) on delete restrict,
  document_version_id uuid not null references public.rental_document_versions(id) on delete restrict,
  original_content_hash text not null,
  certificate_storage_bucket text not null,
  certificate_storage_path text not null,
  generated_at timestamptz not null default now(),
  verification_reference text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create unique index if not exists rental_document_execution_certificates_version_idx
  on public.rental_document_execution_certificates(document_version_id);

create index if not exists rental_document_execution_certificates_rental_idx
  on public.rental_document_execution_certificates(organization_id, rental_id, created_at desc);

create or replace function public.validate_rental_document_acknowledgement_relationships()
returns trigger
language plpgsql
as $$
declare
  v_version public.rental_document_versions%rowtype;
  v_document public.rental_documents%rowtype;
begin
  select * into v_version
  from public.rental_document_versions
  where id = new.document_version_id
    and organization_id = new.organization_id;

  if not found then
    raise exception 'Acknowledgement document version organization mismatch.';
  end if;

  select * into v_document
  from public.rental_documents
  where id = v_version.document_id
    and organization_id = new.organization_id;

  if not found or v_document.rental_id <> new.rental_id then
    raise exception 'Acknowledgement rental/document relationship mismatch.';
  end if;

  if new.content_hash <> v_version.content_hash then
    raise exception 'Acknowledgement content hash does not match document version.';
  end if;

  if new.booking_link_id is not null and not exists (
    select 1 from public.booking_links
    where id = new.booking_link_id
      and organization_id = new.organization_id
      and rental_id = new.rental_id
  ) then
    raise exception 'Acknowledgement booking link relationship mismatch.';
  end if;

  return new;
end;
$$;

create or replace function public.validate_rental_document_execution_certificate_relationships()
returns trigger
language plpgsql
as $$
declare
  v_version public.rental_document_versions%rowtype;
  v_document public.rental_documents%rowtype;
  v_expected_prefix text;
begin
  select * into v_version
  from public.rental_document_versions
  where id = new.document_version_id
    and organization_id = new.organization_id;

  if not found then
    raise exception 'Execution certificate document version organization mismatch.';
  end if;

  select * into v_document
  from public.rental_documents
  where id = new.document_id
    and organization_id = new.organization_id;

  if not found
    or v_document.id <> v_version.document_id
    or v_document.rental_id <> new.rental_id
  then
    raise exception 'Execution certificate document relationship mismatch.';
  end if;

  if new.original_content_hash <> v_version.content_hash then
    raise exception 'Execution certificate hash does not match document version.';
  end if;

  if new.certificate_storage_bucket <> 'documents' then
    raise exception 'Invalid execution certificate storage bucket.';
  end if;

  v_expected_prefix :=
    'organizations/' || new.organization_id::text ||
    '/rentals/' || new.rental_id::text ||
    '/rental-documents/' || new.document_id::text ||
    '/versions/' || new.document_version_id::text ||
    '/execution/execution-certificate-';

  if new.certificate_storage_path not like v_expected_prefix || '%.pdf'
    or length(new.certificate_storage_path) > 560
    or new.certificate_storage_path like '/%'
    or new.certificate_storage_path like '%..%'
    or new.certificate_storage_path like '%//%'
    or new.certificate_storage_path like '%://%'
    or position(chr(92) in new.certificate_storage_path) > 0
    or position('%2e' in lower(new.certificate_storage_path)) > 0
    or position('%2f' in lower(new.certificate_storage_path)) > 0
  then
    raise exception 'Invalid execution certificate storage path.';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_rental_document_acknowledgement_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Document acknowledgement records are immutable.';
end;
$$;

create or replace function public.prevent_rental_document_execution_certificate_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Document execution certificate records are immutable.';
end;
$$;

drop trigger if exists validate_rental_document_acknowledgements_relationships on public.rental_document_acknowledgements;
create trigger validate_rental_document_acknowledgements_relationships
  before insert on public.rental_document_acknowledgements
  for each row execute function public.validate_rental_document_acknowledgement_relationships();

drop trigger if exists protect_rental_document_acknowledgement_updates on public.rental_document_acknowledgements;
create trigger protect_rental_document_acknowledgement_updates
  before update on public.rental_document_acknowledgements
  for each row execute function public.prevent_rental_document_acknowledgement_mutation();

drop trigger if exists protect_rental_document_acknowledgement_deletes on public.rental_document_acknowledgements;
create trigger protect_rental_document_acknowledgement_deletes
  before delete on public.rental_document_acknowledgements
  for each row execute function public.prevent_rental_document_acknowledgement_mutation();

drop trigger if exists validate_rental_document_execution_certificates_relationships on public.rental_document_execution_certificates;
create trigger validate_rental_document_execution_certificates_relationships
  before insert on public.rental_document_execution_certificates
  for each row execute function public.validate_rental_document_execution_certificate_relationships();

drop trigger if exists protect_rental_document_execution_certificate_updates on public.rental_document_execution_certificates;
create trigger protect_rental_document_execution_certificate_updates
  before update on public.rental_document_execution_certificates
  for each row execute function public.prevent_rental_document_execution_certificate_mutation();

drop trigger if exists protect_rental_document_execution_certificate_deletes on public.rental_document_execution_certificates;
create trigger protect_rental_document_execution_certificate_deletes
  before delete on public.rental_document_execution_certificates
  for each row execute function public.prevent_rental_document_execution_certificate_mutation();

alter table public.rental_document_acknowledgements enable row level security;
alter table public.rental_document_execution_certificates enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rental_document_acknowledgements'
      and policyname = 'Members can view rental document acknowledgements'
  ) then
    create policy "Members can view rental document acknowledgements"
      on public.rental_document_acknowledgements
      for select using (public.is_org_member(organization_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rental_document_execution_certificates'
      and policyname = 'Members can view rental document execution certificates'
  ) then
    create policy "Members can view rental document execution certificates"
      on public.rental_document_execution_certificates
      for select using (public.is_org_member(organization_id));
  end if;
end $$;

create or replace function public.complete_rental_document_customer_signing(
  p_booking_token text,
  p_signature_storage_bucket text,
  p_signature_storage_path text,
  p_signer_name text,
  p_ip_address text,
  p_user_agent text,
  p_acknowledgements jsonb,
  p_certificate_storage_bucket text,
  p_certificate_storage_path text,
  p_verification_reference text,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  document_id uuid,
  document_version_id uuid,
  signature_id uuid,
  document_status text,
  version_status text,
  executed_at timestamptz,
  certificate_id uuid
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_link public.booking_links%rowtype;
  v_rental public.rentals%rowtype;
  v_document public.rental_documents%rowtype;
  v_version public.rental_document_versions%rowtype;
  v_business_signature public.rental_document_signatures%rowtype;
  v_existing_renter_signature public.rental_document_signatures%rowtype;
  v_signature public.rental_document_signatures%rowtype;
  v_certificate public.rental_document_execution_certificates%rowtype;
  v_ack jsonb;
  v_ack_type text;
  v_ack_version text;
  v_ack_text text;
  v_required_types text[] := array[
    'agreement_reviewed',
    'early_termination',
    'damage_responsibility',
    'insurance',
    'electronic_signature_records',
    'data_handling'
  ];
  v_ack_types text[] := '{}';
  v_now timestamptz := now();
  v_expected_signature_prefix text;
begin
  if nullif(trim(coalesce(p_booking_token, '')), '') is null then
    raise exception 'Booking token is required.';
  end if;

  select * into v_link
  from public.booking_links
  where token = p_booking_token
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Booking link was not found.';
  end if;

  if v_link.status in ('cancelled', 'expired') then
    raise exception 'Booking link is not active.';
  end if;

  if v_link.expires_at is not null and v_link.expires_at < now() then
    raise exception 'Booking link has expired.';
  end if;

  select * into v_rental
  from public.rentals
  where id = v_link.rental_id
    and organization_id = v_link.organization_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Rental was not found for this booking link.';
  end if;

  if v_rental.contract_authority_mode <> 'rental_document_engine' then
    raise exception 'Rental document customer signing is not authoritative for this booking.';
  end if;

  select * into v_document
  from public.rental_documents
  where organization_id = v_link.organization_id
    and rental_id = v_rental.id
    and document_type = 'rental_agreement'
    and status not in ('voided', 'superseded')
  order by created_at desc
  limit 1
  for update;

  if not found or v_document.current_version_id is null then
    raise exception 'Eligible rental agreement document was not found.';
  end if;

  select * into v_version
  from public.rental_document_versions
  where id = v_document.current_version_id
    and organization_id = v_link.organization_id
    and document_id = v_document.id
  for update;

  if not found then
    raise exception 'Eligible rental agreement version was not found.';
  end if;

  if v_version.status <> 'signed' or v_version.finalised_at is null then
    raise exception 'Only finalised business-signed agreement versions can be signed by the renter.';
  end if;

  if nullif(trim(coalesce(v_version.content_hash, '')), '') is null then
    raise exception 'Document version content hash is missing.';
  end if;

  select * into v_business_signature
  from public.rental_document_signatures
  where organization_id = v_link.organization_id
    and document_version_id = v_version.id
    and signer_role = 'authorised_business_signatory'
  limit 1;

  if not found or v_business_signature.content_hash_at_signing <> v_version.content_hash then
    raise exception 'Business signature is missing or does not match the finalised version.';
  end if;

  select * into v_existing_renter_signature
  from public.rental_document_signatures
  where organization_id = v_link.organization_id
    and document_version_id = v_version.id
    and signer_role = 'renter'
  limit 1;

  if found then
    if v_existing_renter_signature.content_hash_at_signing <> v_version.content_hash
      or v_existing_renter_signature.signer_name <> p_signer_name
    then
      raise exception 'A conflicting renter signature already exists for this agreement.';
    end if;

    select * into v_certificate
    from public.rental_document_execution_certificates
    where document_version_id = v_version.id
    limit 1;

    return query
      select v_document.id, v_version.id, v_existing_renter_signature.id, v_document.status, v_version.status, v_rental.rental_document_executed_at, v_certificate.id;
    return;
  end if;

  if p_signature_storage_bucket <> 'documents' then
    raise exception 'Invalid renter signature storage bucket.';
  end if;

  v_expected_signature_prefix :=
    'organizations/' || v_link.organization_id::text ||
    '/rentals/' || v_rental.id::text ||
    '/rental-documents/' || v_document.id::text ||
    '/versions/' || v_version.id::text ||
    '/signatures/renter-';

  if p_signature_storage_path not like v_expected_signature_prefix || '%.png'
    or length(p_signature_storage_path) > 560
    or p_signature_storage_path like '/%'
    or p_signature_storage_path like '%..%'
    or p_signature_storage_path like '%//%'
    or p_signature_storage_path like '%://%'
    or position(chr(92) in p_signature_storage_path) > 0
    or position('%2e' in lower(p_signature_storage_path)) > 0
    or position('%2f' in lower(p_signature_storage_path)) > 0
  then
    raise exception 'Invalid renter signature storage path.';
  end if;

  if jsonb_typeof(p_acknowledgements) <> 'array' then
    raise exception 'Acknowledgements must be provided as an array.';
  end if;

  for v_ack in select * from jsonb_array_elements(p_acknowledgements)
  loop
    v_ack_type := v_ack ->> 'type';
    v_ack_version := v_ack ->> 'textVersion';
    v_ack_text := v_ack ->> 'text';

    if not (v_ack_type = any(array[
      'agreement_reviewed',
      'early_termination',
      'damage_responsibility',
      'insurance',
      'electronic_signature_records',
      'gps_dashcam',
      'data_handling'
    ])) then
      raise exception 'Unsupported acknowledgement type.';
    end if;

    if nullif(trim(coalesce(v_ack_version, '')), '') is null
      or nullif(trim(coalesce(v_ack_text, '')), '') is null
    then
      raise exception 'Acknowledgement text snapshot is required.';
    end if;

    v_ack_types := array_append(v_ack_types, v_ack_type);

    insert into public.rental_document_acknowledgements (
      organization_id,
      rental_id,
      document_version_id,
      booking_link_id,
      signer_role,
      acknowledgement_type,
      acknowledgement_text_version,
      acknowledgement_text_snapshot,
      content_hash,
      accepted_at,
      metadata
    )
    values (
      v_link.organization_id,
      v_rental.id,
      v_version.id,
      v_link.id,
      'renter',
      v_ack_type,
      v_ack_version,
      v_ack_text,
      v_version.content_hash,
      v_now,
      jsonb_build_object('source', 'public_booking_link')
    )
    on conflict (document_version_id, signer_role, acknowledgement_type) do nothing;
  end loop;

  if not v_required_types <@ v_ack_types then
    raise exception 'Required acknowledgements are missing.';
  end if;

  insert into public.rental_document_signatures (
    organization_id,
    document_version_id,
    signer_role,
    signer_name,
    signature_storage_bucket,
    signature_storage_path,
    signed_at,
    ip_address,
    user_agent,
    verification_method,
    consent_text_version,
    content_hash_at_signing,
    metadata
  )
  values (
    v_link.organization_id,
    v_version.id,
    'renter',
    p_signer_name,
    p_signature_storage_bucket,
    p_signature_storage_path,
    v_now,
    nullif(trim(coalesce(p_ip_address, '')), '')::inet,
    nullif(trim(coalesce(p_user_agent, '')), ''),
    'booking_link_signature_pad',
    'customer-electronic-signature-v1',
    v_version.content_hash,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('booking_link_id', v_link.id)
  )
  returning * into v_signature;

  insert into public.rental_document_execution_certificates (
    organization_id,
    rental_id,
    document_id,
    document_version_id,
    original_content_hash,
    certificate_storage_bucket,
    certificate_storage_path,
    generated_at,
    verification_reference,
    metadata
  )
  values (
    v_link.organization_id,
    v_rental.id,
    v_document.id,
    v_version.id,
    v_version.content_hash,
    p_certificate_storage_bucket,
    p_certificate_storage_path,
    v_now,
    p_verification_reference,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_certificate;

  update public.rental_document_versions
    set status = 'signed'
  where id = v_version.id
    and organization_id = v_link.organization_id;

  update public.rental_documents
    set status = 'signed'
  where id = v_document.id
    and organization_id = v_link.organization_id
  returning * into v_document;

  update public.rentals
    set rental_document_executed_at = v_now
  where id = v_rental.id
    and organization_id = v_link.organization_id
  returning * into v_rental;

  update public.booking_links
    set status = 'completed',
        contract_signed_at = coalesce(contract_signed_at, v_now),
        completed_at = coalesce(completed_at, v_now)
  where id = v_link.id
    and organization_id = v_link.organization_id;

  return query
    select v_document.id, v_version.id, v_signature.id, v_document.status, 'signed'::text, v_now, v_certificate.id;
end;
$$;

revoke all on function public.complete_rental_document_customer_signing(
  text, text, text, text, text, text, jsonb, text, text, text, jsonb
) from public;

grant execute on function public.complete_rental_document_customer_signing(
  text, text, text, text, text, text, jsonb, text, text, text, jsonb
) to service_role;
