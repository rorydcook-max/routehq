alter table public.vehicle_catalog_submissions
  add column if not exists research_status text default 'not_started'
    check (research_status in ('not_started', 'researched', 'failed')),
  add column if not exists research_payload jsonb,
  add column if not exists research_sources jsonb,
  add column if not exists researched_at timestamptz;

create index if not exists vehicle_catalog_submissions_research_idx
  on public.vehicle_catalog_submissions(research_status, researched_at desc);
