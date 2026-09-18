# Backend Architecture

## Product Scope

RouteHQ is modeled as a mixed-fleet rental operating system, not a car-only product. The core asset is `vehicles`, supported by `vehicle_categories` and `vehicle_types` so each organization can operate cars, motorcycles, scooters, e-bikes, vans, ATVs, and future asset classes such as boats or jetskis.

Vehicle-specific details live in `vehicles.specifications` as JSONB. This avoids schema churn when different vehicle classes need different fields:

- cars: `transmission`, `seating_capacity`
- motorcycles: `engine_cc`, `helmet_count`
- e-bikes: `battery_capacity`, `charge_cycles`

## Tenancy

Every business record belongs to `organizations.id`. Users gain access through `organization_members`, which assigns one of five roles:

- `owner`: full permissions, account settings, users, sensitive financial data
- `manager`: operational permissions, limited account settings
- `operator`: operational permissions for tasks, inspections, maintenance, mileage, fuel, walkarounds, and receipt submission
- `accountant`: payment, invoice, and transaction access
- `driver`: assigned delivery/pickup task access

All operational tables include `organization_id`, `created_at`, `updated_at`, and `deleted_at` where soft deletion is needed.

## Authentication

Supabase Auth is the identity provider. The app uses `@supabase/ssr` in:

- `middleware.ts` for session refresh
- `lib/supabase/server.ts` for server components, server actions, and route handlers
- `lib/supabase/browser.ts` for future client-side mutations/subscriptions

## Row-Level Security

RLS is enabled on all tenant-owned tables. Policies enforce:

- Members can read records in their organization.
- Owners and managers can manage operational records.
- Operators can view assigned tasks and submit operational data where allowed.
- Owners manage organization membership and settings.

## Payments, Messaging, And GPS

Provider integrations are interface-first and not hardcoded into schema logic:

- `providers/payments/` supports cash, PromptPay, Thai bank transfer, Wise, Revolut, Omise, Stripe, manual, and future providers.
- `providers/messaging/` supports WhatsApp, LINE, Messenger, email, SMS, push, and future channels.
- `providers/gps/` supports Teltonika, SinoTrack, GPSWOX, Wialon, and future providers.

Operational provider identifiers are stored as text fields such as `provider`, `provider_payment_id`, and `external_device_id` so new providers can be added without database migrations.

## File Storage

Private Supabase Storage bucket: `documents`

Storage path convention:

```text
{organization_id}/{owner_type}/{owner_id}/{document_id-or-filename}
```

Examples:

```text
00000000-0000-4000-8000-000000000001/vehicle/vehicle-id/registration-book.pdf
00000000-0000-4000-8000-000000000001/customer/customer-id/passport.jpg
00000000-0000-4000-8000-000000000001/rental/rental-id/signed-contract.pdf
```

The `documents` table stores metadata, OCR status, and extracted JSON. Storage policies read the first path segment as `organization_id` and enforce organization membership.

## Activity Events

`activity_events` is the append-only operational history table. Vehicle timelines, rental histories, document uploads, and financial events should write here after successful mutations.

## AI Trim Catalog Maintenance

`scripts/generate-trim-catalog.mjs` can generate draft Thailand-market vehicle trims with OpenAI for catalog review. It uses `OPENAI_API_KEY` and `OPENAI_TRIM_CATALOG_MODEL` server-side only; Blue Book OCR continues to use the separate `OPENAI_VISION_MODEL`.

Before running it, apply `supabase/migrations/0008_trim_metadata.sql`. Always dry-run first:

```powershell
node scripts/generate-trim-catalog.mjs --make Ford --model Ranger --dry-run
```

Review output quality, then run without `--dry-run` to insert `ai_generated` / `pending_review` rows. Manual or verified trim rows are not overwritten.

## Internationalization

The architecture is multilingual from the start:

- `organizations.default_locale`, `fallback_locale`, and `supported_locales`
- `users.preferred_locale`
- `customers.preferred_locale`
- `message_templates` with `template_type`, `template_key`, `locale`, and `version`
- `notification_templates` for channel-specific WhatsApp, Messenger, email, SMS, push, and in-app copy
- `contract_templates` for localized legal/rental documents
- `documents.locale`, `contracts.locale`, `invoices.locale`, `notifications.locale`
- locale files under `locales/{locale}/`

Initial operator locales are English, Thai, Bahasa Indonesia, Bahasa Malaysia, Vietnamese, Simplified Chinese, Russian, French, and Japanese. Customer-facing flows initially support English, Thai, Russian, Chinese, French, and Japanese.

All persisted text fields are Unicode-safe PostgreSQL `text`/`jsonb`. Thai, Chinese, Japanese, Cyrillic, and Latin content can be stored without Latin-only assumptions.

## Profitability

Per-vehicle profitability is calculated from real records:

- revenue/expenses from `transactions`
- billing state from `rental_payments`
- utilization from rental date overlap
- depreciation from `purchase_price` and `estimated_value`
- maintenance burden from maintenance transactions and `maintenance_events`

The calculation helper lives in `services/profitability.ts` and avoids hardcoded dashboard-only math.

## CRUD Pattern

Reusable CRUD lives in `lib/supabase/crud.ts`; server actions in `app/actions/crud.ts` add:

- organization scoping
- soft deletion
- activity event recording
- cache revalidation

## Optimistic Updates

`lib/optimistic.ts` defines generic optimistic create/update/delete reducers. UI screens can use this later without changing backend mutation contracts.
