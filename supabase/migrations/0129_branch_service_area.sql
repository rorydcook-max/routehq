-- Service area per branch (Rory, 7 Nov 2026). Each location already has latitude/longitude; this adds how far the
-- business delivers and collects around it. The partner network search matches a searched place against it, and
-- delivery can reuse it later. Separate from the travel rules ("how far customers may drive"), which stay in
-- organizations.settings.travel_rules.
-- null = not set yet (search assumes 10 km around the branch, or around its town when it has no pin);
-- 0 = customers come to the branch only. Always stored in km (the form converts miles).
-- Additive only, safe to run on a live database and safe to run twice. RLS: the existing branches policies apply.
alter table public.branches add column if not exists service_radius_km numeric(6,1);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'branches_service_radius_km_check') then
    alter table public.branches
      add constraint branches_service_radius_km_check check (service_radius_km is null or (service_radius_km >= 0 and service_radius_km <= 500));
  end if;
end $$;

comment on column public.branches.service_radius_km is 'Delivers and collects within this many km of the branch pin (0 = pickup at the branch only; null = not set).';
