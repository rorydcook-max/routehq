# RouteHQ — Codex Project Instructions

## Product Identity

This project is RouteHQ: a production-grade, SaaS-ready vehicle rental operating system for Southeast Asia.

It is NOT car-only rental software.

It must support:

- Cars
- Motorcycles
- Scooters
- E-bikes
- Vans
- ATVs
- Future vehicle categories such as boats, jetskis, tuk-tuks, golf carts, machinery, etc.

Primary market:

- Thailand first
- Southeast Asia later
- Small and mid-sized rental operators
- Long-term rentals
- Subscription rentals
- Mixed fleets
- Mobile-first workflows
- WhatsApp, Facebook Messenger, Facebook Marketplace-heavy operations

## Core Architecture Rules

1. Multi-tenant from day one.

Every major business table must be scoped by organization_id.

2. Use relational IDs.

Do not store relationships as embedded names or strings.

Use:

- organization_id
- vehicle_id
- customer_id
- rental_id
- branch_id
- document_id

3. Vehicle is the core asset.

Most platform data should connect back to vehicles where relevant:

- rentals
- transactions
- inspections
- maintenance
- compliance
- documents
- GPS
- profitability
- activity events

4. Important actions must create activity_events.

Examples:

- vehicle created
- rental created
- payment received
- payment overdue
- inspection completed
- document uploaded
- maintenance completed
- insurance renewed
- tax renewed
- GPS alert triggered

5. Do not hardcode car-only assumptions.

Use “vehicle”, not “car”, unless the context is specifically cars.

6. Do not invent fake metrics.

KPIs should come from real transactions, rentals, maintenance, documents, inspections, and events.

7. Keep business logic reusable.

Do not bury important business rules only inside page components.

8. Prefer provider/adaptor architecture for integrations.

Examples:

- providers/payments
- providers/messaging
- providers/gps
- providers/ocr

9. Do not hardcode third-party providers.

PromptPay, Omise, Stripe, WhatsApp, Messenger, Teltonika, GPSWOX, Wialon, etc. should be modular.

## Internationalization Rules

The platform must be multilingual from the beginning.

Supported initial languages:

- English: en
- Thai: th
- Bahasa Indonesia: id
- Bahasa Malaysia: ms
- Vietnamese: vi
- Chinese Simplified: zh
- Russian: ru
- French: fr
- Japanese: ja

Do not hardcode user-facing UI text.

Use translation keys.

All customer-facing flows must support localization:

- onboarding forms
- contracts
- invoices
- payment reminders
- WhatsApp templates
- Messenger templates
- inspection forms
- email templates

Use locale-aware formatting for:

- dates
- times
- currencies
- numbers

Initial currencies:

- THB
- IDR
- MYR
- VND
- USD

## Vehicle Catalog Rules

The vehicle catalog must support granular trims/variants.

One trim row should represent one specific purchasable variant, not a broad trim family.

Good:

- Wildtrak 2.0L Bi-Turbo 4x4 10AT
- Wildtrak 2.0L Turbo 4x2 10AT
- XLT 2.2L 4x2 6AT

Bad:

- Wildtrak
- XLT
- Ranger trims

Trim/variant data matters because it affects:

- vehicle identification
- rental pricing
- resale value
- insurance value
- features
- maintenance expectations
- profitability calculations

AI-generated vehicle catalog data must never be treated as verified truth.

AI-generated trims must use:

- source = ai_generated
- verification_status = pending_review
- confidence_score where available
- raw_ai_payload where available

Do not overwrite manually entered or verified trim data unless explicitly instructed.

Always allow manual custom trim entry when catalog data is incomplete.

## Data Quality Rules

Thailand and Southeast Asia vehicle data is messy.

Do not over-constrain database fields too early.

Support:

- facelift and pre-facelift versions
- local market variants
- motorcycle variants
- e-bike specifications
- manual overrides
- custom user-submitted data

## Security Rules

Never expose service role keys in browser code.

Never commit real API keys or secrets.

Secrets must live in:

- .env.local for local development
- deployment platform secrets for production

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY should be added to .env.local for full Google Maps location autocomplete and pin-drop functionality in booking delivery fields.

.env.local must be gitignored.

Use Supabase Row Level Security for tenant isolation.

## Build/Test Rules

Before finishing a coding task, attempt to run:

npm run build

If available, also run:

npm run lint

npm run typecheck

If a command cannot be run, explain why.

Do not add new features while the build is broken unless the task is specifically to fix the build.

## Current Product Priorities

Current priority order:

1. Build-clean project
2. Supabase-backed Add Vehicle workflow
3. Accurate vehicle catalog and trim selection
4. Add Customer
5. Create Rental
6. Record Payment
7. Add Transaction
8. Delivery/Return Inspection
9. Reminders
10. Documents
11. Profitability calculator integration
12. WhatsApp reminders
13. PromptPay/card payments
14. GPS tracking
15. Facebook/Messenger lead workflows

