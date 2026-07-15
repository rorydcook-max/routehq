do $$
declare
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  category_a uuid := gen_random_uuid();
  category_b uuid := gen_random_uuid();
  vehicle_a uuid := gen_random_uuid();
  vehicle_b uuid := gen_random_uuid();
  customer_a uuid := gen_random_uuid();
  rental_a uuid := gen_random_uuid();
  rental_b uuid := gen_random_uuid();
  doc_a uuid := gen_random_uuid();
  version_a uuid := gen_random_uuid();
  final_version uuid := gen_random_uuid();
  signature_a uuid := gen_random_uuid();
  blocked boolean;
begin
  insert into auth.users (id, email, role, aud) values
    (user_a, 'phase5-validation@example.invalid', 'authenticated', 'authenticated');

  insert into public.organizations (id, name, slug, country_code, timezone, default_locale, fallback_locale, currency, supported_locales, supported_currencies, settings, created_by)
  values
    (org_a, 'Phase 5 Validation A', 'phase5-validation-a-' || replace(org_a::text, '-', ''), 'TH', 'Asia/Bangkok', 'en', 'en', 'THB', array['en'], array['THB'], '{}', user_a),
    (org_b, 'Phase 5 Validation B', 'phase5-validation-b-' || replace(org_b::text, '-', ''), 'TH', 'Asia/Bangkok', 'en', 'en', 'THB', array['en'], array['THB'], '{}', user_a);

  insert into public.vehicle_categories (id, organization_id, code, name)
  values
    (category_a, org_a, 'phase5_validation', 'Phase 5 Validation'),
    (category_b, org_b, 'phase5_validation', 'Phase 5 Validation');

  insert into public.vehicles (id, organization_id, category_id, make, model, registration_number, status, availability_status, created_by)
  values
    (vehicle_a, org_a, category_a, 'Validation', 'Vehicle', 'PHASE5-A', 'available', 'available_now', user_a),
    (vehicle_b, org_b, category_b, 'Validation', 'Vehicle', 'PHASE5-B', 'available', 'available_now', user_a);

  insert into public.customers (id, organization_id, full_name, created_by)
  values (customer_a, org_a, 'Validation Customer', user_a);

  insert into public.rentals (id, organization_id, vehicle_id, customer_id, status, start_date, pricing_model, rental_rate, deposit_amount, created_by)
  values
    (rental_a, org_a, vehicle_a, customer_a, 'booked', now(), 'daily', 1000, 5000, user_a),
    (rental_b, org_b, vehicle_b, null, 'booked', now(), 'daily', 1000, 5000, user_a);

  if (select early_termination_minimum_days from public.rentals where id = rental_a) is distinct from 3 then
    raise exception 'early_termination_minimum_days default failed';
  end if;

  update public.rentals set standard_daily_rate = 1200, rental_rate = 1000 where id = rental_a;
  if (select standard_daily_rate from public.rentals where id = rental_a) is distinct from 1200 then
    raise exception 'standard_daily_rate independence failed';
  end if;

  insert into public.rental_documents (id, organization_id, rental_id, document_type, created_by)
  values (doc_a, org_a, rental_a, 'rental_agreement', user_a);

  insert into public.rental_document_versions (id, organization_id, document_id, version_number, rendered_html_snapshot, rendered_data_snapshot, business_snapshot, content_hash, created_by)
  values (version_a, org_a, doc_a, 1, '<p>draft</p>', '{}', '{}', repeat('a', 64), user_a);

  update public.rental_document_versions
  set rendered_html_snapshot = '<p>draft updated</p>', content_hash = repeat('b', 64)
  where id = version_a;

  update public.rental_document_versions
  set status = 'finalised', finalised_at = now()
  where id = version_a;

  blocked := false;
  begin
    update public.rental_document_versions
    set rendered_html_snapshot = '<p>mutated final</p>'
    where id = version_a;
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'finalised version content update was not blocked';
  end if;

  blocked := false;
  begin
    delete from public.rental_document_versions where id = version_a;
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'version deletion was not blocked';
  end if;

  insert into public.rental_document_versions (id, organization_id, document_id, version_number, rendered_html_snapshot, rendered_data_snapshot, business_snapshot, content_hash, status, finalised_at, created_by)
  values (final_version, org_a, doc_a, 2, '<p>final</p>', '{}', '{}', repeat('c', 64), 'finalised', now(), user_a);

  insert into public.rental_document_signatures (id, organization_id, document_version_id, signer_role, signer_name, signed_at, verification_method, content_hash_at_signing)
  values (signature_a, org_a, final_version, 'renter', 'Validation Customer', now(), 'validation', repeat('c', 64));

  blocked := false;
  begin
    insert into public.rental_document_signatures (organization_id, document_version_id, signer_role, signer_name, signed_at, verification_method, content_hash_at_signing)
    values (org_a, final_version, 'renter', 'Validation Customer', now(), 'validation', repeat('d', 64));
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'mismatched signature hash was not blocked';
  end if;

  blocked := false;
  begin
    update public.rental_document_signatures set signer_name = 'Mutated' where id = signature_a;
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'signature update was not blocked';
  end if;

  blocked := false;
  begin
    delete from public.rental_document_signatures where id = signature_a;
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'signature deletion was not blocked';
  end if;

  blocked := false;
  begin
    insert into public.rental_documents (organization_id, rental_id, document_type, created_by)
    values (org_a, rental_b, 'rental_agreement', user_a);
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'cross-organization rental document was not blocked';
  end if;

  raise exception 'PHASE5_RUNTIME_PROBES_PASSED_ROLLBACK';
end $$;
