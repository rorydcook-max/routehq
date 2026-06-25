create or replace function public.generate_booking_reference(org_id uuid)
returns text as $$
declare
  year_part text := to_char(now(), 'YYYY');
  seq_num integer;
begin
  perform pg_advisory_xact_lock(hashtext(org_id::text), year_part::integer);

  -- Use MAX of existing sequence numbers rather than COUNT, so deleted
  -- rentals don't cause collisions with still-existing references.
  select coalesce(
    max(
      (regexp_match(reference, '^FL-\d{4}-(\d+)$'))[1]::integer
    ), 0
  ) + 1 into seq_num
  from public.rentals
  where organization_id = org_id
    and reference like 'FL-' || year_part || '-%';

  return 'FL-' || year_part || '-' || lpad(seq_num::text, 4, '0');
end;
$$ language plpgsql;
