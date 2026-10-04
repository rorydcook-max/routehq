-- One row per reminder a customer has been sent for a rental (rent due, return
-- coming up, service due...). The primary key is what guarantees each goes out
-- once, even if the daily job runs twice at the same moment.
create table if not exists public.customer_reminders (
  rental_id uuid not null references public.rentals(id) on delete cascade,
  reminder_key text not null,
  created_at timestamptz not null default now(),
  primary key (rental_id, reminder_key)
);
-- Server code only (service role): no policies, so nothing is readable from the browser.
alter table public.customer_reminders enable row level security;
