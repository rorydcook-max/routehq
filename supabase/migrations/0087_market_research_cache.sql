-- Market figures looked up for the buying calculator (what a model rents for,
-- costs to run and sells for in one area). Kept for a while so the same vehicle
-- gives the same answer each time it is checked, for every business in that area.
-- Public market facts only: nothing about any business or customer.
create table if not exists public.market_research_cache (
  cache_key text primary key,
  payload jsonb not null,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Read and written only by the server (service role); no policies on purpose.
alter table public.market_research_cache enable row level security;
