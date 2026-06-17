insert into public.organizations (
  id, name, slug, country_code, timezone, default_locale, fallback_locale, currency, supported_locales, supported_currencies
)
values (
  '00000000-0000-4000-8000-000000000001',
  'Demo Fleet Thailand',
  'demo-fleet',
  'TH',
  'Asia/Bangkok',
  'en',
  'en',
  'THB',
  array['en','th','id','ms','vi','zh','ru','fr','ja'],
  array['THB','IDR','MYR','VND','USD']
)
on conflict (slug) do update set
  supported_locales = excluded.supported_locales,
  supported_currencies = excluded.supported_currencies,
  updated_at = now();

insert into public.vehicle_categories (id, organization_id, code, name, description, icon, sort_order, is_system)
values
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', 'car', 'Car', 'Passenger cars and sedans', 'car', 10, true),
  ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', 'motorcycle', 'Motorcycle', 'Motorcycles and motorbikes', 'bike', 20, true),
  ('00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000001', 'scooter', 'Scooter', 'Scooters and mopeds', 'scooter', 30, true),
  ('00000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000001', 'ebike', 'E-bike', 'Electric bicycles and light EVs', 'battery', 40, true),
  ('00000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000001', 'van', 'Van', 'Vans and people movers', 'van', 50, true),
  ('00000000-0000-4000-8000-000000000016', '00000000-0000-4000-8000-000000000001', 'atv', 'ATV', 'ATVs and off-road vehicles', 'atv', 60, true)
on conflict (organization_id, code) do update set name = excluded.name, updated_at = now();

insert into public.vehicle_types (id, organization_id, category_id, code, name, default_spec_schema)
values
  ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'sedan', 'Sedan', '{"transmission":"string","seating_capacity":"number"}'),
  ('00000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'suv', 'SUV', '{"transmission":"string","seating_capacity":"number"}'),
  ('00000000-0000-4000-8000-000000000023', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', 'automatic_motorcycle', 'Automatic motorcycle', '{"engine_cc":"number","helmet_count":"number"}'),
  ('00000000-0000-4000-8000-000000000024', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000014', 'city_ebike', 'City e-bike', '{"battery_capacity":"string","charge_cycles":"number"}')
on conflict (organization_id, code) do update set default_spec_schema = excluded.default_spec_schema, updated_at = now();

insert into public.customers (
  id, organization_id, display_code, full_name, phone, nationality, preferred_locale, lifetime_value, document_status, open_balance
)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'C-9181', 'Maya Jensen', '+66 84 220 1184', 'Denmark', 'en', 88000, 'complete', 0),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'C-9174', 'Sofia Miller', '+66 93 445 9021', 'Germany', 'en', 142500, 'missing_license', 18500),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'C-9202', 'Daniel Koh', '+66 61 772 1039', 'Singapore', 'en', 62000, 'missing_passport', 62000)
on conflict (id) do update set
  full_name = excluded.full_name,
  phone = excluded.phone,
  lifetime_value = excluded.lifetime_value,
  document_status = excluded.document_status,
  open_balance = excluded.open_balance,
  updated_at = now();

insert into public.vehicles (
  id, organization_id, category_id, type_id, display_code, make, model, trim, year, color, registration_number,
  purchase_price, estimated_value, mileage, status, availability_status, daily_rate, weekly_rate, monthly_rate,
  utilization_12_month, utilization_lifecycle, revenue_generated, profit_generated, health_score, specifications
)
values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000021', 'V-1001', 'Toyota', 'Yaris Ativ', 'Smart', 2023, 'Pearl White', 'BKK-4821', 520000, 420000, 38420, 'rented', 'rented', 1100, 7000, 22000, 92, 86, 286000, 104500, 88, '{"transmission":"automatic","seating_capacity":5}'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000021', 'V-1002', 'Honda', 'City', 'SV', 2022, 'Meteoroid Gray', 'BKK-7712', 560000, 405000, 51210, 'available', 'available_now', 1200, 7600, 23500, 74, 68, 214500, 79200, 81, '{"transmission":"automatic","seating_capacity":5}'),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000022', 'V-1003', 'Mitsubishi', 'Xpander', 'GT', 2021, 'Black Mica', 'HKT-2040', 780000, 510000, 70260, 'maintenance', 'offline', 1500, 9400, 28500, 68, 76, 238000, 61400, 63, '{"transmission":"automatic","seating_capacity":7}'),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000022', 'V-1004', 'Toyota', 'Fortuner', 'Legender', 2024, 'Silver', 'CNX-9891', 1620000, 1480000, 18600, 'reserved', 'reserved', 2800, 17500, 62000, 86, 89, 496000, 188000, 94, '{"transmission":"automatic","seating_capacity":7}')
on conflict (organization_id, registration_number) do update set
  status = excluded.status,
  availability_status = excluded.availability_status,
  monthly_rate = excluded.monthly_rate,
  utilization_12_month = excluded.utilization_12_month,
  utilization_lifecycle = excluded.utilization_lifecycle,
  profit_generated = excluded.profit_generated,
  mileage = excluded.mileage,
  health_score = excluded.health_score,
  updated_at = now();

insert into public.rentals (
  id, organization_id, display_code, customer_id, vehicle_id, start_date, end_date, status,
  pricing_model, recurring_billing, billing_interval, rental_rate, deposit_amount, balance_due, currency,
  delivery_location, return_location
)
values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000001', 'R-4208', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000201', '2026-04-18', '2026-06-18', 'active', 'monthly', true, 'monthly', 22000, 10000, 0, 'THB', 'Bang Tao, Phuket', 'Bang Tao, Phuket'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000001', 'R-4211', '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000204', '2026-05-20', '2026-06-20', 'booked', 'monthly', true, 'monthly', 62000, 15000, 62000, 'THB', 'CNX Airport', 'CNX Airport'),
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000001', 'R-4192', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000203', '2026-03-01', '2026-05-15', 'overdue', 'monthly', true, 'monthly', 28500, 12000, 18500, 'THB', 'Rawai, Phuket', 'Rawai, Phuket')
on conflict (id) do update set status = excluded.status, balance_due = excluded.balance_due, updated_at = now();

update public.vehicles set
  current_customer_id = rental.customer_id,
  current_rental_id = rental.id
from public.rentals rental
where public.vehicles.id = rental.vehicle_id
  and rental.status in ('active', 'overdue');

insert into public.rental_payments (
  id, organization_id, rental_id, customer_id, vehicle_id, provider, payment_method, due_date, status, amount, currency
)
values
  ('00000000-0000-4000-8000-000000000351', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000201', 'promptpay', 'qr', '2026-05-01', 'paid', 22000, 'THB'),
  ('00000000-0000-4000-8000-000000000352', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000204', 'promptpay', 'qr', '2026-05-20', 'scheduled', 62000, 'THB'),
  ('00000000-0000-4000-8000-000000000353', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000203', 'promptpay', 'qr', '2026-05-15', 'overdue', 18500, 'THB')
on conflict (id) do update set status = excluded.status, amount = excluded.amount, updated_at = now();

insert into public.transactions (
  id, organization_id, display_code, vehicle_id, rental_id, customer_id, rental_payment_id, type, amount, currency, transaction_date, notes
)
values
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000001', 'T-8801', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000351', 'rental_income', 22000, 'THB', '2026-05-01', 'Monthly rental payment'),
  ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000001', 'T-8807', '00000000-0000-4000-8000-000000000203', null, null, null, 'maintenance', -8700, 'THB', '2026-05-15', 'Brake pads and oil service'),
  ('00000000-0000-4000-8000-000000000403', '00000000-0000-4000-8000-000000000001', 'T-8810', '00000000-0000-4000-8000-000000000204', null, null, null, 'finance', -26500, 'THB', '2026-05-16', 'Monthly finance obligation'),
  ('00000000-0000-4000-8000-000000000404', '00000000-0000-4000-8000-000000000001', 'T-8814', '00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000103', null, 'deposit', 15000, 'THB', '2026-05-17', 'Booking deposit received')
on conflict (id) do update set amount = excluded.amount, notes = excluded.notes, updated_at = now();

insert into public.maintenance_events (
  id, organization_id, vehicle_id, transaction_id, event_type, service_date, mileage, cost, supplier, notes, next_due_date
)
values
  ('00000000-0000-4000-8000-000000000451', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000402', 'oil_service_brakes', '2026-05-15', 70260, 8700, 'Local service partner', 'Brake pads and oil service', '2026-08-15')
on conflict (id) do update set cost = excluded.cost, updated_at = now();

insert into public.compliance_events (
  id, organization_id, vehicle_id, compliance_type, expiry_date, cost, provider, notes
)
values
  ('00000000-0000-4000-8000-000000000461', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', 'insurance', '2026-05-24', 0, 'Demo insurer', 'Insurance expires in 6 days'),
  ('00000000-0000-4000-8000-000000000462', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', 'tax', '2026-05-31', 0, null, 'Tax renewal due')
on conflict (id) do update set expiry_date = excluded.expiry_date, updated_at = now();

insert into public.reminders (
  id, organization_id, vehicle_id, rental_id, customer_id, type, severity, title_key, title, due_date
)
values
  ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', null, null, 'compliance', 'high', 'reminders.insuranceExpiring', 'Insurance expires in 6 days', '2026-05-24'),
  ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000204', null, null, 'payment', 'medium', 'reminders.financeDue', 'Finance payment due', '2026-05-22'),
  ('00000000-0000-4000-8000-000000000503', '00000000-0000-4000-8000-000000000001', null, '00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000102', 'rental', 'high', 'reminders.rentalOverdue', 'Rental overdue', '2026-05-15'),
  ('00000000-0000-4000-8000-000000000504', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', null, null, 'maintenance', 'high', 'reminders.serviceDueToday', 'Service due today', '2026-05-18')
on conflict (id) do update set severity = excluded.severity, due_date = excluded.due_date, updated_at = now();

insert into public.message_templates (
  id, organization_id, template_type, template_key, locale, version, title, subject, body, variables
)
values
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000001', 'message', 'payment_reminder', 'en', 1, 'Payment reminder', null, 'Hi {{customer_name}}, your rental payment of {{amount}} is due on {{due_date}}.', '["customer_name","amount","due_date"]'),
  ('00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000001', 'message', 'payment_reminder', 'th', 1, 'แจ้งเตือนการชำระเงิน', null, 'สวัสดี {{customer_name}} ยอดชำระ {{amount}} ครบกำหนดวันที่ {{due_date}}', '["customer_name","amount","due_date"]'),
  ('00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000001', 'contract', 'standard_rental', 'en', 1, 'Standard rental contract', null, 'Rental agreement for {{customer_name}} and {{vehicle_name}}.', '["customer_name","vehicle_name"]')
on conflict (organization_id, template_type, template_key, locale, version) do update set body = excluded.body, updated_at = now();

insert into public.notification_templates (
  id, organization_id, channel, template_key, locale, version, subject, body, variables
)
values
  ('00000000-0000-4000-8000-000000000711', '00000000-0000-4000-8000-000000000001', 'whatsapp', 'payment_reminder', 'en', 1, null, 'Hi {{customer_name}}, your rental payment of {{amount}} is due on {{due_date}}.', '["customer_name","amount","due_date"]'),
  ('00000000-0000-4000-8000-000000000712', '00000000-0000-4000-8000-000000000001', 'whatsapp', 'payment_reminder', 'th', 1, null, 'สวัสดี {{customer_name}} ยอดชำระ {{amount}} ครบกำหนดวันที่ {{due_date}}', '["customer_name","amount","due_date"]')
on conflict (organization_id, channel, template_key, locale, version) do update set body = excluded.body, updated_at = now();

insert into public.contract_templates (
  id, organization_id, template_key, locale, version, title, body, variables, jurisdiction
)
values
  ('00000000-0000-4000-8000-000000000721', '00000000-0000-4000-8000-000000000001', 'standard_rental', 'en', 1, 'Standard rental contract', 'Rental agreement for {{customer_name}} and {{vehicle_name}}.', '["customer_name","vehicle_name"]', 'TH'),
  ('00000000-0000-4000-8000-000000000722', '00000000-0000-4000-8000-000000000001', 'standard_rental', 'th', 1, 'สัญญาเช่ามาตรฐาน', 'สัญญาเช่าสำหรับ {{customer_name}} และ {{vehicle_name}}', '["customer_name","vehicle_name"]', 'TH')
on conflict (organization_id, template_key, locale, version) do update set body = excluded.body, updated_at = now();

insert into public.activity_events (
  id, organization_id, entity_type, entity_id, vehicle_id, rental_id, customer_id, event_type, title_key, title, detail, occurred_at
)
values
  ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000001', 'vehicle', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000101', 'payment_received', 'events.paymentReceived', 'Payment received', 'Monthly rental payment posted and profitability updated.', '2026-05-01 09:00:00+07'),
  ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000001', 'vehicle', '00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000203', null, null, 'service_completed', 'events.serviceCompleted', 'Service completed', 'Oil service and brake pads recorded with receipt attached.', '2026-05-15 14:30:00+07'),
  ('00000000-0000-4000-8000-000000000603', '00000000-0000-4000-8000-000000000001', 'vehicle', '00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000103', 'rental_booked', 'events.rentalBooked', 'Rental booked', 'Public intake link completed, deposit captured, contract pending signature.', '2026-05-17 11:00:00+07')
on conflict (id) do update set detail = excluded.detail;
