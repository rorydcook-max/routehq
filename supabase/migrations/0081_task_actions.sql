-- A job can point at what it is about, so the to-do list can offer the right
-- button and the job can close itself when that thing is dealt with.
--   action = 'refund'  : a customer cancelled after paying; closes when a refund is recorded
--   action = 'request' : a customer request that needs an answer; closes when it is answered
alter table public.tasks add column if not exists portal_action_id uuid;
alter table public.tasks add column if not exists action text;
create index if not exists tasks_open_action on public.tasks (rental_id, action) where completed_at is null;
