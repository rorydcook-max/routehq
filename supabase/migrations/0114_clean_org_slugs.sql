-- Clean booking addresses (Rory, 1 Nov 2026): a new business's address on Rove is its name, rove.rent/samuicar,
-- not samuicar-7bb4d0. Taken or reserved: the name with -01, -02 ... added. The random ending is the last resort.

create or replace function public.available_org_slug(p_base text, p_exclude uuid default null)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_base text := left(btrim(regexp_replace(lower(coalesce(p_base, '')), '[^a-z0-9]+', '-', 'g'), '-'), 40);
  v_try text;
  v_n int := 0;
  v_reserved text[] := array[
    'accept-invite','account','actions','amend','api','auth','book','bookings','business-closed','calendar','customers','documents',
    'fleet','forgot-password','help','import','inbox','inspections','invite','login','onboarding','partners','platform','rent',
    'rental-calculator','reports','reset-password','settings','signup','subscription-required','tasks','transactions','trial-expired',
    'contact','faq','guides','home','pricing','resources','manifest','icon','robots','sitemap','favicon','admin','www','app','rove','rovehq'
  ];
begin
  if v_base = '' or length(v_base) < 3 then
    v_base := coalesce(nullif(v_base, ''), 'business');
    if length(v_base) < 3 then v_base := v_base || '-rent'; end if;
  end if;
  v_try := v_base;
  loop
    if not (v_try = any(v_reserved))
       and not exists (select 1 from public.organizations o where o.slug = v_try and (p_exclude is null or o.id <> p_exclude))
       and not exists (
         select 1 from public.organizations o
         where o.settings -> 'previous_slugs' ? v_try and (p_exclude is null or o.id <> p_exclude)
       ) then
      return v_try;
    end if;
    v_n := v_n + 1;
    if v_n > 99 then
      return v_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
    end if;
    v_try := v_base || '-' || lpad(v_n::text, 2, '0');
  end loop;
end;
$$;

create or replace function public.create_my_organization(p_name text, p_full_name text default null::text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_full_name text := nullif(btrim(coalesce(p_full_name, '')), '');
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

  loop
    v_attempt := v_attempt + 1;
    v_slug := public.available_org_slug(v_name, null);
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
$function$;
