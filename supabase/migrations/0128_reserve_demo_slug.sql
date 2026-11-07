-- Booking page templates (Rory, 7 Nov 2026): /rent/demo/<id> holds the example booking pages and /booking-pages is a
-- website page, so no business may take "demo" or "booking-pages" as its address. Same function as 0114, two more
-- reserved names. Used by create_my_organization (new businesses) and the rename in Settings (app/actions/booking-address.ts).

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
    'contact','faq','guides','home','pricing','resources','manifest','icon','robots','sitemap','favicon','admin','www','app','rove','rovehq',
    'demo','booking-pages'
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
