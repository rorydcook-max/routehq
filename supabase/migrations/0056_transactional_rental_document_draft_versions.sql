-- Transactional draft version creation for rental document versions.

create or replace function public.create_rental_document_draft_version(
  p_organization_id uuid,
  p_document_id uuid,
  p_rendered_html_snapshot text,
  p_rendered_data_snapshot jsonb,
  p_business_snapshot jsonb,
  p_content_hash text,
  p_template_id uuid default null,
  p_template_version integer default null,
  p_pdf_storage_bucket text default null,
  p_pdf_storage_path text default null,
  p_draft_pdf_storage_bucket text default null,
  p_draft_pdf_storage_path text default null,
  p_draft_pdf_generated_at timestamptz default null,
  p_final_pdf_storage_bucket text default null,
  p_final_pdf_storage_path text default null,
  p_final_pdf_generated_at timestamptz default null,
  p_supersedes_version_id uuid default null,
  p_generated_at timestamptz default null,
  p_created_by uuid default null
)
returns public.rental_document_versions
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_id uuid := auth.uid();
  v_document public.rental_documents%rowtype;
  v_superseded public.rental_document_versions%rowtype;
  v_next_version_number integer;
  v_version public.rental_document_versions%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select * into v_document
  from public.rental_documents rd
  where rd.id = p_document_id
  for update;

  if not found then
    raise exception 'Rental document was not found.';
  end if;

  if v_document.organization_id is distinct from p_organization_id then
    raise exception 'Rental document organization mismatch.';
  end if;

  if not public.has_org_role(v_document.organization_id, array['owner','manager','operator']::public.organization_role[]) then
    raise exception 'You do not have permission to create rental document versions for this organization.';
  end if;

  if v_document.status in ('signed', 'void') then
    raise exception 'Signed or void rental documents cannot receive new draft versions.';
  end if;

  if not exists (
    select 1
    from public.rentals r
    where r.id = v_document.rental_id
      and r.organization_id = v_document.organization_id
  ) then
    raise exception 'Rental document rental ownership mismatch.';
  end if;

  if p_template_id is not null and not exists (
    select 1
    from public.contract_templates ct
    where ct.id = p_template_id
      and (ct.organization_id is null or ct.organization_id = v_document.organization_id)
  ) then
    raise exception 'Template organization mismatch.';
  end if;

  if p_supersedes_version_id is not null then
    select * into v_superseded
    from public.rental_document_versions rdv
    where rdv.id = p_supersedes_version_id
      and rdv.organization_id = v_document.organization_id
      and rdv.document_id = v_document.id;

    if not found then
      raise exception 'Superseded version organization mismatch.';
    end if;
  end if;

  if nullif(trim(coalesce(p_rendered_html_snapshot, '')), '') is null
    or p_rendered_data_snapshot is null
    or p_business_snapshot is null
    or nullif(trim(coalesce(p_content_hash, '')), '') is null
  then
    raise exception 'Rendered snapshots and content hash are required.';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next_version_number
  from public.rental_document_versions rdv
  where rdv.organization_id = v_document.organization_id
    and rdv.document_id = v_document.id;

  insert into public.rental_document_versions (
    organization_id,
    document_id,
    version_number,
    template_id,
    template_version,
    rendered_html_snapshot,
    rendered_data_snapshot,
    business_snapshot,
    pdf_storage_bucket,
    pdf_storage_path,
    draft_pdf_storage_bucket,
    draft_pdf_storage_path,
    draft_pdf_generated_at,
    final_pdf_storage_bucket,
    final_pdf_storage_path,
    final_pdf_generated_at,
    content_hash,
    status,
    generated_at,
    supersedes_version_id,
    created_by
  )
  values (
    v_document.organization_id,
    v_document.id,
    v_next_version_number,
    p_template_id,
    p_template_version,
    p_rendered_html_snapshot,
    p_rendered_data_snapshot,
    p_business_snapshot,
    p_pdf_storage_bucket,
    p_pdf_storage_path,
    p_draft_pdf_storage_bucket,
    p_draft_pdf_storage_path,
    p_draft_pdf_generated_at,
    p_final_pdf_storage_bucket,
    p_final_pdf_storage_path,
    p_final_pdf_generated_at,
    p_content_hash,
    'draft',
    coalesce(p_generated_at, now()),
    p_supersedes_version_id,
    coalesce(p_created_by, v_actor_id)
  )
  returning * into v_version;

  update public.rental_documents rd
    set current_version_id = v_version.id,
        status = 'draft'
  where rd.id = v_document.id
    and rd.organization_id = v_document.organization_id;

  return v_version;
end;
$$;

revoke all on function public.create_rental_document_draft_version(
  uuid, uuid, text, jsonb, jsonb, text, uuid, integer, text, text, text, text, timestamptz, text, text, timestamptz, uuid, timestamptz, uuid
) from public;

grant execute on function public.create_rental_document_draft_version(
  uuid, uuid, text, jsonb, jsonb, text, uuid, integer, text, text, text, text, timestamptz, text, text, timestamptz, uuid, timestamptz, uuid
) to authenticated;
