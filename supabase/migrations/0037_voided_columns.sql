alter table public.transactions 
  add column if not exists voided boolean default false;

alter table public.rental_payments 
  add column if not exists voided boolean default false;
