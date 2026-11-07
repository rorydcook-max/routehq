-- Daily jobs on each business's own clock (lib/scheduled-runs.ts). The morning summary and customer reminders now
-- run hourly and pick up each business at its local hour; one row here per business, job and local day says that
-- day's run has been done, so a retried or overlapping cron call can't send twice. Inserted with ON CONFLICT DO
-- NOTHING: only one caller wins. Written only by the server (service role); nobody reads it from the app.
-- Additive only: a new table, nothing else changes.

create table if not exists public.scheduled_runs (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job text not null,
  local_date date not null,
  ran_at timestamptz not null default now(),
  primary key (organization_id, job, local_date)
);

-- Old rows are cleared after 60 days by the daily job.
create index if not exists scheduled_runs_ran_at_idx on public.scheduled_runs (ran_at);

alter table public.scheduled_runs enable row level security;
-- No policies: only the service role (cron routes) uses it.
