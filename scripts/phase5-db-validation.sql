select jsonb_build_object(
  'tables', (
    select jsonb_object_agg(table_name, table_name is not null)
    from (
      values
        ('rental_documents'),
        ('rental_document_versions'),
        ('rental_document_signatures'),
        ('rental_amendments'),
        ('deposit_reconciliations'),
        ('inspection_media_manifest')
    ) required(table_name)
    where exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and information_schema.tables.table_name = required.table_name
    )
  ),
  'organization_columns', (
    select jsonb_object_agg(column_name, column_name is not null)
    from (
      values
        ('business_logo_storage_bucket'),
        ('business_logo_storage_path'),
        ('authorised_signature_storage_bucket'),
        ('authorised_signature_storage_path')
    ) required(column_name)
    where exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'organizations'
        and information_schema.columns.column_name = required.column_name
    )
  ),
  'rental_columns', (
    select jsonb_object_agg(column_name, column_name is not null)
    from (
      values
        ('contracted_rate'),
        ('billing_period'),
        ('standard_daily_rate'),
        ('early_termination_minimum_days'),
        ('delivery_fee'),
        ('collection_fee'),
        ('cancellation_admin_fee'),
        ('insurance_excess'),
        ('mileage_allowance'),
        ('excess_mileage_rate')
    ) required(column_name)
    where exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'rentals'
        and information_schema.columns.column_name = required.column_name
    )
  ),
  'version_pdf_columns', (
    select jsonb_object_agg(column_name, column_name is not null)
    from (
      values
        ('draft_pdf_storage_bucket'),
        ('draft_pdf_storage_path'),
        ('draft_pdf_generated_at'),
        ('final_pdf_storage_bucket'),
        ('final_pdf_storage_path'),
        ('final_pdf_generated_at')
    ) required(column_name)
    where exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'rental_document_versions'
        and information_schema.columns.column_name = required.column_name
    )
  ),
  'rls_enabled', (
    select jsonb_object_agg(relname, relrowsecurity)
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and relname in (
        'rental_documents',
        'rental_document_versions',
        'rental_document_signatures',
        'rental_amendments',
        'deposit_reconciliations',
        'inspection_media_manifest'
      )
  ),
  'private_buckets', (
    select jsonb_object_agg(id, public)
    from storage.buckets
    where id in ('branding', 'documents')
  ),
  'new_indexes', (
    select jsonb_agg(indexname order by indexname)
    from pg_indexes
    where schemaname = 'public'
      and tablename in (
        'rental_documents',
        'rental_document_versions',
        'rental_document_signatures',
        'rental_amendments',
        'deposit_reconciliations',
        'inspection_media_manifest'
      )
  )
) as validation_summary;
