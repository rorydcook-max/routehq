-- Paid extras on a booking (child seat, second helmet, airport delivery):
-- what was picked, and the one-off amount charged for them with the first rent.
alter table public.rentals
  add column if not exists extras jsonb not null default '[]'::jsonb,
  add column if not exists extras_total numeric(12,2) not null default 0;
