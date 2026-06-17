alter type public.inspection_type add value if not exists 'condition_report';

alter table public.inspections
  add column if not exists type text,
  add column if not exists status text not null default 'draft',
  add column if not exists odometer_reading integer,
  add column if not exists fuel_level_label text,
  add column if not exists damage_items jsonb not null default '[]',
  add column if not exists photos jsonb not null default '[]',
  add column if not exists video_url text,
  add column if not exists customer_signature text,
  add column if not exists customer_signed_at timestamptz,
  add column if not exists customer_signed_name text,
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by uuid references auth.users(id) on delete set null;

update public.inspections
set type = case
  when inspection_type::text in ('delivery', 'return') then inspection_type::text
  else 'condition_report'
end
where type is null;

alter table public.inspections
  alter column type set not null;

alter table public.inspections
  alter column fuel_level drop default;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inspections'
      and column_name = 'fuel_level'
      and data_type <> 'integer'
  ) then
    alter table public.inspections
      alter column fuel_level type integer
      using case
        when lower(coalesce(fuel_level, '')) in ('empty', 'e') then 0
        when lower(coalesce(fuel_level, '')) in ('1/4', 'quarter') then 25
        when lower(coalesce(fuel_level, '')) in ('1/2', 'half') then 50
        when lower(coalesce(fuel_level, '')) in ('3/4', 'three_quarter', 'three quarters') then 75
        when lower(coalesce(fuel_level, '')) in ('full', 'f') then 100
        else nullif(regexp_replace(coalesce(fuel_level, ''), '[^0-9]', '', 'g'), '')::integer
      end;
  end if;
end $$;

update public.inspections
set
  odometer_reading = coalesce(odometer_reading, mileage),
  damage_items = case
    when damage_items = '[]'::jsonb then coalesce(damage_markers, '[]'::jsonb)
    else damage_items
  end
where odometer_reading is null or damage_items = '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inspections_type_check'
  ) then
    alter table public.inspections
      add constraint inspections_type_check check (type in ('delivery', 'return', 'condition_report'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'inspections_status_check'
  ) then
    alter table public.inspections
      add constraint inspections_status_check check (status in ('draft', 'submitted'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'inspections_fuel_level_check'
  ) then
    alter table public.inspections
      add constraint inspections_fuel_level_check check (fuel_level is null or fuel_level between 0 and 100);
  end if;
end $$;

create index if not exists inspections_org_type_status_idx
  on public.inspections(organization_id, type, status, created_at desc)
  where deleted_at is null;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'inspections'
      and policyname = 'Members can view inspections'
  ) then
    create policy "Members can view inspections" on public.inspections
      for select using (deleted_at is null and public.is_org_member(organization_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'inspections'
      and policyname = 'Operators can manage inspections'
  ) then
    create policy "Operators can manage inspections" on public.inspections
      for all using (public.has_org_role(organization_id, array['owner','manager','operator','driver']::public.organization_role[]))
      with check (public.has_org_role(organization_id, array['owner','manager','operator','driver']::public.organization_role[]));
  end if;
end $$;
