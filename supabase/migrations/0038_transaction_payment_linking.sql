alter table public.rental_payments
  add column if not exists transaction_id uuid references public.transactions(id),
  add column if not exists paid_date date;

alter table public.tasks
  add column if not exists rental_payment_id uuid references public.rental_payments(id);
