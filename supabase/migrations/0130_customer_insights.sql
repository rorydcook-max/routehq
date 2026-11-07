-- Customers: richer list figures and insights, worked out in one pass per business rather than per customer.
-- Nothing new is stored: both functions read existing rentals, transactions, booking links, referrals and
-- return reports. security invoker, so row-level security decides what the caller can see.

-- One row per customer: rentals, days, first/last/next dates, money brought in, where they came from, damage.
create or replace function public.customer_stats(p_org uuid)
returns table (
  customer_id uuid,
  rentals integer,
  rental_days integer,
  first_start date,
  last_end date,
  next_start date,
  revenue numeric,
  source text,
  damage_count integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with org as (
    select coalesce(nullif(o.timezone, ''), 'Asia/Bangkok') as tz,
           (now() at time zone coalesce(nullif(o.timezone, ''), 'Asia/Bangkok'))::date as today
    from organizations o where o.id = p_org
  ),
  -- The day each vehicle came back (return report), and whether it came back with new damage.
  ret as (
    select i.rental_id,
           max((coalesce(i.submitted_at, i.created_at) at time zone (select tz from org))::date) as day,
           bool_or(exists (
             select 1 from jsonb_array_elements(case when jsonb_typeof(i.damage_items) = 'array' then i.damage_items else '[]'::jsonb end) d
             where (d ->> 'is_pre_existing') is distinct from 'true'
           )) as damaged
    from inspections i
    where i.organization_id = p_org and i.type = 'return' and i.deleted_at is null and i.rental_id is not null
    group by i.rental_id
  ),
  r as (
    select r.id, r.customer_id, r.status::text as status, r.start_date, r.end_date, r.created_at,
           coalesce(r.deposit_forfeited_amount, 0) as kept,
           ret.day as returned_on, coalesce(ret.damaged, false) as damaged,
           r.status::text in ('active', 'due_soon', 'overdue', 'extended', 'completed') as went_out
    from rentals r
    left join ret on ret.rental_id = r.id
    where r.organization_id = p_org and r.deleted_at is null and r.customer_id is not null
      and r.status::text not in ('cancelled', 'draft')
  ),
  -- Days on rent so far: a finished rental to the day it came back, one still out to today (or its end if sooner).
  rd as (
    select r.*,
           case when r.went_out then
             case when r.status = 'completed' then coalesce(r.returned_on, least(r.end_date, (select today from org)), (select today from org))
                  else least(coalesce(r.end_date, (select today from org)), (select today from org)) end
           end as end_eff
    from r
  ),
  agg as (
    select rd.customer_id,
           count(*) filter (where rd.went_out)::int as rentals,
           coalesce(sum(greatest(1, rd.end_eff - rd.start_date + 1)) filter (where rd.went_out), 0)::int as rental_days,
           min(rd.start_date) filter (where rd.went_out) as first_start,
           max(case when rd.status = 'completed' then rd.end_eff else coalesce(rd.end_date, rd.start_date) end) filter (where rd.went_out) as last_end,
           min(rd.start_date) filter (where rd.status = 'booked' and rd.start_date >= (select today from org)) as next_start,
           (count(*) filter (where rd.damaged or rd.kept > 0))::int as damage_rentals
    from rd group by rd.customer_id
  ),
  cash as (
    select t.customer_id,
           sum(case
                 when coalesce(t.is_deposit, false) or t.type::text in ('deposit', 'deposit_received', 'deposit_refunded') then 0
                 when t.type::text in ('rental_income', 'charge_recovered', 'finders_fee_income', 'deposit_forfeited', 'deposit_deduction') and t.amount > 0 then abs(t.amount)
                 when t.type::text = 'refund' then -abs(t.amount)
                 else 0
               end) as revenue
    from transactions t
    where t.organization_id = p_org and t.deleted_at is null and coalesce(t.voided, false) = false and t.customer_id is not null
    group by t.customer_id
  ),
  -- Where they came from: their first booking link's channel, a partner referral, an import, else added directly.
  first_link as (
    select distinct on (b.customer_id) b.customer_id, b.rental_id, b.share_channels ->> 0 as channel,
           (b.booking_data ? 'referral') as referred
    from booking_links b
    where b.organization_id = p_org and b.deleted_at is null and b.customer_id is not null
    order by b.customer_id, b.created_at
  ),
  first_rental as (
    select distinct on (x.customer_id) x.customer_id, x.id, x.import_batch_id
    from rentals x
    where x.organization_id = p_org and x.deleted_at is null and x.customer_id is not null
    order by x.customer_id, x.created_at
  ),
  referred as (
    select distinct f.to_organization_id, f.rental_id from referrals f where f.to_organization_id = p_org and f.rental_id is not null
  ),
  reports as (
    select c.customer_id, count(*)::int as n from customer_reports c
    where c.organization_id = p_org and c.withdrawn_at is null and c.kind = 'damage_unpaid'
    group by c.customer_id
  )
  select c.id as customer_id,
         coalesce(agg.rentals, 0),
         coalesce(agg.rental_days, 0),
         agg.first_start,
         agg.last_end,
         agg.next_start,
         coalesce(cash.revenue, 0),
         case
           when fl.referred or fl.channel = 'partner' or exists (select 1 from referred x where x.rental_id in (fl.rental_id, fr.id)) then 'partner'
           when fl.channel = 'directory' then 'rove_rent'
           when fl.channel in ('public_page', 'website') then 'booking_page'
           when c.import_batch_id is not null or fr.import_batch_id is not null then 'imported'
           else 'direct'
         end,
         coalesce(agg.damage_rentals, 0) + coalesce(reports.n, 0)
  from customers c
  left join agg on agg.customer_id = c.id
  left join cash on cash.customer_id = c.id
  left join first_link fl on fl.customer_id = c.id
  left join first_rental fr on fr.customer_id = c.id
  left join reports on reports.customer_id = c.id
  where c.organization_id = p_org and c.deleted_at is null;
$$;

-- The last 12 months for the insights panel: new customers, rentals started, their days and money brought in.
create or replace function public.customer_month_stats(p_org uuid)
returns table (
  month date,
  new_customers integer,
  rentals integer,
  rental_days integer,
  revenue numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with org as (
    select coalesce(nullif(o.timezone, ''), 'Asia/Bangkok') as tz,
           (now() at time zone coalesce(nullif(o.timezone, ''), 'Asia/Bangkok'))::date as today
    from organizations o where o.id = p_org
  ),
  months as (
    select generate_series(date_trunc('month', (select today from org)) - interval '11 months', date_trunc('month', (select today from org)), interval '1 month')::date as month
  ),
  ret as (
    select i.rental_id, max((coalesce(i.submitted_at, i.created_at) at time zone (select tz from org))::date) as day
    from inspections i
    where i.organization_id = p_org and i.type = 'return' and i.deleted_at is null and i.rental_id is not null
    group by i.rental_id
  ),
  r as (
    select r.id, date_trunc('month', r.start_date)::date as month,
           greatest(1, (case when r.status::text = 'completed' then coalesce(ret.day, least(r.end_date, (select today from org)), (select today from org))
                            else least(coalesce(r.end_date, (select today from org)), (select today from org)) end) - r.start_date + 1) as days
    from rentals r left join ret on ret.rental_id = r.id
    where r.organization_id = p_org and r.deleted_at is null
      and r.status::text in ('active', 'due_soon', 'overdue', 'extended', 'completed')
      and r.start_date >= (select min(month) from months)
  ),
  rm as (
    select t.rental_id,
           sum(case
                 when coalesce(t.is_deposit, false) or t.type::text in ('deposit', 'deposit_received', 'deposit_refunded') then 0
                 when t.type::text in ('rental_income', 'charge_recovered', 'finders_fee_income', 'deposit_forfeited', 'deposit_deduction') and t.amount > 0 then abs(t.amount)
                 when t.type::text = 'refund' then -abs(t.amount)
                 else 0
               end) as revenue
    from transactions t
    where t.organization_id = p_org and t.deleted_at is null and coalesce(t.voided, false) = false and t.rental_id in (select id from r)
    group by t.rental_id
  ),
  nc as (
    select date_trunc('month', (c.created_at at time zone (select tz from org)))::date as month, count(*)::int as n
    from customers c where c.organization_id = p_org and c.deleted_at is null
    group by 1
  )
  select m.month,
         coalesce((select n from nc where nc.month = m.month), 0),
         (select count(*)::int from r where r.month = m.month),
         coalesce((select sum(r.days)::int from r where r.month = m.month), 0),
         coalesce((select sum(rm.revenue) from r join rm on rm.rental_id = r.id where r.month = m.month), 0)
  from months m
  order by m.month;
$$;

revoke execute on function public.customer_stats(uuid) from public, anon;
revoke execute on function public.customer_month_stats(uuid) from public, anon;
grant execute on function public.customer_stats(uuid) to authenticated;
grant execute on function public.customer_month_stats(uuid) to authenticated;
