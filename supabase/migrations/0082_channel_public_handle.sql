-- The name customers use to open a chat with the business's account (LINE basic
-- ID such as @samuicar, Telegram bot username), so their booking page can link
-- straight to it.
alter table public.messaging_channels add column if not exists public_handle text;
