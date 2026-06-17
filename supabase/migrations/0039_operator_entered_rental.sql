alter table public.rentals
  add column if not exists entered_by_operator boolean default false;

alter table public.contracts
  add column if not exists operator_confirmed boolean default false;
