alter table public.rentals
  add column if not exists payment_due_trigger text 
    check (payment_due_trigger in ('immediate', 'on_delivery', 'manual')),
  add column if not exists payment_due_after_delivery boolean default false,
  add column if not exists first_payment_amount numeric,
  add column if not exists deposit_payment_amount numeric;
