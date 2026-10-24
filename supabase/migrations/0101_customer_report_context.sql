-- Shared customer history with context (Rory, 24 Oct 2026): a warning alone can be unfair. A business may report rent
-- as unpaid when the customer was within their rights to hold it back. So the business that sees a warning now gets
-- what it needs to judge for itself:
-- * who reported it (the business name, how long it has been on RouteHQ, how many rentals it has run, how many
--   customers it has reported): a business that reports everyone, or is new with few rentals, reads differently;
-- * the reporting business's own account of what happened (summary, shared: separate from its private notes);
-- * whether it was settled afterwards, and how;
-- * the customer's side, when they have given one, and whether they dispute it.
alter table public.customer_reports
  add column if not exists summary text check (summary is null or char_length(summary) <= 600),
  add column if not exists settled_at timestamptz,
  add column if not exists settled_note text check (settled_note is null or char_length(settled_note) <= 300),
  add column if not exists customer_response text check (customer_response is null or char_length(customer_response) <= 600),
  add column if not exists customer_response_at timestamptz;

-- Other businesses' live reports matching any of the given keys, one row per report, with the reporting business
-- and its track record. Callable only by a member of p_org; p_org's own reports are left out (it sees those anyway).
-- Still never returned: the reporting business's private notes, the customer record or the match keys.
create or replace function public.customer_report_details(p_org uuid, p_keys text[])
returns table (
  id uuid,
  kind text,
  amount numeric,
  occurred_on date,
  summary text,
  business_name text,
  business_since date,
  business_rentals integer,
  business_reports integer,
  settled_at timestamptz,
  settled_note text,
  customer_response text,
  disputed boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.kind,
    r.amount,
    r.occurred_on,
    r.summary,
    coalesce(nullif(o.trading_name, ''), o.name),
    o.created_at::date,
    (select count(*)::integer from public.rentals x where x.organization_id = r.organization_id and x.deleted_at is null and x.status in ('active', 'due_soon', 'overdue', 'extended', 'completed')),
    (select count(*)::integer from public.customer_reports y where y.organization_id = r.organization_id and y.withdrawn_at is null),
    r.settled_at,
    r.settled_note,
    r.customer_response,
    r.disputed_at is not null
  from public.customer_reports r
  join public.organizations o on o.id = r.organization_id
  where public.is_org_member(p_org)
    and r.organization_id <> p_org
    and r.withdrawn_at is null
    and not r.dispute_upheld
    and r.expires_at > now()
    and r.match_keys && p_keys
    and cardinality(p_keys) between 1 and 6
  order by (r.settled_at is null) desc, r.occurred_on desc
  limit 20;
$$;

revoke all on function public.customer_report_details(uuid, text[]) from public;
grant execute on function public.customer_report_details(uuid, text[]) to authenticated, service_role;
