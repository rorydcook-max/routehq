---
title: "Bytt fra HQ Rental Software til RoveHQ"
description: "Eksporter reservasjoner, kjøretøy og kunder fra HQ Rental Software til Excel og få dem inn i RoveHQ. Vi importerer gratis."
updated: 2026-11-03
exports:
  - "Alle tabeller (reservasjoner, kjøretøy, kunder) til Excel, med kolonnene du velger"
  - "Rapporter til Excel eller PDF"
  - "Et API for utviklere"
steps:
  - "I HQ Rental Software åpner du Car Rental, så Reservations, filtrerer om nødvendig og legger til kolonnene du vil ha."
  - "Klikk menyen øverst til høyre i tabellen, så Actions og Export."
  - "Gjør det samme for Vehicles og Customers."
  - "I RoveHQ åpner du Flåte, så Importer, velger HQ Rental Software og laster opp filene samlet."
faq:
  - q: "Trenger jeg API-et til HQ?"
    a: "Nei. Excel-eksportene holder. API-et finnes hvis en utvikler heller vil bruke det."
---
Kunnskapsbasen til HQ sier at du kan eksportere alle tabeller og rapporter i systemet til Excel. RoveHQ kjenner igjen reservasjons- og kjøretøyeksportene fra HQ på overskriftene (hente- og returdato og -sted, kjøretøyklasse, registreringsnummer, kilometerstand).

## Slik overføres statusene

- **Open**- og **Pending**-reservasjoner blir kommende bookinger.
- **Rental**-reservasjoner blir utleier som er ute nå.
- **Completed**-reservasjoner blir tidligere utleier.
- **Quote**, **Cancelled** og **No Show** vises, men tas bare med hvis du huker dem av.

Totalt betalt og depositum overføres hver for seg, så et depositum du holder, regnes aldri som inntekt.

Fortsatt usikker? Les [vår sammenligning av HQ Rental Software og RoveHQ](/guides/hq-rental-software-vs-rovehq).

## Gratis import

Import er gratis i alle abonnementer. RoveHQ kjenner igjen eksporter fra HQ Rental Software og leser dem med en gang. Du ser hvert kjøretøy, hver booking og hver betaling før noe lagres, og du kan angre hele importen innen 30 dager. Vil du helst slippe å gjøre det selv? [Send oss filene](/contact), så legger vi dem inn for deg.
