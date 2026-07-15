alter table public.rental_document_versions
  add column if not exists draft_pdf_storage_bucket text,
  add column if not exists draft_pdf_storage_path text,
  add column if not exists draft_pdf_generated_at timestamptz,
  add column if not exists final_pdf_storage_bucket text,
  add column if not exists final_pdf_storage_path text,
  add column if not exists final_pdf_generated_at timestamptz;

comment on column public.rental_document_versions.draft_pdf_storage_bucket is
  'Private storage bucket for the internal draft PDF generated from this rental document version.';

comment on column public.rental_document_versions.draft_pdf_storage_path is
  'Private storage path for the internal draft PDF generated from this rental document version.';

comment on column public.rental_document_versions.final_pdf_storage_bucket is
  'Private storage bucket for the internal final PDF generated from this immutable rental document version.';

comment on column public.rental_document_versions.final_pdf_storage_path is
  'Private storage path for the internal final PDF generated from this immutable rental document version.';

create unique index if not exists rental_document_signatures_unique_version_role_idx
  on public.rental_document_signatures(document_version_id, signer_role);
