do $$
declare
  v_actor_id uuid;
  v_organization_id uuid;
  v_original_settings jsonb;
  v_rental_id uuid;
  v_document_id uuid := gen_random_uuid();
  v_version_one public.rental_document_versions%rowtype;
  v_version_two public.rental_document_versions%rowtype;
  v_valid_path text;
  v_probe record;
begin
  select
    om.user_id,
    r.organization_id,
    o.settings,
    r.id
  into
    v_actor_id,
    v_organization_id,
    v_original_settings,
    v_rental_id
  from public.rentals r
  join public.organizations o on o.id = r.organization_id
  join public.organization_members om on om.organization_id = r.organization_id
  where om.is_active is true
    and om.role in ('owner', 'manager', 'operator')
    and (
      coalesce((o.settings ->> 'rental_document_engine_enabled')::boolean, false) is true
      or coalesce((o.settings ->> 'experimental_rental_document_engine_enabled')::boolean, false) is true
    )
  order by r.created_at desc
  limit 1;

  if v_actor_id is null then
    raise exception 'phase9 probe setup failed: no enabled rental/operator context found';
  end if;

  perform set_config('request.jwt.claim.sub', v_actor_id::text, true);

  insert into public.rental_documents (
    id, organization_id, rental_id, document_type, status, source_event_type, created_by
  )
  values (
    v_document_id, v_organization_id, v_rental_id, 'rental_agreement', 'draft', 'phase9_adversarial_probe', v_actor_id
  );

  select * into v_version_one
  from public.create_rental_document_draft_version(
    p_organization_id => v_organization_id,
    p_document_id => v_document_id,
    p_rendered_html_snapshot => '<p>Phase 9 probe v1</p>',
    p_rendered_data_snapshot => '{"warnings":[],"variables":{"renter_full_name":"Probe","vehicle_registration":"QA","rental_start_date":"2026-07-15","contracted_rate":"1","billing_period":"monthly"}}'::jsonb,
    p_business_snapshot => jsonb_build_object(
      'legal_name', 'Phase 9 Probe Legal Co',
      'authorised_signatory', jsonb_build_object(
        'name', 'Phase 9 Probe',
        'title', 'Director',
        'signature_authorised_at', now()::text,
        'signature_authorisation_text_version', 'phase9-probe'
      ),
      'authorised_signature', jsonb_build_object(
        'kind', 'storage',
        'bucket', 'branding',
        'path', v_organization_id::text || '/branding/signatures/phase9-probe.png'
      )
    ),
    p_content_hash => 'phase9-hash-v1'
  );

  select * into v_version_two
  from public.create_rental_document_draft_version(
    p_organization_id => v_organization_id,
    p_document_id => v_document_id,
    p_rendered_html_snapshot => '<p>Phase 9 probe v2</p>',
    p_rendered_data_snapshot => '{"warnings":[],"variables":{"renter_full_name":"Probe","vehicle_registration":"QA","rental_start_date":"2026-07-15","contracted_rate":"1","billing_period":"monthly"}}'::jsonb,
    p_business_snapshot => jsonb_build_object(
      'legal_name', 'Phase 9 Probe Legal Co',
      'authorised_signatory', jsonb_build_object(
        'name', 'Phase 9 Probe',
        'title', 'Director',
        'signature_authorised_at', now()::text,
        'signature_authorisation_text_version', 'phase9-probe'
      ),
      'authorised_signature', jsonb_build_object(
        'kind', 'storage',
        'bucket', 'branding',
        'path', v_organization_id::text || '/branding/signatures/phase9-probe.png'
      )
    ),
    p_content_hash => 'phase9-hash-v2',
    p_supersedes_version_id => v_version_one.id
  );

  if v_version_one.version_number <> 1 or v_version_two.version_number <> 2 then
    raise exception 'phase9_concurrent_draft_creation sequential numbering failed';
  end if;

  if not exists (
    select 1
    from public.rental_documents
    where id = v_document_id
      and current_version_id = v_version_two.id
  ) then
    raise exception 'phase9_current_version_id_latest_draft failed';
  end if;

  v_valid_path :=
    'organizations/' || v_organization_id ||
    '/rentals/' || v_rental_id ||
    '/rental-documents/' || v_document_id ||
    '/versions/' || v_version_two.id ||
    '/final-phase9.pdf';

  for v_probe in
    select *
    from (values
      ('phase9_wrong_bucket', 'Invalid final PDF storage bucket', 'branding', v_valid_path, v_version_two.content_hash, v_version_two.content_hash),
      ('phase9_traversal_path', 'Invalid final PDF storage path', 'documents', '../outside.pdf', v_version_two.content_hash, v_version_two.content_hash),
      ('phase9_external_url', 'Invalid final PDF storage path', 'documents', 'https://example.invalid/final.pdf', v_version_two.content_hash, v_version_two.content_hash),
      ('phase9_wrong_rental_path', 'Final PDF path does not match', 'documents', replace(v_valid_path, v_rental_id::text, gen_random_uuid()::text), v_version_two.content_hash, v_version_two.content_hash),
      ('phase9_wrong_document_path', 'Final PDF path does not match', 'documents', replace(v_valid_path, v_document_id::text, gen_random_uuid()::text), v_version_two.content_hash, v_version_two.content_hash),
      ('phase9_wrong_version_path', 'Final PDF path does not match', 'documents', replace(v_valid_path, v_version_two.id::text, gen_random_uuid()::text), v_version_two.content_hash, v_version_two.content_hash),
      ('phase9_stale_hash', 'Current content hash does not match', 'documents', v_valid_path, 'stale-hash', v_version_two.content_hash)
    ) as t(label, expected, bucket, path, current_hash, final_hash)
  loop
    begin
      perform *
      from public.finalise_rental_document_version(
        v_organization_id,
        v_version_two.id,
        v_probe.current_hash,
        v_probe.final_hash,
        v_probe.bucket,
        v_probe.path,
        now(),
        v_actor_id,
        'Phase 9 Probe',
        'branding',
        v_organization_id::text || '/branding/signatures/phase9-probe.png',
        'phase9-probe',
        '{}'::jsonb
      );
      raise exception '% failed', v_probe.label;
    exception
      when others then
        if position(lower(v_probe.expected) in lower(sqlerrm)) = 0 then
          raise exception '% unexpected error: %', v_probe.label, sqlerrm;
        end if;
    end;
  end loop;

  begin
    perform *
    from public.finalise_rental_document_version(
      v_organization_id,
      v_version_one.id,
      v_version_one.content_hash,
      v_version_one.content_hash,
      'documents',
      replace(v_valid_path, v_version_two.id::text, v_version_one.id::text),
      now(),
      v_actor_id,
      'Phase 9 Probe',
      'branding',
      v_organization_id::text || '/branding/signatures/phase9-probe.png',
      'phase9-probe',
      '{}'::jsonb
    );
    raise exception 'phase9_stale_version failed';
  exception
    when others then
      if position('current rental document version' in lower(sqlerrm)) = 0 then
        raise exception 'phase9_stale_version unexpected error: %', sqlerrm;
      end if;
  end;

  update public.organizations
  set settings = coalesce(settings, '{}'::jsonb)
    || '{"rental_document_engine_enabled":false,"experimental_rental_document_engine_enabled":false}'::jsonb
  where id = v_organization_id;

  begin
    perform *
    from public.finalise_rental_document_version(
      v_organization_id,
      v_version_two.id,
      v_version_two.content_hash,
      v_version_two.content_hash,
      'documents',
      v_valid_path,
      now(),
      v_actor_id,
      'Phase 9 Probe',
      'branding',
      v_organization_id::text || '/branding/signatures/phase9-probe.png',
      'phase9-probe',
      '{}'::jsonb
    );
    raise exception 'phase9_feature_disabled failed';
  exception
    when others then
      if position('engine is disabled' in lower(sqlerrm)) = 0 then
        raise exception 'phase9_feature_disabled unexpected error: %', sqlerrm;
      end if;
  end;

  update public.organizations
  set settings = v_original_settings
  where id = v_organization_id;

  delete from public.rental_document_versions where document_id = v_document_id;
  delete from public.rental_documents where id = v_document_id;
exception
  when others then
    update public.organizations
    set settings = v_original_settings
    where id = v_organization_id;
    delete from public.rental_document_versions where document_id = v_document_id;
    delete from public.rental_documents where id = v_document_id;
    raise;
end $$;
