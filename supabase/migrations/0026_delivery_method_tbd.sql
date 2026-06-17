alter table public.booking_links
  add column if not exists delivery_method text default 'delivery';

alter table public.rentals
  add column if not exists delivery_method text default 'delivery',
  add column if not exists delivery_datetime timestamptz;

update public.booking_links
set delivery_method = coalesce(
  nullif(booking_data->>'delivery_method', ''),
  delivery_method,
  'delivery'
)
where delivery_method is null
   or delivery_method not in ('delivery', 'collection', 'tbd');

update public.rentals
set delivery_method = coalesce(delivery_method, 'delivery')
where delivery_method is null
   or delivery_method not in ('delivery', 'collection', 'tbd');

alter table public.booking_links
  drop constraint if exists booking_links_delivery_method_check;

alter table public.booking_links
  add constraint booking_links_delivery_method_check
  check (delivery_method in ('delivery', 'collection', 'tbd'));

alter table public.rentals
  drop constraint if exists rentals_delivery_method_check;

alter table public.rentals
  add constraint rentals_delivery_method_check
  check (delivery_method in ('delivery', 'collection', 'tbd'));
