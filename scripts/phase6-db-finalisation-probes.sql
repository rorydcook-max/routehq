do $$
declare
  org_id uuid := gen_random_uuid();
  user_id uuid := gen_random_uuid();
  category_id uuid := gen_random_uuid();
  vehicle_id uuid := gen_random_uuid();
  rental_id uuid := gen_random_uuid();
  document_id uuid := gen_random_uuid();
  version_id uuid := gen_random_uuid();
  blocked boolean := false;
begin
  insert into auth.users (id, email, role, aud)
  values (user_id, 'phase6-validation@example.invalid', 'authenticated', 'authenticated');

  insert into public.organizations (id, name, slug, country_code, timezone, default_locale, fallback_locale, currency, supported_locales, supported_currencies, settings, created_by)
  values (org_id, 'Phase 6 Validation', 'phase6-validation-' || replace(org_id::text, '-', ''), 'TH', 'Asia/Bangkok', 'en', 'en', 'THB', array['en'], array['THB'], '{}', user_id);

  insert into public.vehicle_categories (id, organization_id, code, name)
  values (category_id, org_id, 'phase6_validation', 'Phase 6 Validation');

  insert into public.vehicles (id, organization_id, category_id, make, model, registration_number, status, availability_status, created_by)
  values (vehicle_id, org_id, category_id, 'Validation', 'Vehicle', 'PHASE6', 'available', 'available_now', user_id);

  insert into public.rentals (id, organization_id, vehicle_id, status, start_date, pricing_model, rental_rate, deposit_amount, created_by)
  values (rental_id, org_id, vehicle_id, 'booked', now(), 'daily', 1000, 5000, user_id);

  insert into public.rental_documents (id, organization_id, rental_id, document_type, status, created_by)
  values (document_id, org_id, rental_id, 'rental_agreement', 'finalised', user_id);

  insert into public.rental_document_versions (
    id,
    organization_id,
    document_id,
    version_number,
    rendered_html_snapshot,
    rendered_data_snapshot,
    business_snapshot,
    content_hash,
    status,
    finalised_at,
    draft_pdf_storage_bucket,
    draft_pdf_storage_path,
    final_pdf_storage_bucket,
    final_pdf_storage_path,
    final_pdf_generated_at,
    created_by
  )
  values (
    version_id,
    org_id,
    document_id,
    1,
    '<p>final</p>',
    '{}',
    '{}',
    repeat('f', 64),
    'finalised',
    now(),
    'documents',
    'organizations/test/draft.pdf',
    'documents',
    'organizations/test/final.pdf',
    now(),
    user_id
  );

  update public.rental_documents
  set current_version_id = version_id
  where id = document_id;

  insert into public.rental_document_signatures (organization_id, document_version_id, signer_role, signer_name, signed_at, verification_method, content_hash_at_signing)
  values (org_id, version_id, 'authorised_business_signatory', 'Validation Signatory', now(), 'stored_business_authorisation', repeat('f', 64));

  begin
    insert into public.rental_document_signatures (organization_id, document_version_id, signer_role, signer_name, signed_at, verification_method, content_hash_at_signing)
    values (org_id, version_id, 'authorised_business_signatory', 'Validation Signatory', now(), 'stored_business_authorisation', repeat('f', 64));
  exception when others then
    blocked := true;
  end;

  if not blocked then
    raise exception 'duplicate business signature was not blocked';
  end if;

  raise exception 'PHASE6_FINALISATION_PROBES_PASSED_ROLLBACK';
end $$;
