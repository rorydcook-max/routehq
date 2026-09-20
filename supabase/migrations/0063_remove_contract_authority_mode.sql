-- 0063: remove the contract authority mode.
--
-- The rental document engine is now the only authority for rental agreements.
-- This migration drops contract_authority_mode along with the constraint and
-- index from 0059, and rewrites the two functions that read it:
--
--   * complete_rental_document_customer_signing (last defined in 0062) is
--     recreated verbatim minus its authority-mode guard.
--   * enforce_rental_document_customer_signing_enabled (0060) keeps its
--     document -> rental -> organization relationship integrity checks and
--     loses the authority-mode check and the feature-flag checks, which no
--     longer gate anything.
--
-- Ordering matters: both functions must stop referencing the column before it
-- is dropped, so the drops come last.

create or replace function public.enforce_rental_document_customer_signing_enabled()
returns trigger
language plpgsql
as $$
declare
  v_document public.rental_documents%rowtype;
  v_rental public.rentals%rowtype;
  v_organization public.organizations%rowtype;
begin
  if tg_table_name = 'rental_document_signatures' and new.signer_role <> 'renter' then
    return new;
  end if;

  select rd.* into v_document
  from public.rental_document_versions rdv
  join public.rental_documents rd on rd.id = rdv.document_id
  where rdv.id = new.document_version_id
    and rdv.organization_id = new.organization_id;

  if not found then
    raise exception 'Customer signing document relationship mismatch.';
  end if;

  select * into v_rental
  from public.rentals
  where id = v_document.rental_id
    and organization_id = new.organization_id
    and deleted_at is null;

  if not found then
    raise exception 'Customer signing rental relationship mismatch.';
  end if;

  select * into v_organization
  from public.organizations
  where id = new.organization_id
    and deleted_at is null;

  if not found then
    raise exception 'Customer signing organization relationship mismatch.';
  end if;

  return new;
end;
$$;

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
  from public.rental_document_versions rdv
  where rdv.id = v_document.current_version_id
    and rdv.organization_id = v_link.organization_id
    and rdv.document_id = v_document.id
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
  from public.rental_document_signatures rds
  where rds.organization_id = v_link.organization_id
    and rds.document_version_id = v_version.id
    and rds.signer_role = 'authorised_business_signatory'
  limit 1;

  if not found or v_business_signature.content_hash_at_signing <> v_version.content_hash then
    raise exception 'Business signature is missing or does not match the finalised version.';
  end if;

  select * into v_existing_renter_signature
  from public.rental_document_signatures rds
  where rds.organization_id = v_link.organization_id
    and rds.document_version_id = v_version.id
    and rds.signer_role = 'renter'
  limit 1;

  if found then
    if v_existing_renter_signature.content_hash_at_signing <> v_version.content_hash
      or v_existing_renter_signature.signer_name <> p_signer_name
    then
      raise exception 'A conflicting renter signature already exists for this agreement.';
    end if;

    select * into v_certificate
    from public.rental_document_execution_certificates rdec
    where rdec.document_version_id = v_version.id
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

    if not exists (
      select 1
      from public.rental_document_acknowledgements rda
      where rda.document_version_id = v_version.id
        and rda.signer_role = 'renter'
        and rda.acknowledgement_type = v_ack_type
    ) then
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
      );
    end if;
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


-- Drop the authority mode itself, now that nothing reads it.

drop index if exists public.rentals_contract_authority_mode_idx;

alter table public.rentals
  drop constraint if exists rentals_contract_authority_mode_check;

alter table public.rentals
  drop column if exists contract_authority_mode;
