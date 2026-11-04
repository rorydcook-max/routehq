---
title: "Prijeđite s programa HQ Rental Software na RoveHQ"
description: "Izvezite rezervacije, vozila i klijente iz programa HQ Rental Software u Excel i prenesite ih u RoveHQ. Besplatno ih uvozimo."
updated: 2026-11-03
exports:
  - "Bilo koja tablica (rezervacije, vozila, klijenti) u Excel, sa stupcima koje odaberete"
  - "Izvješća u Excel ili PDF"
  - "API za programere"
steps:
  - "U programu HQ Rental Software otvorite Car Rental, zatim Reservations, po potrebi filtrirajte i dodajte stupce koje želite."
  - "Kliknite izbornik u gornjem desnom kutu tablice, zatim Actions, pa Export."
  - "Isto učinite za Vehicles i Customers."
  - "U RoveHQ-u otvorite Vozni park, zatim Uvoz, odaberite HQ Rental Software i učitajte sve datoteke zajedno."
faq:
  - q: "Trebam li HQ-ov API?"
    a: "Ne. Izvozi u Excel su dovoljni. API je tu ako ga programer više voli."
---
HQ-ova baza znanja navodi da u Excel možete izvesti svaku tablicu i izvješće u sustavu. RoveHQ prepoznaje HQ-ove izvoze rezervacija i vozila po zaglavljima (datumi i mjesta preuzimanja i povrata, klasa vozila, registarska oznaka, stanje brojila).

## Kako se prenose statusi

- Rezervacije **Open** i **Pending** postaju nadolazeće rezervacije.
- Rezervacije **Rental** postaju najmovi koji su trenutačno u tijeku.
- Rezervacije **Completed** postaju završeni najmovi.
- **Quote**, **Cancelled** i **No Show** prikazuju se na popisu, ali se ne uvoze ako ih ne označite.

Ukupno plaćeni iznos i sigurnosni polog prenose se odvojeno, pa se polog koji držite nikad ne računa kao prihod.

Još se odlučujete? Pročitajte našu [usporedbu HQ Rental Software vs RoveHQ](/guides/hq-rental-software-vs-rovehq).

## Besplatan uvoz

Uvoz je besplatan u svakom paketu. RoveHQ prepoznaje izvoze iz programa HQ Rental Software i odmah ih čita. Prije nego što se išta spremi, vidite svako vozilo, rezervaciju i uplatu, a cijeli uvoz možete poništiti u roku od 30 dana. Ako to ne želite raditi sami, [pošaljite nam datoteke](/contact) i mi ćemo ih uvesti umjesto Vas.
