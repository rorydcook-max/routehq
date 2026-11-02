---
title: "Link payments to a booking"
description: "Connect rent you recorded before a booking existed to that booking, so its payments show as paid and nothing is counted twice."
category: money
order: 7
appPath: ""
related: ["rentals-already-running", "record-a-payment", "import-a-spreadsheet", "money-in-and-out"]
updated: 2026-11-02
---

Say you imported old payments from a spreadsheet, or recorded rent before adding the booking. The booking would say rent is owed when the customer already paid.

When you open a booking, RoveHQ looks for **Rental income** for the same vehicle, not linked to any booking, within the booking's dates (give or take a few days). If it finds some, it asks at the top of the booking: **Is this payment from this booking?**

## Link them

1. Check the list. Everything is ticked; untick any that aren't from this booking.
2. Tap **Yes, link them**.

Nothing is linked until you say yes.

Each payment is matched to the rent on the booking with the same amount and the nearest due date (within about three weeks), and that rent is marked paid. If you'd set the booking up as already paid, your real payment replaces the placeholder, so nothing is counted twice. A payment that doesn't match any rent is still linked; just check the booking's payments look right.

## Not from this booking

Tap **No, not from this booking**. RoveHQ stops asking about them on this booking and leaves them as they are.

## Tips

- Adding a rental that's already running? Add it with its real start date, then open it and answer the question. See [Rentals already running](/docs/rentals-already-running).
- Only rent is offered, never deposits or costs.
- If a payment was saved against the wrong vehicle, fix it in **Money in & out** first, then reopen the booking.
