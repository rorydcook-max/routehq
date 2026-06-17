alter table public.organizations
  add column if not exists promptpay_qr_url text;
