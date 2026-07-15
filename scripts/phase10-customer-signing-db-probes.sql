do $$
declare
  v_org public.organizations%rowtype;
  v_rental public.rentals%rowtype;
  v_old_settings jsonb;
  v_old_mode text;
  v_token text := 'phase10-probe-' || replace(gen_random_uuid()::text, '-', '');
  v_link_id uuid;
  v_document_id uuid := gen_random_uuid();
  v_version_id uuid := gen_random_uuid();
  v_hash text := repeat('a', 64);
  v_ack jsonb := jsonb_build_array(
    jsonb_build_object('type','agreement_reviewed','textVersion','phase10','text','Agreement reviewed.'),
    jsonb_build_object('type','early_termination','textVersion','phase10','text','Early termination understood.'),
    jsonb_build_object('type','damage_responsibility','textVersion','phase10','text','Damage responsibility understood.'),
    jsonb_build_object('type','insurance','textVersion','phase10','text','Insurance understood.'),
    jsonb_build_object('type','electronic_signature_records','textVersion','phase10','text','Electronic signature consent.'),
    jsonb_build_object('type','data_handling','textVersion','phase10','text','Data handling understood.')
  );
  v_result record;
begin
  select * into v_org
  from public.organizations
  where deleted_at is null
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'phase10 setup failed: no organization found';
  end if;

  select * into v_rental
  from public.rentals
  where organization_id = v_org.id
    and deleted_at is null
    and vehicle_id is not null
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'phase10 setup failed: no rental found';
  end if;

  v_old_settings := v_org.settings;
  v_old_mode := coalesce(v_rental.contract_authority_mode, 'legacy');

  update public.organizations
    set settings = coalesce(settings, '{}'::jsonb)
      || '{"rental_document_engine_enabled":true,"experimental_rental_document_engine_enabled":true,"rental_document_customer_signing_enabled":false}'::jsonb
  where id = v_org.id;

  update public.rentals
    set contract_authority_mode = 'rental_document_engine'
  where id = v_rental.id
    and organization_id = v_org.id;

  insert into public.booking_links (
    organization_id, rental_id, vehicle_id, customer_id, contract_id, token, status,
    data_type, delivery_method, booking_data, included_items, share_channels, expires_at
  )
  values (
    v_org.id, v_rental.id, v_rental.vehicle_id, v_rental.customer_id, v_rental.contract_id, v_token, 'pending',
    'rental_booking', coalesce(v_rental.delivery_method, 'delivery'), '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, now() + interval '1 day'
  )
  returning id into v_link_id;

  insert into public.rental_documents (
    id, organization_id, rental_id, legacy_contract_id, document_type, status, source_event_type
  )
  values (
    v_document_id, v_org.id, v_rental.id, v_rental.contract_id, 'rental_agreement', 'partially_signed', 'phase10_probe'
  );

  insert into public.rental_document_versions (
    id, organization_id, document_id, version_number, rendered_html_snapshot, rendered_data_snapshot,
    business_snapshot, pdf_storage_bucket, pdf_storage_path, final_pdf_storage_bucket,
    final_pdf_storage_path, final_pdf_generated_at, content_hash, status, finalised_at
  )
  values (
    v_version_id, v_org.id, v_document_id, 1, '<html><body>phase10 probe</body></html>',
    jsonb_build_object('variables', jsonb_build_object('renter_full_name','Phase Ten Probe'), 'rental_id', v_rental.id, 'vehicle_id', v_rental.vehicle_id, 'customer_id', v_rental.customer_id),
    jsonb_build_object('legal_name', coalesce(v_org.legal_name, v_org.name)),
    'documents',
    'organizations/' || v_org.id || '/rentals/' || v_rental.id || '/rental-documents/' || v_document_id || '/versions/' || v_version_id || '/final-phase10.pdf',
    'documents',
    'organizations/' || v_org.id || '/rentals/' || v_rental.id || '/rental-documents/' || v_document_id || '/versions/' || v_version_id || '/final-phase10.pdf',
    now(), v_hash, 'signed', now()
  );

  update public.rental_documents
    set current_version_id = v_version_id
  where id = v_document_id;

  insert into public.rental_document_signatures (
    organization_id, document_version_id, signer_role, signer_name, signature_storage_bucket,
    signature_storage_path, verification_method, content_hash_at_signing
  )
  values (
    v_org.id, v_version_id, 'authorised_business_signatory', 'Phase Ten Business', 'branding',
    v_org.id || '/branding/signatures/phase10.png', 'probe', v_hash
  );

  begin
    perform * from public.complete_rental_document_customer_signing(
      v_token, 'documents',
      'organizations/' || v_org.id || '/rentals/' || v_rental.id || '/rental-documents/' || v_document_id || '/versions/' || v_version_id || '/signatures/renter-disabled.png',
      'Phase Ten Probe', '127.0.0.1', 'phase10-probe', v_ack, 'documents',
      'organizations/' || v_org.id || '/rentals/' || v_rental.id || '/rental-documents/' || v_document_id || '/versions/' || v_version_id || '/execution/execution-certificate-disabled.pdf',
      'PHASE10-DISABLED', '{}'::jsonb
    );
    raise exception 'phase10 probe failed: feature disabled signing was allowed';
  exception when others then
    if position('customer signing is disabled' in lower(sqlerrm)) = 0 then
      raise;
    end if;
  end;

  update public.organizations
    set settings = coalesce(settings, '{}'::jsonb)
      || '{"rental_document_engine_enabled":true,"experimental_rental_document_engine_enabled":true,"rental_document_customer_signing_enabled":true}'::jsonb
  where id = v_org.id;

  begin
    perform * from public.complete_rental_document_customer_signing(
      v_token, 'documents', '../escape.png', 'Phase Ten Probe', '127.0.0.1', 'phase10-probe',
      v_ack, 'documents',
      'organizations/' || v_org.id || '/rentals/' || v_rental.id || '/rental-documents/' || v_document_id || '/versions/' || v_version_id || '/execution/execution-certificate-invalid.pdf',
      'PHASE10-BADPATH', '{}'::jsonb
    );
    raise exception 'phase10 probe failed: malformed signature path was allowed';
  exception when others then
    if position('invalid renter signature storage path' in lower(sqlerrm)) = 0 then
      raise;
    end if;
  end;

  select * into v_result
  from public.complete_rental_document_customer_signing(
    v_token, 'documents',
    'organizations/' || v_org.id || '/rentals/' || v_rental.id || '/rental-documents/' || v_document_id || '/versions/' || v_version_id || '/signatures/renter-good.png',
    'Phase Ten Probe', '127.0.0.1', 'phase10-probe', v_ack, 'documents',
    'organizations/' || v_org.id || '/rentals/' || v_rental.id || '/rental-documents/' || v_document_id || '/versions/' || v_version_id || '/execution/execution-certificate-good.pdf',
    'PHASE10-GOOD', '{}'::jsonb
  );

  if v_result.signature_id is null or v_result.certificate_id is null then
    raise exception 'phase10 probe failed: signing result incomplete';
  end if;

  perform * from public.complete_rental_document_customer_signing(
    v_token, 'documents',
    'organizations/' || v_org.id || '/rentals/' || v_rental.id || '/rental-documents/' || v_document_id || '/versions/' || v_version_id || '/signatures/renter-good.png',
    'Phase Ten Probe', '127.0.0.1', 'phase10-probe', v_ack, 'documents',
    'organizations/' || v_org.id || '/rentals/' || v_rental.id || '/rental-documents/' || v_document_id || '/versions/' || v_version_id || '/execution/execution-certificate-good.pdf',
    'PHASE10-GOOD', '{}'::jsonb
  );

  if (
    select count(*)
    from public.rental_document_signatures
    where document_version_id = v_version_id
      and signer_role = 'renter'
  ) <> 1 then
    raise exception 'phase10 probe failed: duplicate submission was not idempotent';
  end if;

  begin
    perform * from public.complete_rental_document_customer_signing(
      v_token, 'documents',
      'organizations/' || v_org.id || '/rentals/' || v_rental.id || '/rental-documents/' || v_document_id || '/versions/' || v_version_id || '/signatures/renter-conflict.png',
      'Different Renter', '127.0.0.1', 'phase10-probe', v_ack, 'documents',
      'organizations/' || v_org.id || '/rentals/' || v_rental.id || '/rental-documents/' || v_document_id || '/versions/' || v_version_id || '/execution/execution-certificate-conflict.pdf',
      'PHASE10-CONFLICT', '{}'::jsonb
    );
    raise exception 'phase10 probe failed: conflicting second signature was allowed';
  exception when others then
    if position('conflicting renter signature' in lower(sqlerrm)) = 0 then
      raise;
    end if;
  end;

  begin
    update public.rental_document_acknowledgements
      set acknowledgement_text_snapshot = 'mutated'
    where document_version_id = v_version_id;
    raise exception 'phase10 probe failed: acknowledgement mutation was allowed';
  exception when others then
    if position('immutable' in lower(sqlerrm)) = 0 then
      raise;
    end if;
  end;

  update public.rentals
    set contract_authority_mode = v_old_mode,
        rental_document_executed_at = null
  where id = v_rental.id
    and organization_id = v_org.id;

  update public.organizations
    set settings = v_old_settings
  where id = v_org.id;

  update public.rental_documents
    set status = 'voided'
  where id = v_document_id;

  update public.booking_links
    set status = 'cancelled',
        cancelled_at = now()
  where id = v_link_id;
exception when others then
  update public.rentals
    set contract_authority_mode = v_old_mode,
        rental_document_executed_at = null
  where id = v_rental.id
    and organization_id = v_org.id;
  update public.organizations set settings = v_old_settings where id = v_org.id;
  update public.rental_documents set status = 'voided' where id = v_document_id;
  update public.booking_links
    set status = 'cancelled',
        cancelled_at = now()
  where id = v_link_id;
  raise;
end $$;
