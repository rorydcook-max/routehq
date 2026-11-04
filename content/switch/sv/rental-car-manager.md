---
title: "Byt från Rental Car Manager till RoveHQ"
description: "Kör Bookings Export med betalningar i Rental Car Manager och för in dina bokningar i RoveHQ. Vi importerar det gratis."
updated: 2026-11-03
exports:
  - "Bookings Export: alla fält för bokningar med status Reservation, Hired eller Returned"
  - "Betalningar som lagts till varje bokning (betalningsdatum, typ, referens, belopp, kortavgift)"
  - "Excel, CSV eller PDF (Excel eller CSV rekommenderas)"
steps:
  - "Gå till Reports i Rental Car Manager, sedan Other Reports, sedan Bookings Export."
  - "Välj All Dates, bocka för Include Payments och kör rapporten."
  - "Exportera till Excel eller CSV."
  - "Öppna Flotta i RoveHQ, sedan Importera, välj Rental Car Manager och ladda upp filen."
---
Rental Car Manager beskriver Bookings Export som en datadump för analys i ett kalkylark, vilket gör den till ett bra sätt att flytta. RoveHQ känner igen den på rubrikerna.

## Så förs statusarna över

- **Reservation** blir en kommande bokning.
- **Hired** blir en uthyrning som pågår nu.
- **Returned** blir en tidigare uthyrning.

Kolumner som du döljer i rapporten följer inte heller med i exporten, så visa allt innan du exporterar.

Fortfarande osäker? Läs vår [jämförelse Rental Car Manager vs RoveHQ](/guides/rental-car-manager-vs-rovehq).

## Gratis import

Importen är gratis i alla planer. RoveHQ känner igen exporter från Rental Car Manager och läser dem direkt. Du ser varje fordon, bokning och betalning innan något sparas, och du kan ångra hela importen inom 30 dagar. Vill du hellre slippa göra det själv? [Skicka filerna till oss](/contact) så för vi in dem åt dig.
