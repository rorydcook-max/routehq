alter type public.transaction_type add value if not exists 'deposit_received';
alter type public.transaction_type add value if not exists 'deposit_refunded';
alter type public.transaction_type add value if not exists 'deposit_forfeited';
alter type public.transaction_type add value if not exists 'deposit_deduction';
