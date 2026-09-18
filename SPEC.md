# RouteHQ — Product Specification v1.0
*Compiled: May 2026*

---

## 1. Product Overview

**RouteHQ** is a vehicle rental fleet management platform designed initially for small-to-medium rental operators in Thailand and Southeast Asia, with a roadmap to scale as a commercial SaaS product. The first version is built for a single owner-operator managing a mixed fleet of cars, with Thai compliance requirements, THB as primary currency, and mobile-first usage patterns.

**Primary users:** Fleet owner/operator (Rory) and partner — both working primarily from mobile with occasional laptop use.

**Languages (v1):** English (owner) and Thai (partner/staff). Future: Russian, Chinese, Bahasa, Vietnamese, French, Japanese, Korean.

**Primary currency:** Thai Baht (THB). Multi-currency support in schema from day one.

---

## 2. Core Design Principles

- **Mobile-first.** Every feature must work cleanly on a phone. No feature requires a laptop.
- **Speed of capture.** Adding a transaction, logging a delivery, or recording a repair should take under 30 seconds on mobile.
- **Replace the spreadsheet.** Every piece of data currently tracked manually (compliance dates, transactions, rental payments, mileage) must have a home in RouteHQ. Nothing should require a separate spreadsheet.
- **Eliminate memory-to-data lag.** The biggest current pain point is data entered from memory hours or days after the fact. The app must make real-time capture frictionless.
- **Alert before the problem.** Compliance expiries, payment dues, and service intervals surface as escalating alerts — not discovered by chance.

---

## 3. User Roles (v1)

| Role | Access |
|---|---|
| **Owner** | Full access to all data, settings, financial data, user management |
| **Manager** | Operational access, limited financial data |
| **Operator** | Task completion, inspections, mileage/fuel logging, receipt submission |
| **Accountant** | Payment, invoice, and transaction access |
| **Driver** | Assigned delivery/pickup tasks only |

*v1 supports two users: the owner and partner. Both have full Owner-level access — identical permissions across all data, settings, and features. Role differentiation (Manager, Operator, etc.) is built into the schema for future staff and SaaS use but is not enforced in v1.*

### 3.1 v1 User Setup

- Owner (Rory) — full access, English UI default
- Partner — full access, Thai UI default
- Both invited via email, each sets their own password
- Either can perform any action in the system

---

## 4. Fleet & Vehicle Management

### 4.1 Vehicle Profile

Each vehicle has a dedicated profile containing:

**Identity**
- Make, model, trim, year, colour
- Registration number (plate)
- Vehicle category (car, motorcycle, scooter, e-bike, van, ATV, boat — future)
- Display code (internal reference, e.g. V-001)
- Purchase price and estimated current value
- Odometer/mileage (updated at each delivery/return)
- Specifications (JSONB — e.g. transmission, seating capacity, engine cc)
- Photos (exterior, interior, documents)

**Compliance dates** — all with colour-coded status (green/amber/red) and escalating alerts:
- Annual vehicle tax (ต่อภาษี) expiry
- Compulsory insurance (พรบ) expiry
- Voluntary/full insurance expiry
- Next scheduled service date
- Outstanding finance due date (if applicable)
- Tyre replacement due (km or date based)
- Oil change due (km or date based)

**Financial summary**
- Total revenue generated (lifetime)
- Total expenses (lifetime)
- Net profit (lifetime)
- Monthly revenue (current/recent)
- Depreciation (purchase price minus estimated current value)
- ROI

**Utilization**
- 12-month utilization rate (% of days rented in last 12 months)
- Lifecycle utilization rate (% of days rented since purchased)
- Desired rental rate vs actual rental rate
- Days rented / days available / days in maintenance

**Current status**
- Available / Rented / Reserved / Maintenance / Inactive
- If rented: who has it, return date, outstanding balance
- GPS status (online/offline, last seen, credit status)
- Health score (composite of maintenance burden, compliance status, utilization)

### 4.2 Vehicle List View

- Card or table view toggle
- Filter by status (Available / Rented / Maintenance / Reserved)
- Sort by: utilization, profit, health score, plate number
- At-a-glance compliance traffic lights per vehicle
- Quick action buttons: Add Transaction, Add Event, View Profile

### 4.3 Adding a New Vehicle

Step-by-step mobile form:
1. Make / Model / Trim / Year / Colour
2. Registration plate
3. Vehicle category and type
4. Purchase price and estimated current value
5. Odometer at acquisition
6. Compliance dates (tax, compulsory insurance, full insurance, next service)
7. Daily / weekly / monthly rental rates
8. Finance details (if applicable — lender, monthly payment, outstanding balance)
9. GPS device assignment (select from registered devices or add new)
10. Upload photos (optional at setup, can add later)

---

## 5. Rental Management

### 5.1 Rental Types

- **Long-term:** 1 month or longer, recurring monthly payments
- **Short-term:** Daily or weekly, single or split payments
- **Custom:** Any arrangement — the system accommodates varied billing periods and payment structures

### 5.2 Active Rental Record

Each rental contains:
- Customer linked (or created inline)
- Vehicle assigned
- Start date / end date (or open-ended for long-term)
- Rental rate and billing period
- Deposit amount and deposit status (held / partially returned / fully returned)
- Payment schedule (expected payment dates and amounts)
- Payment history (all payments received, with dates)
- Outstanding balance
- Delivery location and return location
- Contract (linked document, signed status)
- Delivery inspection (linked form)
- Return inspection (linked form, when completed)
- Notes

### 5.3 Rental Status Flow

`Draft → Booked → Active → Due Soon → Overdue → Completed / Cancelled`

Statuses trigger dashboard alerts and reminders automatically.

### 5.4 Rental List View

- Filter by status (Active / Booked / Overdue / Due Soon / Completed)
- Sort by return date, outstanding balance, vehicle
- Overdue and Due Soon rentals surfaced at top automatically

---

## 6. Booking Flow

This is the primary customer-facing workflow. The goal is to generate a booking and send it to a customer in under 60 seconds.

### 6.1 Creating a Booking

Owner triggers "New Booking" from dashboard or vehicle profile. Steps:

1. Select vehicle (or confirm if triggered from vehicle profile)
2. Select or create customer (name, phone, nationality)
3. Set rental period (start date, expected end date or open-ended)
4. Set rental rate and billing period
5. Set deposit amount
6. Select what is included (full insurance, breakdown cover, delivery/collection, car seat, etc.)
7. Select delivery method (delivery to customer / customer collects)
8. If delivery: enter delivery location and time
9. Review summary
10. Generate booking link

### 6.2 The Booking Link

A unique link sent to the customer via WhatsApp, LINE, SMS, or Email. The link contains:

**Customer-facing page:**
- Rental summary (vehicle, dates, rate, deposit, what is included)
- Pre-filled info form requiring:
  - Full name, phone number, nationality
  - Passport number and upload
  - Driving licence upload
  - Photo of customer (selfie)
  - Next of kin / emergency contact name and phone
  - Confirmation of terms
- Link to view/download the rental contract (PDF, auto-generated from template)
- E-signature field for the contract
- Optional: deposit payment link (if online payment is configured)

**Owner receives notification when:**
- Customer opens the link
- Customer completes the info form
- Customer signs the contract
- Deposit is paid (if applicable)

### 6.3 Contract Generation

Contracts are auto-generated from a customisable template using `{{variable_name}}` syntax. All dynamic fields are variables — no hardcoded values in the template.

**Owner/business variables:**
`{{business_name}}`, `{{owner_name}}`, `{{owner_phone}}`, `{{owner_email}}`, `{{owner_line_id}}`, `{{owner_whatsapp}}`, `{{business_address}}`, `{{home_territory}}`, `{{home_territory_type}}` (island/mainland)

**Renter variables:**
`{{renter_first_name}}`, `{{renter_surname}}`, `{{renter_full_name}}`, `{{renter_passport_number}}`, `{{renter_licence_number}}`, `{{renter_licence_country}}`, `{{renter_licence_expiry}}`, `{{renter_phone}}`, `{{renter_email}}`, `{{renter_address}}`, `{{renter_nationality}}`

**Vehicle variables:**
`{{vehicle_make}}`, `{{vehicle_model}}`, `{{vehicle_year}}`, `{{vehicle_registration}}`, `{{vehicle_colour}}`, `{{vehicle_fuel_type}}`

**Rental variables:**
`{{rental_start_date}}`, `{{rental_start_time}}`, `{{rental_end_date}}`, `{{rental_end_time}}`, `{{rental_rate}}`, `{{billing_period}}`, `{{deposit_amount}}`, `{{secondary_deposit_amount}}`, `{{mileage_limit}}` (default 1500), `{{fuel_charge_per_increment}}` (default 150), `{{late_fee_percentage}}` (default 5), `{{cleaning_fee_minimum}}` (default 500), `{{smoking_fee_maximum}}` (default 2000), `{{emergency_repair_limit}}` (default 2000), `{{deposit_return_days}}` (default 5), `{{insurance_type}}`, `{{insurance_excess}}`, `{{contract_date}}`, `{{included_items}}`, `{{special_conditions}}`

**Delivery variables** (populated after inspection, blank on initial contract):
`{{delivery_odometer}}`, `{{delivery_fuel_level}}`, `{{delivery_fuel_image_url}}`, `{{delivery_date}}`, `{{delivery_location}}`, `{{delivery_damage_report}}`

**Jurisdiction variable:**
`{{jurisdiction}}` — auto-populated from the organisation's country setting (e.g. "the Kingdom of Thailand", "the Republic of Indonesia", "the Republic of the Philippines", "Malaysia", "the Republic of Singapore", "Australia"). Defaults to "the Kingdom of Thailand" if no country is set. Used in the governing law clause so contracts are legally correct for each market without manual editing.

**Conditional section variables** (boolean — controls whether optional clauses appear):
`{{island_travel_clause_enabled}}` — renders secondary deposit clause for island operators
`{{geofence_monitoring_enabled}}` — renders GPS consent clause for operators with GPS devices
`{{secondary_deposit_enabled}}` — renders secondary deposit amount and terms

### 6.4 Travel Policy & Island Clause

Operators configure a travel policy in Settings → Business → Travel Policy:

**Home territory type:** Island / Mainland region
- Island operators (Koh Samui, Phuket, Koh Phangan, Koh Tao, Koh Lanta etc.) get the island travel clause enabled by default
- Mainland operators get it disabled by default but can enable it

**Island travel policy:** Allowed with notice and secondary deposit / Allowed with notice only / Not permitted
- Controls which variant of the island clause appears in contracts
- Secondary deposit amount: configurable THB amount (default 5,000 THB)

**Travel policy logic in contracts:**
- Mainland-to-mainland travel: always permitted, no notification required, no additional deposit
- Mainland-to-island or island-to-island: requires advance notice, may require secondary deposit depending on policy
- Island operators: any ferry crossing triggers the island clause
- GPS geofence: if GPS is enabled, a geofence around the home territory fires an alert if the vehicle approaches a ferry terminal or leaves the island — gives the operator real-time awareness of unreported island travel

**Contract clause behaviour:**
- If `home_territory_type = island`: Section 9.8 renders the island travel clause with secondary deposit terms
- If `home_territory_type = mainland`: Section 9.8 renders mainland travel permitted language, island clause is a separate optional section
- All hardcoded THB amounts and percentages are variables so operators in different markets can customise without editing contract text

The owner can edit the template at any time in Settings → Contracts. Per-rental customisation (e.g. waiving the secondary deposit for a trusted customer) is possible before the booking link is sent.

---

## 7. Delivery & Return Inspection Forms

### 7.1 Delivery Form (Car Out)

Triggered when the car is handed to the customer. Mobile-guided, step-by-step:

1. **Odometer photo** — camera prompt, value confirmed by owner
2. **Fuel level photo** — camera prompt, fuel percentage noted
3. **Vehicle walkaround** — prompted to record video (front, rear, driver side, passenger side, interior, boot)
4. **Damage notation** — tap on a vehicle diagram to mark any existing damage, add description and photo for each item
5. **GPS tracker check** — confirm tracker is online and has credit (manual confirmation or auto-pulled from GPS integration)
6. **Customer confirmation** — customer signs the delivery form digitally (on owner's phone or via link)
7. **Submit** — form is saved to rental record, PDF version sent to customer via WhatsApp/LINE/email

### 7.2 Return Form (Car In)

Triggered when the car is collected from the customer:

1. **Odometer photo** — camera prompt, total km during rental calculated automatically
2. **Fuel level photo** — compared against delivery fuel level, deficit noted
3. **Vehicle walkaround** — prompted to record video
4. **Damage check** — owner marks any new damage vs delivery form (pre-populated with existing damage so new damage is clearly distinguished)
5. **Deposit reconciliation** — system calculates:
   - Outstanding rental balance (if any)
   - Fuel deficit charge (if applicable, based on agreed rate)
   - Damage excess charges (if any new damage)
   - Deposit refund amount = deposit minus deductions
6. **Customer sign-off** — customer signs return form
7. **Submit** — return form saved, deposit reconciliation summary sent to customer

---

## 8. Customer Management (CRM)

### 8.1 Customer Profile

- Full name, phone, nationality
- Preferred language
- Passport number, expiry date
- Driving licence number, expiry date
- Emergency contact
- Document uploads (passport, licence, selfie)
- Document status (Complete / Missing Licence / Missing Passport / Missing Documents)
- Rental history (all past and active rentals)
- Lifetime value (total revenue from this customer)
- Open balance (outstanding across all rentals)
- Notes

### 8.2 Customer List

- Search by name or phone
- Filter by document status, open balance
- Quick view of active rental if applicable

### 8.3 Customer Onboarding via Booking Link

Customers can complete their own profile through the booking link — no manual data entry by the owner required. Documents uploaded by the customer are automatically attached to their profile.

---

## 9. Transactions

### 9.1 Transaction Types

| Type | Direction |
|---|---|
| Rental Income | Revenue (positive) |
| Deposit Received | Revenue (positive, offset at return) |
| Deposit Refunded | Expense (negative) |
| Repair | Expense (negative) |
| Maintenance / Servicing | Expense (negative) |
| Fuel | Expense (negative) |
| Insurance Premium | Expense (negative) |
| Vehicle Tax | Expense (negative) |
| Finance Payment | Expense (negative) |
| Fine | Expense (negative) |
| Accessories / Equipment | Expense (negative) |
| Refund to Customer | Expense (negative) |
| Other Income | Revenue (positive) |
| Other Expense | Expense (negative) |

### 9.2 Adding a Transaction (Mobile Quick-Capture)

The most frequent daily action. Must be completable in under 30 seconds:

1. Tap "Add Transaction" from dashboard or vehicle profile
2. Select vehicle (or "General / Not vehicle-specific")
3. Select transaction type
4. Enter amount
5. Date (defaults to today)
6. Optional: photo of receipt (camera prompt)
7. Optional: note
8. Save

The transaction is immediately reflected in the vehicle's profit/loss and the business financial overview.

### 9.3 Transaction List

- Filter by vehicle, type, date range
- Search by note
- Total income / total expenses / net shown for any filtered view
- Export to CSV

---

## 10. Compliance & Maintenance Alerts

### 10.1 Alert System

All compliance dates generate automatic escalating alerts:

| Time Until Expiry | Alert Level | Notification |
|---|---|---|
| 1 month | Low (yellow) | In-app reminder |
| 2 weeks | Medium (amber) | In-app + push notification |
| 1 week | High (orange) | In-app + push + WhatsApp/LINE to owner |
| Expired | Critical (red) | Persistent dashboard alert |

Alert types covered:
- Annual vehicle tax (ต่อภาษี)
- Compulsory insurance (พรบ)
- Voluntary/full insurance
- Next scheduled service
- Outstanding finance payment due
- Tyre replacement due
- Oil change due
- Overdue rental returns
- Outstanding customer balances

### 10.2 Compliance Dashboard Widget

On the main dashboard: a per-vehicle compliance grid showing all dates with colour coding. At a glance, the owner can see which vehicles need attention and what specifically is due.

### 10.3 Maintenance Events

Logging a completed maintenance event:
- Vehicle
- Type (service, oil change, tyre replacement, repair, etc.)
- Date performed
- Odometer at service
- Cost (links to a transaction automatically)
- Next due date or next due km
- Mechanic / garage name (optional)
- Receipt photo
- Notes

---

## 11. Dashboard

The main dashboard is the daily command centre. It must be useful at a glance, primarily on mobile.

### 11.1 KPI Strip (top of page)

- Monthly revenue (current month)
- Outstanding balances (total owed across all customers)
- Fleet net profit (lifetime)
- High-priority alerts (count)

### 11.2 Fleet Status Summary

- Vehicles rented / available / in maintenance / reserved (counts with quick links)
- Average fleet utilization (12-month)

### 11.3 Compliance Grid

- Per vehicle: tax, compulsory insurance, full insurance, service — all colour coded
- Tappable to go straight to that vehicle's profile or log a renewal

### 11.4 Active Rentals

- Cards showing: customer name, vehicle, return date, outstanding balance, status badge
- Overdue and Due Soon sorted to top
- Quick action: tap to view rental, add payment, or start return inspection

### 11.5 Alert Queue

- Ordered by severity
- Types: payment overdue, compliance expiring, maintenance due, rental overdue
- Each alert has a quick action (e.g. "Mark as Renewed", "Record Payment", "Start Return")

### 11.6 Recent Transactions

- Last 10 transactions across the fleet
- Income shown green, expenses shown red

### 11.7 Vehicle Timeline

- Chronological feed of recent events: deliveries, returns, transactions, maintenance, compliance renewals

### 11.8 This Week

- Calendar summary of what is due or scheduled this week: deliveries, returns, services, finance payments, insurance renewals

---

## 12. Calendar

A full calendar view syncing all:
- Scheduled deliveries
- Scheduled returns
- Booked rentals (availability view per vehicle)
- Compliance renewal due dates
- Service bookings
- Finance payment due dates
- Custom events added by owner

Views: monthly, weekly, per-vehicle availability (horizontal Gantt-style showing which cars are free on which days — essential for scheduling).

New events can be added directly from the calendar: type, vehicle, date/time, notes.

---

## 13. GPS Tracking

### 13.1 Recommended Hardware

**Teltonika FMP100** — plug-and-play (cigarette lighter socket, no wiring required), suitable for car rental. Supported by Teltonika's own connectivity SIM with auto top-up, managed via their IoT platform. API integration with RouteHQ is available.

Alternative: any Teltonika FMB/FMC series device for wired installation.

### 13.2 GPS Features in RouteHQ

- Live location map of all fleet vehicles (dashboard widget and full-screen map view)
- Last seen timestamp and location for each vehicle
- Online / offline / low credit status per device
- Geofence alerts (notify owner if vehicle leaves a defined area — useful for long-term rentals)
- Mileage tracking (auto-populated from GPS, reducing manual odometer photo dependency over time)
- Trip history (for dispute resolution)

### 13.3 GPS Device Management

- Register a GPS device to a vehicle (IMEI, SIM number, provider)
- View all devices and their status
- SIM credit status (where API supports it)
- Alert if device goes offline unexpectedly

*v1: Teltonika integration via their API. Architecture supports adding SinoTrack, GPSWOX, Wialon, and others.*

---

## 14. Document Storage

### 14.1 Document Types

- Vehicle documents: registration book, insurance policy, compulsory insurance, tax disc, purchase agreement
- Customer documents: passport, driving licence, selfie, signed contract
- Rental documents: signed contract, delivery inspection form, return inspection form
- Financial documents: receipts, invoices, finance agreements
- General: any file associated with the business

### 14.2 Storage Structure

Documents are stored per entity:
`{organisation}/{vehicle|customer|rental|transaction}/{entity_id}/{document}`

### 14.3 Document Features

- Upload from phone camera or file system
- PDF and image support
- OCR extraction of key dates (e.g. read insurance expiry date from policy document and auto-populate the compliance field)
- View / download / share any document
- Documents are private and accessible only to the organisation

---

## 15. Rental Calculator

A decision-support tool to evaluate whether a potential vehicle purchase makes financial sense.

### 15.1 User Inputs

- Vehicle make, model, trim, year
- Purchase price (or estimated price if researching)
- Financing: yes/no — if yes: down payment, monthly payment, loan term
- Estimated monthly rental rate (owner's estimate)
- Estimated utilization (defaults to owner's fleet average, editable)

### 15.2 AI / Auto-Estimated Inputs

The system supplements user inputs with:
- Insurance cost estimate (based on vehicle type, year, and Thailand market data)
- Annual tax cost estimate (based on vehicle type and engine size)
- Estimated maintenance cost per year (based on make/model reliability data and owner's fleet actuals for similar vehicles)
- Depreciation curve (based on vehicle age, make/model, and market data)
- Utilization benchmark (from owner's own fleet actuals for comparable vehicles)

### 15.3 Outputs

**Summary card:**
- Buy / Don't Buy recommendation (with confidence score)
- Estimated monthly net profit
- Payback period (months to recoup purchase price)
- ROI at 12 months / 24 months / 36 months

**Detailed breakdown:**
- Monthly revenue projection (rate × utilization)
- Monthly expenses (insurance, tax, maintenance, finance payment, depreciation)
- Monthly net profit
- Cumulative profit chart over 36 months
- Sensitivity table: what happens if utilization drops to 60%? 40%?

**Comparison:** if the owner has a similar vehicle in the fleet, show side-by-side with actuals from that vehicle.

---

## 16. Reporting & Financial Overview

### 16.1 Business-Level Reports

- Total revenue / expenses / net profit (monthly, quarterly, annual, custom range)
- Revenue breakdown by vehicle
- Expense breakdown by type (maintenance, fuel, insurance, tax, finance)
- Outstanding balances (aged: 0–30 days, 30–60 days, 60+ days)

### 16.2 Per-Vehicle Reports

- Revenue, expenses, net profit (any date range)
- Utilization rate (12-month, lifecycle)
- Maintenance cost history and trend
- Depreciation vs revenue chart
- Comparison vs fleet average

### 16.3 Export

- All reports exportable as CSV or PDF
- Transaction log exportable for accounting purposes

---

## 17. Messaging & Notifications

### 17.1 Channels

- WhatsApp (primary for Thailand market)
- LINE (secondary, common in Thailand)
- SMS (fallback)
- Email (formal documents, contracts)
- In-app push notifications

### 17.2 Owner Notifications

- Compliance expiry alerts (escalating)
- Overdue rental alerts
- Customer opens/completes booking link
- Customer signs contract
- Deposit received
- GPS device goes offline
- New payment received

### 17.3 Customer Messages (sent by owner via app)

- Booking confirmation + link
- Contract for signature
- Delivery form share (post-delivery)
- Return form share (post-return)
- Payment reminders
- Deposit refund confirmation
- Ad hoc message from within a rental record

---

## 18. API & Integrations

All integrations are provider-agnostic — switching providers requires no code changes.

| Category | v1 Providers | Future |
|---|---|---|
| GPS Tracking | Teltonika | SinoTrack, GPSWOX, Wialon |
| Messaging | WhatsApp, LINE, SMS, Email | Messenger |
| Payments | Cash, PromptPay/QR, Bank Transfer (Thai), Wise, Revolut | Omise, Stripe |
| Insurance | Manual (data entry) | Provider API (future) |
| Finance | Manual (data entry) | Provider API (future) |
| E-signature | Built-in (canvas signature) | DocuSign, HelloSign (future) |
| OCR | Built-in (document scanning) | Google Vision API |

### 18.1 Payment Method Notes

**Cash** — recorded manually. Owner or partner logs amount, date, and optionally photos the cash/receipt.

**PromptPay / QR payment** — customer scans a QR code to transfer via their Thai banking app. v1: owner generates or displays their PromptPay QR, payment is confirmed manually in the app. Future: automated confirmation via bank webhook.

**Bank transfer (Thai)** — direct transfer to Thai bank account. Confirmed manually when owner sees it in their bank app. Slip photo can be uploaded to the rental record.

**Wise** — used for international customers without a Thai bank account. Transfers arrive in the owner's Wise account. Logged manually in RouteHQ with amount and date.

**Revolut** — same as Wise. Used for European customers primarily. Logged manually.

*All payment methods in v1 are manually confirmed — the owner or partner records when payment is received. Automated payment confirmation (webhook-based) is a future feature. The system tracks what is owed and what has been received; it does not process payments directly in v1.*

---

## 19. Mobile Experience

Since the owner operates primarily from a phone:

- All core actions accessible within 2 taps from the home screen
- Bottom navigation bar: Dashboard / Fleet / Rentals / + (quick add) / More
- "Quick Add" button (the +) always visible: opens action sheet with most common actions:
  - New Transaction
  - New Rental Payment
  - Start Delivery Form
  - Start Return Form
  - New Booking
  - Add Event
  - New Document
- Camera integration throughout (receipts, inspection photos, documents)
- Offline-capable for form capture (syncs when connection restored)
- Push notifications for all alerts

---

## 20. Settings

- Organisation profile (name, logo, contact details, address)
- Contract template editor (customise the rental contract used for all bookings)
- Notification preferences (which alerts, which channels, how far in advance)
- GPS provider configuration
- Messaging provider configuration (WhatsApp Business API, LINE, SMS gateway)
- Payment provider configuration
- Currency and locale settings
- User management (invite additional users, assign roles)
- Billing (subscription management — for future SaaS use)

---

## 21. Build Sequence (Recommended)

Based on the priority of daily operational value, features should be built in this order:

### Phase 1 — Core Operations (use for own fleet)
1. Authentication — login, protected routes, invite partner user, both with full access; owner defaults to English UI, partner defaults to Thai UI
2. Vehicle profiles — add, edit, view all 6 cars with compliance dates
3. Compliance alert system — escalating alerts per vehicle
4. Transaction quick-capture — mobile form, receipt photo, links to vehicle; supports recording cash, PromptPay, bank transfer, Wise, Revolut as payment method
5. Active rentals view — who has what, return date, outstanding balance
6. Add rental payment — record a payment received against a rental, with payment method field

### Phase 2 — Delivery & Customer Flow
7. Customer profiles — create, document upload, document status
8. Delivery inspection form — guided mobile form, video/photo prompts, shared with customer
9. Return inspection form — damage comparison, deposit reconciliation
10. Booking flow — create booking, generate link, customer form, contract PDF, e-sign

### Phase 3 — Intelligence & Automation
11. GPS integration — Teltonika API, live map, device management
12. Calendar — all events, per-vehicle availability view
13. Reporting — per-vehicle and business-level financial reports
14. Rental calculator — AI-assisted vehicle acquisition decision tool

### Phase 4 — Scale & Polish
15. Additional messaging providers (LINE, SMS)
16. Multi-tenant SaaS infrastructure (onboarding, billing, org isolation)
17. Additional GPS providers
18. Automated payment confirmation (bank webhooks for PromptPay/transfer)
19. Additional payment providers (Omise, Stripe)
20. Additional language support (Russian, Chinese, Bahasa, Vietnamese, French, Japanese, Korean)

---

## 22. What Codex Has Already Built

The following is already in the codebase and does NOT need to be rebuilt:

- Multi-tenant database schema (Supabase / PostgreSQL) with full RLS
- Vehicle, customer, rental, transaction, reminder, and activity event tables
- Profitability calculation service (per-vehicle revenue, expenses, depreciation, ROI, utilization)
- Dashboard data layer with seed/fallback for development
- Dashboard UI (KPIs, fleet table, alert queue, rental cards, transaction table, customer list, timeline)
- CRUD infrastructure (create, update, soft-delete with activity logging and cache revalidation)
- Supabase Auth integration (session management via middleware)
- Provider-agnostic interfaces for GPS, messaging, and payments
- i18n infrastructure (next-intl, locale files for 9 languages)
- Next.js 15 / TypeScript / Tailwind 4 / Supabase SSR stack

**What needs to be added to match this spec:**
- Login/auth UI and protected routes
- Compliance date fields wired through from DB to UI (currently returning empty strings)
- Transaction quick-capture mobile form
- Delivery and return inspection forms
- Booking flow and customer link page
- GPS live view (Teltonika API)
- Calendar view
- Rental calculator with AI layer
- Reporting screens
- Settings screens
- Contract template editor and PDF generation
- Document storage UI
- Push notifications

---

## 23. Multi-Location & Branch Support

### 23.1 Concept

RouteHQ supports rental businesses operating across multiple locations or branches. A single-location operator (like the initial use case on Koh Samui) simply ignores branch features entirely — they add no friction. A growing operator can define branches and assign vehicles and staff accordingly.

### 23.2 Data Model

**Branch** — a named operating location belonging to an organisation. Fields:
- Name (e.g. "Koh Samui", "Koh Phangan", "Phuket")
- Base address / GPS coordinates
- Contact phone and email
- Active / inactive status

**Vehicle home branch** — each vehicle is assigned to a branch. This determines which branch's staff see it by default, where it is expected to be when not rented, and which branch's revenue it contributes to in reporting.

**Service area** — the geographic zone within which a vehicle can be delivered or collected. Can be set per vehicle as:
- Same as home branch only
- Any branch within the organisation
- Custom zone (defined by radius or drawn on map — future)

**Permitted drop-off locations** — for one-way rentals, a vehicle can be configured to allow return at a different location than pickup. Per vehicle toggle with a list of eligible drop-off branches or points.

### 23.3 v1 Behaviour

- Single branch created automatically on account setup ("Main" or the organisation name)
- Branch field present on vehicle form but pre-filled and not required to change
- No branch-level reporting or staff scoping in v1 — that comes with multi-user expansion
- Schema supports full branch model from day one so no restructuring is needed later

### 23.4 UI Additions

- Branch management page under Settings → Branches
- Vehicle form includes: Home Branch (dropdown), Service Area (dropdown: home branch only / all branches / custom), Permitted Drop-off Locations (multi-select of branches)
- Fleet list filterable by branch
- Dashboard KPIs filterable by branch (Phase 3+)

---

## 24. Partner Network

### 24.1 Concept

A peer-to-peer availability sharing network between RouteHQ operators. When an operator has a customer ready to rent but no available vehicles, the Partner Network surfaces opted-in vehicles from nearby operators. The booking is facilitated through RouteHQ, the end customer deals only with the original operator, and revenue/commission is split between the two businesses.

This formalises and automates the informal WhatsApp/LINE networks that already exist between rental operators in Thai tourist areas.

### 24.2 How It Works

**For the operator with a customer (the booking operator):**
1. Creates a booking as normal but has no available vehicle
2. App surfaces a "Check Partner Network" option
3. Sees a list of available partner vehicles nearby matching the requirements (type, dates, location)
4. Selects a vehicle and sends a booking request to the partner operator
5. Partner confirms or declines
6. If confirmed: booking proceeds normally from the customer's perspective
7. Customer contract is with the booking operator
8. Commission/revenue split is recorded in RouteHQ for both parties

**For the operator lending the vehicle (the supply operator):**
1. Opts each vehicle into the Partner Network per vehicle (toggle in vehicle settings)
2. Sets per-vehicle partner terms: partner rental rate (may differ from public rate), deposit requirement, commission percentage, blackout dates
3. Receives booking requests via in-app notification and WhatsApp/LINE
4. Confirms or declines each request
5. Handles vehicle handover as normal using RouteHQ delivery/return forms
6. Revenue recorded against their account minus the agreed commission

### 24.3 Data Shared vs Private

**Shared across the network:**
- Vehicle availability (dates only — not full calendar history)
- Vehicle type, make, model, year, photos
- Partner rental rate and deposit
- Operator name, location, and contact

**Always private:**
- Customer data and rental history
- Financial data and transaction history
- Internal notes and documents
- Full vehicle compliance and maintenance data

### 24.4 Trust & Vetting

- Operators join the Partner Network by opt-in within their RouteHQ account
- v1: open network — any RouteHQ account can participate
- Future: verified badge system, rating/review between operators, approval-based network tiers
- Each operator independently controls which of their vehicles are visible to the network
- A vehicle can be removed from the network at any time

### 24.5 Liability & Terms

- Each operator is responsible for their own vehicles and their own customer relationships
- The Partner Network facilitates introductions and bookings only
- A standard inter-operator agreement template is provided by RouteHQ (accepted on network join)
- Dispute resolution between operators is handled outside RouteHQ in v1

### 24.6 Build Phase

**Phase 4 feature.** The schema should be designed with partner network in mind (organisation-level network opt-in flag, per-vehicle network settings, inter-org booking records) but no UI is built until Phase 4. Core dependency: multi-tenant SaaS infrastructure must be in place first, since the network only has value when there are multiple operators on the platform.

---

## 25. Onboarding Wizard

The onboarding experience is the single most important factor in trial-to-paid conversion. An operator who enters real data in their first session almost never churns. An operator who doesn't almost always does.

### 25.1 First Login Setup Wizard

Triggers automatically on first login for any new organisation. A full-screen guided flow — not a tooltip tour, but an actual account-building sequence. Can be skipped but skipping should feel like a loss, not a relief.

**Step 1 — Business profile (60 seconds)**
- Business name
- Location (island/city — dropdown of common Thai locations, with custom entry)
- Fleet type: Cars only / Motorcycles only / Mixed
- Approximate fleet size (1-5 / 6-15 / 16-50 / 50+)
- Primary language preference (English / Thai)

Progress bar visible throughout. "Step 1 of 4"

**Step 2 — Add your first vehicle**
Blue Book OCR is front and centre — large camera icon, "Take a photo of your vehicle registration book". This is the first wow moment. After OCR runs, fields appear pre-populated. User confirms or corrects. Compliance dates appear with colour-coded urgency.

Alternative paths: VIN lookup, manual entry, CSV import — all available but secondary.

User cannot proceed with zero vehicles — the wizard requires at least one vehicle to complete. If they genuinely don't have details to hand, a "Add later" option creates a placeholder vehicle they must complete within 7 days (reminder sent via LINE/email).

**Step 3 — Check your alerts**
The compliance dates just entered are shown as a live alert preview: "Your [vehicle] insurance expires in 14 days. We'll remind you on LINE 1 month, 2 weeks, and 1 week before it expires." This demonstrates immediate value before any payment is taken.

If no dates are urgent, show the next upcoming one. If all are far away, show a green "All compliance up to date" screen — still satisfying.

**Step 4 — Connect LINE notifications**
"Get daily summaries and alerts on LINE." Show a QR code to add the RouteHQ LINE Official Account. Explain in one sentence what they'll receive. Mark as optional but show the value: "Most operators find this the most useful feature."

On completion: confetti animation, "You're all set" screen showing a summary of what was created, and a redirect to the dashboard — which now shows real data, real alerts, real value.

### 25.2 Post-Wizard Checklist

After the wizard, a dismissible checklist card appears on the dashboard (similar to Shopify's setup checklist):

- ✅ Business profile complete
- ✅ First vehicle added
- ⬜ Add remaining vehicles (X remaining based on fleet size they told us)
- ⬜ Add your first customer
- ⬜ Create your first booking
- ⬜ Upload your rental contract template
- ⬜ Connect LINE notifications
- ⬜ Invite your team member

Progress percentage shown. Completing all items unlocks a "Setup Complete" badge and triggers a congratulatory LINE message. Checklist auto-hides when 100% complete or after 30 days.

### 25.3 Concierge Onboarding (White Glove Setup)

Available on Growth tier and above. Promoted during trial and on the pricing page.

A RouteHQ team member (Thai-speaking support agent) contacts the operator within 24 hours of signup via LINE. They offer to:
- Enter all vehicles on the operator's behalf (from photos of blue books sent via LINE)
- Set up compliance dates from photographed documents
- Import any spreadsheet data they have
- Answer questions in Thai

This is a manual process tracked via an internal admin tool. Target: operator has all vehicles entered and compliance dates set within 48 hours of requesting concierge setup, without touching the app themselves.

This service removes the single biggest adoption barrier — the effort of initial data entry — and creates an immediate human relationship with the RouteHQ brand.

Internal admin tool needed: a support agent view where a RouteHQ team member can enter data on behalf of an organisation without being an org member. Flagged as "support session" in the activity log.

### 25.4 Blue Book OCR as Primary Onboarding

The vehicle registration book (สมุดคู่มือจดทะเบียนรถ) contains almost all the data needed to create a vehicle record: registration number, make, model, year, engine CC, VIN, and the registered owner. The OCR feature already built should be promoted as the fastest onboarding path throughout the product.

Every vehicle list empty state, every "Add Vehicle" button, should lead with "Scan your Blue Book" as the primary action.

---

## 26. Daily Engagement & Notifications

### 26.1 Daily Morning Summary (LINE)

Sent every morning at 8:00am local time to the operator's LINE account. Personalised, relevant, actionable.

**Content:**
- Greeting with operator's name
- Today's active rentals: customer names, vehicles, return dates
- Vehicles returning today or tomorrow (with customer phone tappable)
- Any overdue returns
- Payments expected today
- Urgent compliance alerts (expiring within 7 days)
- One motivational business metric: "Your fleet generated ฿X this month so far"

**Format:** Clean, readable in LINE's message format. Uses LINE Flex Message format for rich layout where supported. Falls back to plain text where not.

**Controls:** Operator can set their preferred send time (default 8am), disable specific sections, or pause summaries — all from Settings → Notifications.

**Implementation:** Scheduled function (cron job) runs daily, fetches each organisation's data, generates personalised message, sends via LINE Messaging API. Queue-based to handle many organisations without timeout.

### 26.2 Event-Triggered Notifications

Real-time notifications sent immediately when specific events occur:

| Event | Channel | Message |
|---|---|---|
| Rental payment received | LINE + in-app | "Payment received: ฿X from [Customer] for [Vehicle]" |
| Customer opens booking link | In-app | "[Customer] opened their booking link" |
| Customer signs contract | LINE + in-app | "[Customer] has signed the rental contract" |
| Vehicle GPS offline >1 hour | LINE + in-app | "⚠️ [Vehicle] GPS tracker has gone offline" |
| Compliance expires tomorrow | LINE + in-app | "🔴 [Vehicle] [item] expires tomorrow" |
| Rental overdue | LINE + in-app | "⚠️ [Vehicle] was due back today — [Customer] has not returned it" |
| New booking request | LINE + in-app | "New booking request for [Vehicle] from [Customer]" |
| Deposit refund due | In-app | "[Customer]'s rental ends in 2 days — prepare deposit refund" |

All notifications are opt-in per category in Settings → Notifications. Defaults: all on for owner, compliance and GPS alerts on for partner.

### 26.3 Automatic Customer Payment Reminders

RouteHQ sends payment reminders to renters on behalf of the operator. Operator never has to manually chase rent.

**Reminder schedule (configurable per rental):**
- 5 days before payment due: "Friendly reminder" message with payment QR code
- 1 day before: "Payment due tomorrow" with QR code
- Day of payment: "Payment due today" with QR code and operator's phone number
- 1 day overdue: "Payment overdue" alert — sent to customer AND to operator

**Message content:** Sent via WhatsApp or LINE (customer's preference set at booking). Contains:
- Rental details (vehicle, period, amount due)
- PromptPay QR code (generated from operator's PromptPay ID stored in settings)
- Operator's LINE/WhatsApp contact for questions
- Branded with RouteHQ + operator's business name

**Operator controls:**
- Enable/disable automatic reminders per rental
- Customise message template in Settings → Message Templates
- Override and send a manual reminder at any time from the rental detail page
- View all sent reminders in the rental timeline

### 26.4 Annual Business Summary Report

Generated automatically every January for each active organisation. Delivered via LINE and available as a PDF download in the app.

**Content:**
- Year in review: total revenue, total expenses, net profit
- Best performing vehicle (highest profit)
- Most reliable vehicle (lowest maintenance cost)
- Most rented vehicle (highest utilization)
- Busiest month
- Total customers served
- Total km tracked across fleet
- Year-on-year comparison (if second year or beyond)
- Compliance renewals completed
- A personalised message from RouteHQ

**Format:** Beautifully designed PDF — not a spreadsheet export, a proper visual report. The kind of document an operator would photograph and share. Branded with RouteHQ.

**Purpose:** Demonstrates value, gets shared organically, reinforces the switching cost of leaving (this report only exists because of the data in RouteHQ).

---

## 27. Retention & Churn Reduction

### 27.1 Trial-to-Paid Conversion Strategy

The 30-day trial is full access, no feature limits, no credit card required.

Day 1: Welcome LINE message with setup wizard link and offer of concierge onboarding.
Day 3: If fewer than 2 vehicles entered — "Need help getting set up?" LINE message with concierge offer.
Day 7: "Here's what RouteHQ tracked for you this week" — a mini summary of activity so far.
Day 14: Mid-trial check-in — "You're halfway through your trial. Here's what you've saved time on." Show the number of alerts fired, transactions recorded, km tracked.
Day 25: "Your trial ends in 5 days" — pricing summary, annual billing discount highlighted, one-tap to subscribe.
Day 28: Final reminder with a direct link to subscribe. Offer a 7-day extension if they contact support.
Day 30: Trial ends. Soft access restriction begins (read-only mode, not lockout).

### 27.2 Soft Access Restriction

When payment is overdue or trial has ended:

- Day 0-7: Warning banner only. Full access continues. Daily LINE reminder.
- Day 7-14: Read-only mode. Can view all data but cannot add vehicles, rentals, transactions, or documents. A "Subscribe to continue" button is prominent on every page.
- Day 14-30: Restricted access. Can only view dashboard and billing page.
- Day 30+: Account suspended. Data preserved for 90 days. A reactivation page is shown with one-tap to resubscribe and restore full access.
- Day 120: Data deletion warning. 14-day notice before permanent deletion.

This approach respects operators who have cashflow timing issues (common in seasonal businesses) without leaving accounts unpaid indefinitely.

### 27.3 "What You'd Lose" Cancellation Flow

When an operator initiates cancellation, before confirming they see a personalised screen:

- Number of vehicles in their account
- Number of customers with stored documents
- Number of transactions recorded
- Months of rental history
- Documents stored
- "Your data will be preserved for 90 days after cancellation. After that, it will be permanently deleted."

A data export button is prominent — operators who can export their data feel less trapped, which paradoxically makes them less likely to leave (the act of exporting makes them realise how much data they have).

A "Pause instead?" option is offered — pause for up to 3 months at no charge, data preserved, reactivate anytime. This captures seasonal operators who would otherwise cancel and re-signup.

### 27.4 Account Pause Feature

Available to all paid subscribers. Pause for 1, 2, or 3 months.

During pause:
- No charge
- Read-only access to all data
- Compliance alerts continue (operators still need to know about expiring insurance even in low season)
- Daily summary paused
- Data fully preserved

Auto-reactivates at the end of the pause period with a LINE reminder 7 days before. Maximum 3 months pause per 12-month period.

### 27.5 Vehicle Health Score Trends

The vehicle health score (already in schema) should be tracked over time — not just the current score but the trend. A vehicle declining from 90 to 65 over 3 months is a warning sign.

Dashboard widget: "Fleet Health Trend" showing each vehicle's health score over the last 6 months as a sparkline. Declining vehicles highlighted. Predictive alert: "Your Mazda2 health score has dropped 15 points in 3 months — review maintenance history."

This is a genuinely useful feature that operators cannot get anywhere else. It creates a reason to open the dashboard regularly even when there are no urgent alerts.

---

## 28. Value Demonstration Features

### 28.1 ROI Dashboard Widget

Permanently visible on the dashboard (cannot be dismissed or hidden). Shows:

- "RouteHQ costs you ฿[price]/day"
- "Your fleet generated ฿[daily average] per day this month"
- "RouteHQ costs [X]% of your monthly revenue"

For an operator paying ฿990/month with a fleet generating ฿40,000/month: "RouteHQ costs 2.5% of your monthly revenue." Framed this way, the subscription is obviously worth it.

### 28.2 Per-Vehicle Profitability Clarity

The vehicle detail page already shows profitability. The dashboard should surface a simplified version: a ranked list of vehicles from most to least profitable. Operators who can see their worst-performing vehicle often take action — reduce maintenance spend, increase the rental rate, or decide to sell. This is genuine business intelligence they couldn't easily access before.

### 28.3 Competitor Benchmarking (Anonymised, Opt-in)

Phase 3+ feature. Once there are enough operators on the platform (50+) to make aggregated data meaningful:

Operators who opt in see anonymised benchmarks: "Operators in Koh Samui with similar fleet sizes achieve X% average utilization and ฿Y average monthly rate per vehicle." Compared to their own metrics.

This is only valuable and only ethical with genuine data. Don't build until there's a real dataset. Opt-in only — operators choose to share their anonymised metrics in exchange for seeing the benchmarks.

### 28.4 Public Rental Calculator (Marketing Website)

A simplified version of the rental calculator embedded on the RouteHQ marketing website — no account required.

Inputs: vehicle make/model (rough), purchase price, estimated monthly rental rate.
Output: monthly profit estimate, payback period, 3-year ROI.

At the bottom: "Get a more accurate calculation using your real fleet data. Start your free trial."

This is a lead generation tool that attracts operators researching a vehicle purchase and demonstrates product value before signup.

### 28.5 Referral Programme

Every operator gets a unique referral link in Settings → Referrals.

When a referred operator signs up and completes their trial, both parties get one month free added to their account automatically.

Referral tracking is simple: referral code in the signup URL, stored against the new account, credit applied automatically when trial converts to paid.

A leaderboard of top referrers (opt-in) in the RouteHQ operator community group. Social recognition within the community drives referrals more effectively than financial incentives alone in the Thai market.

---

## 29. Community & Network Effects

### 29.1 RouteHQ Operator Community

A LINE group (primary) and Facebook group (secondary) for RouteHQ operators. Managed by the RouteHQ Thai-speaking team member.

Content:
- Tips and best practices for using RouteHQ
- Thai rental market news and discussion
- Seasonal advice (high season prep, low season cost reduction)
- Feature announcements and previews
- Peer-to-peer help and questions

Rules: no competitor promotion, no spam, Thai and English welcome.

This community creates social switching cost — leaving RouteHQ means leaving the network of operators you've built relationships with.

### 29.2 In-App Feature Announcements

When a new feature is released, operators see an in-app announcement card on the dashboard. One card per release, dismissible. Shows what's new, why it matters, and a "Try it now" link.

This keeps operators aware of growing value and reduces the "I didn't know it could do that" reason for churn.

### 29.3 Operator Feedback Loop

A permanent "Suggest a feature" button in the app (footer or settings). Submissions go to a public roadmap board (Canny or similar) where operators can vote on each other's suggestions. Top-voted features get prioritised.

This makes operators feel ownership of the product direction. Operators who have submitted a feature request that gets built are extremely unlikely to churn.

---

## 30. Onboarding & Retention Build Sequence

These features should be built in this priority order, as they directly impact trial-to-paid conversion:

### Phase 1 additions (build before first paying customers):
1. First login setup wizard (Section 25.1)
2. Post-wizard setup checklist (Section 25.2)
3. LINE Official Account integration and daily summary (Section 26.1)
4. Event-triggered notifications — compliance and overdue alerts first (Section 26.2)
5. Soft access restriction and trial countdown (Section 27.1, 27.2)
6. ROI dashboard widget (Section 28.1)

### Phase 2 additions (build before scaling to 50+ customers):
7. Automatic customer payment reminders (Section 26.3)
8. Cancellation flow with "what you'd lose" screen (Section 27.3)
9. Account pause feature (Section 27.4)
10. Referral programme (Section 28.5)
11. Concierge onboarding admin tool (Section 25.3)
12. Vehicle health score trends (Section 27.5)

### Phase 3 additions (build before international expansion):
13. Annual business summary report (Section 26.4)
14. Public rental calculator on marketing website (Section 28.4)
15. Competitor benchmarking — anonymised opt-in (Section 28.3)
16. Operator feedback/roadmap board (Section 29.3)

---

## 31. Automatic Review Requests

### 31.1 Overview

When a rental booking is marked as complete (return inspection submitted), RouteHQ automatically sends a review request to the customer via WhatsApp or LINE after a configurable delay. The request contains direct links to the operator's Google and Facebook review pages.

Note: Google and Facebook do not allow programmatic review publishing or iframe embeds. The flow is message → customer taps link → opens Google/Facebook in their browser → leaves review there. RouteHQ tracks whether the link was sent and clicked but cannot confirm a review was actually posted.

### 31.2 Trigger

Review request is triggered when:
- Rental status changes to `completed` AND
- A return inspection has been submitted for the rental AND
- The customer has a phone number stored AND
- The operator has at least one review platform configured in settings AND
- Automatic review requests are enabled for the organisation

### 31.3 Delay Options

Operator configures a delay between booking completion and review request:
- Immediate (0 hours)
- 24 hours after completion (default)
- 48 hours after completion
- 1 week after completion

Delayed requests are queued and sent by a scheduled function. If the customer has no WhatsApp or LINE, the request is skipped and logged as "no contact method available".

### 31.4 Message Content

Sent via WhatsApp or LINE (customer's preferred channel, LINE fallback to WhatsApp):

```
Hi [Customer Name],

Thank you for renting with [Business Name]! We hope you enjoyed your [Vehicle Make Model].

If you have a moment, a review would mean a lot to us — it helps our small business enormously. 🙏

⭐ Review on Google: [Google Review Link]
👍 Review on Facebook: [Facebook Review Link]

Thank you!
[Business Name]
```

Links are tracked via a redirect through RouteHQ (`/r/review/{token}`) so click-through can be recorded in the booking timeline.

Operator can customise the message template in Settings → Messages → Review Request Template.

### 31.5 Review Platform Links

**Google Reviews:**
Direct link format: `https://search.google.com/local/writereview?placeid={PLACE_ID}`
Opens Google Maps review dialog directly. Requires operator's Google Place ID.

To find a Google Place ID: go to Google Maps, search for the business, the Place ID appears in the URL or can be found via the Place ID Finder tool at developers.google.com/maps/documentation/places/web-service/place-id.

**Facebook Reviews:**
Direct link format: `https://www.facebook.com/{PAGE_ID_OR_USERNAME}/reviews`
Opens the operator's Facebook page reviews tab.

### 31.6 Settings

In Settings → Integrations → Review Requests:
- Enable/disable automatic review requests (toggle)
- Review request delay (dropdown: Immediate / 24 hours / 48 hours / 1 week)
- Google Place ID (text input with helper link to Place ID finder)
- Facebook Page URL or username (text input)
- Message template editor (customisable, with variables: customer_name, business_name, vehicle_label, google_review_link, facebook_review_link)
- Preview button — shows how the message will look before sending

At least one platform (Google or Facebook) must be configured for review requests to be enabled.

### 31.7 Tracking

Per booking record, track:
- Review request sent: yes/no + timestamp
- Review request channel: WhatsApp / LINE / not sent
- Google link clicked: yes/no + timestamp (tracked via redirect)
- Facebook link clicked: yes/no + timestamp (tracked via redirect)

Show this in the booking timeline as: "Review request sent to [Customer] via [channel]" and "Customer clicked Google review link" if applicable.

### 31.8 Manual Trigger

From any completed booking detail page, a "Send review request" button allows the operator to manually trigger a review request regardless of the automatic setting. Useful for:
- Operators who prefer to send manually
- Re-sending if the first request was missed
- Sending to a customer who completed a booking before this feature was enabled

### 31.9 Database

```sql
-- Add to organizations table
alter table public.organizations
  add column if not exists review_requests_enabled boolean default false,
  add column if not exists review_request_delay_hours integer default 24,
  add column if not exists google_place_id text,
  add column if not exists facebook_page_id text,
  add column if not exists review_request_template text;

-- Track review requests
create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organizations(id),
  rental_id uuid not null references public.rentals(id),
  customer_id uuid references public.customers(id),
  status text default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  channel text,
  google_link_clicked boolean default false,
  google_link_clicked_at timestamptz,
  facebook_link_clicked boolean default false,
  facebook_link_clicked_at timestamptz,
  sent_at timestamptz,
  error text,
  created_at timestamptz default now()
);
```

### 31.10 Build Phase

Phase 3 feature — build after LINE messaging integration is complete, as it shares the same outbound messaging infrastructure.

---

## 32. Payment Methods & Payment Recording

### 32.1 Overview

Payment handling in the Thai and SEA rental market is fundamentally different from Western markets. Most transactions are cash or manual bank transfer. Credit cards are rare. Thai payment methods (PromptPay, QR) are unavailable to foreign customers. RouteHQ must accommodate all of these gracefully without requiring payment processing integrations to function.

### 32.2 Accepted Payment Methods (Operator Settings)

Operators configure which payment methods they accept in Settings → Payments. Each method can be toggled on or off independently:

**Thai / local methods:**
- Cash (always available, no setup required)
- PromptPay / QR Payment (requires PromptPay ID stored in settings)
- Thai Bank Transfer (requires bank account details stored in settings)

**International methods:**
- Wise (requires Wise.me payment link or email stored in settings)
- Revolut (requires Revolut.me payment link stored in settings)
- Credit/Debit Card via Stripe (requires Stripe account — future)
- Credit/Debit Card via Omise (requires Omise account — future)

Only methods the operator has enabled and configured appear as options to customers in the booking link and to admins in the booking form.

### 32.3 Customer Payment Method Selection (Booking Link)

In the customer-facing booking page (`app/book/[token]/`), after completing their details, the customer sees a payment section:

**"How would you like to pay?"**

Shows only the payment methods the operator has enabled. Each option displayed as a card with:
- Payment method name and icon
- Whether remote payment is available ("Pay now online" or "Pay on delivery/collection only")
- Any relevant notes (e.g. "For customers without a Thai bank account")

**Payment timing options** — shown based on selected method:

| Method | Options |
|---|---|
| Cash | Pay on delivery only |
| PromptPay / QR | Pay now (QR shown immediately) or Pay on delivery |
| Thai Bank Transfer | Pay now (bank details shown) or Pay on delivery |
| Wise | Pay now (Wise link shown) or Pay on delivery |
| Revolut | Pay now (Revolut link shown) or Pay on delivery |
| Stripe / Omise | Pay now only (payment link generated) |

Customer's selection is stored against the booking: `preferred_payment_method` and `payment_timing` (now / on_delivery).

### 32.4 Pay Now Flows

**PromptPay / QR:**
Display the operator's PromptPay QR code (generated from their PromptPay ID stored in settings) as an image inline on the booking page. Show the exact amount and a reference number. Customer scans with their Thai banking app.

Since PromptPay has no webhook/confirmation API, payment is not auto-confirmed. Show a "I've made the payment" button the customer can tap. This flags the payment as "customer-reported paid — awaiting confirmation" in the admin panel. Admin confirms manually when they see it in their banking app.

**Thai Bank Transfer:**
Show operator's bank name, account number, account name, and the exact amount with a unique reference code. Same "I've made the transfer" button. Admin confirms manually.

**Wise:**
Show the operator's Wise.me link or email as a tappable button: "Pay via Wise →". Same confirmation flow.

**Revolut:**
Show the operator's Revolut.me link as a tappable button: "Pay via Revolut →". Same confirmation flow.

**Stripe / Omise (future):**
Generate a payment link server-side. Customer taps "Pay by card →" and completes payment on Stripe/Omise hosted page. Webhook confirms payment automatically — no manual confirmation needed.

### 32.5 Cash on Delivery Flow

When cash is selected, or when "Pay on delivery" is chosen for any method:

No payment action required from the customer in the booking link. The booking proceeds normally.

During the **delivery inspection form** (app/inspections/delivery/[rentalId]/page.tsx), add a payment step:

**Step: Collect payment**
- Shows: Amount due, payment method selected by customer
- If cash: "Mark payment received" button with amount field (pre-filled, editable for partial payments)
- If other method selected but not yet paid: "Has payment been received?" yes/no with amount field
- On confirmation: records a transaction (rental_income) against the rental, generates a receipt, marks rental payment as received

**Receipt generation:**
Auto-generate a simple PDF receipt containing:
- RouteHQ + operator business name and logo
- Receipt number (auto-generated: REC-YYYY-XXXX format)
- Date and time
- Customer name
- Vehicle make, model, plate
- Amount paid
- Payment method
- Rental period
- "Paid" stamp

Receipt is:
1. Saved to Supabase Storage under `{org_id}/receipts/{receipt_id}.pdf`
2. Linked to the transaction record
3. Linked to the rental payment record
4. Sent to customer via WhatsApp/LINE automatically
5. Visible in the booking detail page for the operator to download

### 32.6 Admin Payment Recording

From the booking detail page or transactions page, admin can manually record any payment at any time:

"Add payment" → amount, payment method, date, notes, optional receipt photo upload.

This is the fallback for any payment that happens outside the normal flow (e.g. customer paid via bank transfer directly without using the booking link, or cash was collected without going through the delivery form).

### 32.7 Payment Status on Booking

Each booking shows a payment summary:

- Deposit: ฿X — Received / Pending / Waived
- Rental payments: list of expected payments with dates and amounts, each showing Paid / Pending / Overdue
- Outstanding balance: ฿X (total owed minus total received)
- Payment method on file: [method customer selected]

Overdue payments surface in the dashboard alert queue and in the daily LINE summary.

### 32.8 Partial Payments

Operators sometimes receive partial payments (e.g. customer pays half the deposit, rest later). The system must support:
- Recording a payment against a rental for any amount (not just the exact amount due)
- Multiple payments against one expected payment (e.g. two cash installments for one month's rent)
- Outstanding balance recalculated correctly after each partial payment

### 32.9 Deposit Reconciliation

At return (handled in return inspection form — already specced in Section 7.2):
- Deposit held: ฿X
- Deductions: fuel deficit, damage excess, outstanding rent, cleaning fee
- Refund amount: calculated automatically, editable by operator
- On confirmation: records deposit refund as a transaction (expense), generates refund receipt, sends to customer

### 32.10 Settings Required

In Settings → Payments:
- Toggle each payment method on/off
- For PromptPay: enter PromptPay ID (phone number or national ID)
- For Bank Transfer: bank name, account number, account name, branch (optional)
- For Wise: Wise.me link or registered email
- For Revolut: Revolut.me link
- For Stripe/Omise: API keys (future)
- Default payment method (pre-selected in booking form)
- Receipt footer text (optional custom message on receipts, e.g. "Thank you for choosing [Business Name]!")
- Receipt numbering prefix (default: REC)

### 32.11 Database

```sql
-- Add payment fields to booking_links
alter table public.booking_links
  add column if not exists preferred_payment_method text,
  add column if not exists payment_timing text check (payment_timing in ('now', 'on_delivery')),
  add column if not exists payment_reported_by_customer boolean default false,
  add column if not exists payment_reported_at timestamptz;

-- Receipts table
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organizations(id),
  rental_id uuid references public.rentals(id),
  transaction_id uuid references public.transactions(id),
  rental_payment_id uuid references public.rental_payments(id),
  receipt_number text not null,
  amount numeric not null,
  payment_method text,
  pdf_url text,
  sent_to_customer boolean default false,
  sent_at timestamptz,
  created_at timestamptz default now()
);

-- Add to organizations for payment settings
alter table public.organizations
  add column if not exists accepted_payment_methods jsonb default '["cash"]',
  add column if not exists promptpay_id text,
  add column if not exists bank_name text,
  add column if not exists bank_account_number text,
  add column if not exists bank_account_name text,
  add column if not exists wise_link text,
  add column if not exists revolut_link text,
  add column if not exists receipt_prefix text default 'REC',
  add column if not exists receipt_footer_text text,
  add column if not exists default_payment_method text default 'cash';
```

### 32.12 Build Phase

Phase 2 completion feature — the payment method selection on the booking link and cash receipt generation on delivery are high daily-use features that should be built before beta launch. Stripe/Omise card processing is Phase 3.

---

## 33. Booking Eligibility Rules & Automatic Restrictions

### 33.1 Overview

Operators can configure eligibility rules that are automatically checked when a customer submits their details through the booking link. If a customer fails any rule, they are shown a clear, polite message explaining why they cannot complete the booking, and the operator is notified.

The licence validation approach uses customer self-certification rather than automated document validation. This is the standard approach used by professional rental companies globally (Hertz, Avis, etc.), shifts legal responsibility to the customer for providing accurate information, and works cleanly across all countries and licence types without requiring complex OCR classification.

### 33.2 Driving Licence Self-Certification

When a customer uploads their driving licence in the booking form, they are shown a self-certification checkbox that must be ticked before proceeding:

**Checkbox label:**
"I certify that I hold a valid driving licence that legally permits me to rent and operate the vehicle described in this agreement in [location/jurisdiction]. I understand that operating a vehicle without the appropriate licence may void my insurance coverage and make me personally liable for any costs, damages, or legal consequences that arise."

Below the checkbox, a collapsible "What licence do I need?" section links to local driving laws:

**For Thailand bookings (default):**
"In Thailand, foreign nationals must hold either a Thai driving licence or an International Driving Permit (IDP) issued in their home country, accompanied by their original national driving licence. A foreign licence alone is not legally valid for driving in Thailand. [Learn more →](https://www.dlt.go.th)" 

**For other countries:** link to the relevant transport authority website based on the organisation's jurisdiction setting.

The link URL and explanatory text are customisable per organisation in Settings → Booking Rules.

**Additionally**, the customer selects their licence type from a simple dropdown alongside the upload:
- Thai driving licence
- International Driving Permit (IDP)
- Other — [country of issue text field]

And for motorcycle/scooter rentals (automatically shown when the booked vehicle category is motorcycle or scooter):
- A second checkbox: "I confirm my licence includes authorisation to operate motorcycles/scooters"

This selection is stored against the customer record and displayed in the admin panel so the operator can see at a glance what the customer claimed to hold.

### 33.3 Automatic Eligibility Rules (Operator Configured)

Beyond licence self-certification, operators configure automatic rules in Settings → Booking Rules:

**Age restrictions:**
- Minimum age to rent (e.g. 21 years — calculated from date of birth vs rental start date)
- Maximum age (optional)
- Per-vehicle-category overrides (e.g. motorcycles require minimum age 18)

**Document completeness:**
- Require passport upload before booking completes: yes/no (default yes)
- Require licence upload before booking completes: yes/no (default yes)
- Require selfie before booking completes: yes/no (default no)

**Licence expiry:**
- Automatically flag if the uploaded licence appears expired (best-effort OCR — flags for manual review rather than auto-rejects if OCR is uncertain)

### 33.4 Rule Checking Flow

Rules are checked when the customer submits their details form. If any automatic rule fails:
- Customer sees a clear polite message (see 33.5)
- Cannot proceed to contract and payment steps
- Booking link status updated to `ineligible`
- Operator notified in-app

Self-certification failure (customer does not tick the box) simply prevents form submission — the checkbox is required. The customer cannot proceed without acknowledging the licence requirement.

### 33.5 Customer-Facing Messages

**Age restriction:**
"We're sorry, but this rental requires drivers to be at least [X] years old. Unfortunately we're unable to complete this booking. Please contact [Business Name] if you have any questions: [contact details]."

**Expired licence (OCR detected):**
"Your driving licence appears to have expired. We're unable to complete this booking with an expired licence. Please contact [Business Name] if you believe this is an error: [contact details]."

**Missing required documents:**
"To complete your booking, we still need: [list of missing documents]. Please upload them above to continue."

All messages include the operator's contact details. Messages are customisable in settings.

### 33.6 Legal Protection Note

The self-certification checkbox creates a clear record that the customer acknowledged and confirmed their licence status. This is stored with a timestamp and the customer's IP address alongside their signature on the rental contract. In the event of an insurance dispute or accident where an invalid licence is involved, this record demonstrates the operator took reasonable steps to verify eligibility and the customer provided false information.

This should be noted in the rental contract under Section 4 (Qualifications) — the existing clause already covers this: "The Renter states that he/she is physically and legally qualified to operate the above-described vehicle, including that they are in possession of the necessary, valid licences." The self-certification checkbox reinforces this contractual statement.

### 33.7 Operator Override

From the booking detail page, if a booking is in `ineligible` status, the operator can override with mandatory notes. The override is logged in the activity timeline.

### 33.8 Settings UI

In Settings → Booking Rules:
- Minimum/maximum age (number inputs, blank = no restriction)
- Per-category age overrides
- Required documents toggles
- Licence law reference URL (customisable link shown under the self-certification checkbox)
- Licence law explanation text (customisable, shown in "What licence do I need?" section)
- Custom eligibility failure messages per rule type

### 33.9 Database

```sql
create table if not exists public.booking_rules (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organizations(id),
  vehicle_category text default 'all',
  min_age integer,
  max_age integer,
  require_motorcycle_endorsement_checkbox boolean default true,
  require_passport boolean default true,
  require_licence boolean default true,
  require_selfie boolean default false,
  licence_law_url text,
  licence_law_text text,
  custom_messages jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organisation_id, vehicle_category)
);

alter table public.booking_links
  add column if not exists eligibility_status text default 'pending'
    check (eligibility_status in ('pending', 'passed', 'failed', 'overridden')),
  add column if not exists eligibility_failure_reason text,
  add column if not exists eligibility_checked_at timestamptz,
  add column if not exists eligibility_override_by uuid references auth.users(id),
  add column if not exists eligibility_override_note text,
  add column if not exists eligibility_override_at timestamptz;

alter table public.customers
  add column if not exists licence_type text,
  add column if not exists licence_country text,
  add column if not exists licence_self_certified boolean default false,
  add column if not exists licence_certified_at timestamptz,
  add column if not exists motorcycle_endorsement_certified boolean default false;
```

### 33.10 Build Phase

Phase 2 completion feature — build alongside booking link improvements. The self-certification checkbox and licence type selector are straightforward additions to the existing customer form in `app/book/[token]/page.tsx`. The age check is the only automated rule that needs backend logic at this stage.

---

## 34. Market Sizing & Target Customer Definition

### 34.1 The Thai Vehicle Rental Market

The formal Thai car rental market is well documented — approximately 239,000 vehicles available for short-term rental as of 2017, growing significantly since. The formal segment is dominated by Thai Rent A Car, Sixt, Hertz, Avis, and Enterprise. These operators already have enterprise software and are not RouteHQ's target.

The informal and semi-formal segment is the opportunity. This segment is invisible to official data sources — DBD registration, TAT licensing, insurance records, and finance company data all systematically exclude operators who:
- Operate without formal business registration
- Run fewer than 5-10 vehicles
- Take bookings via WhatsApp, Facebook Marketplace, and word of mouth
- Manage deposits, contracts, and payments informally

The true number of informal operators is therefore higher than any formal estimate suggests. A reasonable estimate for Thailand is **25,000–50,000+ informal and semi-formal rental operators nationally**, covering both cars and motorcycles. Motorcycle rental operators are the larger segment by volume (every tourist beach town has dozens), car rental operators are fewer but higher value per customer.

### 34.2 RouteHQ's Addressable Market

Not all informal operators are ready for software. The realistic addressable market is operators who are "feeling the friction" — large enough to be losing track of things but not large enough to have hired staff to manage it. This segment has specific characteristics:

- **Fleet size:** 3–10 vehicles (cars) or 10–30 vehicles (motorcycles)
- **Current tools:** WhatsApp for bookings, notebook or basic spreadsheet for records, paper contracts
- **Pain points actively felt:** forgetting compliance renewal dates, losing track of deposits, no record of which customer has which car, chasing rent payments manually, no easy way to see profitability
- **Digital readiness:** owns a smartphone, uses Facebook and LINE daily, comfortable with apps
- **Willingness to pay:** ฿500–1,500/month if the value is obvious and immediate

Estimated size of this "feeling the friction" segment in Thailand: **8,000–12,000 operators**.

### 34.3 Realistic Capture Targets

Capturing even a small percentage of this segment is a meaningful business:

| Scenario | Operators | Avg monthly fee | Monthly MRR | Annual ARR |
|---|---|---|---|---|
| Conservative (Year 1) | 150 | ฿790 | ฿118,500 | ฿1.4M |
| Realistic (Year 2) | 500 | ฿890 | ฿445,000 | ฿5.3M |
| Strong (Year 3) | 1,200 | ฿990 | ฿1,188,000 | ฿14.3M |
| Thailand saturation | 3,000 | ฿1,090 | ฿3,270,000 | ฿39.2M |

These figures assume Thailand only. SEA expansion (Bali, Vietnam, Philippines, Cambodia, Malaysia) follows the same informal operator pattern and could 5-10x the addressable market.

### 34.4 SEA Expansion Market

The same informal rental operator profile exists across Southeast Asia:

**Indonesia / Bali:** Bali alone mirrors Koh Samui — thousands of scooter and car rental operators running on WhatsApp and paper. The digital operator proportion is high (many expat-run). Estimated informal operators nationally: 50,000+. Bali as an initial focus: 3,000–5,000 operators.

**Philippines:** Siargao, Palawan, Cebu — growing tourist markets with identical informal rental patterns. Lower digital readiness than Thailand but improving rapidly. Estimated addressable: 5,000–8,000 operators nationally.

**Vietnam:** Da Nang, Hoi An, Ho Chi Minh City motorbike rental market is enormous. Very price-sensitive market — pricing would need localisation. Estimated addressable: 10,000–20,000 operators.

**Cambodia:** Smaller market, Siem Reap and Phnom Penh primarily. Lower willingness to pay but low competition. Estimated addressable: 1,000–2,000 operators.

**Malaysia:** More formalised than Thailand but significant informal segment in Langkawi, Penang. Estimated addressable: 3,000–5,000 operators.

**Combined SEA addressable market (conservative):** 30,000–50,000 operators in the "feeling the friction" zone.

### 34.5 Why Informal Operators Are Underserved

Existing rental management software (Loopit, CarCEO, HQ Rental Software, Rent Centric) targets:
- Formal registered businesses
- English-speaking operators
- Western markets primarily
- Minimum viable fleet sizes of 20–50+ vehicles
- Pricing of $100–500/month USD

None of these products are accessible, affordable, or culturally relevant to a Thai operator managing 5 cars from their phone in Thai. RouteHQ's positioning — built for SEA, mobile-first, Thai language, PromptPay/QR payment, LINE integration, priced at ฿590–4,990/month — is differentiated by design, not just by price.

### 34.6 Primary Customer Persona

**"Khun Somchai" — the Thai semi-formal car rental operator**
- Owns 5–8 cars, mostly Japanese makes (Toyota, Honda, Isuzu)
- Based in a tourist area (Koh Samui, Phuket, Chiang Mai, Pattaya)
- Manages rentals primarily via Facebook Marketplace listings and WhatsApp
- Long-term rentals (1–3 months) are the core business, short-term is occasional
- Tracks everything in LINE messages and a notebook
- Knows he's losing money somewhere but can't pinpoint where
- Has a smartphone, uses Facebook and LINE constantly
- Would pay ฿500–1,000/month if the software clearly saved him time and money
- Primary language: Thai, but may have some English
- Biggest fear: a customer dispute he can't prove

**"Rory" — the expat operator**
- Owns 4–10 cars or motorcycles
- More digitally sophisticated, English-speaking
- Already tried spreadsheets, maybe even looked at Western rental software
- Frustrated by the lack of SEA-specific features (PromptPay, Thai compliance dates, LINE)
- Would pay ฿1,000–2,500/month for something that actually fits his workflow
- Likely to be an early adopter and vocal referrer within expat communities

### 34.7 Go-to-Market Sequence

Based on market sizing and accessibility:

1. **Koh Samui** — home base, personal network, concierge onboarding possible in-person
2. **Koh Phangan + Koh Tao** — island triangle, operators know each other, word travels fast
3. **Phuket + Krabi** — larger market, higher competition, needs local presence or agent
4. **Chiang Mai** — digital nomad/backpacker motorbike rental market, different product use case
5. **Bangkok** — large but more corporate, harder to penetrate with small operator focus
6. **Bali** — first international expansion, highest ROI outside Thailand, large expat operator community
7. **Philippines, Vietnam, Malaysia** — follow with localised versions

---

## 35. Customer Communication Hub

### 35.1 Overview

RouteHQ solves the communication context problem without requiring unified inbox API access. Rather than pulling messages into RouteHQ, the platform pushes booking context to wherever the conversation is happening, and provides structured in-portal communication options that reduce unstructured messaging volume over time.

### 35.2 Customer Contact Channels

Each customer record stores their communication channels. These are collected at multiple points:

**During booking creation (admin side):**
When an operator creates a new booking, they can record how the customer contacted them and add their social/messaging handles. Fields in the booking creation flow (Step 2 — optional customer details):
- WhatsApp number (pre-filled from phone if Thai number)
- Facebook Messenger username or profile URL
- LINE ID
- Telegram username
- Instagram handle (optional)
- Email (optional)
- Preferred contact method: dropdown of the above — whichever the operator selects is used for automated messages

**Via booking link (customer side):**
The booking link form includes an optional "How would you like us to contact you?" section:
- Pre-filled with any details the operator already entered
- Customer can add or correct their handles
- Preferred contact method selector — customers choose how they want to receive messages (payment reminders, return reminders, etc.)
- If preferred method is Messenger or Instagram: show a helper note "We'll send reminders to your preferred channel when possible"

**Database:**
```sql
alter table public.customers
  add column if not exists whatsapp_number text,
  add column if not exists messenger_id text,
  add column if not exists line_id text,
  add column if not exists telegram_username text,
  add column if not exists instagram_handle text,
  add column if not exists preferred_contact_method text 
    check (preferred_contact_method in ('whatsapp', 'messenger', 'line', 'telegram', 'sms', 'email', 'phone'));
```

### 35.3 Customer Communication Panel

On every booking detail page and customer detail page, a "Communication" panel shows:

**Contact quick-launch buttons:**
One-tap buttons for each channel the customer has provided:
- WhatsApp → opens `https://wa.me/[number]`
- Messenger → opens `https://m.me/[username]`
- LINE → opens `https://line.me/ti/p/[line_id]`
- Telegram → opens `https://t.me/[username]`
- Call → opens `tel:[phone]`
- Email → opens `mailto:[email]`

Buttons show the channel icon and are greyed out if that channel is not set for this customer. Preferred channel is highlighted with a teal border.

**Context card shown alongside the buttons:**
- Vehicle: make/model/plate
- Rental period and status
- Return date (colour coded)
- Outstanding balance
- Deposit held
- Last automated message sent and when

This means when you tap "Message on WhatsApp", you can see all their booking context in the same screen without switching apps.

**Pre-drafted message templates:**
Each channel button opens a confirmation popup offering pre-drafted message options:
- "Payment reminder" — pre-fills with amount owed, due date, PromptPay QR link
- "Return reminder" — pre-fills with return date, location, vehicle
- "Custom message" — free text
- "Share booking link" — shares their booking portal link

Tapping a template opens the relevant app with the message pre-populated in the share URL (wa.me/?text=..., t.me/share/url?..., etc.). Not all platforms support pre-populated text — where they don't, the message is copied to clipboard automatically with a "Copied — paste into [app]" toast notification.

### 35.4 Customer Self-Service Portal

Extend the existing booking link (`/book/[token]`) to support ongoing rental management, not just initial booking completion. Once the customer has completed their booking form and signed the contract, the same link becomes their rental management portal.

**Portal sections (shown after booking is active):**

*Rental summary* — vehicle, dates, rate, deposit, outstanding balance. Already exists.

*Request extension* — tap "Request extension", pick a new return date, add a note. Creates a task for the operator and sends them a notification. Does NOT automatically extend — operator confirms.

*Confirm return details* — "Confirm your return" button that opens a simple form: return date/time, return location (pre-filled, editable), any notes. Submits to the operator as a confirmed return event on the calendar.

*Report a problem* — "Report an issue" opens: category (breakdown, damage, query, other), description text, optional photo upload. Creates an urgent task for the operator with notification.

*Ask a question* — simple text input, submits as a message in the booking's communication log.

*Request rental information* — view their signed contract, delivery inspection photos, deposit amount, payment history.

**Operator notification for all portal actions:**
Every customer portal action creates an in-app notification and activity event. If LINE is connected, also sends a LINE message to the operator.

### 35.5 Operator-Side Rental Management

From the booking detail page, operators can perform rental management actions that mirror what customers can do in the portal:

**Extend rental:**
"Extend rental" button opens a form: new return date, new rate (pre-filled, editable), reason (optional). On confirm:
- Updates rental end_date
- If rate changes, creates a note in the activity log
- Sends customer a notification via their preferred channel: "Your rental has been extended to [date]. Your new balance is ฿[amount]."
- Logs activity event

**Record return:**
"Record return" — triggers return inspection flow (already built).

**Add note:**
Free text note added to the booking communication log. Visible to operator only (not customer).

**Send message:**
Opens the communication panel with pre-drafted templates.

### 35.6 Communication Log

A chronological log of all communication events for a booking, visible on the booking detail page under a "Communication" tab or section.

Entries include:
- Automated messages sent (payment reminders, booking confirmations, review requests) — with channel, timestamp, status (sent/failed)
- Customer portal actions (extension request submitted, return confirmed, problem reported, question asked) — with timestamp and content
- Manual notes added by operator — with timestamp and author
- Booking link activity (opened, form submitted, contract signed) — already tracked in booking_links

Each entry shows: timestamp, type badge, content summary, channel icon if applicable.

This log gives operators a complete record of every interaction — useful for dispute resolution and for knowing what was communicated and when.

### 35.7 Automated Reminders

Operators configure automated messages in Settings → Notifications → Automated Reminders.

**Available reminder types:**

| Reminder | Default timing | Default channel |
|---|---|---|
| Payment due reminder | 3 days before due date | Customer preferred channel |
| Payment overdue alert | 1 day after due date | Customer preferred channel + operator LINE |
| Return reminder | 2 days before return date | Customer preferred channel |
| Return day reminder | Morning of return date | Customer preferred channel |
| Overdue return alert | Same day as overdue | Customer preferred channel + operator LINE |
| Extension expiry | 3 days before extended date | Customer preferred channel |
| Delivery confirmation | 1 hour before scheduled delivery | Customer preferred channel |

**Per-reminder settings:**
- Enable/disable toggle
- Timing: configurable (e.g. "3 days before" → operator can change to 1, 2, 3, 5, or 7 days)
- Channel: Customer preferred channel / WhatsApp only / LINE only / SMS only / All channels
- Message template: editable with variables

**Message template variables:**
`{{customer_name}}`, `{{vehicle_make_model}}`, `{{vehicle_plate}}`, `{{return_date}}`, `{{payment_amount}}`, `{{payment_due_date}}`, `{{deposit_amount}}`, `{{business_name}}`, `{{business_phone}}`, `{{business_line}}`, `{{booking_portal_link}}`

Every automated message includes the booking portal link at the bottom so the customer can take action directly.

**Channel routing logic:**
1. Use customer's preferred_contact_method if set and operator has that channel configured
2. Fall back to WhatsApp if customer has a WhatsApp number
3. Fall back to LINE if customer has a LINE ID and operator has LINE OA
4. Fall back to SMS if operator has SMS configured
5. If no channel available: create an in-app task for operator to contact manually

### 35.8 Settings UI

Settings → Notifications → Automated Reminders:

A list of all reminder types with per-reminder controls. Toggle, timing selector, channel selector, message template editor with variable insertion. Preview button shows how the message will appear to the customer. Save saves all reminders in a single organization settings JSONB field.

### 35.9 Database

```sql
-- Communication log
create table if not exists public.communication_log (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organizations(id),
  rental_id uuid references public.rentals(id),
  customer_id uuid references public.customers(id),
  type text not null check (type in (
    'automated_reminder', 'manual_note', 'customer_portal_action',
    'booking_link_activity', 'operator_message', 'system_event'
  )),
  channel text,
  direction text check (direction in ('outbound', 'inbound', 'internal')),
  content text,
  status text default 'sent' check (status in ('pending', 'sent', 'failed', 'read')),
  metadata jsonb default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Customer portal actions
create table if not exists public.customer_portal_actions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organizations(id),
  rental_id uuid not null references public.rentals(id),
  customer_id uuid references public.customers(id),
  booking_link_token text,
  action_type text not null check (action_type in (
    'extension_request', 'return_confirmation', 'problem_report',
    'question', 'info_request'
  )),
  content jsonb not null,
  status text default 'pending' check (status in ('pending', 'acknowledged', 'resolved')),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz default now()
);

-- Automated reminder settings (stored in organizations.settings JSONB)
-- reminder_settings: {
--   payment_due: { enabled: bool, days_before: int, channels: string[] },
--   return_reminder: { enabled: bool, days_before: int, channels: string[] },
--   ...
-- }
alter table public.organizations
  add column if not exists reminder_settings jsonb default '{}';
```

### 35.10 Build Phase

Phase 2 completion. Build in this order:
1. Customer contact channels in customer form and booking form (Stage 1)
2. Communication panel on booking/customer detail pages (Stage 2)
3. Customer portal extensions — extension request, return confirmation, problem report (Stage 3)
4. Communication log (Stage 4)
5. Automated reminders settings UI and sending logic (Stage 5 — after LINE OA is set up)

---

## 37. Payment Schedule System

### 37.1 Core Payment Schedule Logic

Payment records are created at booking form completion using this model:

**Schedule creation trigger:**
When the customer completes the booking form (or when the operator uses "Record existing rental"), the system generates the full payment schedule based on:
- Delivery date = Day 1 of rental = first payment due date
- Billing period (daily/weekly/monthly)
- Rental end date (if set) or rolling 12 months (if open-ended)

**For open-ended monthly rentals:**
Generate 12 monthly payment records from the delivery date. As each month's payment is marked paid, generate the next month's record automatically. This creates a rolling schedule that never ends until the rental is closed.

**Payment record status lifecycle:**
- `scheduled` — future dated, not yet due
- `pending` — due date has arrived, not yet paid
- `overdue` — past due date, not paid
- `paid` — confirmed received
- `voided` — cancelled/error
- `waived` — forgiven

**Status transitions (automatic):**
- Created → `scheduled`
- Due date arrives → `scheduled` becomes `pending` (daily cron job)
- 1 day past due → `pending` becomes `overdue`
- Payment recorded → becomes `paid`

**Delivery date as payment due date:**
The delivery date from the booking form is always the payment due date for the first payment and all subsequent monthly payments, regardless of whether the customer selects "pay now" or "pay on delivery". The rental period begins when the customer receives the car.

**Delivery inspection due date update:**
During the delivery inspection flow, if the actual delivery date differs from the booking form delivery date, show:
"Delivery date: [booking form date]. Is this correct?"
- "Yes, use this date" → keep existing payment schedule
- "No, update to today" → update all payment records' due dates by the difference in days
- "Choose a different date" → show date picker, then recalculate

### 37.2 Payment Status Display Rules

Payment records show in the booking detail page with these display states:

| Status | Display | Colour |
|---|---|---|
| scheduled | "Due [date]" | Muted grey |
| pending | "Due today" or "Due [date]" | Amber |
| overdue | "Overdue by [N] days" | Red |
| paid | "Paid [date]" | Green |
| voided | "Voided" strikethrough | Grey |
| waived | "Waived" | Muted |

**Outstanding balance** = sum of pending + overdue rent payments only. Scheduled future payments are NOT included in outstanding balance — they are not yet due.

**Deposits** are never included in the outstanding balance. They are tracked separately via `rentals.deposit_held`.

### 37.3 Payment Notifications and Alerts

**Immediate (when payment schedule is created):**
- Task created: "Collect payment — [Customer] ฿[amount] due [date]" with due_date set to the payment due date
- Calendar entry created for the payment due date
- Dashboard alert surfaces according to existing colour system: Green (>14 days), Amber (7-14 days), Red (<7 days or overdue)

**Day before or day of payment due (operator preference):**
- In-app notification: "[Customer] — [Vehicle] payment of ฿[amount] due tomorrow/today"
- LINE notification to operator (if LINE enabled)
- Task urgency escalates to high

**Day after payment due (overdue):**
- Status transitions to overdue automatically via cron
- Dashboard overdue payments card updates
- New LINE notification to operator

**Implementation:**
Tasks and calendar entries are created immediately when payment records are generated — not deferred to the day before. This ensures the operator always has visibility of upcoming payments in their task list and calendar from the moment a booking is confirmed.

A daily cron job (already set up at 01:00 UTC via vercel.json) handles:
1. Transition `scheduled` → `pending` where due_date = today
2. Transition `pending` → `overdue` where due_date < today
3. Send day-before notifications for payments due tomorrow
4. Escalate task priority for payments due today with no recorded payment

### 37.4 Early Return and Open-Ended Contract Closure

When an early return is recorded via the RentalAdjustmentModal:
1. Update `rentals.end_date` to the actual return date
2. Update `rentals.status` to `completed`
3. **Delete or void all `rental_payment` records where:**
   - `status` in (`scheduled`, `pending`)
   - `due_date` > actual return date
   - `voided` is not true
4. If a partial period refund is due: create a refund transaction
5. Cancel any open tasks related to future payments for this rental

This ensures an unexpected return doesn't leave phantom future payment obligations on the books.

### 37.5 Upfront Payment (Multiple Periods)

During booking creation (Step 2 — Rental details), add an "Upfront payment" section:

**Toggle: "Customer is paying multiple periods upfront"**

When enabled, show:
- "Number of periods upfront": number input (e.g. 3)
- "Rate per period": ฿ input (pre-filled with rental_rate, editable for discount)
- "Total upfront amount": calculated and shown (read-only): periods × rate
- Helper: "e.g. 3 months × ฿10,000 = ฿30,000 due on delivery"

**On booking creation with upfront payment:**
1. Create N payment records for the upfront periods, all with status `paid` and `paid_date` = delivery date
2. Create 1 transaction record for the total upfront amount
3. Remaining monthly records (if end date set) created as `scheduled`
4. First non-prepaid payment due date = delivery date + N periods

**Example:**
- Monthly rate: ฿11,000
- Upfront: 3 months at ฿10,000 (discounted)
- Delivery: June 10
- Result: June, July, August payment records → all `paid`, ฿10,000 each
- Next payment due: September 10, ฿11,000 (or ฿10,000 if discount continues)

### 37.6 Dynamic Pricing / Upfront Discount Offer

This is an entirely opt-in feature. Most operators will agree pricing with the customer beforehand and simply present that price in the booking form. The dynamic pricing offer is for operators who want to proactively incentivise upfront payment without a separate negotiation.

**Operator opt-in:**
The offer card only appears in the customer booking form if the operator has explicitly enabled it in Settings → Payment Methods → Upfront discount. It is off by default.

**Upfront discount settings (Settings → Payment Methods):**
- Enable/disable toggle: "Show upfront payment offer to customers in booking form"
- Minimum periods for discount: number input (e.g. 3 months minimum)
- Discounted rate per period: ฿ input (e.g. ฿10,000/month instead of ฿11,000)
- Offer headline: text input — what the customer sees, e.g. "Save ฿3,000 when paying 3 months upfront" or "Pay annually and get 1 month free"
- Offer description: optional longer text

**In the customer booking form (only if operator enabled this):**
A highlighted offer card appears after the payment method section. If the operator has not enabled this, the card never appears and the customer only sees standard payment method selection.

```
╔═══════════════════════════════════════╗
║  💰 Save ฿3,000 with upfront payment  ║
║                                       ║
║  Pay 3 months upfront: ฿30,000        ║
║  (instead of ฿11,000/month × 3)       ║
║                                       ║
║  [Accept this offer]  [No thanks]     ║
╚═══════════════════════════════════════╝
```

If customer accepts:
- Updates payment_timing to 'now' (upfront)
- Records upfront_periods = 3, upfront_rate = 10000
- Total due = ฿30,000 shown in payment section
- On form submission: creates payment records accordingly

**Database additions:**
```sql
alter table public.rentals
  add column if not exists upfront_periods integer default 0,
  add column if not exists upfront_rate numeric,
  add column if not exists upfront_total numeric,
  add column if not exists upfront_accepted boolean default false;

alter table public.organizations
  add column if not exists upfront_discount_enabled boolean default false,
  add column if not exists upfront_discount_min_periods integer default 3,
  add column if not exists upfront_discount_rate numeric,
  add column if not exists upfront_discount_label text;
```

### 37.7 Build Phase

Build in this order:
1. Payment schedule generation at booking completion (core — needed now)
2. Scheduled/pending/overdue status transitions via cron
3. Day-before notifications and task creation
4. Early return payment cleanup
5. Upfront payment option in booking creation
6. Dynamic pricing / upfront discount offer in customer form

---

### 36.1 The Problem

Entering historical and ongoing financial data is the biggest adoption barrier for RouteHQ. An operator with 6 cars and 1 year of history faces hundreds of individual transaction entries before the platform shows meaningful financial intelligence. For operators with more vehicles or longer history, this becomes the primary reason not to adopt.

The platform's value proposition — financial visibility, profitability per vehicle, ROI tracking — is dramatically diminished if operators don't have real data. Getting data in quickly and accurately is therefore a product-critical problem, not just a UX nicety.

### 36.2 Approaches to Speed Up Historical Data Entry

**Approach 1 — CSV Import with Template**

The existing smart importer failed for transactions. Replace or augment it with a template-based approach:

Provide a downloadable CSV template with exact column headers and example rows. Operators fill it in (or have their accountant fill it in) and upload. The template covers:
- Date
- Type (rental_income / maintenance / insurance / tax / fuel / finance / other_expense / other_income)
- Amount
- Vehicle (registration number or make/model)
- Description
- Reference (optional)

On upload: validate each row, show a preview table with any errors highlighted, allow row-by-row correction before confirming import. Import all valid rows, skip/flag invalid ones.

Provide the template as a downloadable .xlsx file with a dropdown for Type so operators can't enter free-text values that break the import.

**Approach 2 — Bulk entry mode**

A fast-entry table view for transactions — similar to a spreadsheet. Operator sees a table with empty rows, each row being a transaction. Tab between cells. Type date, select type from dropdown, enter amount, select vehicle, enter description. Add row with Enter or +. Commit all rows at once.

Much faster than the current single-transaction form for entering historical data.

**Approach 3 — AI-assisted import from bank statement**

Operator uploads a bank statement PDF or CSV export. RouteHQ uses AI (OpenAI) to parse the statement, identify likely rental income vs expenses, suggest transaction types and vehicle associations, and present for review before importing.

This is particularly useful for operators whose accountant exports bank data. The AI doesn't need to be perfect — it just needs to reduce the categorisation work from 100% manual to 20% correction.

This is Phase 3 — complex but high-value.

**Approach 4 — Starting balance / history shortcut**

Rather than entering every historical transaction, allow operators to enter summary figures per vehicle:
- Total revenue to date
- Total expenses to date
- Current outstanding balance

These are entered as a single "Opening balance" transaction dated to their signup date. The platform then tracks accurately going forward. Historical data isn't visible for per-transaction analysis but the cumulative figures are correct.

Show this as an optional step during onboarding: "Do you want to add your historical data? You can import a summary or enter it later."

### 36.3 Recurring Transactions

**Overview**

Operators have predictable recurring expenses: insurance premiums, tax renewals, loan repayments, subscription costs, regular maintenance. Currently these must be entered manually each time, creating friction and risk of missing entries.

**Recurring transaction setup**

In Transactions → Recurring (new section), operators define recurring transactions:

Fields:
- Name: e.g. "MG3 Type 1 Insurance"
- Type: expense category (insurance / tax / finance / maintenance / other)
- Vehicle: link to a vehicle (optional — some expenses are fleet-wide)
- Amount: ฿ prefixed number input
- Frequency: Monthly / Quarterly / Annual / Custom (N days)
- Next due date: date picker
- Auto-add: toggle — if on, transaction is added automatically on the due date; if off, operator is prompted

**Confirmation flow for non-auto recurring transactions**

When a recurring transaction's due date arrives:
- Dashboard shows a notification card: "Recurring payment due today — [name] ฿[amount]"
- Operator taps it and sees: "Was the [name] payment of ฿[amount] made?"
- Two buttons: "Yes — record it now" and "No — remind me later"
- "Yes" immediately creates the transaction record and advances the next due date
- "No — remind me later" snoozes for 3 days then prompts again
- Also sent via LINE if LINE notifications are enabled

**Auto-add flow**

If auto-add is enabled: transaction is created automatically on the due date with status 'recorded' and a note "Auto-added from recurring transaction". Operator sees it in the transactions list and can void it if it wasn't actually paid.

This handles the core problem: RouteHQ can't confirm payment was made, so the operator is prompted to confirm rather than having the system assume.

**Recurring transaction list**

Shows all defined recurring transactions with: name, vehicle, amount, frequency, next due date, last recorded date, status (active/paused). Edit and pause/resume controls. Quick "Record now" button for immediate entry outside the normal schedule.

### 36.4 Build Phase

Section 36.2 Approach 1 (CSV template import) and 36.3 (Recurring transactions) are Phase 2 completion features — high priority before beta launch. Approach 3 (AI bank statement import) is Phase 3. Approach 4 (opening balance shortcut) should be added to onboarding immediately.

### 36.5 Database

```sql
create table if not exists public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organizations(id),
  vehicle_id uuid references public.vehicles(id),
  name text not null,
  type text not null,
  amount numeric not null,
  frequency text not null check (frequency in ('monthly','quarterly','annual','custom')),
  frequency_days integer,
  next_due_date date not null,
  last_recorded_date date,
  auto_add boolean default false,
  is_active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.recurring_transaction_prompts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organizations(id),
  recurring_transaction_id uuid not null references public.recurring_transactions(id),
  due_date date not null,
  status text default 'pending' check (status in ('pending','confirmed','snoozed','skipped')),
  snoozed_until date,
  confirmed_at timestamptz,
  transaction_id uuid references public.transactions(id),
  created_at timestamptz default now()
);
```

---

*This document is the authoritative product brief for all future development sessions. Any AI tool (Claude Code, Codex, ChatGPT) working on this codebase should be given this document as context before being asked to build any feature.*
