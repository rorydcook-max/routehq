-- AI vehicle photos (task build-img, 8 Nov 2026): one row per image an AI provider made, generated or enhanced,
-- whether or not the owner kept it. Counted against the plan's monthly AI image allowance (lib/ai-image-quota.ts)
-- and kept as a record of what each image cost. Written and read by the server only (service role).
create table if not exists public.ai_image_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  kind text not null check (kind in ('generate', 'enhance')),
  provider text not null,
  model text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists ai_image_usage_org_created_idx on public.ai_image_usage (organization_id, created_at desc);

alter table public.ai_image_usage enable row level security;
