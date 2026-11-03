---
title: "Switch from HQ Rental Software to RoveHQ"
description: "Export your HQ Rental Software reservations, vehicles and customers to Excel and bring them into RoveHQ. We import it free."
updated: 2026-11-03
exports:
  - "Any table (reservations, vehicles, customers) to Excel, with the columns you choose"
  - "Reports to Excel or PDF"
  - "An API for developers"
steps:
  - "In HQ Rental Software, open Car Rental, then Reservations, filter if you need to, and add the columns you want."
  - "Click the menu at the top right of the table, then Actions, then Export."
  - "Do the same for Vehicles and Customers."
  - "In RoveHQ, open Fleet, then Import, choose HQ Rental Software and upload the files together."
faq:
  - q: "Do I need HQ's API?"
    a: "No. The Excel exports are enough. The API is there if a developer prefers it."
---
HQ's knowledge base says you can export every table and report in the system to Excel. RoveHQ recognises HQ's reservation and vehicle exports by their headings (pick-up and return dates and locations, vehicle class, plate, odometer).

## How statuses come across

- **Open** and **Pending** reservations become upcoming bookings.
- **Rental** reservations become rentals that are out now.
- **Completed** reservations become past rentals.
- **Quote**, **Cancelled** and **No Show** are listed but left out unless you tick them.

Total paid and the security deposit come across separately, so a deposit you hold is never counted as income.

## Free import

Importing is free on every plan. RoveHQ recognises HQ Rental Software exports and reads them straight away. You see every vehicle, booking and payment before anything is saved, and you can take the whole import back within 30 days. If you'd rather not do it yourself, [send us the files](/contact) and we'll bring them in for you.
