-- Tidy-up from the database security check.
--
-- 1. Functions that run with the owner's rights could be called straight from
--    the public API by someone who is not signed in. The app only ever calls
--    these from the server, so the public door is closed. Signing an agreement
--    as a customer goes through the server (service role), which keeps access.
revoke execute on function public.complete_rental_document_customer_signing(text, text, text, text, text, text, jsonb, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.create_my_organization(text, text) from public, anon;
revoke execute on function public.finalise_inspection_report(uuid, uuid, uuid, uuid, text, jsonb, text, text, text, text, text, text) from public, anon;
revoke execute on function public.protect_last_organization_owner() from public, anon, authenticated;
revoke execute on function public.rental_payments_recompute_balance() from public, anon, authenticated;

-- 2. Functions without a fixed search path: pin it to what they already use.
alter function public.enforce_rental_document_customer_signing_enabled() set search_path = public, extensions;
alter function public.generate_booking_reference(uuid) set search_path = public, extensions;
alter function public.prevent_protected_rental_document_version_delete() set search_path = public, extensions;
alter function public.prevent_protected_rental_document_version_update() set search_path = public, extensions;
alter function public.prevent_rental_document_acknowledgement_mutation() set search_path = public, extensions;
alter function public.prevent_rental_document_execution_certificate_mutation() set search_path = public, extensions;
alter function public.prevent_rental_document_signature_mutation() set search_path = public, extensions;
alter function public.set_rental_reference() set search_path = public, extensions;
alter function public.set_updated_at() set search_path = public, extensions;
alter function public.validate_deposit_reconciliation_relationships() set search_path = public, extensions;
alter function public.validate_inspection_media_manifest_relationships() set search_path = public, extensions;
alter function public.validate_rental_amendment_relationships() set search_path = public, extensions;
alter function public.validate_rental_document_acknowledgement_relationships() set search_path = public, extensions;
alter function public.validate_rental_document_execution_certificate_relationships() set search_path = public, extensions;
alter function public.validate_rental_document_relationships() set search_path = public, extensions;
alter function public.validate_rental_document_signature_relationships() set search_path = public, extensions;
alter function public.validate_rental_document_version_relationships() set search_path = public, extensions;
