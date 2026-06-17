---
name: project-fleeetos
description: FleetOS car rental ERP platform — Next.js 15 / Supabase / TypeScript / Tailwind 4. Key context for ongoing development.
metadata:
  type: project
---

FleetOS: Next.js 15 / Supabase / TypeScript / Tailwind 4 vehicle rental platform for Thailand/SEA. Primary currency THB.

**Why:** Single-operator fleet management replacing spreadsheets. Mobile-first, Thai compliance (tax/insurance/service dates), multi-tenant Supabase RLS.

**How to apply:** Always use `as any` on Supabase client calls (typed as `any` in codebase). Organization isolation via `organization_id`. Use `createSupabaseServerClient()` for server queries. `getDefaultOrganization()` returns the active org. Auth via `getCurrentUserEmail()`. AppShell wraps pages.

Key lib files: `lib/dashboard.ts`, `lib/transactions.ts`, `lib/vehicle-detail.ts`, `lib/reports.ts`, `lib/organization.ts`. Components: `components/ui.tsx` (Card/SectionHeader/Badge/ProgressBar), `components/app-shell.tsx`.

recharts installed (added 2026-05-28). openai package installed. createSimplePdf in lib/simple-pdf.ts for basic PDF generation.

Transactions table: `transaction_date`, `type` (rental_income/deposit/repair/servicing/maintenance/fuel/insurance/tax/finance/fine/accessories/refund/other), `amount`, `vehicle_id`, `customer_id`, `organization_id`. Income types: rental_income, deposit. Everything else is expense.
