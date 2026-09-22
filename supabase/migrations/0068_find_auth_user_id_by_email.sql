-- 0068: look up an existing account by email, for team invites.
--
-- Inviting someone who already has a RouteHQ account should add them to the
-- inviter's business instead of refusing. auth.users is not reachable through
-- the API, so the server needs this lookup.
--
-- It is executable by service_role only - never by signed-in users or the
-- public - because otherwise anyone could use it to test which email
-- addresses have accounts.

create or replace function public.find_auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = auth, public
as $$
  select id
  from auth.users
  where lower(email) = lower(btrim(p_email))
  limit 1;
$$;

revoke all on function public.find_auth_user_id_by_email(text) from public;
revoke all on function public.find_auth_user_id_by_email(text) from anon;
revoke all on function public.find_auth_user_id_by_email(text) from authenticated;
grant execute on function public.find_auth_user_id_by_email(text) to service_role;
