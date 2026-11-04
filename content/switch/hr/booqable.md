---
title: "Prijeđite s programa Booqable na RoveHQ"
description: "Izvezite narudžbe, klijente i inventar iz programa Booqable kao CSV i prenesite ih u RoveHQ za nekoliko minuta. Besplatno ih uvozimo."
updated: 2026-11-03
exports:
  - "Orders (rezervacije) kao CSV, s popisa Orders"
  - "Customers (klijenti) kao CSV"
  - "Inventory (inventar) kao CSV, jedan redak po artiklu kad se proizvodi prate pojedinačno"
  - "Reports (učinak proizvoda, klijenti) kao CSV"
steps:
  - "U programu Booqable otvorite Orders, pomaknite se do dna popisa i kliknite Export."
  - "Isto učinite u Customers i Inventory."
  - "U RoveHQ-u otvorite Vozni park, zatim Uvoz, odaberite Booqable i učitajte sve CSV datoteke zajedno."
  - "Provjerite što je pronađeno, a zatim to uvezite."
faq:
  - q: "Kopira li RoveHQ pologe iz programa Booqable kao prihod?"
    a: "Ne. Sigurnosni polog na narudžbi bilježi se kao zadržani polog, a ne kao prihod."
  - q: "Mogu li uvesti više datoteka iz programa Booqable odjednom?"
    a: "Da. Učitajte narudžbe, klijente i inventar zajedno i RoveHQ će ih povezati."
---
Izvozi iz programa Booqable su CSV datoteke sa stupcem za svako polje na stranici, a prije izvoza možete dodati ili ukloniti stupce. RoveHQ prepoznaje Booqableove datoteke narudžbi, klijenata i inventara po zaglavljima i čita ih bez nagađanja.

## Kako se prenose statusi

- Narudžbe **Reserved** (rezervirano) postaju nadolazeće rezervacije.
- Narudžbe **Started** (preuzeto) postaju najmovi koji su trenutačno u tijeku.
- Narudžbe **Stopped** (vraćeno) i **archived** (arhivirano) postaju završeni najmovi.
- Narudžbe **Draft** (skica) i **cancelled** (otkazano) prikazuju se na popisu, ali se ne uvoze ako ih ne označite.

Oznaka artikla (često registarska oznaka ili broj u voznom parku) postaje registarska oznaka vozila. Narudžbe se s klijentima povezuju po imenu, a s vozilima kad je oznaka u izvozu.

Još se odlučujete? Pročitajte našu [usporedbu Booqable vs RoveHQ](/guides/booqable-vs-rovehq) ili naš popis [alternativa za Booqable za najam vozila](/guides/booqable-alternatives).

## Besplatan uvoz

Uvoz je besplatan u svakom paketu. RoveHQ prepoznaje izvoze iz programa Booqable i odmah ih čita. Prije nego što se išta spremi, vidite svako vozilo, rezervaciju i uplatu, a cijeli uvoz možete poništiti u roku od 30 dana. Ako to ne želite raditi sami, [pošaljite nam datoteke](/contact) i mi ćemo ih uvesti umjesto Vas.
