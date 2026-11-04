# How competing rental software lets data out

Research for "Switch to RoveHQ" (importer presets in `lib/import/presets.ts`, catalogue in `lib/import/software.ts`,
website pages in `content/switch/en/`). Checked **3 November 2026** from public help centres, API docs and product
pages. Exports change: recheck before relying on a detail.

**Confidence.** Very few vendors publish their export column names. Where a help article lists them, it is marked
*documented*. Otherwise the preset's heading signature is built from the vendor's on-screen labels, API field names and
the fields its help pages describe (*inferred*). Every preset falls back to RoveHQ's normal reading (past corrections,
AI when on, header rules) for columns it doesn't know, and the owner checks every card before anything is saved.

| Software | Region | Data out | How | Preset |
|---|---|---|---|---|
| Anolla | EU (multilingual) | "Raw data" to Excel, Google Sheets, BI tools | Not documented step by step | No |
| AnyRent | PT (incl. Madeira) | Not documented publicly | Ask support | No |
| Appointrent | IT | Not documented publicly | Ask support | No |
| Coastr | UK | Vehicle tracking/trip data as CSV; bookings/customers not documented | Reports (tracking); ask support | No |
| Fleetee | FR | Not documented publicly | Ask support | No |
| Lokki | FR | Not documented publicly | Ask support | No |
| MyRent (Dogma Systems) | IT, global | Reports to Excel ("other format like excel") | Reports | No |
| Prohire | UK | Not documented publicly | Ask support | No |
| Renteon | HR, EU | "Data export to finance"; nothing else public | Ask support | No |
| Rentware | DE | Revenue (Datev) as CSV/Excel only | app.rentware.io/metrics/datev-revenue | No |
| TopRentApp | IT | All data as SQL or CSV on termination | Ask TopRentApp | No |
| VEVS | Global (80+ countries, GR) | Reservations CSV (Export Reservations, configurable template); customers CSV | Customers > tick > Choose Action > Export selected | Yes (reservations, inferred and strict; **confirm headers with a real file**) |
| Way2Rentals | PT, ES | Not documented publicly | Ask support | No |
| Wheelsys | GR, global | Reports exported "in many formats", emailed or scheduled | Reports | No |
| Booqable | EU, NA (equipment/scooters) | Orders, customers, inventory, documents, reports as CSV | Each list > Export at the bottom; Reports > Export; Background tasks to re-download | Yes (orders, customers, inventory) |
| Car Rental Solutions | NA | Customers and renters as CSV | Marketing > Export Customers / Export Renters > Export | No (generic reading) |
| Checkfront | Global (tours, activity rentals) | Bookings as CSV, Excel, PDF, XML | Booking Index > Export (all/visible columns, ISO dates option) | Yes (bookings) |
| Easy Rent Pro | EU | Not documented publicly | Ask support | No |
| FareHarbor | NA, global (activities) | Bookings and contacts reports as CSV | Reports > Bookings / Contacts report > export | Yes (bookings) |
| HQ Rental Software | Global (EU, NA, LatAm) | Every table and report to Excel; reports to PDF; REST API | Table menu (top right) > Actions > Export; Reports > Excel button | Yes (reservations, vehicles) |
| MotoStack | SEA (Thailand, Bali) | No export documented on its public site | Ask support | No |
| RENTALL (formerly Navotar) | NA | Reports to Excel (not documented publicly) | Ask support / reports | Yes (reservations/agreements, inferred) |
| Rent Centric | NA | Reports (not documented publicly) | Ask support | No |
| Rental Car Manager (RCM) | AU, NZ, UK, global | Bookings Export (all booking fields + payments) to Excel, CSV, PDF | Reports > Other Reports > Bookings Export, Include Payments | Yes (bookings with payments) |
| RentSyst | EU, global | Vehicles list as XLS or CSV; data export listed on its pricing page | Vehicles > Park > Options > XLS/CSV | Yes (vehicles, orders, inferred) |
| RentWorks / RentWorks Plus (Bluebird) | NA, UK | Every report to PDF, Excel, CSV; Reservations and Customers lists have Export buttons; accounting export | Export Results on reports; list Export buttons | Yes (agreements/reservations, fleet) |
| Rezdy | AU, global (tours) | Sales - Orders report to CSV (all columns, whatever is shown) | Reports > Sales - Orders > Export to CSV | Yes (orders) |
| TSD Rental | NA (dealer loaners, rental) | Custom reports exported to Microsoft Excel; G/L output files | Reports (not documented publicly) | Yes (contracts, units, inferred) |
| TWICE Commerce (formerly Rentle) | EU (Nordics), equipment/scooters | Every table's current view as CSV; Revenue and Payments reports as CSV (Export tab, 100,000 rows) | Table > Export; Reports > Export tab | Yes (orders, payments report; partly documented) |
| Wheelbase | NA (RV/campervan) | Not documented publicly | Ask support | No |

Also looked at and left out of the presets (not enough public detail or not vehicle rental): Thermeon (enterprise,
implementation-led), Planyo, Bókun, WorCo. Europe/UK long tail (BookingPlan, GOCARS, Ridebly, Dynabyte, Renthub,
Noleggy, Esposito, CileaRent, AZLoc, Teori, C-Rent, Yourenti, RentPanels, Flit2GO, Renviq, Eccocar, iVech, Carhire
Manager Web, Rently) is covered by the generic spreadsheet reading; research in the 4 November 2026 EU report.

The table is grouped: European and UK systems added on 4 November 2026 first, then the original list. The importer
and website sort by name.

## Per software

### Booqable — *documented paths, inferred columns*
- Export: Orders, Documents, Customers, Inventory (and Collections): left sidebar > the list > scroll down > **Export**.
  CSV, "generated automatically with columns for the page's contents"; columns can be added or removed. Inventory
  exports one row per stock item for trackable products and includes the main image URL. Reports (product
  performance, product fulfillment, customers) > **Export**; re-download from Reports > Background tasks.
- Columns named in the article: order number, item count, price, tax region, pickup location. API v1 order fields:
  `number`, `status`, `starts_at`, `stops_at`, `customer_id`, `item_count`; customers: `number`, `name`, `email`,
  `deposit_type`, `legal_type`, `discount_percentage`, `tax_region`; stock items: `identifier`.
- Statuses: new, draft (concept), reserved, started (picked up), stopped (returned), archived, canceled.
- Sources: https://help.booqable.com/en/articles/5603655 ·
  https://help.booqable.com/en/articles/3845244-the-booqable-order-workflow · https://developers.booqable.com/v1.html

### Car Rental Solutions — *documented path*
- Marketing > Export Renters (renters on completed agreements) or Export Customers (includes reservation-only
  customers) > Export > CSV. Contents: name and contact details, address, phone numbers, contract renter fields.
- Source: https://www.carrentalsolutions.com/marketing/export-renters.html

### Checkfront — *documented path, inferred columns*
- Booking Index (filters applied) > **Export** > Save As, Format (XLSX, CSV, PDF, XML), Columns (all or visible),
  Max Rows, **Use ISO Dates** > Export. Selected bookings can be exported from the blue banner. Booking notes and the
  daily list export separately.
- Columns: the article doesn't list them. Preset uses the Booking Index labels / API booking fields: booking id or
  code, status name, customer name, email, phone, start date, end date, summary, total, paid total.
- Sources: https://support.checkfront.com/hc/en-us/articles/19868452880668-Importing-and-exporting-via-the-Booking-Index ·
  https://support.checkfront.com/hc/en-us/articles/19868487340316-Exporting-the-booking-daily-list

### FareHarbor — *documented path, inferred columns*
- Reports > Performance > Bookings (advanced reports: dates, filters, groupings, columns) and Contacts report; files use
  "FareHarbor's standardized CSV format". Columns are chosen per report; preset expects booking id, item, start,
  contact name/email/phone, total or amount paid, status.
- Sources: https://help.fareharbor.com/hc/en-us/articles/40898072248987-Bookings-reports ·
  https://help.fareharbor.com/hc/en-us/articles/40898088413595-Contacts-report

### HQ Rental Software — *documented path, inferred columns*
- "You can essentially export all tables and reports from the system to an Excel sheet." Tables: open the table
  (e.g. Car Rental > Reservations), filter, add/remove columns, then the menu (top right) > Actions > **Export**.
  Reports: Reports > choose report > filters > **Excel** button (also PDF, saved fixed reports, email). Recurring data
  exports exist; full REST API (reservations, vehicles, payments, refunds, security deposits).
- Columns: chosen by the user; preset uses on-screen/API names (reservation #, pick-up date, return date, pick-up and
  return location, vehicle class, plate, customer, total, total paid, outstanding balance, security deposit; vehicles:
  plate, vehicle class, brand, model, odometer, VIN, location).
- Statuses (API): quote, pending, open (confirmed), rental (out), completed, cancelled, no show.
- Sources: https://hqrs.notion.site/Exporting-To-Excel-27f39e91383c48cfaa2f9d41b1290b1f ·
  https://hqrs.notion.site/Knowledge-Base-b3dc775703154b14b2ba62fad43c7032 · https://api-docs.hqrentalsoftware.com/

### MotoStack — *nothing public*
- The public site describes bikes (class, plate, mileage, photos, history), customers (profiles, documents, rental
  history, deposits) and bookings (calendar, cancellations, extensions, source) and a free import, but no export.
  Data likely only via a support request.
- Source: https://motostack.io/

### RENTALL (formerly Navotar) — *nothing public*
- Navotar announced its switch to the Rentall brand on 9 May 2022 (merger with Bluebird and Thermeon); navotar.com
  redirects to rentallsoftware.com. Catalogue id and `/switch/navotar` kept. Sources:
  https://www.autorentalnews.com/news/navotar-announces-branding-switch-to-rentall ·
  https://www.autorentalnews.com/news/bluebird-thermeon-navotar-combine-to-form-rentall
- No public help centre found. Preset (inferred) expects reservation and agreement numbers, pickup/return dates,
  vehicle type, vehicle number, customer, status. US: month-first dates, miles. Support request may be needed.
- Source: https://www.youtube.com/watch?v=K8whwY_PxYk (vendor demo; no export documentation found)

### Rental Car Manager — *documented path, partly documented columns*
- Reports > Other Reports > **Bookings Export**: pickup location, date range by Date Booked / Pickup / Dropoff /
  Date Closed / Payment Date / All Dates, **Include Payments**. Shown in the browser; print, copy, export to Excel,
  CSV or PDF (Excel/CSV recommended). Hidden columns are hidden in exports too. All fields for bookings with status
  Reservation, Hired or Returned; payment details: payment date, payment type, reference number, amount, merchant fee.
- Source: https://support.rentalcarmanager.com/portal/en/kb/articles/booking-export-report

### TWICE Commerce (formerly Rentle) — *documented paths, partly documented columns*
- Renamed: the Rentle WordPress plugin changelog reads "Rentle ==> Twice Commerce brand changes". Catalogue id
  `rentle` and `/switch/rentle` kept; `/switch/twice-commerce` redirects there (next.config.ts).
- Every admin table exports the current view (filters, sorts, groupings, visible columns) as CSV with one click.
  Orders table columns named in TWICE's update notes: Payment, Deposit, Stage (formerly State), Item states,
  Fulfillment state, Customers, Sales channel, Price, Line items, Purchase types, End date returned.
- Finance reports (Revenue, Payments) export CSV from the Export tab, up to 100,000 rows. Revenue CSV: Document_Type,
  Revenue_Category, Order_Number, Item_Name, Quantity, Create_Date, Start_Date, End_Date, Created/Started/Ended_In_Period,
  Account, Location, Cost_Center, Timezone, Amount_Excl_Tax, Amount_Total, Payment_Status, Amount_Paid,
  Amount_Refunded, Amount_Outstanding, First_Payment_Date, Row_ID (+ one tax column per rate). Payments CSV:
  Payment_Date, Payment_Datetime, Payment_Type, Payment_Method, Payment_Provider, Account, Location, Cost_Center,
  Timezone, Amount_Excl_Tax, Amount_Total, Revenue_Row_ID, Row_ID. Dates are in the account timezone; format not stated.
- Presets: orders (key: store/shop, sales channel, line items or purchase types; Stage = status, Line items = vehicle,
  Customers = customer) and the Payments CSV (key: Revenue_Row_ID). The Revenue CSV is one row per order line, so it
  is not a preset; it is read generically when uploaded beside a recognised file. Older Rentle exports (order, start,
  end, store, customer, total, products) still match. Exact orders headers for start/end dates are unconfirmed.
- Sources: https://www.twicecommerce.com/docs/admin/tables · https://www.twicecommerce.com/docs/updates ·
  https://www.twicecommerce.com/docs/concepts/reports/finance-reports · https://wordpress.org/plugins/embed-rentle/

### VEVS — *documented paths, inferred columns (confirm with a real file)*
- Customers: "Under the Customers menu check the client's details that you want to export and from the Choose Action
  button click on 'Export selected'. Clients' details will be saved into a CSV file." Reservations: "Quickly export
  reservations in CSV format" (VEVS blog); Glovebox's migration guide names the "Export Reservations" screen, which
  uses a configurable export template.
- Fields (from Glovebox's importer guide, not VEVS): booking reference, customer first name, last name, email, phone,
  pickup and return date/time, vehicle, pickup and return locations, booking total, booking status, notes; dates
  `DD.MM.YYYY`. Glovebox dedupes on the VEVS reference and matches customers on email.
- **Exact header strings are not published.** The preset is deliberately strict: it needs a pickup location heading
  and all of return location, first name, last name, email, pickup date and return date, 9 of 13 signature headings
  (8 when the owner picks VEVS), and is ruled out by other software's tell-tale headings (outstanding balance,
  merchant fee, date booked, date closed, item count, tax region, sales channel, line items). **Confirm the headings
  with a real VEVS export and adjust `lib/import/presets.ts`.** Whether operators can run the reservations export
  themselves is also unconfirmed (Glovebox flags it).
- Sources: https://www.vevs.com/how-to/customers.php ·
  https://www.vevs.com/blog/new-upgrade-for-the-car-rental-website-builder-67.php ·
  https://getglovebox.co.nz/help/guides/switching-to-glovebox-from-vevs

### Wheelsys, TopRentApp, MyRent, Renteon, Rentware, Anolla — *paths partly public, no columns*
- Wheelsys (Athens): "Reports can be exported in many formats, printed or emailed... scheduled to be delivered in your
  inbox." https://wheelsys.com/features/
- TopRentApp (Oxygen S.R.L., Rome): "Upon termination, we will provide ALL DATA to the customer in a human readable
  format such as SQL or CSV." https://toprentapp.com/
- MyRent (Dogma Systems Srl, Italy): "exporting of reports to other format like excel".
  https://www.myrentsoftware.com/introduction/
- Renteon (VIP-DATA d.o.o., Zagreb): "data export to finance" listed. https://renteon.com/hr/
- Rentware (Germany): revenue export (Datev) as CSV or Excel at app.rentware.io/metrics/datev-revenue; no booking or
  customer export documented. https://rentware.com/en/help/export-your-accounting-data/
- Anolla: "Export raw data at any time to Excel, Google Sheets or directly to BI and AI tools".
  https://anolla.com/en/vehicle-rental-software
- No presets: collect a real export from the first migrating customer before building one (Wheelsys and TopRentApp
  first).

### Coastr, Prohire (UK); Lokki, Fleetee (FR); Appointrent (IT); Way2Rentals, AnyRent (PT) — *nothing public*
- Coastr: only vehicle tracking/trip CSV from Reports is documented
  (https://help.coastr.com/knowledge/how-to-view-and-download-vehicle-tracking/trips-data-in-the-reports-section);
  it offers migration in from Excel/paper (https://www.coastr.com/). Prohire: nothing public
  (https://www.prohire.co.uk/). Lokki (https://solutions.lokki.rent/it/logiciel-location/mobilite), Fleetee
  (https://www.fleetee.io/), Appointrent (https://appointrent.com/), Way2Rentals (https://way2rentals.com/en/),
  AnyRent (https://www.anyrent.pt/pt): no export documentation found. Generic steps; UK entries miles, EU entries km,
  all day-first dates (these defaults only take effect once a preset exists).

### RentSyst — *documented path (vehicles), inferred columns*
- Vehicles > Park > **Options** > XLS or CSV. "Data export" and "Fleet import" are listed among plan features.
  Orders and clients exports not documented publicly.
- Sources: https://rentsyst.com/faq/question/69/ · https://rentsyst.com/price/

### RentWorks / RentWorks Plus (Bluebird Auto Rental Systems) — *documented paths, inferred columns*
- "Every report exports to PDF, Excel and CSV from Export Results. Lists such as Reservations and Customers have their
  own export buttons." Desktop RentWorks has an accounting export (AR, AP, G/L).
- Preset (inferred): RA #, Res #, Unit #, date out, date due, date in, class, renter, status; fleet: unit #, VIN,
  license, make, model, year, mileage, class. "Open" agreement = vehicle out. US/UK: month-first dates (US), miles.
- Sources: https://www.rentworksplus.com/platform/reporting-analytics · https://www.barsnet.com/products/add-on-modules/

### Rezdy — *documented path, inferred columns*
- Reports > **Sales - Orders** > **Export to CSV** (exports all data and columns regardless of what is shown).
  Statuses include confirmed, on hold, cancelled; payment status paid, pending, refunded. "Deposit" can be a part
  payment, so the preset doesn't read it as a security deposit.
- Sources: https://support.rezdy.com/hc/en-us/articles/19867797356316-How-To-Use-the-Sales-Orders-Report ·
  https://support.rezdy.com/hc/en-us/articles/19867712055068-Reports-Overview

### TSD Rental — *path not public*
- "Custom design and save reports ... data exporting to Microsoft Excel"; output files with G/L distribution for
  accounting. Preset (inferred): contract #, stock #, date out, date in / expected return, customer, VIN.
- Sources: https://www.autorentalnews.com/news/tsd-expands-reporting-features-more-than-20-other-upgrades ·
  https://tsdweb.com/car-rental-software/

### Rent Centric, Easy Rent Pro, Wheelbase — *nothing public*
- Product sites mention reporting but no export article was found. The importer shows generic steps (look for
  Export/Excel/CSV, else ask support) and reads files with the normal reading.
- Sources: https://www.rentcentric.com/ · https://www.capterra.com/p/92382/Rent-Centric/

## Data that needs an API or a support request
- **HQ Rental Software**: Excel covers tables and reports; full history with payments/refunds per reservation is
  easiest via the API (developer) if the table export lacks a column.
- **MotoStack, RENTALL (Navotar), Rent Centric, Easy Rent Pro, Wheelbase, Prohire, Lokki, Fleetee, Appointrent,
  Way2Rentals, AnyRent, Renteon**: no documented self-serve export; expect a support request (or copy lists / photos
  into RoveHQ's importer). **TopRentApp** hands over all data (SQL or CSV) on termination. **Rentware** and **Coastr**
  document only revenue or tracking exports; bookings and customers need support.
- **TSD Rental**: report export to Excel exists but the path isn't public; dealers may need TSD support.
- **RentSyst**: vehicles self-serve; orders and clients may need support depending on plan.

## How the presets treat money, dates and units
- Booking statuses: cancelled / void / no-show and quotes / drafts / on-hold are listed but left out unless ticked;
  returned / completed / closed set "Returned: yes"; out / started / hired / open agreement set "Returned: no".
- Deposits: a booking's deposit column is a deposit held, never income. In payment files, money in described as a
  deposit is "deposit received"; a refund or release going out is "deposit refunded"; only a deposit described as
  kept, retained, forfeited or deducted becomes "deposit forfeited" (income). Rent payments on a rental still running
  are not copied: they become its "amount paid", and its "paid up to" records them (nothing is counted twice).
- Dates: worked out from the file (13/06 vs 06/13); when every date could be either, the software's usual order is
  used (US tools month first) and the owner is still asked. ISO dates are never ambiguous.
- Distance: a heading that says miles or km decides; otherwise the software's usual unit (US tools miles). Converted
  to the business's `settings.distance_unit`.
- Currency: symbols and codes are stripped from amounts ($, €, £, US$, RM, Rp, ₱...). A currency column different from
  the business's currency is flagged; no exchange rate is guessed.
