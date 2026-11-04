---
title: "Bytt fra Booqable til RoveHQ"
description: "Eksporter ordrer, kunder og lager fra Booqable som CSV og få dem inn i RoveHQ på noen minutter. Vi importerer gratis."
updated: 2026-11-03
exports:
  - "Ordrer (bookinger) som CSV, fra Orders-listen"
  - "Kunder som CSV"
  - "Lager som CSV, én rad per enhet når produktene spores"
  - "Rapporter (produktytelse, kunder) som CSV"
steps:
  - "I Booqable åpner du Orders, blar helt ned i listen og klikker Export."
  - "Gjør det samme i Customers og Inventory."
  - "I RoveHQ åpner du Flåte, så Importer, velger Booqable og laster opp CSV-filene samlet."
  - "Sjekk hva som ble funnet, og hent det inn."
faq:
  - q: "Kopierer RoveHQ depositum fra Booqable som inntekt?"
    a: "Nei. Et depositum på en ordre registreres som holdt depositum, ikke som inntekt."
  - q: "Kan jeg importere flere Booqable-filer samtidig?"
    a: "Ja. Last opp ordrer, kunder og lager samlet, så kobler RoveHQ dem sammen."
---
Eksportene fra Booqable er CSV-filer med én kolonne per felt på siden, og du kan legge til eller fjerne kolonner før du eksporterer. RoveHQ kjenner igjen ordre-, kunde- og lagerfilene fra Booqable på overskriftene og leser dem uten å gjette.

## Slik overføres statusene

- **Reserved**-ordrer blir kommende bookinger.
- **Started**-ordrer (hentet) blir utleier som er ute nå.
- **Stopped**-ordrer (levert tilbake) og **archived**-ordrer blir tidligere utleier.
- **Draft**- og **cancelled**-ordrer vises, men tas bare med hvis du huker dem av.

Identifikatoren på en lagerenhet (ofte registreringsnummeret eller et flåtenummer) blir kjøretøyets registreringsnummer. Ordrer kobles til kunder etter navn, og til kjøretøy når identifikatoren er med i eksporten.

Fortsatt usikker? Les [vår sammenligning av Booqable og RoveHQ](/guides/booqable-vs-rovehq) eller listen vår over [Booqable-alternativer for kjøretøyutleie](/guides/booqable-alternatives).

## Gratis import

Import er gratis i alle abonnementer. RoveHQ kjenner igjen eksporter fra Booqable og leser dem med en gang. Du ser hvert kjøretøy, hver booking og hver betaling før noe lagres, og du kan angre hele importen innen 30 dager. Vil du helst slippe å gjøre det selv? [Send oss filene](/contact), så legger vi dem inn for deg.
