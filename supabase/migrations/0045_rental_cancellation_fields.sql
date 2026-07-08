-- Add cancellation tracking columns to rentals table
alter table public.rentals
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_notes text,
  add column if not exists cancellation_refund_option text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists collection_datetime timestamptz;

-- Add vehicle repair tracking to vehicles table
-- Tracks when a vehicle is in repair and expected back
alter table public.vehicles
  add column if not exists repair_started_at timestamptz,
  add column if not exists repair_expected_end timestamptz,
  add column if not exists repair_notes text;
