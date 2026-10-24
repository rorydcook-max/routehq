-- What the importer has learned from a business's own corrections, so its next import reads the same way:
--   kind 'column': a column heading the owner re-mapped ("Rego" -> registration_number, "Cost centre" -> ignore)
--   kind 'cost':   a cost description the owner re-categorised ("Lazada GPS" -> accessories)
-- Keys are stored lower-cased with spaces collapsed. One row per business, kind and key; the latest choice wins.
create table if not exists public.import_learnings (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('column', 'cost')),
  key text not null check (char_length(key) between 1 and 200),
  value text not null check (char_length(value) between 1 and 60),
  uses integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (organization_id, kind, key)
);

alter table public.import_learnings enable row level security;

create policy import_learnings_member_select on public.import_learnings for select using (is_org_member(organization_id));
create policy import_learnings_member_insert on public.import_learnings for insert with check (is_org_member(organization_id));
create policy import_learnings_member_update on public.import_learnings for update using (is_org_member(organization_id));
create policy import_learnings_member_delete on public.import_learnings for delete using (is_org_member(organization_id));
