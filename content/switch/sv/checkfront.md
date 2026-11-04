---
title: "Byt från Checkfront till RoveHQ"
description: "Exportera dina Checkfront-bokningar från Booking Index som CSV eller Excel och för in dem i RoveHQ. Vi importerar det gratis."
updated: 2026-11-03
exports:
  - "Bokningar från Booking Index som CSV, Excel, PDF eller XML"
  - "Alla kolumner eller bara de synliga"
  - "ISO-datum (2026-11-03) om du bockar för alternativet"
steps:
  - "Öppna Booking Index i Checkfront och filtrera fram de bokningar du vill flytta."
  - "Klicka på Export, välj CSV eller Excel, All columns, och bocka för Use ISO dates."
  - "Öppna Flotta i RoveHQ, sedan Importera, välj Checkfront och ladda upp filen."
  - "Kontrollera det som hittades och ta sedan in det."
faq:
  - q: "Checkfront är byggt för turer och aktiviteter. Fungerar uthyrning?"
    a: "Ja. Varje bokning blir en uthyrning med datum, kund och pris. Artiklar utan registreringsnummer väntar på att du väljer fordon."
---
RoveHQ känner igen Checkfronts bokningsexport på rubrikerna (bokning, status, kundens namn och e-post, start- och slutdatum, totalt och betalt). Avbokade, ogiltiga och pausade bokningar visas men tas inte med om du inte bockar för dem.

Bockar du för **Use ISO dates** i Checkfront kan datumen inte läsas fel. Utan det räknar RoveHQ ut datumordningen från filen och frågar dig när det inte går att avgöra.

## Gratis import

Importen är gratis i alla planer. RoveHQ känner igen exporter från Checkfront och läser dem direkt. Du ser varje fordon, bokning och betalning innan något sparas, och du kan ångra hela importen inom 30 dagar. Vill du hellre slippa göra det själv? [Skicka filerna till oss](/contact) så för vi in dem åt dig.
