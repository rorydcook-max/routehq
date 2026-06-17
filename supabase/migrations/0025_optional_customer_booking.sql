-- Allow bookings to be created without a customer assigned up-front.
-- The customer can complete their details later via the booking link.
-- booking_links.customer_id is already nullable (set in 0017).
-- contracts.customer_id was made nullable in 0017.
-- Only rentals.customer_id needs to be changed here.

alter table public.rentals
  alter column customer_id drop not null;
