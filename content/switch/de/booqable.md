---
title: "Von Booqable zu RoveHQ wechseln"
description: "Exportieren Sie Ihre Aufträge, Kunden und Ihr Inventar aus Booqable als CSV und übernehmen Sie alles in wenigen Minuten in RoveHQ. Wir importieren es kostenlos."
updated: 2026-11-03
exports:
  - "Orders (Buchungen) als CSV, aus der Orders-Liste"
  - "Kunden als CSV"
  - "Inventar als CSV, eine Zeile pro Artikel, wenn Produkte einzeln erfasst werden"
  - "Berichte (Produktleistung, Kunden) als CSV"
steps:
  - "Öffnen Sie in Booqable Orders, scrollen Sie ans Ende der Liste und klicken Sie auf Export."
  - "Machen Sie dasselbe in Customers und in Inventory."
  - "Öffnen Sie in RoveHQ Flotte, dann Importieren, wählen Sie Booqable und laden Sie die CSV-Dateien zusammen hoch."
  - "Prüfen Sie, was gefunden wurde, und übernehmen Sie es dann."
faq:
  - q: "Übernimmt RoveHQ die Kautionen aus Booqable als Einnahmen?"
    a: "Nein. Eine Kaution auf einem Auftrag wird als gehaltene Kaution erfasst, nicht als Einnahme."
  - q: "Kann ich mehrere Booqable-Dateien auf einmal importieren?"
    a: "Ja. Laden Sie Aufträge, Kunden und Inventar zusammen hoch, und RoveHQ verknüpft sie."
---
Die Exporte aus Booqable sind CSV-Dateien mit einer Spalte für jedes Feld auf der Seite, und Sie können vor dem Export Spalten hinzufügen oder entfernen. RoveHQ erkennt die Auftrags-, Kunden- und Inventardateien von Booqable an ihren Überschriften und liest sie, ohne zu raten.

## So werden die Status übernommen

- Aufträge mit **Reserved** werden zu anstehenden Buchungen.
- Aufträge mit **Started** (abgeholt) werden zu laufenden Vermietungen.
- Aufträge mit **Stopped** (zurückgegeben) und **archived** werden zu früheren Vermietungen.
- Aufträge mit **Draft** und **cancelled** werden aufgelistet, aber nur übernommen, wenn Sie sie anhaken.

Die Kennung eines Artikels (oft das Kennzeichen oder eine Flottennummer) wird zum Kennzeichen des Fahrzeugs. Aufträge werden über den Namen mit Kunden verknüpft und mit Fahrzeugen, wenn die Kennung im Export steht.

Noch unentschlossen? Lesen Sie unseren [Vergleich Booqable vs. RoveHQ](/guides/booqable-vs-rovehq) oder unsere Liste der [Booqable-Alternativen für die Fahrzeugvermietung](/guides/booqable-alternatives).

## Kostenloser Import

Der Import ist in jedem Tarif kostenlos. RoveHQ erkennt Exporte aus Booqable und liest sie sofort ein. Sie sehen jedes Fahrzeug, jede Buchung und jede Zahlung, bevor etwas gespeichert wird, und können den gesamten Import innerhalb von 30 Tagen zurücknehmen. Wenn Sie das nicht selbst machen möchten, [schicken Sie uns die Dateien](/contact) und wir übernehmen sie für Sie.
