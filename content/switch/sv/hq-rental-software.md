---
title: "Byt från HQ Rental Software till RoveHQ"
description: "Exportera dina reservationer, fordon och kunder från HQ Rental Software till Excel och för in dem i RoveHQ. Vi importerar det gratis."
updated: 2026-11-03
exports:
  - "Vilken tabell som helst (reservationer, fordon, kunder) till Excel, med de kolumner du väljer"
  - "Rapporter till Excel eller PDF"
  - "Ett API för utvecklare"
steps:
  - "Öppna Car Rental i HQ Rental Software, sedan Reservations, filtrera vid behov och lägg till de kolumner du vill ha."
  - "Klicka på menyn uppe till höger i tabellen, sedan Actions och sedan Export."
  - "Gör likadant för Vehicles och Customers."
  - "Öppna Flotta i RoveHQ, sedan Importera, välj HQ Rental Software och ladda upp filerna tillsammans."
faq:
  - q: "Behöver jag HQ:s API?"
    a: "Nej. Excel-exporterna räcker. API:t finns om en utvecklare hellre vill använda det."
---
Enligt HQ:s kunskapsbas kan varje tabell och rapport i systemet exporteras till Excel. RoveHQ känner igen HQ:s reservations- och fordonsexporter på rubrikerna (datum och plats för hämtning och återlämning, fordonsklass, registreringsnummer, mätarställning).

## Så förs statusarna över

- Reservationer med **Open** och **Pending** blir kommande bokningar.
- Reservationer med **Rental** blir uthyrningar som pågår nu.
- Reservationer med **Completed** blir tidigare uthyrningar.
- **Quote**, **Cancelled** och **No Show** visas men tas inte med om du inte bockar för dem.

Totalt betalt och depositionen förs över var för sig, så en deposition du håller räknas aldrig som intäkt.

Fortfarande osäker? Läs vår [jämförelse HQ Rental Software vs RoveHQ](/guides/hq-rental-software-vs-rovehq).

## Gratis import

Importen är gratis i alla planer. RoveHQ känner igen exporter från HQ Rental Software och läser dem direkt. Du ser varje fordon, bokning och betalning innan något sparas, och du kan ångra hela importen inom 30 dagar. Vill du hellre slippa göra det själv? [Skicka filerna till oss](/contact) så för vi in dem åt dig.
