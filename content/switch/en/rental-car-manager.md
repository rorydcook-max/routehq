---
title: "Switch from Rental Car Manager to RoveHQ"
description: "Run Rental Car Manager's Bookings Export with payments and bring your bookings into RoveHQ. We import it free."
updated: 2026-11-03
exports:
  - "Bookings Export: every field of bookings with a status of Reservation, Hired or Returned"
  - "Payments added to each booking (payment date, type, reference, amount, merchant fee)"
  - "Excel, CSV or PDF (Excel or CSV recommended)"
steps:
  - "In Rental Car Manager, go to Reports, then Other Reports, then Bookings Export."
  - "Choose All Dates, tick Include Payments, and run it."
  - "Export to Excel or CSV."
  - "In RoveHQ, open Fleet, then Import, choose Rental Car Manager and upload the file."
---
Rental Car Manager describes the Bookings Export as a data dump for analysis in a spreadsheet, which makes it a good way to move. RoveHQ recognises it by its headings.

## How statuses come across

- **Reservation** becomes an upcoming booking.
- **Hired** becomes a rental that is out now.
- **Returned** becomes a past rental.

Columns you hide in the report are left out of the export too, so show everything before exporting.

## Free import

Importing is free on every plan. RoveHQ recognises Rental Car Manager exports and reads them straight away. You see every vehicle, booking and payment before anything is saved, and you can take the whole import back within 30 days. If you'd rather not do it yourself, [send us the files](/contact) and we'll bring them in for you.
