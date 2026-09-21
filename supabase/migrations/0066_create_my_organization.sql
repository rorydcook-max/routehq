-- 0066: self-service organisation creation.
--
-- Nothing previously created organisations: onboarding only updated an
-- existing one, so every organisation had to be made by hand. This adds
-- create_my_organization, called by a signed-in user who does not yet belong
-- to any organisation. In one transaction it creates the organisation (trial,
-- currency, locale and timezone all come from existing column defaults),
-- makes the caller its owner, and records their name in public.users.
--
-- Guards:
--   * caller must be signed in
--   * a per-user advisory lock serialises concurrent calls, so a double
--     submit cannot create two organisations
--   * refuses if the caller already has an active membership, so it cannot
--     be used to create extra organisations or to join someone else's
--   * business name must be 2-120 characters after trimming
--
-- Slugs are derived from the name plus a random suffix and retried on the
-- (unlikely) unique collision.

create or replace function public.create_my_organization(p_name text, p_full_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_full_name text := nullif(btrim(coalesce(p_full_name, '')), '');
  v_base text;
  v_slug text;
  v_org uuid;
  v_attempt int := 0;
begin
  if v_uid is null then
    raise exception 'Authentication is required.';
  end if;

  perform pg_advisory_xact_lock(hashtext('create_my_organization:' || v_uid::text));

  if exists (
    select 1 from public.organization_members
    where user_id = v_uid and is_active = true
  ) then
    raise exception 'You already belong to an organisation.';
  end if;

  if length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'Business name must be between 2 and 120 characters.';
  end if;

  v_base := btrim(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '-');
  if v_base = '' then
    v_base := 'business';
  end if;
  v_base := left(v_base, 40);

  loop
    v_attempt := v_attempt + 1;
    v_slug := v_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
    begin
      insert into public.organizations (name, slug)
      values (v_name, v_slug)
      returning id into v_org;
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then
        raise exception 'Could not allocate an organisation address. Please try again.';
      end if;
    end;
  end loop;

  insert into public.organization_members (organization_id, user_id, role, is_active)
  values (v_org, v_uid, 'owner', true);

  insert into public.users (id, full_name)
  values (v_uid, v_full_name)
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.users.full_name);

  return v_org;
end;
$$;

revoke all on function public.create_my_organization(text, text) from public;
grant execute on function public.create_my_organization(text, text) to authenticated;
