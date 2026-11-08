-- rove.rent listing is opt-in for new businesses (build-p, 8 Nov 2026).
--
-- A new business starts with settings.directory = { enabled: false, ask: true }: not listed on rove.rent, and asked
-- once ("Share your fleet on rove.rent and accept bookings there?") when its first vehicle is in the fleet
-- (components/rove-listing-prompt.tsx). Answering, or switching the listing in Settings, clears `ask`.
-- Existing businesses keep their current setting: only the default changes here, and lib/directory.ts still reads a
-- missing directory setting as listed.

alter table public.organizations alter column settings set default '{"directory": {"enabled": false, "ask": true}}'::jsonb;

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
  if exists (select 1 from public.organization_members where user_id = v_uid and is_active = true) then
    raise exception 'You already belong to an organisation.';
  end if;
  if length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'Business name must be between 2 and 120 characters.';
  end if;
  loop
    v_attempt := v_attempt + 1;
    v_slug := public.available_org_slug(v_name, null);
    begin
      -- Not listed on rove.rent until the owner says yes (asked once their first vehicle is added).
      insert into public.organizations (name, slug, settings)
      values (v_name, v_slug, '{"directory": {"enabled": false, "ask": true}}'::jsonb)
      returning id into v_org;
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then
        raise exception 'Could not allocate an organisation address. Please try again.';
      end if;
    end;
  end loop;
  insert into public.organization_members (organization_id, user_id, role, is_active) values (v_org, v_uid, 'owner', true);
  insert into public.users (id, full_name) values (v_uid, v_full_name)
  on conflict (id) do update set full_name = coalesce(excluded.full_name, public.users.full_name);
  return v_org;
end;
$function$;
