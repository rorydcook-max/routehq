-- The free rental agreement can be filled in with the operator's own details (Rory, 28 Oct 2026):
-- what they typed is kept with the lead so the signed 7-day link can build their personalised contract.
alter table public.leads add column if not exists contract jsonb;
alter table public.leads add column if not exists contract_country text;
alter table public.leads add column if not exists logo_path text;
comment on column public.leads.contract is 'Values typed into the free contract builder (business, vehicle, prices, rules). Used only to generate their download.';
comment on column public.leads.contract_country is 'Which country version of the agreement they chose (TH, ID, VN, MY, PH, LA, KH, XX).';
comment on column public.leads.logo_path is 'Their logo for the contract, in the private branding bucket (leads/<id>/logo.<ext>).';
