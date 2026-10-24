-- Shared customer history: when a rental ends badly (rent never paid, damage not paid for, vehicle not returned,
-- false documents, abuse), the operator can report it, and other RouteHQ operators are warned when the same person
-- books or gets in touch with them.
--
-- Privacy by design:
-- * A report holds no name, phone or document number in readable form: only keyed hashes of the customer's
--   identifiers (made by the app with a secret pepper), so nobody can look a person up by browsing reports.
-- * Only the reporting business can read its own reports (RLS). Other businesses only ever get anonymous
--   summaries (kind, amount, month) for a customer they already have in front of them, through
--   customer_report_signals(), which never returns which business reported.
-- * A report needs a rental the vehicle actually went out on, expires after three years, and can be withdrawn by
--   the reporting business or set aside after a dispute.
create table if not exists public.customer_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  rental_id uuid not null references public.rentals(id) on delete cascade,
  kind text not null check (kind in ('unpaid_rent', 'damage_unpaid', 'not_returned', 'false_documents', 'abusive', 'other_serious')),
  amount numeric(12, 2) check (amount is null or amount >= 0),
  occurred_on date not null default current_date,
  -- Private to the reporting business: never shown to anyone else.
  notes text check (notes is null or char_length(notes) <= 1000),
  match_keys text[] not null check (cardinality(match_keys) between 1 and 6),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '3 years'),
  withdrawn_at timestamptz,
  disputed_at timestamptz,
  dispute_upheld boolean not null default false
);

create index if not exists customer_reports_keys_idx on public.customer_reports using gin (match_keys);
create index if not exists customer_reports_org_customer_idx on public.customer_reports (organization_id, customer_id);
create unique index if not exists customer_reports_one_per_kind on public.customer_reports (rental_id, kind) where withdrawn_at is null;

alter table public.customer_reports enable row level security;

create policy customer_reports_own_select on public.customer_reports for select using (is_org_member(organization_id));
create policy customer_reports_own_insert on public.customer_reports for insert with check (has_org_role(organization_id, array['owner', 'manager']::organization_role[]));
create policy customer_reports_own_update on public.customer_reports for update using (has_org_role(organization_id, array['owner', 'manager']::organization_role[]));

-- Anonymous summaries of other businesses' live reports matching any of the given keys, one line per kind of
-- problem: how many businesses reported it, the amounts added up, and the latest month. Callable only by a member of
-- p_org, and p_org's own reports are left out (it already sees those). No business, customer or note is returned.
create or replace function public.customer_report_signals(p_org uuid, p_keys text[])
returns table (kind text, amount numeric, latest date, reporters integer, reports integer)
language sql
stable
security definer
set search_path = public
as $$
  select r.kind, sum(r.amount), max(r.occurred_on), count(distinct r.organization_id)::integer, count(*)::integer
  from public.customer_reports r
  where public.is_org_member(p_org)
    and r.organization_id <> p_org
    and r.withdrawn_at is null
    and not r.dispute_upheld
    and r.expires_at > now()
    and r.match_keys && p_keys
    and cardinality(p_keys) between 1 and 6
  group by r.kind
  order by max(r.occurred_on) desc;
$$;

revoke all on function public.customer_report_signals(uuid, text[]) from public;
grant execute on function public.customer_report_signals(uuid, text[]) to authenticated, service_role;
