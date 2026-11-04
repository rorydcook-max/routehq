---
title: "Bytt fra Checkfront til RoveHQ"
description: "Eksporter bookingene dine fra Booking Index i Checkfront som CSV eller Excel og få dem inn i RoveHQ. Vi importerer gratis."
updated: 2026-11-03
exports:
  - "Bookinger fra Booking Index som CSV, Excel, PDF eller XML"
  - "Alle kolonner eller bare de synlige"
  - "ISO-datoer (2026-11-03) hvis du huker av for det"
steps:
  - "I Checkfront åpner du Booking Index og filtrerer på bookingene du vil flytte."
  - "Klikk Export, velg CSV eller Excel og All columns, og huk av for Use ISO dates."
  - "I RoveHQ åpner du Flåte, så Importer, velger Checkfront og laster opp filen."
  - "Sjekk hva som ble funnet, og hent det inn."
faq:
  - q: "Checkfront er laget for turer og aktiviteter. Fungerer det for utleie?"
    a: "Ja. Hver booking blir en utleie med datoer, kunde og pris. Enheter uten registreringsnummer venter på at du velger kjøretøy."
---
RoveHQ kjenner igjen bookingeksporten fra Checkfront på overskriftene (booking, status, kundens navn og e-post, start- og sluttdato, totalt og betalt). Kansellerte, ugyldige og ventende bookinger (cancelled, void, on hold) vises, men tas bare med hvis du huker dem av.

Huker du av for **Use ISO dates** i Checkfront, kan ingen datoer leses feil. Uten det finner RoveHQ ut datorekkefølgen fra filen, og spør deg når den ikke kan avgjøre det.

## Gratis import

Import er gratis i alle abonnementer. RoveHQ kjenner igjen eksporter fra Checkfront og leser dem med en gang. Du ser hvert kjøretøy, hver booking og hver betaling før noe lagres, og du kan angre hele importen innen 30 dager. Vil du helst slippe å gjøre det selv? [Send oss filene](/contact), så legger vi dem inn for deg.
