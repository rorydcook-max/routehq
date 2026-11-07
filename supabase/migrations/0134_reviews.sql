-- Renter reviews (Rory, 7 Nov 2026): one review request per returned rental, the renter's stars and words, and the
-- business's own choice to show it on its website with a public reply. See lib/reviews.ts.
--
-- A row is made when the request goes out (the day after the return, 10:00 local), holding the link's token.
-- It is filled in when the renter sends the form. Every rating is kept (no gating). A review is public only when the
-- renter said yes (consent) AND the business published it.
--
-- Access: business members read their own; every change goes through server actions (service role) after a role
-- check. The public reads published reviews only through public_published_reviews() and public_review_stats().

create table if not exists public.rental_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rental_id uuid not null references public.rentals(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  token text not null,
  requested_at timestamptz not null default now(),
  rating smallint check (rating between 1 and 5),
  body text check (body is null or char_length(body) <= 600),
  display_name text check (display_name is null or char_length(display_name) <= 60),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  consent boolean not null default false,
  submitted_at timestamptz,
  published boolean not null default false,
  published_at timestamptz,
  reply text check (reply is null or char_length(reply) <= 1000),
  replied_at timestamptz,
  checked_at timestamptz,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rental_reviews_rental_unique unique (rental_id),
  constraint rental_reviews_token_unique unique (token),
  constraint rental_reviews_token_length check (char_length(token) >= 16)
);

create index if not exists rental_reviews_org_submitted_idx on public.rental_reviews (organization_id, submitted_at desc) where submitted_at is not null;
create index if not exists rental_reviews_customer_idx on public.rental_reviews (customer_id) where submitted_at is not null;
create index if not exists rental_reviews_vehicle_idx on public.rental_reviews (vehicle_id) where submitted_at is not null;

create trigger rental_reviews_updated_at before update on public.rental_reviews for each row execute function public.set_updated_at();

alter table public.rental_reviews enable row level security;

-- Read only for signed-in members. No insert/update/delete policy: the renter's form and the business's
-- Publish / Hide / Reply go through server actions (service role) after their own checks.
create policy "Members can view reviews" on public.rental_reviews
  for select to authenticated
  using (public.is_org_member(organization_id));

-- Published reviews of one business, newest first: the renter said yes and the business published it.
create or replace function public.public_published_reviews(p_organization_id uuid, p_limit integer default 20)
returns table (
  id uuid,
  display_name text,
  country_code text,
  rating smallint,
  body text,
  vehicle_name text,
  reply text,
  submitted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.display_name, r.country_code, r.rating, r.body,
         nullif(trim(concat_ws(' ', v.make, v.model)), '') as vehicle_name,
         r.reply, r.submitted_at
  from public.rental_reviews r
  left join public.vehicles v on v.id = r.vehicle_id
  where r.organization_id = p_organization_id
    and r.submitted_at is not null
    and r.rating is not null
    and r.consent
    and r.published
  order by r.submitted_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

-- Average and count of the same published reviews.
create or replace function public.public_review_stats(p_organization_id uuid)
returns table (average numeric, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select round(avg(r.rating)::numeric, 1), count(*)
  from public.rental_reviews r
  where r.organization_id = p_organization_id
    and r.submitted_at is not null
    and r.rating is not null
    and r.consent
    and r.published;
$$;

grant execute on function public.public_published_reviews(uuid, integer) to anon, authenticated, service_role;
grant execute on function public.public_review_stats(uuid) to anon, authenticated, service_role;
