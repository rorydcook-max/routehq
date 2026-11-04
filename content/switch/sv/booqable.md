---
title: "Byt från Booqable till RoveHQ"
description: "Exportera dina ordrar, kunder och ditt lager från Booqable som CSV och för in dem i RoveHQ på några minuter. Vi importerar det gratis."
updated: 2026-11-03
exports:
  - "Orders (bokningar) som CSV, från listan Orders"
  - "Kunder som CSV"
  - "Lager som CSV, en rad per artikel när produkterna spåras styckvis"
  - "Rapporter (produktresultat, kunder) som CSV"
steps:
  - "Öppna Orders i Booqable, scrolla längst ner i listan och klicka på Export."
  - "Gör likadant i Customers och i Inventory."
  - "Öppna Flotta i RoveHQ, sedan Importera, välj Booqable och ladda upp CSV-filerna tillsammans."
  - "Kontrollera det som hittades och ta sedan in det."
faq:
  - q: "Tar RoveHQ med depositioner från Booqable som intäkter?"
    a: "Nej. En deposition på en order registreras som en innehållen deposition, inte som intäkt."
  - q: "Kan jag importera flera filer från Booqable på en gång?"
    a: "Ja. Ladda upp ordrar, kunder och lager tillsammans så kopplar RoveHQ ihop dem."
---
Booqables exporter är CSV-filer med en kolumn för varje fält på sidan, och du kan lägga till eller ta bort kolumner innan du exporterar. RoveHQ känner igen Booqables order-, kund- och lagerfiler på rubrikerna och läser dem utan att gissa.

## Så förs statusarna över

- Ordrar med **Reserved** blir kommande bokningar.
- Ordrar med **Started** (hämtade) blir uthyrningar som pågår nu.
- Ordrar med **Stopped** (återlämnade) och **archived** blir tidigare uthyrningar.
- Ordrar med **Draft** och **cancelled** visas men tas inte med om du inte bockar för dem.

En artikels id (ofta registreringsnumret eller ett flottnummer) blir fordonets registreringsnummer. Ordrar kopplas till kunder via namnet och till fordon när id:t finns i exporten.

Fortfarande osäker? Läs vår [jämförelse Booqable vs RoveHQ](/guides/booqable-vs-rovehq) eller vår lista över [alternativ till Booqable för fordonsuthyrning](/guides/booqable-alternatives).

## Gratis import

Importen är gratis i alla planer. RoveHQ känner igen exporter från Booqable och läser dem direkt. Du ser varje fordon, bokning och betalning innan något sparas, och du kan ångra hela importen inom 30 dagar. Vill du hellre slippa göra det själv? [Skicka filerna till oss](/contact) så för vi in dem åt dig.
