-- 0067: every organisation keeps at least one active owner.
--
-- With owner and teammate roles, demoting, deactivating or removing an
-- organisation's only active owner would leave nobody able to change its
-- settings, billing or team - and nothing in the app could recover it.
-- This trigger refuses any change that would leave an organisation with no
-- active owner.
--
-- Cascading deletes are still allowed: when the organisation itself is being
-- deleted, or the owner's auth account is deleted, the membership row goes
-- with it and there is no organisation left to protect.

create or replace function public.protect_last_organization_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_was_active_owner boolean := old.role = 'owner' and old.is_active = true;
  v_still_active_owner boolean;
begin
  if not v_was_active_owner then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE' then
    v_still_active_owner := new.role = 'owner' and new.is_active = true and new.organization_id = old.organization_id;
    if v_still_active_owner then
      return new;
    end if;
  end if;

  -- cascade from deleting the organisation or the user: nothing left to protect
  if not exists (select 1 from public.organizations where id = old.organization_id) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if not exists (select 1 from auth.users where id = old.user_id) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if not exists (
    select 1 from public.organization_members
    where organization_id = old.organization_id
      and id <> old.id
      and role = 'owner'
      and is_active = true
  ) then
    raise exception 'A business must keep at least one active owner. Make someone else an owner first.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists protect_last_organization_owner on public.organization_members;
create trigger protect_last_organization_owner
  before update or delete on public.organization_members
  for each row execute function public.protect_last_organization_owner();
