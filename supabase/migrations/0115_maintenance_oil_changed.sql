-- Services and repairs: whether the oil was changed, so "last oil change" can be tracked apart from "last service" (1 Nov 2026).
alter table public.maintenance_events add column if not exists oil_changed boolean not null default false;
update public.maintenance_events set oil_changed = true where event_type = 'oil_change';
