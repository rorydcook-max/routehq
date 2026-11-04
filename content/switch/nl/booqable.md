---
title: "Overstappen van Booqable naar RoveHQ"
description: "Exporteer je Booqable-orders, klanten en voorraad als CSV en zet ze in een paar minuten over naar RoveHQ. We importeren het gratis."
updated: 2026-11-03
exports:
  - "Orders (boekingen) als CSV, vanuit de Orders-lijst"
  - "Klanten als CSV"
  - "Voorraad als CSV, één rij per item als producten per stuk worden bijgehouden"
  - "Rapporten (productprestaties, klanten) als CSV"
steps:
  - "Open in Booqable Orders, scrol naar onderen in de lijst en klik op Export."
  - "Doe hetzelfde in Customers en in Inventory."
  - "Open in RoveHQ Wagenpark, dan Importeren, kies Booqable en upload de CSV-bestanden samen."
  - "Controleer wat er is gevonden en neem het dan mee."
faq:
  - q: "Neemt RoveHQ de borg uit Booqable over als inkomsten?"
    a: "Nee. Een borg op een order wordt vastgelegd als ontvangen borg, niet als inkomsten."
  - q: "Kan ik meerdere Booqable-bestanden tegelijk importeren?"
    a: "Ja. Upload orders, klanten en voorraad samen en RoveHQ koppelt ze aan elkaar."
---
De exports van Booqable zijn CSV-bestanden met een kolom voor elk veld op de pagina, en je kunt vóór het exporteren kolommen toevoegen of weghalen. RoveHQ herkent de order-, klant- en voorraadbestanden van Booqable aan hun kolomkoppen en leest ze zonder te gokken.

## Hoe statussen worden overgenomen

- Orders met **Reserved** worden komende boekingen.
- Orders met **Started** (opgehaald) worden verhuur die nu loopt.
- Orders met **Stopped** (ingeleverd) en **archived** worden eerdere verhuur.
- Orders met **Draft** en **cancelled** worden getoond maar niet meegenomen, tenzij je ze aanvinkt.

De code van een item (vaak het kenteken of een vlootnummer) wordt het kenteken van het voertuig. Orders worden op naam aan klanten gekoppeld, en aan voertuigen als de code in de export staat.

Twijfel je nog? Lees onze [vergelijking Booqable vs RoveHQ](/guides/booqable-vs-rovehq) of onze lijst met [Booqable-alternatieven voor voertuigverhuur](/guides/booqable-alternatives).

## Gratis import

Importeren is gratis in elk abonnement. RoveHQ herkent exports uit Booqable en leest ze meteen in. Je ziet elk voertuig, elke boeking en elke betaling voordat er iets wordt opgeslagen, en je kunt de hele import binnen 30 dagen terugdraaien. Doe je het liever niet zelf? [Stuur ons de bestanden](/contact) en wij zetten ze voor je over.
