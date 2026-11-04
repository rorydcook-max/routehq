---
title: "Overstappen van HQ Rental Software naar RoveHQ"
description: "Exporteer je reserveringen, voertuigen en klanten uit HQ Rental Software naar Excel en zet ze over naar RoveHQ. We importeren het gratis."
updated: 2026-11-03
exports:
  - "Elke tabel (reserveringen, voertuigen, klanten) naar Excel, met de kolommen die jij kiest"
  - "Rapporten naar Excel of PDF"
  - "Een API voor ontwikkelaars"
steps:
  - "Open in HQ Rental Software Car Rental, dan Reservations, filter als dat nodig is en voeg de kolommen toe die je wilt."
  - "Klik op het menu rechtsboven in de tabel, dan op Actions en dan op Export."
  - "Doe hetzelfde voor Vehicles en Customers."
  - "Open in RoveHQ Wagenpark, dan Importeren, kies HQ Rental Software en upload de bestanden samen."
faq:
  - q: "Heb ik de API van HQ nodig?"
    a: "Nee. De Excel-exports zijn genoeg. De API is er als een ontwikkelaar die liever gebruikt."
---
Volgens de kennisbank van HQ kun je elke tabel en elk rapport in het systeem naar Excel exporteren. RoveHQ herkent de reserverings- en voertuigexports van HQ aan de kolomkoppen (ophaal- en inleverdatum en -locatie, voertuigklasse, kenteken, kilometerstand).

## Hoe statussen worden overgenomen

- Reserveringen met **Open** en **Pending** worden komende boekingen.
- Reserveringen met **Rental** worden verhuur die nu loopt.
- Reserveringen met **Completed** worden eerdere verhuur.
- **Quote**, **Cancelled** en **No Show** worden getoond maar niet meegenomen, tenzij je ze aanvinkt.

Het betaalde totaal en de borg komen apart binnen, dus een borg die je vasthoudt telt nooit als inkomsten.

Twijfel je nog? Lees onze [vergelijking HQ Rental Software vs RoveHQ](/guides/hq-rental-software-vs-rovehq).

## Gratis import

Importeren is gratis in elk abonnement. RoveHQ herkent exports uit HQ Rental Software en leest ze meteen in. Je ziet elk voertuig, elke boeking en elke betaling voordat er iets wordt opgeslagen, en je kunt de hele import binnen 30 dagen terugdraaien. Doe je het liever niet zelf? [Stuur ons de bestanden](/contact) en wij zetten ze voor je over.
