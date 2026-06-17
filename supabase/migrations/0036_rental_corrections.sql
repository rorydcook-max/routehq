alter type public.payment_status add value if not exists 'voided';
alter type public.payment_status add value if not exists 'waived';

alter table public.transactions
  add column if not exists voided boolean default false,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id),
  add column if not exists void_reason text;
