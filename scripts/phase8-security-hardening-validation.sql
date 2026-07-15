select
  'phase8_hardened_finalisation_rpc_present' as check_name,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'finalise_rental_document_version'
  ) as passed
union all
select
  'phase8_finalisation_rejects_wrong_bucket' as check_name,
  pg_get_functiondef('public.finalise_rental_document_version(uuid, uuid, text, text, text, text, timestamptz, uuid, text, text, text, text, jsonb)'::regprocedure) like '%Invalid final PDF storage bucket%' as passed
union all
select
  'phase8_finalisation_rejects_path_traversal' as check_name,
  pg_get_functiondef('public.finalise_rental_document_version(uuid, uuid, text, text, text, text, timestamptz, uuid, text, text, text, text, jsonb)'::regprocedure) like '%Invalid final PDF storage path%' as passed
union all
select
  'phase8_finalisation_derives_expected_path' as check_name,
  pg_get_functiondef('public.finalise_rental_document_version(uuid, uuid, text, text, text, text, timestamptz, uuid, text, text, text, text, jsonb)'::regprocedure) like '%/rental-documents/%'
    and pg_get_functiondef('public.finalise_rental_document_version(uuid, uuid, text, text, text, text, timestamptz, uuid, text, text, text, text, jsonb)'::regprocedure) like '%/versions/%'
    and pg_get_functiondef('public.finalise_rental_document_version(uuid, uuid, text, text, text, text, timestamptz, uuid, text, text, text, text, jsonb)'::regprocedure) like '%/final-%' as passed
union all
select
  'phase8_finalisation_checks_feature_flag' as check_name,
  pg_get_functiondef('public.finalise_rental_document_version(uuid, uuid, text, text, text, text, timestamptz, uuid, text, text, text, text, jsonb)'::regprocedure) like '%rental_document_engine_enabled%' as passed
union all
select
  'phase8_finalisation_checks_signature_snapshot' as check_name,
  pg_get_functiondef('public.finalise_rental_document_version(uuid, uuid, text, text, text, text, timestamptz, uuid, text, text, text, text, jsonb)'::regprocedure) like '%Signature reference does not match the immutable business snapshot%' as passed
union all
select
  'phase8_finalisation_checks_blocking_warnings' as check_name,
  pg_get_functiondef('public.finalise_rental_document_version(uuid, uuid, text, text, text, text, timestamptz, uuid, text, text, text, text, jsonb)'::regprocedure) like '%Blocking template warnings%' as passed
union all
select
  'phase8_transactional_draft_rpc_present' as check_name,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_rental_document_draft_version'
  ) as passed
union all
select
  'phase8_transactional_draft_locks_parent' as check_name,
  pg_get_functiondef('public.create_rental_document_draft_version(uuid, uuid, text, jsonb, jsonb, text, uuid, integer, text, text, text, text, timestamptz, text, text, timestamptz, uuid, timestamptz, uuid)'::regprocedure) like '%for update%' as passed
union all
select
  'phase8_transactional_draft_updates_current_version' as check_name,
  pg_get_functiondef('public.create_rental_document_draft_version(uuid, uuid, text, jsonb, jsonb, text, uuid, integer, text, text, text, text, timestamptz, text, text, timestamptz, uuid, timestamptz, uuid)'::regprocedure) like '%current_version_id%' as passed;
