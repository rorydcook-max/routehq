-- A booking link holds its vehicle for a limited time (hold_until). When the
-- customer signs, the booking is confirmed and the hold no longer matters. If
-- the hold runs out first, the rental goes back to "draft" (which blocks
-- nothing), hold_released_at is set, and the link still works: opening it
-- takes the vehicle again if it is still free.

alter table public.booking_links
  add column if not exists hold_until timestamptz,
  add column if not exists hold_released_at timestamptz;

create index if not exists booking_links_hold_idx on public.booking_links (organization_id, hold_until) where hold_until is not null and hold_released_at is null;
