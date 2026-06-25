alter table public.organizations
  add column if not exists owner_signature_url text;
