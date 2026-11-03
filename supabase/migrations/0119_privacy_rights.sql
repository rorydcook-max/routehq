-- Privacy rights (GDPR / UK GDPR / Thai PDPA), 3 Nov 2026. docs/gdpr.md has the reasoning.
-- 1. erase_customer(): a renter asks their rental business to delete them. Their details, ID photos, messages and
--    shared-history reports go; bookings, payments and signed agreements stay under "Deleted customer" so the
--    business keeps the financial records accounting law needs. Returns the storage files to remove.
-- 2. purge_organization_data(): an owner deletes their business (Settings). Everything goes, signed agreements
--    included (Rory: delete removes everything, archive keeps records). People's sign-in accounts stay.
-- 3. id_photo_retention_candidates(): renters' passport, licence and selfie photos whose last rental ended more than
--    N months ago (organizations.settings.privacy.idPhotoMonths, default 24). Used by the daily job, which deletes
--    only for businesses that switched it on and only when ID_PHOTO_RETENTION=on (otherwise it just logs).
-- Callable by the server (service role) only.

create or replace function public.erase_customer(p_customer uuid)
returns table(bucket text, path text)
language plpgsql security definer set search_path = public as $$
declare
  v_name text; v_rentals uuid[]; v_docs uuid[]; v_renters uuid[];
begin
  select full_name into v_name from customers where id = p_customer;
  if not found then raise exception 'Customer not found'; end if;
  select coalesce(array_agg(id), '{}') into v_rentals from rentals where customer_id = p_customer;
  -- ID photos and anything else filed against the person (not their bookings' agreements or receipts).
  select coalesce(array_agg(id), '{}') into v_docs from documents where owner_type::text = 'customer' and owner_id = p_customer;

  create temp table if not exists _erase_files(bucket text, path text) on commit drop;
  insert into _erase_files select storage_bucket, storage_path from documents where id = any(v_docs);

  update transactions set receipt_document_id = null where receipt_document_id = any(v_docs);
  update contracts set document_id = null where document_id = any(v_docs);
  update invoices set document_id = null where document_id = any(v_docs);
  update inspection_media_manifest set document_id = null where document_id = any(v_docs);
  delete from documents where id = any(v_docs);

  -- Messages, reminders and reports about them.
  delete from customer_reports where customer_id = p_customer;
  delete from communication_log where customer_id = p_customer;
  delete from customer_portal_actions where customer_id = p_customer;
  delete from line_messages where customer_id = p_customer;
  delete from reminders where customer_id = p_customer;
  delete from notifications where customer_id = p_customer;
  delete from conversations where customer_id = p_customer;
  update booking_requests set customer_name = 'Deleted customer', phone = null, message = null where customer_id = p_customer;
  update booking_links
    set booking_data = case when jsonb_typeof(booking_data) = 'object'
      then booking_data - array['ocr_reads','ocr_passport_number','ocr_licence_number','ocr_licence_read','ocr_passport_read','ocr_nationality','ocr_licence_expiry','ocr_licence_country','delivery_lat','delivery_lng','delivery_place_id']
      else booking_data end
    where customer_id = p_customer;
  if coalesce(v_name, '') <> '' then
    update activity_events set title = replace(title, v_name, 'Deleted customer'), detail = replace(detail, v_name, 'Deleted customer')
      where customer_id = p_customer;
  end if;

  -- RoveHQ's renter list: this business's record no longer feeds it, and its rentals leave the copy.
  select coalesce(array_agg(distinct renter_id), '{}') into v_renters from renter_sources where customer_id = p_customer;
  delete from renter_rentals where rental_id = any(v_rentals);
  delete from renter_sources where customer_id = p_customer;
  delete from renters r where r.id = any(v_renters) and not exists (select 1 from renter_sources s where s.renter_id = r.id);
  delete from renter_consents where customer_id = p_customer;

  update customers set
    full_name = 'Deleted customer', date_of_birth = null, email = null, phone = null, whatsapp = null, whatsapp_number = null,
    nationality = null, address = null, hotel_name = null, license_type = null, passport_number = null, passport_expiry = null,
    driver_license_number = null, driver_license_expiry = null, driver_license_country = null, notes = null,
    emergency_contact_name = null, emergency_contact_phone = null, messenger_id = null, line_id = null,
    telegram_username = null, instagram_handle = null, preferred_contact_method = null, do_not_rent = false,
    do_not_rent_reason = null, do_not_rent_at = null, document_status = null,
    deleted_at = coalesce(deleted_at, now()), updated_at = now()
  where id = p_customer;

  return query select distinct f.bucket, f.path from _erase_files f where f.bucket is not null and f.path is not null and f.path <> '';
  delete from _erase_files where true;
end; $$;

create or replace function public.purge_organization_data(p_organization_id uuid)
returns table(bucket text, path text)
language plpgsql security definer set search_path = public as $$
declare
  r record; pass integer; blocked integer; v uuid;
begin
  if not exists (select 1 from organizations where id = p_organization_id) then raise exception 'Business not found'; end if;
  perform set_config('rovehq.purge', 'on', true);
  create temp table if not exists _org_files(bucket text, path text) on commit drop;

  -- Vehicles and bookings first, with their agreements, checks and files (migration 0112).
  for v in select id from vehicles where organization_id = p_organization_id loop
    insert into _org_files select * from public.purge_vehicle(v);
  end loop;
  for v in select id from rentals where organization_id = p_organization_id loop
    insert into _org_files select * from public.purge_rental(v);
  end loop;

  insert into _org_files select storage_bucket, storage_path from documents where organization_id = p_organization_id;
  insert into _org_files select business_logo_storage_bucket, business_logo_storage_path from organizations where id = p_organization_id;
  insert into _org_files select authorised_signature_storage_bucket, authorised_signature_storage_path from organizations where id = p_organization_id;

  -- RoveHQ's renter list keeps renters who said yes to RoveHQ itself, but no longer links them to this business.
  delete from renter_sources where organization_id = p_organization_id;

  -- Everything else that points at the business, in passes (some tables point at each other).
  for pass in 1..12 loop
    blocked := 0;
    for r in
      select c.conrelid::regclass as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and c.confrelid = 'public.organizations'::regclass
        and c.conrelid <> 'public.organizations'::regclass
        and array_length(c.conkey, 1) = 1
    loop
      begin
        execute format('delete from %s where %I = $1', r.tbl, r.col) using p_organization_id;
      exception when foreign_key_violation then blocked := blocked + 1;
      end;
    end loop;
    exit when blocked = 0;
  end loop;
  delete from organizations where id = p_organization_id;

  return query select distinct f.bucket, f.path from _org_files f where f.bucket is not null and f.path is not null and f.path <> '';
  delete from _org_files where true;
end; $$;

create or replace function public.id_photo_retention_candidates(p_limit integer default 200, p_only_enabled boolean default true)
returns table(document_id uuid, organization_id uuid, customer_id uuid, bucket text, path text, last_rental_end date, months integer)
language sql security definer set search_path = public stable as $$
  with orgs as (
    select o.id,
      greatest(1, least(120, coalesce(nullif(o.settings #>> '{privacy,idPhotoMonths}', '')::integer, 24))) as months,
      coalesce((o.settings #>> '{privacy,idPhotoAutoDelete}')::boolean, false) as enabled
    from organizations o
    where o.deleted_at is null
  ),
  people as (
    select c.id, c.organization_id, orgs.months,
      coalesce((select max(coalesce(r.end_date, r.cancelled_at::date, r.updated_at::date)) from rentals r where r.customer_id = c.id), c.created_at::date) as last_end
    from customers c join orgs on orgs.id = c.organization_id
    where (orgs.enabled or not p_only_enabled)
      -- Nobody with a booking still open (draft, booked, out on rent, overdue or extended).
      and not exists (select 1 from rentals r where r.customer_id = c.id and r.deleted_at is null
        and r.status::text in ('draft', 'booked', 'active', 'due_soon', 'overdue', 'extended'))
  )
  select d.id, d.organization_id, p.id, d.storage_bucket, d.storage_path, p.last_end, p.months
  from documents d join people p on p.id = d.owner_id
  where d.owner_type::text = 'customer'
    and d.category in ('passport', 'driver_license', 'selfie')
    and p.last_end < (current_date - make_interval(months => p.months))::date
  order by p.last_end
  limit greatest(1, least(p_limit, 1000))
$$;

revoke all on function public.erase_customer(uuid) from public, anon, authenticated;
revoke all on function public.purge_organization_data(uuid) from public, anon, authenticated;
revoke all on function public.id_photo_retention_candidates(integer, boolean) from public, anon, authenticated;
grant execute on function public.erase_customer(uuid) to service_role;
grant execute on function public.purge_organization_data(uuid) to service_role;
grant execute on function public.id_photo_retention_candidates(integer, boolean) to service_role;
