---
title: "Przejdź z Booqable na RoveHQ"
description: "Wyeksportuj zamówienia, klientów i magazyn z Booqable jako CSV i przenieś je do RoveHQ w kilka minut. Zaimportujemy to za darmo."
updated: 2026-11-03
exports:
  - "Orders (rezerwacje) jako CSV, z listy Orders"
  - "Klienci jako CSV"
  - "Magazyn jako CSV, jeden wiersz na egzemplarz, gdy produkty są śledzone pojedynczo"
  - "Raporty (wyniki produktów, klienci) jako CSV"
steps:
  - "W Booqable otwórz Orders, przewiń na dół listy i kliknij Export."
  - "Zrób to samo w Customers i w Inventory."
  - "W RoveHQ otwórz „Flota”, potem „Importuj”, wybierz Booqable i prześlij razem pliki CSV."
  - "Sprawdź, co zostało znalezione, a potem to dodaj."
faq:
  - q: "Czy RoveHQ przenosi kaucje z Booqable jako przychód?"
    a: "Nie. Kaucja przy zamówieniu jest zapisywana jako przechowywana kaucja, a nie jako przychód."
  - q: "Czy mogę zaimportować kilka plików z Booqable naraz?"
    a: "Tak. Prześlij razem zamówienia, klientów i magazyn, a RoveHQ je połączy."
---
Eksporty z Booqable to pliki CSV z kolumną dla każdego pola na stronie, a przed eksportem możesz dodać lub usunąć kolumny. RoveHQ rozpoznaje pliki zamówień, klientów i magazynu z Booqable po nagłówkach i odczytuje je bez zgadywania.

## Jak przenoszone są statusy

- Zamówienia **Reserved** stają się nadchodzącymi rezerwacjami.
- Zamówienia **Started** (odebrane) stają się trwającymi wynajmami.
- Zamówienia **Stopped** (zwrócone) i **archived** stają się zakończonymi wynajmami.
- Zamówienia **Draft** i **cancelled** są widoczne na liście, ale pomijane, chyba że je zaznaczysz.

Identyfikator egzemplarza (często numer rejestracyjny lub numer floty) staje się numerem rejestracyjnym pojazdu. Zamówienia łączą się z klientami po nazwisku, a z pojazdami wtedy, gdy identyfikator jest w eksporcie.

Wciąż się zastanawiasz? Przeczytaj nasze [porównanie Booqable vs RoveHQ](/guides/booqable-vs-rovehq) albo listę [alternatyw dla Booqable do wynajmu pojazdów](/guides/booqable-alternatives).

## Bezpłatny import

Import jest bezpłatny w każdym planie. RoveHQ rozpoznaje eksporty z Booqable i od razu je odczytuje. Widzisz każdy pojazd, każdą rezerwację i każdą płatność, zanim cokolwiek zostanie zapisane, i przez 30 dni możesz cofnąć cały import. Jeśli wolisz nie robić tego sam, [wyślij nam pliki](/contact), a przeniesiemy je za Ciebie.
