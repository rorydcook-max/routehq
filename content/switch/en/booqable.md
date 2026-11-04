---
title: "Switch from Booqable to RoveHQ"
description: "Export your Booqable orders, customers and inventory as CSV and bring them into RoveHQ in a few minutes. We import it free."
updated: 2026-11-03
exports:
  - "Orders (bookings) as CSV, from the Orders list"
  - "Customers as CSV"
  - "Inventory as CSV, one row per stock item when products are tracked"
  - "Reports (product performance, customers) as CSV"
steps:
  - "In Booqable, open Orders, scroll to the bottom of the list and click Export."
  - "Do the same in Customers and in Inventory."
  - "In RoveHQ, open Fleet, then Import, choose Booqable and upload the CSV files together."
  - "Check what was found, then bring it in."
faq:
  - q: "Does RoveHQ copy Booqable's deposits as income?"
    a: "No. A security deposit on an order is recorded as a deposit held, not as income."
  - q: "Can I import several Booqable files at once?"
    a: "Yes. Upload orders, customers and inventory together and RoveHQ links them."
---
Booqable's exports are CSV files with a column for each field on the page, and you can add or remove columns before exporting. RoveHQ recognises Booqable's order, customer and inventory files by their headings and reads them without guessing.

## How statuses come across

- **Reserved** orders become upcoming bookings.
- **Started** (picked up) orders become rentals that are out now.
- **Stopped** (returned) and **archived** orders become past rentals.
- **Draft** and **cancelled** orders are listed but left out unless you tick them.

A stock item's identifier (often the plate or a fleet number) becomes the vehicle's plate. Orders link to customers by name and to vehicles where the identifier is in the export.

Still deciding? Read our [Booqable vs RoveHQ comparison](/guides/booqable-vs-rovehq) or our list of [Booqable alternatives for vehicle rental](/guides/booqable-alternatives).

## Free import

Importing is free on every plan. RoveHQ recognises Booqable exports and reads them straight away. You see every vehicle, booking and payment before anything is saved, and you can take the whole import back within 30 days. If you'd rather not do it yourself, [send us the files](/contact) and we'll bring them in for you.
