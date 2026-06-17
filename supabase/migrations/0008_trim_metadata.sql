alter table public.vehicle_trims
  add column if not exists source text default 'manual',
  add column if not exists verification_status text default 'verified',
  add column if not exists confidence_score numeric,
  add column if not exists raw_ai_payload jsonb;

create index if not exists vehicle_trims_review_idx
  on public.vehicle_trims(source, verification_status);
