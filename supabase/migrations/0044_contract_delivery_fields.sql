alter table public.contracts
  add column if not exists delivery_completed_at timestamptz;
