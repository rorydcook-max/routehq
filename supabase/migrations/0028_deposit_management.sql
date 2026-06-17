alter table public.rentals
  add column if not exists deposit_held numeric default 0,
  add column if not exists deposit_status text default 'pending'
    check (deposit_status in ('pending', 'received', 'partially_returned', 'fully_returned', 'forfeited', 'partially_forfeited')),
  add column if not exists deposit_received_at timestamptz,
  add column if not exists deposit_refunded_amount numeric default 0,
  add column if not exists deposit_forfeited_amount numeric default 0,
  add column if not exists deposit_deduction_reason text,
  add column if not exists deposit_reconciled_at timestamptz,
  add column if not exists deposit_reconciled_by uuid references auth.users(id);

alter table public.transactions
  add column if not exists is_deposit boolean default false,
  add column if not exists deposit_rental_id uuid references public.rentals(id);
