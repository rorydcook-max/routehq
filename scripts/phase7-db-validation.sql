select
  'phase7_finalisation_rpc' as check_name,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'finalise_rental_document_version'
  ) as passed
union all
select
  'phase7_activity_idempotency_index' as check_name,
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'activity_events_document_idempotency_idx'
  ) as passed
union all
select
  'phase7_final_pdf_immutability_guard' as check_name,
  pg_get_functiondef('public.prevent_protected_rental_document_version_update()'::regprocedure) like '%final_pdf_storage_path%' as passed
union all
select
  'phase7_rpc_execute_grant' as check_name,
  has_function_privilege(
    'authenticated',
    'public.finalise_rental_document_version(uuid, uuid, text, text, text, text, timestamptz, uuid, text, text, text, text, jsonb)',
    'execute'
  ) as passed;
