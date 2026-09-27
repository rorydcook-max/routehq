-- rentals.balance_due was written by hand in a few places and drifted from the
-- payment schedule (a booking showed ฿10,000 owed against ฿13,000 of unpaid
-- rent; a signed rate change never reached it). It now always equals the sum
-- of the rental's unpaid, non-voided payments, kept up to date by a trigger.

create or replace function public.recompute_rental_balance(p_rental_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.rentals r
  set balance_due = case when r.status = 'cancelled' then 0 else coalesce((
    select sum(p.amount)
    from public.rental_payments p
    where p.rental_id = r.id
      and p.deleted_at is null
      and coalesce(p.voided, false) = false
      and coalesce(p.metadata ->> 'voided', 'false') <> 'true'
      and p.status not in ('paid', 'voided', 'waived', 'cancelled')
  ), 0) end
  where r.id = p_rental_id
    -- A booking with no schedule yet keeps its opening balance.
    and (r.status = 'cancelled' or exists (select 1 from public.rental_payments p where p.rental_id = r.id));
$$;

create or replace function public.rental_payments_recompute_balance()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.recompute_rental_balance(old.rental_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.rental_id is distinct from old.rental_id) then
    perform public.recompute_rental_balance(new.rental_id);
  end if;
  return null;
end;
$$;

drop trigger if exists rental_payments_recompute_balance on public.rental_payments;
create trigger rental_payments_recompute_balance
  after insert or update or delete on public.rental_payments
  for each row execute function public.rental_payments_recompute_balance();

revoke all on function public.recompute_rental_balance(uuid) from public, anon, authenticated;

-- Bring every existing rental into line.
select public.recompute_rental_balance(id) from public.rentals;
