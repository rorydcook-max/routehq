---
title: "Von HQ Rental Software zu RoveHQ wechseln"
description: "Exportieren Sie Ihre Reservierungen, Fahrzeuge und Kunden aus HQ Rental Software nach Excel und übernehmen Sie sie in RoveHQ. Wir importieren es kostenlos."
updated: 2026-11-03
exports:
  - "Jede Tabelle (Reservierungen, Fahrzeuge, Kunden) nach Excel, mit den Spalten Ihrer Wahl"
  - "Berichte nach Excel oder PDF"
  - "Eine API für Entwickler"
steps:
  - "Öffnen Sie in HQ Rental Software Car Rental, dann Reservations, filtern Sie bei Bedarf und fügen Sie die gewünschten Spalten hinzu."
  - "Klicken Sie auf das Menü oben rechts in der Tabelle, dann auf Actions und dann auf Export."
  - "Machen Sie dasselbe für Vehicles und Customers."
  - "Öffnen Sie in RoveHQ Flotte, dann Importieren, wählen Sie HQ Rental Software und laden Sie die Dateien zusammen hoch."
faq:
  - q: "Brauche ich die API von HQ?"
    a: "Nein. Die Excel-Exporte reichen aus. Die API ist da, falls ein Entwickler sie bevorzugt."
---
Laut der Wissensdatenbank von HQ lässt sich jede Tabelle und jeder Bericht im System nach Excel exportieren. RoveHQ erkennt die Reservierungs- und Fahrzeugexporte von HQ an ihren Überschriften (Abhol- und Rückgabedatum und -ort, Fahrzeugklasse, Kennzeichen, Kilometerstand).

## So werden die Status übernommen

- Reservierungen mit **Open** und **Pending** werden zu anstehenden Buchungen.
- Reservierungen mit **Rental** werden zu laufenden Vermietungen.
- Reservierungen mit **Completed** werden zu früheren Vermietungen.
- **Quote**, **Cancelled** und **No Show** werden aufgelistet, aber nur übernommen, wenn Sie sie anhaken.

Bezahlter Gesamtbetrag und Kaution werden getrennt übernommen, sodass eine gehaltene Kaution nie als Einnahme zählt.

Noch unentschlossen? Lesen Sie unseren [Vergleich HQ Rental Software vs. RoveHQ](/guides/hq-rental-software-vs-rovehq).

## Kostenloser Import

Der Import ist in jedem Tarif kostenlos. RoveHQ erkennt Exporte aus HQ Rental Software und liest sie sofort ein. Sie sehen jedes Fahrzeug, jede Buchung und jede Zahlung, bevor etwas gespeichert wird, und können den gesamten Import innerhalb von 30 Tagen zurücknehmen. Wenn Sie das nicht selbst machen möchten, [schicken Sie uns die Dateien](/contact) und wir übernehmen sie für Sie.
