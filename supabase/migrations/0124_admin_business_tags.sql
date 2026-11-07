-- Admin › Businesses (7 Nov 2026): manual tags the RoveHQ team puts on a business ("test", "vip"), used with the
-- automatic segments to filter the list and, later, to pick who gets an email. Only the admin console reads or writes
-- them (service role); the business never sees them. Adds a column with a default, so it is safe to run on a live
-- database and safe to run twice.

alter table public.organizations
  add column if not exists admin_tags text[] not null default '{}';

create index if not exists organizations_admin_tags_idx on public.organizations using gin (admin_tags);

comment on column public.organizations.admin_tags is 'RoveHQ admin console tags (lower case). Not shown to the business.';
