do $$
declare
  v_actor_id uuid;
  v_organization_id uuid;
  v_rental_id uuid;
  v_document_id uuid;
  v_version_id uuid;
  v_content_hash text;
  v_valid_path text;
begin
  select
    om.user_id,
    rd.organization_id,
    rd.rental_id,
    rd.id,
    rdv.id,
    rdv.content_hash
  into
    v_actor_id,
    v_organization_id,
    v_rental_id,
    v_document_id,
    v_version_id,
    v_content_hash
  from public.rental_documents rd
  join public.rental_document_versions rdv on rdv.id = rd.current_version_id
  join public.organization_members om on om.organization_id = rd.organization_id
  join public.organizations o on o.id = rd.organization_id
  where om.is_active is true
    and om.role in ('owner', 'manager', 'operator')
    and (
      coalesce((o.settings ->> 'rental_document_engine_enabled')::boolean, false) is true
      or coalesce((o.settings ->> 'experimental_rental_document_engine_enabled')::boolean, false) is true
    )
  order by rd.created_at desc
  limit 1;

  if v_actor_id is null then
    raise exception 'phase8 probe setup failed: no enabled rental document context found';
  end if;

  perform set_config('request.jwt.claim.sub', v_actor_id::text, true);
  v_valid_path :=
    'organizations/' || v_organization_id ||
    '/rentals/' || v_rental_id ||
    '/rental-documents/' || v_document_id ||
    '/versions/' || v_version_id ||
    '/final-adversarial.pdf';

  begin
    perform *
    from public.finalise_rental_document_version(
      v_organization_id,
      v_version_id,
      v_content_hash,
      v_content_hash,
      'branding',
      v_valid_path,
      now(),
      v_actor_id,
      'Phase 8 Probe',
      'branding',
      v_organization_id::text || '/branding/signatures/phase8-probe.png',
      'phase8-probe',
      '{}'::jsonb
    );
    raise exception 'phase8_adversarial_wrong_bucket_rejected failed';
  exception
    when others then
      if position('invalid final pdf storage bucket' in lower(sqlerrm)) = 0 then
        raise exception 'phase8_adversarial_wrong_bucket_rejected unexpected error: %', sqlerrm;
      end if;
  end;

  begin
    perform *
    from public.finalise_rental_document_version(
      v_organization_id,
      v_version_id,
      v_content_hash,
      v_content_hash,
      'documents',
      '../outside.pdf',
      now(),
      v_actor_id,
      'Phase 8 Probe',
      'branding',
      v_organization_id::text || '/branding/signatures/phase8-probe.png',
      'phase8-probe',
      '{}'::jsonb
    );
    raise exception 'phase8_adversarial_traversal_path_rejected failed';
  exception
    when others then
      if position('invalid final pdf storage path' in lower(sqlerrm)) = 0 then
        raise exception 'phase8_adversarial_traversal_path_rejected unexpected error: %', sqlerrm;
      end if;
  end;
end $$;
