-- Per-rental switch for the automatic customer reminders (rent due, return), set when an owner adds a running rental
-- through the fleet assistant and says no to reminders for that customer (2 Nov 2026).
alter table public.rentals add column if not exists customer_reminders boolean not null default true;
comment on column public.rentals.customer_reminders is 'False when the owner chose not to send this customer the automatic rent-due and return reminders.';
