-- 0065: finalise delivery and return inspection reports as immutable documents.
--
-- Until now an inspection's evidence (odometer, fuel, damage, photos and the
-- customer's signature) lived only in public.inspections, an ordinary mutable
-- table. This adds finalise_inspection_report, which turns a submitted
-- delivery or return inspection into a rental document of type
-- delivery_report / return_report, in one transaction:
--
--   * caller must be owner, manager or operator of the organisation
--   * inspection must be a submitted delivery/return with a customer signature
--   * at most one report per inspection (also enforced by a unique index)
--   * the content hash is computed here from the HTML, never trusted from the app
--   * storage paths use the same traversal rules as agreement finalisation
--
-- The document, a signed version and the customer's signature are inserted
-- together; the existing triggers on rental_document_versions and
-- rental_document_signatures then make them immutable.
--
-- The agreement finalisation RPC is deliberately untouched: its checks
-- (authorised signatory, renter, rate, billing period) are agreement-specific.

create unique index if not exists rental_documents_one_report_per_inspection
  on public.rental_documents (organization_id, source_event_id)
  where source_event_type = 'inspection';

create or replace function public.finalise_inspection_report(
  p_organization_id uuid,
  p_inspection_id uuid,
  p_document_id uuid,
  p_version_id uuid,
  p_rendered_html_snapshot text,
  p_rendered_data_snapshot jsonb,
  p_content_hash text,
  p_pdf_storage_bucket text,
  p_pdf_storage_path text,
  p_signature_storage_bucket text,
  p_signature_storage_path text,
  p_signer_name text
)
returns table (document_id uuid, document_version_id uuid, signature_id uuid, document_type text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inspection public.inspections%rowtype;
  v_document_type text;
  v_hash text;
  v_prefix text;
  v_path text;
  v_signature_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.has_org_role(p_organization_id, array['owner','manager','operator']::public.organization_role[]) then
    raise exception 'You do not have permission to finalise inspection reports for this organization.';
  end if;

  select * into v_inspection
  from public.inspections
  where id = p_inspection_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Inspection was not found.';
  end if;

  v_document_type := case v_inspection.inspection_type
    when 'delivery' then 'delivery_report'
    when 'return' then 'return_report'
  end;

  if v_document_type is null then
    raise exception 'Only delivery and return inspections produce a report.';
  end if;

  if v_inspection.rental_id is null then
    raise exception 'Inspection is not linked to a rental.';
  end if;

  if v_inspection.status is distinct from 'submitted' then
    raise exception 'Inspection has not been submitted.';
  end if;

  if nullif(trim(coalesce(v_inspection.customer_signature, '')), '') is null then
    raise exception 'Inspection has no customer signature.';
  end if;

  if exists (
    select 1 from public.rental_documents rd
    where rd.organization_id = p_organization_id
      and rd.source_event_type = 'inspection'
      and rd.source_event_id = p_inspection_id
  ) then
    raise exception 'A report already exists for this inspection.';
  end if;

  if nullif(trim(coalesce(p_rendered_html_snapshot, '')), '') is null then
    raise exception 'Report content is missing.';
  end if;

  v_hash := encode(sha256(convert_to(p_rendered_html_snapshot, 'UTF8')), 'hex');
  if p_content_hash is distinct from v_hash then
    raise exception 'Content hash does not match the report content.';
  end if;

  if nullif(trim(coalesce(p_signer_name, '')), '') is null then
    raise exception 'Signer name is required.';
  end if;

  if p_pdf_storage_bucket is distinct from 'documents' or p_signature_storage_bucket is distinct from 'documents' then
    raise exception 'Invalid storage bucket.';
  end if;

  v_prefix :=
    'organizations/' || p_organization_id::text ||
    '/rentals/' || v_inspection.rental_id::text ||
    '/rental-documents/' || p_document_id::text ||
    '/versions/' || p_version_id::text || '/';

  foreach v_path in array array[p_pdf_storage_path, p_signature_storage_path] loop
    if v_path is null
      or length(v_path) > 512
      or v_path like '/%'
      or v_path like '%//%'
      or v_path like '%..%'
      or position(chr(92) in v_path) > 0
      or v_path like '%://%'
      or v_path like '%?%'
      or v_path like '%#%'
      or position('%2e' in lower(v_path)) > 0
      or position('%2f' in lower(v_path)) > 0
      or position('%5c' in lower(v_path)) > 0
      or v_path not like v_prefix || '%'
    then
      raise exception 'Invalid storage path.';
    end if;
  end loop;

  if substring(p_pdf_storage_path from length(v_prefix) + 1) !~ '^report-[-A-Za-z0-9_]+\.pdf$' then
    raise exception 'Invalid report file name.';
  end if;

  if substring(p_signature_storage_path from length(v_prefix) + 1) !~ '^customer-signature-[-A-Za-z0-9_]+\.png$' then
    raise exception 'Invalid signature file name.';
  end if;

  insert into public.rental_documents (
    id, organization_id, rental_id, document_type, status,
    source_event_type, source_event_id, created_by, finalised_at
  ) values (
    p_document_id, p_organization_id, v_inspection.rental_id, v_document_type, 'signed',
    'inspection', p_inspection_id, auth.uid(), now()
  );

  insert into public.rental_document_versions (
    id, organization_id, document_id, version_number, template_version,
    rendered_html_snapshot, rendered_data_snapshot, content_hash, status,
    generated_at, finalised_at, created_by,
    pdf_storage_bucket, pdf_storage_path,
    final_pdf_storage_bucket, final_pdf_storage_path, final_pdf_generated_at
  ) values (
    p_version_id, p_organization_id, p_document_id, 1, 1,
    p_rendered_html_snapshot, coalesce(p_rendered_data_snapshot, '{}'::jsonb), v_hash, 'signed',
    now(), now(), auth.uid(),
    p_pdf_storage_bucket, p_pdf_storage_path,
    p_pdf_storage_bucket, p_pdf_storage_path, now()
  );

  update public.rental_documents
  set current_version_id = p_version_id
  where id = p_document_id;

  insert into public.rental_document_signatures (
    organization_id, document_version_id, signer_role, signer_name, signer_user_id,
    signature_storage_bucket, signature_storage_path, signed_at,
    verification_method, consent_text_version, content_hash_at_signing, metadata
  ) values (
    p_organization_id, p_version_id, 'renter', trim(p_signer_name), null,
    p_signature_storage_bucket, p_signature_storage_path, coalesce(v_inspection.customer_signed_at, now()),
    'in_person_inspection', 'inspection-report-v1', v_hash,
    jsonb_build_object(
      'inspection_id', p_inspection_id,
      'inspection_type', v_inspection.inspection_type,
      'signature_captured_at', v_inspection.customer_signed_at,
      'recorded_by', auth.uid()
    )
  )
  returning id into v_signature_id;

  return query select p_document_id, p_version_id, v_signature_id, v_document_type;
end;
$$;

revoke all on function public.finalise_inspection_report(uuid, uuid, uuid, uuid, text, jsonb, text, text, text, text, text, text) from public;
grant execute on function public.finalise_inspection_report(uuid, uuid, uuid, uuid, text, jsonb, text, text, text, text, text, text) to authenticated;
