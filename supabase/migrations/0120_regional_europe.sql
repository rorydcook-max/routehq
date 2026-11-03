-- European and UK rental operators (3 Nov 2026). Additive only.
-- Distance unit and VAT settings live in organizations.settings (distance_unit, vat); country_code, timezone and
-- currency already have columns. Licence categories use the existing customers.license_type column.

-- The VAT inside a receipt's amount, for VAT-registered businesses (null when the business doesn't charge VAT).
alter table public.receipts add column if not exists vat_rate numeric;
alter table public.receipts add column if not exists vat_amount numeric;

-- A UK driver's DVLA licence check code (gov.uk/view-driving-licence), shown to UK operators on the customer.
alter table public.customers add column if not exists dvla_check_code text;
