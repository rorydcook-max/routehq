-- Phase 9 fix: require literal percent-encoded traversal markers in finalisation path validation.

create or replace function public.finalise_rental_document_version(
  p_organization_id uuid,
  p_document_version_id uuid,
  p_current_content_hash text,
  p_final_content_hash text,
  p_final_pdf_storage_bucket text,
  p_final_pdf_storage_path text,
  p_final_pdf_generated_at timestamptz,
  p_signer_user_id uuid,
  p_signer_name text,
  p_signature_storage_bucket text,
  p_signature_storage_path text,
  p_consent_text_version text,
  p_signature_metadata jsonb default '{}'::jsonb
)
returns table (
  document_id uuid,
  document_version_id uuid,
  signature_id uuid,
  document_status text,
  version_status text,
  finalised_at timestamptz,
  content_hash text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_id uuid := auth.uid();
  v_document public.rental_documents%rowtype;
  v_version public.rental_document_versions%rowtype;
  v_organization public.organizations%rowtype;
  v_existing_signature public.rental_document_signatures%rowtype;
  v_finalised_at timestamptz;
  v_expected_final_prefix text;
  v_final_file_name text;
  v_snapshot_signature jsonb;
  v_snapshot_signatory jsonb;
  v_blocking_warning_count integer := 0;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select * into v_version
  from public.rental_document_versions rdv
  where rdv.id = p_document_version_id
  for update;

  if not found then
    raise exception 'Rental document version was not found.';
  end if;

  select * into v_document
  from public.rental_documents rd
  where rd.id = v_version.document_id
  for update;

  if not found then
    raise exception 'Rental document was not found.';
  end if;

  if p_organization_id is distinct from v_document.organization_id
    or v_version.organization_id is distinct from v_document.organization_id
  then
    raise exception 'Rental document organization mismatch.';
  end if;

  if not public.has_org_role(v_document.organization_id, array['owner','manager','operator']::public.organization_role[]) then
    raise exception 'You do not have permission to finalise rental documents for this organization.';
  end if;

  select * into v_organization
  from public.organizations o
  where o.id = v_document.organization_id
    and o.deleted_at is null;

  if not found then
    raise exception 'Organization was not found.';
  end if;

  if coalesce((v_organization.settings ->> 'rental_document_engine_enabled')::boolean, false) is not true
    and coalesce((v_organization.settings ->> 'experimental_rental_document_engine_enabled')::boolean, false) is not true
  then
    raise exception 'Rental document engine is disabled for this organization.';
  end if;

  if nullif(trim(p_current_content_hash), '') is null
    or nullif(trim(p_final_content_hash), '') is null
    or nullif(trim(p_final_pdf_storage_bucket), '') is null
    or nullif(trim(p_final_pdf_storage_path), '') is null
    or nullif(trim(p_signer_name), '') is null
    or nullif(trim(p_signature_storage_bucket), '') is null
    or nullif(trim(p_signature_storage_path), '') is null
  then
    raise exception 'Required finalisation fields are missing.';
  end if;

  if p_final_pdf_storage_bucket <> 'documents' then
    raise exception 'Invalid final PDF storage bucket.';
  end if;

  if length(p_final_pdf_storage_path) > 512
    or p_final_pdf_storage_path like '/%'
    or p_final_pdf_storage_path like '%//%'
    or p_final_pdf_storage_path like '%..%'
    or position(chr(92) in p_final_pdf_storage_path) > 0
    or p_final_pdf_storage_path like '%://%'
    or p_final_pdf_storage_path like '%?%'
    or p_final_pdf_storage_path like '%#%'
    or p_final_pdf_storage_path like 'documents/%'
    or p_final_pdf_storage_path like 'branding/%'
    or position('%2e' in lower(p_final_pdf_storage_path)) > 0
    or position('%2f' in lower(p_final_pdf_storage_path)) > 0
    or position('%5c' in lower(p_final_pdf_storage_path)) > 0
  then
    raise exception 'Invalid final PDF storage path.';
  end if;

  v_expected_final_prefix :=
    'organizations/' || v_document.organization_id::text ||
    '/rentals/' || v_document.rental_id::text ||
    '/rental-documents/' || v_document.id::text ||
    '/versions/' || v_version.id::text ||
    '/final-';

  if p_final_pdf_storage_path not like v_expected_final_prefix || '%.pdf' then
    raise exception 'Final PDF path does not match the rental document version.';
  end if;

  v_final_file_name := substring(p_final_pdf_storage_path from length(v_expected_final_prefix) + 1);
  if v_final_file_name !~ '^[-A-Za-z0-9_]+\.pdf$' then
    raise exception 'Invalid final PDF file name.';
  end if;

  if v_document.current_version_id is distinct from v_version.id then
    raise exception 'Only the current rental document version can be finalised.';
  end if;

  if v_document.document_type <> 'rental_agreement' then
    raise exception 'Only rental agreement documents can be finalised in this phase.';
  end if;

  if exists (
    select 1
    from public.rental_document_versions newer
    where newer.organization_id = v_document.organization_id
      and newer.document_id = v_document.id
      and newer.id <> v_version.id
      and (
        newer.supersedes_version_id = v_version.id
        or newer.version_number > v_version.version_number
      )
  ) then
    raise exception 'A newer rental document version supersedes this version.';
  end if;

  if nullif(trim(v_version.rendered_html_snapshot), '') is null
    or v_version.rendered_data_snapshot is null
    or v_version.business_snapshot is null
  then
    raise exception 'Rendered snapshots are required before finalisation.';
  end if;

  if nullif(trim(coalesce(v_version.business_snapshot ->> 'legal_name', '')), '') is null then
    raise exception 'Business legal identity is required before finalisation.';
  end if;

  v_snapshot_signatory := coalesce(v_version.business_snapshot -> 'authorised_signatory', '{}'::jsonb);
  if nullif(trim(coalesce(v_snapshot_signatory ->> 'name', '')), '') is null
    or nullif(trim(coalesce(v_snapshot_signatory ->> 'title', '')), '') is null
    or nullif(trim(coalesce(v_snapshot_signatory ->> 'signature_authorised_at', '')), '') is null
    or nullif(trim(coalesce(v_snapshot_signatory ->> 'signature_authorisation_text_version', '')), '') is null
  then
    raise exception 'Authorised business signatory details are required before finalisation.';
  end if;

  if p_signer_name <> (v_snapshot_signatory ->> 'name') then
    raise exception 'Signer name does not match the business snapshot.';
  end if;

  v_snapshot_signature := coalesce(v_version.business_snapshot -> 'authorised_signature', '{}'::jsonb);
  if coalesce(v_snapshot_signature ->> 'kind', '') <> 'storage'
    or coalesce(v_snapshot_signature ->> 'bucket', '') <> p_signature_storage_bucket
    or coalesce(v_snapshot_signature ->> 'path', '') <> p_signature_storage_path
  then
    raise exception 'Signature reference does not match the immutable business snapshot.';
  end if;

  if p_signature_storage_bucket <> 'branding'
    or p_signature_storage_path not like v_document.organization_id::text || '/branding/%'
    or p_signature_storage_path like '/%'
    or p_signature_storage_path like '%..%'
    or p_signature_storage_path like '%//%'
    or p_signature_storage_path like '%://%'
    or position('%2e' in lower(p_signature_storage_path)) > 0
    or position('%2f' in lower(p_signature_storage_path)) > 0
  then
    raise exception 'Invalid authorised signature storage reference.';
  end if;

  select count(*) into v_blocking_warning_count
  from jsonb_array_elements(coalesce(v_version.rendered_data_snapshot -> 'warnings', '[]'::jsonb)) warning
  where coalesce((warning ->> 'blocksSigning')::boolean, false) is true
    or coalesce(warning ->> 'severity', '') = 'blocking';

  if v_blocking_warning_count > 0 then
    raise exception 'Blocking template warnings must be resolved before finalisation.';
  end if;

  if v_version.status = 'signed' then
    select * into v_existing_signature
    from public.rental_document_signatures rds
    where rds.organization_id = v_document.organization_id
      and rds.document_version_id = v_version.id
      and rds.signer_role = 'authorised_business_signatory'
    limit 1;

    if not found then
      raise exception 'Signed rental document version is missing its authorised business signature.';
    end if;

    if v_existing_signature.content_hash_at_signing <> v_version.content_hash
      or v_existing_signature.content_hash_at_signing <> p_final_content_hash
      or v_existing_signature.signature_storage_bucket <> p_signature_storage_bucket
      or v_existing_signature.signature_storage_path <> p_signature_storage_path
    then
      raise exception 'Existing signature conflicts with the requested finalisation.';
    end if;

    return query
      select v_document.id, v_version.id, v_existing_signature.id, v_document.status, v_version.status, v_version.finalised_at, v_version.content_hash;
    return;
  end if;

  if v_version.status not in ('draft', 'finalised') then
    raise exception 'Rental document version is not in a finalisable state.';
  end if;

  if v_version.status = 'draft' and v_version.content_hash <> p_current_content_hash then
    raise exception 'Current content hash does not match the stored draft version.';
  end if;

  if v_version.status = 'finalised' and v_version.content_hash <> p_final_content_hash then
    raise exception 'Finalised content hash does not match the requested signature.';
  end if;

  if v_version.final_pdf_storage_path is not null
    and v_version.final_pdf_storage_path <> p_final_pdf_storage_path
  then
    raise exception 'A different final PDF is already recorded for this version.';
  end if;

  v_finalised_at := coalesce(v_version.finalised_at, now());

  if v_version.status = 'draft' then
    update public.rental_document_versions rdv
      set pdf_storage_bucket = p_final_pdf_storage_bucket,
          pdf_storage_path = p_final_pdf_storage_path,
          final_pdf_storage_bucket = p_final_pdf_storage_bucket,
          final_pdf_storage_path = p_final_pdf_storage_path,
          final_pdf_generated_at = coalesce(p_final_pdf_generated_at, now()),
          content_hash = p_final_content_hash,
          status = 'finalised',
          finalised_at = v_finalised_at
    where rdv.id = v_version.id
      and rdv.organization_id = v_document.organization_id
      and rdv.status = 'draft'
    returning * into v_version;
  end if;

  select * into v_existing_signature
  from public.rental_document_signatures rds
  where rds.organization_id = v_document.organization_id
    and rds.document_version_id = v_version.id
    and rds.signer_role = 'authorised_business_signatory'
  limit 1;

  if found then
    if v_existing_signature.content_hash_at_signing <> p_final_content_hash
      or v_existing_signature.signature_storage_bucket <> p_signature_storage_bucket
      or v_existing_signature.signature_storage_path <> p_signature_storage_path
    then
      raise exception 'Existing signature conflicts with the requested finalisation.';
    end if;
  else
    insert into public.rental_document_signatures (
      organization_id, document_version_id, signer_role, signer_name, signer_user_id,
      signature_storage_bucket, signature_storage_path, signed_at, verification_method,
      consent_text_version, content_hash_at_signing, metadata
    )
    values (
      v_document.organization_id, v_version.id, 'authorised_business_signatory', p_signer_name, p_signer_user_id,
      p_signature_storage_bucket, p_signature_storage_path, now(), 'stored_business_authorisation',
      nullif(trim(coalesce(p_consent_text_version, '')), ''), p_final_content_hash, coalesce(p_signature_metadata, '{}'::jsonb)
    )
    returning * into v_existing_signature;
  end if;

  update public.rental_document_versions rdv
    set status = 'signed'
  where rdv.id = v_version.id
    and rdv.organization_id = v_document.organization_id
  returning * into v_version;

  update public.rental_documents rd
    set current_version_id = v_version.id,
        status = 'partially_signed',
        finalised_at = v_finalised_at
  where rd.id = v_document.id
    and rd.organization_id = v_document.organization_id
  returning * into v_document;

  return query
    select v_document.id, v_version.id, v_existing_signature.id, v_document.status, v_version.status, v_version.finalised_at, v_version.content_hash;
end;
$$;

revoke all on function public.finalise_rental_document_version(
  uuid, uuid, text, text, text, text, timestamptz, uuid, text, text, text, text, jsonb
) from public;

grant execute on function public.finalise_rental_document_version(
  uuid, uuid, text, text, text, text, timestamptz, uuid, text, text, text, text, jsonb
) to authenticated;
