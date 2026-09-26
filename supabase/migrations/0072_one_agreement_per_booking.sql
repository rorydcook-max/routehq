-- One live rental agreement per booking.
--
-- The booking page creates the agreement the first time it opens. Two page
-- loads racing each other could each create one, leaving orphan drafts beside
-- the signed agreement. Older extra drafts are marked superseded, and the
-- database now refuses a second live agreement for the same rental.

with ranked as (
  select
    id,
    status,
    row_number() over (
      partition by rental_id
      order by (status in ('signed', 'finalised', 'partially_signed')) desc, created_at desc
    ) as rn
  from public.rental_documents
  where document_type = 'rental_agreement'
    and status not in ('voided', 'superseded')
)
update public.rental_documents d
set status = 'superseded', updated_at = now()
from ranked r
where r.id = d.id
  and r.rn > 1
  and r.status in ('draft', 'generated');

create unique index if not exists rental_documents_one_live_agreement_per_rental
  on public.rental_documents (organization_id, rental_id)
  where document_type = 'rental_agreement'
    and status not in ('voided', 'superseded');
