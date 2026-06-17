# SPEC.md Implementation Review

This review compares `SPEC.md` against the current codebase and turns it into a practical build path.

## Already Aligned

- Multi-tenant Supabase schema with `organizations` and `organization_members`.
- Mixed-fleet vehicle architecture using `vehicle_categories`, `vehicle_types`, and flexible `vehicles.specifications`.
- Roles exist for owner, manager, operator, accountant, and driver.
- Core operational tables exist for vehicles, customers, rentals, rental payments, transactions, documents, reminders, tasks, inspections, maintenance, compliance, contracts, invoices, GPS, notifications, and activity events.
- Provider boundaries exist for payments, messaging, and GPS.
- i18n structure exists with locale files for English, Thai, Indonesian, Malay, Vietnamese, Chinese, Russian, French, and Japanese.
- Dashboard UI covers KPIs, fleet intelligence, alerts, active rentals, customers, transactions, calendar summary, compliance, timeline, and rental calculator placeholder.

## Adjustments Made From The Spec

- Added LINE to the messaging/notification architecture because the spec identifies LINE as a Thailand-relevant secondary channel.
- Expanded payment provider typing to cover v1 manual methods: cash, PromptPay, Thai bank transfer, Wise, and Revolut, plus future Omise/Stripe.
- Cleaned `SPEC.md` encoding so Thai text and punctuation are readable.
- Updated architecture notes so roles, providers, and localization match the spec more closely.

## Gaps To Build Next

1. **Supabase connection and migrations**
   - Create the real Supabase project.
   - Apply migrations.
   - Seed the demo organization.
   - Confirm the dashboard reads from Supabase, not fallback data.

2. **Auth UI and protected routes**
   - Login page.
   - Invite partner user.
   - Organization/member bootstrap.
   - User locale defaults: owner English, partner Thai.

3. **Vehicle profiles**
   - Add/edit/view vehicle.
   - Compliance dates.
   - Document upload.
   - Vehicle timeline from `activity_events`.

4. **Compliance alerts**
   - Generate escalating reminders from compliance dates.
   - Surface critical/expired states.
   - Wire dashboard compliance grid to real `compliance_events`.

5. **Transaction quick-capture**
   - Mobile form under the `+` action.
   - Vehicle link required unless explicitly general.
   - Payment method support: cash, PromptPay, bank transfer, Wise, Revolut.
   - Receipt upload to Supabase Storage.
   - Activity event on save.

6. **Rental payment recording**
   - Record payment against a rental.
   - Update `rental_payments`, `transactions`, rental balance, customer open balance, and activity events.

7. **Inspection forms**
   - Delivery inspection.
   - Return inspection.
   - Mileage, fuel, damage markers, photos/videos, signatures.
   - Deposit reconciliation.

8. **Booking link flow**
   - Owner creates booking.
   - Customer public link.
   - Customer uploads documents and signs contract.
   - Contract PDF generation later.

## Recommended Immediate Next Build

Build **Vehicle Profiles + Add Vehicle** first.

Reason:

- It is foundational for rentals, transactions, compliance, documents, GPS, and inspections.
- It exercises the mixed-fleet model.
- It lets you enter your real fleet before building more complex workflows.

Minimum scope:

- Vehicle list reads from Supabase.
- Add vehicle form.
- Edit core details.
- Add compliance dates.
- Add rental rates.
- Add purchase price and estimated value.
- Save to `vehicles`, `maintenance_events`, and `compliance_events` as appropriate.

## Product Notes

- `SPEC.md` is now the product source of truth.
- `docs/backend-architecture.md` is the technical backend source of truth.
- This review should be updated after each major feature so future Codex/ChatGPT sessions know what changed.
