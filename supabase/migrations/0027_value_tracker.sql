-- Add operator profile field to organisations.
-- Used to determine whether time savings are valued at owner rate or staff rate.
-- Null = auto-detect from fleet size and user count.

alter table public.organizations
  add column if not exists fleet_manager_profile text
    check (fleet_manager_profile in ('solo_owner', 'owner_with_staff', 'staff_managed'));
