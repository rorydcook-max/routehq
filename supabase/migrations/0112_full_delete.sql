-- Full delete of a booking or a vehicle (Rory, 31 Oct 2026): delete means everything goes,
-- including a signed agreement; archive is how an owner keeps records.
-- Signed agreement records stay protected from edits and from any other delete: only the purge
-- functions below set rovehq.purge for their own transaction.

create or replace function public.prevent_rental_document_acknowledgement_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and current_setting('rovehq.purge', true) = 'on' then return old; end if;
  raise exception 'Document acknowledgement records are immutable.';
end; $$;

create or replace function public.prevent_rental_document_execution_certificate_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and current_setting('rovehq.purge', true) = 'on' then return old; end if;
  raise exception 'Document execution certificate records are immutable.';
end; $$;

create or replace function public.prevent_rental_document_signature_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and current_setting('rovehq.purge', true) = 'on' then return old; end if;
  raise exception 'Document signature records are immutable.';
end; $$;

create or replace function public.prevent_protected_rental_document_version_delete()
returns trigger language plpgsql as $$
begin
  if current_setting('rovehq.purge', true) = 'on' then return old; end if;
  if old.finalised_at is not null
    or old.status in ('finalised', 'signed')
    or exists (select 1 from public.rental_document_signatures where document_version_id = old.id)
  then
    raise exception 'Finalised or signed document versions cannot be deleted.';
  end if;
  return old;
end; $$;

-- Deletes a booking and everything on it. Returns the storage files to remove ({bucket, path}).
create or replace function public.purge_rental(p_rental uuid)
returns table(bucket text, path text)
language plpgsql security definer set search_path = public as $$
declare
  v_docs uuid[]; v_versions uuid[]; v_inspections uuid[]; v_payments uuid[]; v_tx uuid[];
  v_links uuid[]; v_contracts uuid[]; v_invoices uuid[]; v_files uuid[];
begin
  perform set_config('rovehq.purge', 'on', true);

  select coalesce(array_agg(id), '{}') into v_docs from rental_documents where rental_id = p_rental;
  select coalesce(array_agg(id), '{}') into v_versions from rental_document_versions where document_id = any(v_docs);
  select coalesce(array_agg(id), '{}') into v_inspections from inspections where rental_id = p_rental;
  select coalesce(array_agg(id), '{}') into v_payments from rental_payments where rental_id = p_rental;
  select coalesce(array_agg(id), '{}') into v_tx from transactions
    where rental_id = p_rental or deposit_rental_id = p_rental or rental_payment_id = any(v_payments);
  select coalesce(array_agg(id), '{}') into v_links from booking_links where rental_id = p_rental;
  select coalesce(array_agg(id), '{}') into v_contracts from contracts where rental_id = p_rental or booking_link_id = any(v_links);
  select coalesce(array_agg(id), '{}') into v_invoices from invoices where rental_id = p_rental;
  select coalesce(array_agg(id), '{}') into v_files from documents
    where (owner_type::text = 'rental' and owner_id = p_rental)
       or (owner_type::text = 'inspection' and owner_id = any(v_inspections))
       or (owner_type::text = 'transaction' and owner_id = any(v_tx))
       or (owner_type::text = 'contract' and owner_id = any(v_contracts))
       or (owner_type::text = 'invoice' and owner_id = any(v_invoices))
       or id in (select receipt_document_id from transactions where id = any(v_tx))
       or id in (select document_id from contracts where id = any(v_contracts))
       or id in (select document_id from invoices where id = any(v_invoices))
       or id in (select document_id from inspection_media_manifest where inspection_id = any(v_inspections));

  -- Files to remove from storage, gathered before their rows go.
  create temp table if not exists _purge_files(bucket text, path text) on commit drop;
  insert into _purge_files
    select storage_bucket, storage_path from documents where id = any(v_files)
    union all select storage_bucket, storage_path from inspection_media_manifest where inspection_id = any(v_inspections)
    union all select storage_bucket, thumbnail_storage_path from inspection_media_manifest where inspection_id = any(v_inspections)
    union all select pdf_storage_bucket, pdf_storage_path from rental_document_versions where id = any(v_versions)
    union all select draft_pdf_storage_bucket, draft_pdf_storage_path from rental_document_versions where id = any(v_versions)
    union all select final_pdf_storage_bucket, final_pdf_storage_path from rental_document_versions where id = any(v_versions)
    union all select signature_storage_bucket, signature_storage_path from rental_document_signatures where document_version_id = any(v_versions)
    union all select certificate_storage_bucket, certificate_storage_path from rental_document_execution_certificates
      where rental_id = p_rental or document_id = any(v_docs);

  -- Agreement and its evidence
  delete from rental_document_acknowledgements where rental_id = p_rental or document_version_id = any(v_versions) or booking_link_id = any(v_links);
  delete from rental_document_execution_certificates where rental_id = p_rental or document_id = any(v_docs) or document_version_id = any(v_versions);
  delete from rental_document_signatures where document_version_id = any(v_versions);
  delete from rental_amendments where rental_id = p_rental or document_id = any(v_docs);
  delete from deposit_reconciliations where rental_id = p_rental or document_id = any(v_docs);
  update rental_documents set current_version_id = null, legacy_contract_id = null where id = any(v_docs);
  update rental_document_versions set supersedes_version_id = null where id = any(v_versions);
  delete from rental_document_versions where id = any(v_versions);
  delete from rental_documents where id = any(v_docs);

  -- Handover and return checks
  delete from inspection_media_manifest where inspection_id = any(v_inspections);
  delete from inspections where id = any(v_inspections);

  -- Money
  delete from receipts where rental_id = p_rental or rental_payment_id = any(v_payments) or transaction_id = any(v_tx);
  delete from tasks where rental_id = p_rental or rental_payment_id = any(v_payments);
  update rental_payments set transaction_id = null where id = any(v_payments);
  update compliance_events set transaction_id = null where transaction_id = any(v_tx);
  update maintenance_events set transaction_id = null where transaction_id = any(v_tx);
  update rental_payments set transaction_id = null where transaction_id = any(v_tx);
  delete from transactions where id = any(v_tx);
  delete from rental_payments where id = any(v_payments);
  delete from invoices where id = any(v_invoices);

  -- Links, contracts and the rest
  update renter_consents set booking_link_id = null where booking_link_id = any(v_links);
  delete from referrals where rental_id = p_rental or booking_link_id = any(v_links);
  update booking_links set contract_id = null where id = any(v_links) or contract_id = any(v_contracts);
  update contracts set booking_link_id = null where id = any(v_contracts);
  delete from contracts where id = any(v_contracts);
  delete from booking_links where id = any(v_links);
  delete from activity_events where rental_id = p_rental;
  delete from notifications where rental_id = p_rental;
  delete from communication_log where rental_id = p_rental;
  delete from customer_portal_actions where rental_id = p_rental;
  update line_messages set rental_id = null where rental_id = p_rental;
  delete from documents where id = any(v_files);
  update vehicles set current_rental_id = null where current_rental_id = p_rental;
  delete from rentals where id = p_rental;

  return query select distinct f.bucket, f.path from _purge_files f where f.bucket is not null and f.path is not null and f.path <> '';
  delete from _purge_files;
end; $$;

-- Deletes a vehicle, every booking it has ever had, and its costs, papers, photos and history.
create or replace function public.purge_vehicle(p_vehicle uuid)
returns table(bucket text, path text)
language plpgsql security definer set search_path = public as $$
declare
  r uuid; v_tx uuid[]; v_inspections uuid[]; v_links uuid[]; v_files uuid[];
begin
  perform set_config('rovehq.purge', 'on', true);
  create temp table if not exists _purge_vehicle_files(bucket text, path text) on commit drop;

  for r in select id from rentals where vehicle_id = p_vehicle loop
    insert into _purge_vehicle_files select * from public.purge_rental(r);
  end loop;

  update rentals set original_vehicle_id = null where original_vehicle_id = p_vehicle;
  delete from vehicle_changes where from_vehicle_id = p_vehicle or to_vehicle_id = p_vehicle;

  select coalesce(array_agg(id), '{}') into v_tx from transactions where vehicle_id = p_vehicle;
  select coalesce(array_agg(id), '{}') into v_inspections from inspections where vehicle_id = p_vehicle;
  select coalesce(array_agg(id), '{}') into v_links from booking_links where vehicle_id = p_vehicle;
  select coalesce(array_agg(id), '{}') into v_files from documents
    where (owner_type::text = 'vehicle' and owner_id = p_vehicle)
       or (owner_type::text = 'transaction' and owner_id = any(v_tx))
       or (owner_type::text = 'inspection' and owner_id = any(v_inspections))
       or id in (select receipt_document_id from transactions where id = any(v_tx))
       or id in (select document_id from inspection_media_manifest where inspection_id = any(v_inspections));

  insert into _purge_vehicle_files
    select storage_bucket, storage_path from documents where id = any(v_files)
    union all select storage_bucket, storage_path from inspection_media_manifest where inspection_id = any(v_inspections)
    union all select storage_bucket, thumbnail_storage_path from inspection_media_manifest where inspection_id = any(v_inspections);

  delete from inspection_media_manifest where inspection_id = any(v_inspections);
  delete from inspections where id = any(v_inspections);
  delete from receipts where transaction_id = any(v_tx);
  update compliance_events set transaction_id = null where transaction_id = any(v_tx);
  update maintenance_events set transaction_id = null where transaction_id = any(v_tx);
  update rental_payments set transaction_id = null where transaction_id = any(v_tx);
  delete from tasks where vehicle_id = p_vehicle;
  delete from rental_payments where vehicle_id = p_vehicle;
  delete from transactions where id = any(v_tx);
  update renter_consents set booking_link_id = null where booking_link_id = any(v_links);
  delete from referrals where vehicle_id = p_vehicle or booking_link_id = any(v_links);
  delete from rental_document_acknowledgements where booking_link_id = any(v_links);
  update contracts set booking_link_id = null where booking_link_id = any(v_links);
  delete from booking_links where id = any(v_links);
  delete from activity_events where vehicle_id = p_vehicle;
  delete from notifications where vehicle_id = p_vehicle;
  update line_messages set vehicle_id = null where vehicle_id = p_vehicle;
  update gps_devices set vehicle_id = null where vehicle_id = p_vehicle;
  delete from documents where id = any(v_files);
  delete from vehicles where id = p_vehicle;

  return query select distinct f.bucket, f.path from _purge_vehicle_files f where f.bucket is not null and f.path is not null and f.path <> '';
  delete from _purge_vehicle_files;
end; $$;

revoke all on function public.purge_rental(uuid) from public, anon, authenticated;
revoke all on function public.purge_vehicle(uuid) from public, anon, authenticated;
grant execute on function public.purge_rental(uuid) to service_role;
grant execute on function public.purge_vehicle(uuid) to service_role;
