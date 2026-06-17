-- Travel policy settings are stored in public.organizations.settings JSONB.
-- No table schema change is required for FleetOS installs using the current
-- organizations.settings architecture.
--
-- Application defaults added in lib/organization.ts:
-- home_territory: text
-- home_territory_type: 'island' | 'mainland'
-- island_travel_policy: 'deposit_required' | 'notice_only' | 'not_permitted'
-- secondary_deposit_amount: numeric
-- geofence_monitoring_enabled: boolean
-- country: text
-- jurisdiction: text
-- mileage_limit: integer
-- fuel_charge_per_increment: numeric
-- late_fee_percentage: numeric
-- cleaning_fee_minimum: numeric
-- smoking_fee_maximum: numeric
-- emergency_repair_limit: numeric
-- deposit_return_days: integer
-- owner_line_id: text
-- owner_whatsapp: text
-- promptpay_id: text

update public.organizations
set settings = coalesce(settings, '{}'::jsonb)
  || jsonb_build_object(
    'home_territory', coalesce(settings->>'home_territory', settings->'main_location'->>'town', 'Koh Samui'),
    'home_territory_type', coalesce(settings->>'home_territory_type', 'island'),
    'island_travel_policy', coalesce(settings->>'island_travel_policy', 'deposit_required'),
    'secondary_deposit_amount', coalesce((settings->>'secondary_deposit_amount')::numeric, 5000),
    'geofence_monitoring_enabled', coalesce((settings->>'geofence_monitoring_enabled')::boolean, false),
    'country', coalesce(settings->>'country', settings->'main_location'->>'country', 'Thailand'),
    'jurisdiction', coalesce(settings->>'jurisdiction', 'the Kingdom of Thailand'),
    'mileage_limit', coalesce((settings->>'mileage_limit')::integer, 1500),
    'fuel_charge_per_increment', coalesce((settings->>'fuel_charge_per_increment')::numeric, 150),
    'late_fee_percentage', coalesce((settings->>'late_fee_percentage')::numeric, 5),
    'cleaning_fee_minimum', coalesce((settings->>'cleaning_fee_minimum')::numeric, 500),
    'smoking_fee_maximum', coalesce((settings->>'smoking_fee_maximum')::numeric, 2000),
    'emergency_repair_limit', coalesce((settings->>'emergency_repair_limit')::numeric, 2000),
    'deposit_return_days', coalesce((settings->>'deposit_return_days')::integer, 5),
    'owner_line_id', coalesce(settings->>'owner_line_id', settings->>'line_id', ''),
    'owner_whatsapp', coalesce(settings->>'owner_whatsapp', settings->>'whatsapp', ''),
    'promptpay_id', coalesce(settings->>'promptpay_id', '')
  )
where settings is null
   or settings ? 'home_territory' = false
   or settings ? 'jurisdiction' = false;
