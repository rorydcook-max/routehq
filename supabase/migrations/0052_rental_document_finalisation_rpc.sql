-- Phase 7: database-side finalisation consistency for internal rental documents.
-- This migration is additive and does not modify legacy contracts or public booking flows.

create unique index if not exists activity_events_document_idempotency_idx
  on public.activity_events(organization_id, event_type, ((metadata ->> 'idempotency_key')))
  where metadata ? 'idempotency_key';

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
      or old.draft_pdf_storage_bucket is distinct from new.draft_pdf_storage_bucket
      or old.draft_pdf_storage_path is distinct from new.draft_pdf_storage_path
      or old.final_pdf_storage_bucket is distinct from new.final_pdf_storage_bucket
      or old.final_pdf_storage_path is distinct from new.final_pdf_storage_path
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
  v_existing_signature public.rental_document_signatures%rowtype;
  v_finalised_at timestamptz;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.has_org_role(p_organization_id, array['owner','manager','operator']::public.organization_role[]) then
    raise exception 'You do not have permission to finalise rental documents for this organization.';
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

  select *
    into v_version
  from public.rental_document_versions
  where id = p_document_version_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Rental document version was not found for this organization.';
  end if;

  select *
    into v_document
  from public.rental_documents
  where id = v_version.document_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Rental document was not found for this organization.';
  end if;

  if v_document.current_version_id is distinct from v_version.id then
    raise exception 'Only the current rental document version can be finalised.';
  end if;

  if v_document.document_type <> 'rental_agreement' then
    raise exception 'Only rental agreement documents can be finalised in this phase.';
  end if;

  if nullif(trim(v_version.rendered_html_snapshot), '') is null
    or v_version.rendered_data_snapshot is null
    or v_version.business_snapshot is null
  then
    raise exception 'Rendered snapshots are required before finalisation.';
  end if;

  if v_version.status = 'signed' then
    select *
      into v_existing_signature
    from public.rental_document_signatures
    where organization_id = p_organization_id
      and document_version_id = v_version.id
      and signer_role = 'authorised_business_signatory'
    limit 1;

    if not found then
      raise exception 'Signed rental document version is missing its authorised business signature.';
    end if;

    if v_existing_signature.content_hash_at_signing <> v_version.content_hash
      or v_existing_signature.content_hash_at_signing <> p_final_content_hash
    then
      raise exception 'Existing signature content hash conflicts with the requested finalisation.';
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
    update public.rental_document_versions
      set pdf_storage_bucket = p_final_pdf_storage_bucket,
          pdf_storage_path = p_final_pdf_storage_path,
          final_pdf_storage_bucket = p_final_pdf_storage_bucket,
          final_pdf_storage_path = p_final_pdf_storage_path,
          final_pdf_generated_at = coalesce(p_final_pdf_generated_at, now()),
          content_hash = p_final_content_hash,
          status = 'finalised',
          finalised_at = v_finalised_at
    where id = v_version.id
      and organization_id = p_organization_id
      and status = 'draft'
    returning * into v_version;
  end if;

  select *
    into v_existing_signature
  from public.rental_document_signatures
  where organization_id = p_organization_id
    and document_version_id = v_version.id
    and signer_role = 'authorised_business_signatory'
  limit 1;

  if found then
    if v_existing_signature.content_hash_at_signing <> p_final_content_hash then
      raise exception 'Existing signature content hash conflicts with the requested finalisation.';
    end if;
  else
    insert into public.rental_document_signatures (
      organization_id,
      document_version_id,
      signer_role,
      signer_name,
      signer_user_id,
      signature_storage_bucket,
      signature_storage_path,
      signed_at,
      verification_method,
      consent_text_version,
      content_hash_at_signing,
      metadata
    )
    values (
      p_organization_id,
      v_version.id,
      'authorised_business_signatory',
      p_signer_name,
      p_signer_user_id,
      p_signature_storage_bucket,
      p_signature_storage_path,
      now(),
      'stored_business_authorisation',
      nullif(trim(coalesce(p_consent_text_version, '')), ''),
      p_final_content_hash,
      coalesce(p_signature_metadata, '{}'::jsonb)
    )
    returning * into v_existing_signature;
  end if;

  update public.rental_document_versions
    set status = 'signed'
  where id = v_version.id
    and organization_id = p_organization_id
  returning * into v_version;

  update public.rental_documents
    set current_version_id = v_version.id,
        status = 'partially_signed',
        finalised_at = v_finalised_at
  where id = v_document.id
    and organization_id = p_organization_id
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
