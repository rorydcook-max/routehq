-- The foreign key from organizations to support_threads made "support_threads -> organizations" embeds
-- ambiguous (two relationships), which broke the Help pages. Keep the column, drop the key.
alter table public.organizations drop constraint if exists organizations_plan_request_thread_id_fkey;
