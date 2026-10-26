-- Four plans from 26 Oct 2026: Growth folded into Pro; the directory listing is in every plan.
update public.organizations set subscription_tier = 'pro' where subscription_tier = 'growth';
comment on column public.organizations.directory_addon is 'No longer used (26 Oct 2026): every plan is listed on the RouteHQ booking site.';
