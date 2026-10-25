-- Renters' own choices about RouteHQ (Rory, 25 Oct 2026): starting with "send me trip extras from RouteHQ partners",
-- an optional, unticked box on the booking form that can be turned off again from the booking page.
--
-- Under the PDPA this permission is RouteHQ's (not the rental business's), must be separate from the rental terms,
-- freely given and as easy to withdraw as to give, and must be provable. So every change is a new row: who, which
-- choice, yes or no, the exact words shown, the language, where it was given, and when. The current choice is the
-- latest row. Nothing is ever updated or deleted except when the customer record itself is erased.
create table if not exists public.renter_consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  booking_link_id uuid references public.booking_links(id) on delete set null,
  purpose text not null check (purpose in ('partner_offers')),
  granted boolean not null,
  wording text not null check (char_length(wording) <= 1000),
  wording_version text not null,
  locale text,
  source text not null check (source in ('booking_form', 'booking_page')),
  created_at timestamptz not null default now()
);

create index if not exists renter_consents_customer_idx on public.renter_consents (customer_id, purpose, created_at desc);

-- RouteHQ's record, not the rental business's: no access from the app's signed-in users; only the server (service role).
alter table public.renter_consents enable row level security;
