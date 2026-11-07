# GDPR, UK GDPR and Thai PDPA: internal record

Internal working record for RoveHQ (3 Nov 2026). Written from public guidance (ICO, EDPB, European Commission, Thai PDPC); **not reviewed by a lawyer** (Rory's rule). Public pages: `content/legal/en/*.md`, shown at rovehq.io/legal.

## Roles

| Data | RoveHQ's role | Basis for RoveHQ |
|---|---|---|
| Operators' renters, drivers, messages, ID photos, agreements, payments, checks | **Processor** for each business (controller) | DPA (`/legal/dpa`), Art. 28 |
| Operator accounts, team members, billing, support, website visitors | **Controller** | Contract, legal obligation, legitimate interests; consent for analytics |
| Renter list (renters who tick "Send me trip extras") | **Controller** | Consent (Art. 6(1)(a); PDPA s.19), version `2026-10-25c` in `renter_consents` |
| Shared customer history | Businesses are controllers (legitimate interest: fraud and loss prevention); RoveHQ provides the tool (processor / possibly joint controller: see open decisions) | Terms s.6 |
| Shared rental prices | Non-personal aggregates (3+ businesses per model) | Terms s.7 |

## Processing activities (Art. 30 summary)

| Activity | Data subjects | Categories | Retention | Where |
|---|---|---|---|---|
| Running rentals for operators | Renters, drivers | Identity, contact, ID numbers and photos, selfie, signature, bookings, payments, messages, vehicle check photos | Operator decides; customer delete; optional ID-photo auto-delete (default 24 months, off by default) | Supabase SG |
| AI reading of ID/licence/receipt/slip photos | Renters, operators | Photo content (name, numbers, dates, amounts) | Not kept by RoveHQ beyond the document; providers keep briefly for abuse monitoring | Anthropic US (fallback OpenAI US, Gemini) |
| Messaging (LINE, Telegram, WhatsApp), email (Resend, planned) | Renters, operators | Contact IDs, message content | With the business's records | Provider locations |
| Operator accounts and billing | Owners, team | Name, email, role, plan, invoices | Account life; tax records per law | Supabase SG |
| Renter list | Opted-in renters | Contact, nationality, DOB, rental summaries | Until withdrawn (TO DECIDE: 3 years after last rental) | Supabase SG |
| Website and chat | Visitors | Messages, chat thread, analytics (consent) | Support 2 years (TO IMPLEMENT); GA 14 months | Vercel SG, Google |
| Shared customer history | Reported renters | Report kind, amount, summary, reporter | `customer_reports.expires_at` | Supabase SG |

## Sub-processors

See `content/legal/en/subprocessors.md` (public page `/legal/subprocessors`, Annex 3 of the DPA). Change process: 30 days' notice by email to account owners plus page update; objection by email; refund of prepaid time if unresolved. **No email sender exists for this yet**: send manually until Resend is live.

## What the product does (implemented 3 Nov 2026)

- **Legal pages**: `/legal`, `/legal/{privacy,terms,dpa,subprocessors,cookies}` (prerendered in every language, English text; `lib/site/legal.ts`). Linked in the website footer, My account, and booking pages ("How {business} and RoveHQ use your information").
- **Cookie consent** (website only; the app sets only necessary cookies): `lib/consent.ts`, banner `app/(site)/site/[locale]/_components/cookie-banner.tsx`. API: `hasConsent("analytics")`, `onConsentChange(cb)`, event `rovehq:consent` on window, `window.rovehqConsent`. Stored in localStorage + cookie `rovehq_consent`, 6 months.
- **Business export**: My account (owner) → `/account/export` (JSON; documents with 7-day signed links; secrets and booking tokens removed).
- **Business delete**: My account (owner), typed name → `purge_organization_data()` (migration 0119) + storage removal. Immediate and irreversible; sign-in accounts stay.
- **Customer export / delete**: customer page, Details tab, "Privacy requests" (owner, manager). Delete = `erase_customer()`: removes ID documents and files, messages, reports, renter-list links; anonymises the customer row ("Deleted customer"); keeps bookings, payments, transactions and signed agreements. Refused while a booking is open.
- **Renter list**: renter withdraws by unticking on their booking page (deletes RoveHQ's copy, keeps match keys + date); RoveHQ staff can "Remove from list" in /platform/renters (deletes the renter row, rentals and links).
- **ID-photo retention**: daily in `/api/cron/payment-status` → `runIdPhotoRetention` (`lib/privacy/erase.ts`). `ID_PHOTO_RETENTION` unset/`dry-run` = log only; `on` = delete, only for businesses that switched it on in My account; `off` = skip. 200 per run. Candidates: passport/driver_license/selfie documents of customers with no open booking whose last rental ended more than N months ago.

## Open decisions for Rory

1. **Legal entity**: name, address, company number, governing law; fill the *[to be added]* placeholders in all five pages.
2. **EU representative (Art. 27 GDPR)**: likely required once RoveHQ offers its service to businesses in the EU without an EU establishment (Art. 3(2)). The Art. 27(2) exemption (occasional, low-risk, no large-scale special data) is doubtful because RoveHQ stores ID documents continuously. Appoint a representative service in an EU member state; name it in the privacy policy.
3. **UK representative (Art. 27 UK GDPR)**: same reasoning for UK operators.
4. **DPO (Art. 37)**: likely not required: RoveHQ is not a public body, and its core activities are not large-scale regular and systematic monitoring or large-scale special-category data. Re-check if the renter list or shared customer history grows large (shared history could be read as systematic monitoring at scale).
5. **EU database option**: data is in Singapore (no EU adequacy). SCCs + TIA are the route now. An EU Supabase region (e.g. Frankfurt) for EU businesses would cut transfer risk and is a selling point; it means a second project or region-aware routing.
6. **Transfer impact assessment**: write a short TIA for Singapore and the US providers (EDPB Recommendations 01/2020).
7. **Shared customer history**: confirm the role split (businesses as controllers vs joint controllers with RoveHQ, Art. 26) and whether a DPIA is needed (Art. 35: evaluation/scoring, data that may lead to refusal of service). A DPIA is recommended.
8. **Renter list retention**: confirm "3 years after last rental" and implement the cleanup.
9. **Business closed for non-payment**: the terms say 30 days to download before deletion; admin purge exists but nothing purges automatically.
10. **Admin purge** (`admin_purge_organization`, migration 0108b) doesn't set `rovehq.purge` (signed agreements block it) and leaves storage files: switch it to `purge_organization_data()`.
11. **Migration 0119**: `id_photo_retention_candidates` is applied; `erase_customer` and `purge_organization_data` need Rory's approval to apply (the database tool asks for confirmation on functions that delete rows). Until then the delete buttons say "isn't available yet".
12. **Marketplace fee wording**: terms say "a service fee applies"; make sure the app shows it before a business turns the marketplace on.
13. **privacy@rovehq.io / hello@rovehq.io**: make sure these mailboxes exist.

## Türkiye (KVKK), added 7 Nov 2026: owner's to-dos

Public text: KVKK section of `content/legal/en/privacy.md`, Annex 4 of `content/legal/en/dpa.md`. Sources: KVKK No. 6698 as amended by Law No. 7499 (Resmî Gazete 12 Mar 2024, in force 1 Jun 2024); Regulation on the Transfer of Personal Data Abroad (Resmî Gazete 10 Jul 2024, No. 32598); KVKK standard-contract notification module (kvkk.gov.tr, Oct 2024); VERBIS exemption decisions (2023/1154: under 50 employees and balance sheet under 100 million TL; 2025/1572: tighter limits for controllers whose main activity is special-category data). Not reviewed by a lawyer.

1. **Standard contracts for transfers abroad (KVKK art. 9).** Sign the Board's standard contracts (unchanged text) for each transfer of Turkish personal data out of Türkiye: RoveHQ → Supabase/AWS Singapore, Vercel, Anthropic/OpenAI/Google, email and messaging providers (as processor-to-sub-processor), and offer the controller-to-processor module to Turkish businesses. **Each must be notified to the Authority within 5 business days of signing** (KEP, in person, or the online module). Fines for not notifying: 90,308–1,806,377 TRY (2026). Decide who notifies each one (exporter).
2. **VERBIS.** Controllers established abroad that process data of people in Türkiye are expected to register regardless of size: confirm and register RoveHQ (as controller for business accounts, website and renter list) before taking Turkish customers. Turkish rental businesses register themselves unless exempt.
3. **Representative in Türkiye.** A foreign controller registering on VERBIS names a data controller representative (a Turkish legal entity or resident Turkish citizen). Appoint one and fill the placeholder in the privacy policy.
4. **Explicit consent (açık rıza)** for the renter list and analytics from people in Türkiye: the current opt-in tick and cookie banner are consent mechanisms; check the Turkish wording of the tick box once the `tr` translation lands.
5. **Breach notification**: 72 hours to the Board; DPA promises 48 hours to businesses (no change needed).
6. **Data-subject applications**: 30 days (KVKK art. 13), shorter than GDPR's one month + two: privacy@ mailbox owner must know.
7. **Transfer cut-off**: consent-only transfers abroad stopped being valid on 1 Sep 2024; standard contracts must be in place before the first Turkish business signs up.
