-- Connecting LINE: the owner gets a short code in Settings and sends it to the
-- RouteHQ LINE account; the webhook matches the code and stores their LINE
-- user id. (LINE user ids are not shown anywhere in the LINE app.)
alter table public.organizations
  add column if not exists line_link_code text,
  add column if not exists line_link_code_expires_at timestamptz;

create unique index if not exists organizations_line_link_code_key
  on public.organizations (line_link_code)
  where line_link_code is not null;
