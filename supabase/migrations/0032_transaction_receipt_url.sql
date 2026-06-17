alter table public.transactions
  add column if not exists receipt_url text;
