-- Phase 10 hardening: database-side guard for customer-signing writes.
-- The public server action already checks this, but the database also rejects
-- renter-signing records unless the rental explicitly uses the new engine and
-- the organization has both engine and customer-signing feature flags enabled.

create or replace function public.enforce_rental_document_customer_signing_enabled()
returns trigger
language plpgsql
as $$
declare
  v_document public.rental_documents%rowtype;
  v_rental public.rentals%rowtype;
  v_organization public.organizations%rowtype;
begin
  if tg_table_name = 'rental_document_signatures' and new.signer_role <> 'renter' then
    return new;
  end if;

  select rd.* into v_document
  from public.rental_document_versions rdv
  join public.rental_documents rd on rd.id = rdv.document_id
  where rdv.id = new.document_version_id
    and rdv.organization_id = new.organization_id;

  if not found then
    raise exception 'Customer signing document relationship mismatch.';
  end if;

  select * into v_rental
  from public.rentals
  where id = v_document.rental_id
    and organization_id = new.organization_id
    and deleted_at is null;

  if not found then
    raise exception 'Customer signing rental relationship mismatch.';
  end if;

  select * into v_organization
  from public.organizations
  where id = new.organization_id
    and deleted_at is null;

  if not found then
    raise exception 'Customer signing organization relationship mismatch.';
  end if;

  if v_rental.contract_authority_mode <> 'rental_document_engine' then
    raise exception 'Rental document engine is not authoritative for this booking.';
  end if;

  if coalesce((v_organization.settings ->> 'rental_document_engine_enabled')::boolean, false) is not true
    and coalesce((v_organization.settings ->> 'experimental_rental_document_engine_enabled')::boolean, false) is not true
  then
    raise exception 'Rental document engine is disabled for this organization.';
  end if;

  if coalesce((v_organization.settings ->> 'rental_document_customer_signing_enabled')::boolean, false) is not true then
    raise exception 'Rental document customer signing is disabled for this organization.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_rental_document_customer_signature_feature on public.rental_document_signatures;
create trigger enforce_rental_document_customer_signature_feature
  before insert on public.rental_document_signatures
  for each row execute function public.enforce_rental_document_customer_signing_enabled();

drop trigger if exists enforce_rental_document_acknowledgement_feature on public.rental_document_acknowledgements;
create trigger enforce_rental_document_acknowledgement_feature
  before insert on public.rental_document_acknowledgements
  for each row execute function public.enforce_rental_document_customer_signing_enabled();
