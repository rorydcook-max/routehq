alter table public.organizations
  add column if not exists business_logo_storage_bucket text,
  add column if not exists business_logo_storage_path text;

comment on column public.organizations.business_logo_storage_bucket is
  'Canonical private storage bucket for the organization business logo used in contract and rental-document rendering.';

comment on column public.organizations.business_logo_storage_path is
  'Canonical private storage path for the organization business logo used in contract and rental-document rendering.';
