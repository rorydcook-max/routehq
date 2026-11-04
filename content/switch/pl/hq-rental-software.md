---
title: "Przejdź z HQ Rental Software na RoveHQ"
description: "Wyeksportuj rezerwacje, pojazdy i klientów z HQ Rental Software do Excela i przenieś je do RoveHQ. Zaimportujemy to za darmo."
updated: 2026-11-03
exports:
  - "Każda tabela (rezerwacje, pojazdy, klienci) do Excela, z wybranymi kolumnami"
  - "Raporty do Excela lub PDF"
  - "API dla programistów"
steps:
  - "W HQ Rental Software otwórz Car Rental, potem Reservations, w razie potrzeby odfiltruj i dodaj potrzebne kolumny."
  - "Kliknij menu w prawym górnym rogu tabeli, potem Actions, potem Export."
  - "Zrób to samo dla Vehicles i Customers."
  - "W RoveHQ otwórz „Flota”, potem „Importuj”, wybierz HQ Rental Software i prześlij pliki razem."
faq:
  - q: "Czy potrzebuję API od HQ?"
    a: "Nie. Eksporty do Excela wystarczą. API jest dostępne, jeśli programista woli z niego korzystać."
---
Według bazy wiedzy HQ każdą tabelę i każdy raport w systemie można wyeksportować do Excela. RoveHQ rozpoznaje eksporty rezerwacji i pojazdów z HQ po nagłówkach (daty i miejsca odbioru i zwrotu, klasa pojazdu, numer rejestracyjny, przebieg).

## Jak przenoszone są statusy

- Rezerwacje **Open** i **Pending** stają się nadchodzącymi rezerwacjami.
- Rezerwacje **Rental** stają się trwającymi wynajmami.
- Rezerwacje **Completed** stają się zakończonymi wynajmami.
- **Quote**, **Cancelled** i **No Show** są widoczne na liście, ale pomijane, chyba że je zaznaczysz.

Zapłacona kwota i kaucja są przenoszone osobno, więc przechowywana kaucja nigdy nie jest liczona jako przychód.

Wciąż się zastanawiasz? Przeczytaj nasze [porównanie HQ Rental Software vs RoveHQ](/guides/hq-rental-software-vs-rovehq).

## Bezpłatny import

Import jest bezpłatny w każdym planie. RoveHQ rozpoznaje eksporty z HQ Rental Software i od razu je odczytuje. Widzisz każdy pojazd, każdą rezerwację i każdą płatność, zanim cokolwiek zostanie zapisane, i przez 30 dni możesz cofnąć cały import. Jeśli wolisz nie robić tego sam, [wyślij nam pliki](/contact), a przeniesiemy je za Ciebie.
