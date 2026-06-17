create table public.vehicle_makes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  origin_country text,
  logo_url text,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table public.vehicle_models (
  id uuid primary key default gen_random_uuid(),
  make_id uuid not null references public.vehicle_makes(id) on delete cascade,
  name text not null,
  category_code text not null,
  body_type text,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(make_id, name)
);

create table public.vehicle_trims (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.vehicle_models(id) on delete cascade,
  name text not null,
  year_from integer not null,
  year_to integer,
  engine_cc integer,
  transmission text,
  fuel_type text,
  seating_capacity integer,
  drivetrain text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create index vehicle_makes_active_order_idx on public.vehicle_makes(is_active, sort_order, name);
create index vehicle_models_make_category_idx on public.vehicle_models(make_id, category_code, is_active, name);
create index vehicle_trims_model_year_idx on public.vehicle_trims(model_id, year_from, year_to, is_active);

alter table public.vehicle_makes enable row level security;
alter table public.vehicle_models enable row level security;
alter table public.vehicle_trims enable row level security;

create policy "Public can view vehicle makes" on public.vehicle_makes
  for select using (is_active = true);

create policy "Public can view vehicle models" on public.vehicle_models
  for select using (is_active = true);

create policy "Public can view vehicle trims" on public.vehicle_trims
  for select using (is_active = true);

create policy "Owners can manage vehicle makes" on public.vehicle_makes
  for all using (
    exists (
      select 1
      from public.organization_members member
      where member.user_id = auth.uid()
        and member.is_active = true
        and member.role = 'owner'
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members member
      where member.user_id = auth.uid()
        and member.is_active = true
        and member.role = 'owner'
    )
  );

create policy "Owners can manage vehicle models" on public.vehicle_models
  for all using (
    exists (
      select 1
      from public.organization_members member
      where member.user_id = auth.uid()
        and member.is_active = true
        and member.role = 'owner'
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members member
      where member.user_id = auth.uid()
        and member.is_active = true
        and member.role = 'owner'
    )
  );

create policy "Owners can manage vehicle trims" on public.vehicle_trims
  for all using (
    exists (
      select 1
      from public.organization_members member
      where member.user_id = auth.uid()
        and member.is_active = true
        and member.role = 'owner'
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members member
      where member.user_id = auth.uid()
        and member.is_active = true
        and member.role = 'owner'
    )
  );
