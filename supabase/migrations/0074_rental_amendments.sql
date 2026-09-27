-- Signed amendments to a rental agreement: extensions and changes to the rate
-- or deposit.
--
-- The business prepares an amendment; the customer opens a short link, sees
-- exactly what changes and signs. Only then are the changes applied to the
-- rental. The text shown is fixed when the amendment is created (its SHA-256
-- is stored) and the signed copy is kept as an immutable rental document with
-- the business's pre-authorised signature and the customer's signature.

-- Replaces the unused placeholder table from migration 0049 (never used by
-- the app, no rows).
drop table if exists public.rental_amendments cascade;

create table public.rental_amendments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  rental_id uuid not null references public.rentals(id) on delete restrict,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  status text not null default 'awaiting_signature'
    check (status in ('awaiting_signature', 'signed', 'cancelled')),
  changes jsonb not null,
  rendered_html text not null,
  content_hash text not null,
  business_snapshot jsonb not null,
  document_id uuid references public.rental_documents(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  signed_at timestamptz,
  signer_name text,
  applied_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null
);

create index if not exists rental_amendments_rental_idx on public.rental_amendments (organization_id, rental_id, created_at desc);

-- One amendment waiting for the customer at a time per rental.
create unique index if not exists rental_amendments_one_pending_per_rental
  on public.rental_amendments (rental_id) where status = 'awaiting_signature';

alter table public.rental_amendments enable row level security;

drop policy if exists "Members can view rental amendments" on public.rental_amendments;
create policy "Members can view rental amendments" on public.rental_amendments
  for select using (public.is_org_member(organization_id));
-- Writes go through server code (service role) after its own checks, or the
-- function below.

-- Record a customer's signature on an amendment, in one transaction:
-- the signed document, its immutable version, the business's pre-authorised
-- signature and the customer's signature, and the amendment's new status.
-- Called by the server (service role) after it has validated the request.
create or replace function public.sign_rental_amendment(
  p_token text,
  p_content_hash text,
  p_document_id uuid,
  p_version_id uuid,
  p_pdf_storage_path text,
  p_signature_storage_path text,
  p_signer_name text,
  p_ip_address text,
  p_user_agent text
)
returns table (amendment_id uuid, document_id uuid, document_version_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_amendment public.rental_amendments%rowtype;
  v_hash text;
  v_prefix text;
  v_path text;
  v_signatory jsonb;
  v_signature jsonb;
  v_document_type text;
begin
  select * into v_amendment
  from public.rental_amendments
  where token = p_token
  for update;

  if not found then
    raise exception 'This amendment could not be found.';
  end if;
  if v_amendment.status <> 'awaiting_signature' then
    raise exception 'This amendment is no longer waiting for a signature.';
  end if;
  if v_amendment.expires_at < now() then
    raise exception 'This amendment has expired.';
  end if;

  v_hash := encode(sha256(convert_to(v_amendment.rendered_html, 'UTF8')), 'hex');
  if v_hash is distinct from v_amendment.content_hash or p_content_hash is distinct from v_hash then
    raise exception 'The amendment text has changed. Please reload and read it again.';
  end if;

  if nullif(trim(coalesce(p_signer_name, '')), '') is null then
    raise exception 'Signer name is required.';
  end if;

  v_signatory := v_amendment.business_snapshot -> 'authorised_signatory';
  v_signature := v_amendment.business_snapshot -> 'authorised_signature';
  if nullif(trim(coalesce(v_signatory ->> 'name', '')), '') is null
    or v_signature ->> 'kind' is distinct from 'storage'
    or nullif(v_signature ->> 'path', '') is null
  then
    raise exception 'The business has not set up its authorised signature.';
  end if;

  v_prefix :=
    'organizations/' || v_amendment.organization_id::text ||
    '/rentals/' || v_amendment.rental_id::text ||
    '/rental-documents/' || p_document_id::text ||
    '/versions/' || p_version_id::text || '/';

  foreach v_path in array array[p_pdf_storage_path, p_signature_storage_path] loop
    if v_path is null or length(v_path) > 512 or v_path like '%..%' or v_path like '%//%'
      or position(chr(92) in v_path) > 0 or v_path not like v_prefix || '%'
    then
      raise exception 'Invalid storage path.';
    end if;
  end loop;

  v_document_type := case when (v_amendment.changes ->> 'new_end_date') is not null
    and (v_amendment.changes ->> 'new_rate') is null
    and (v_amendment.changes ->> 'new_deposit') is null
    then 'extension_amendment' else 'agreement_amendment' end;

  insert into public.rental_documents (
    id, organization_id, rental_id, document_type, status,
    source_event_type, source_event_id, created_by, finalised_at
  ) values (
    p_document_id, v_amendment.organization_id, v_amendment.rental_id, v_document_type, 'signed',
    'rental_amendment', v_amendment.id, v_amendment.created_by, now()
  );

  insert into public.rental_document_versions (
    id, organization_id, document_id, version_number, template_version,
    rendered_html_snapshot, rendered_data_snapshot, business_snapshot, content_hash, status,
    generated_at, finalised_at, created_by,
    pdf_storage_bucket, pdf_storage_path,
    final_pdf_storage_bucket, final_pdf_storage_path, final_pdf_generated_at
  ) values (
    p_version_id, v_amendment.organization_id, p_document_id, 1, 1,
    v_amendment.rendered_html, v_amendment.changes, v_amendment.business_snapshot, v_hash, 'signed',
    v_amendment.created_at, now(), v_amendment.created_by,
    'documents', p_pdf_storage_path,
    'documents', p_pdf_storage_path, now()
  );

  update public.rental_documents set current_version_id = p_version_id where id = p_document_id;

  insert into public.rental_document_signatures (
    organization_id, document_version_id, signer_role, signer_name, signer_user_id,
    signature_storage_bucket, signature_storage_path, signed_at,
    verification_method, consent_text_version, content_hash_at_signing, metadata
  ) values (
    v_amendment.organization_id, p_version_id, 'authorised_business_signatory', v_signatory ->> 'name', null,
    coalesce(v_signature ->> 'bucket', 'branding'), v_signature ->> 'path', now(),
    'pre_authorised_signature', coalesce(v_signatory ->> 'signature_authorisation_text_version', 'unknown'), v_hash,
    jsonb_build_object('signatory_title', v_signatory ->> 'title', 'applied_by', 'server', 'trigger', 'customer_signed_amendment', 'amendment_id', v_amendment.id)
  );

  insert into public.rental_document_signatures (
    organization_id, document_version_id, signer_role, signer_name, signer_user_id,
    signature_storage_bucket, signature_storage_path, signed_at, ip_address, user_agent,
    verification_method, consent_text_version, content_hash_at_signing, metadata
  ) values (
    v_amendment.organization_id, p_version_id, 'renter', trim(p_signer_name), null,
    'documents', p_signature_storage_path, now(),
    case when p_ip_address ~ '^[0-9a-fA-F:.]{3,45}$' then p_ip_address::inet end, p_user_agent,
    'amendment_link', 'customer-amendment-signature-v1', v_hash,
    jsonb_build_object('amendment_id', v_amendment.id)
  );

  update public.rental_amendments
  set status = 'signed', signed_at = now(), signer_name = trim(p_signer_name), document_id = p_document_id
  where id = v_amendment.id;

  return query select v_amendment.id, p_document_id, p_version_id;
end;
$function$;

revoke all on function public.sign_rental_amendment(text, text, uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.sign_rental_amendment(text, text, uuid, uuid, text, text, text, text, text) to service_role;
