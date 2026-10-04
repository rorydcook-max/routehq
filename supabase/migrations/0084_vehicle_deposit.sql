-- The deposit a business takes differs by vehicle. Null means "use the
-- business's usual deposit" (organizations.settings.public_booking.deposit).
alter table public.vehicles add column if not exists deposit_amount numeric;
