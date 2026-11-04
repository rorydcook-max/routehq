---
title: "Passer de Rental Car Manager à RoveHQ"
description: "Lancez le Bookings Export de Rental Car Manager avec les paiements et importez vos réservations dans RoveHQ. Nous l’importons gratuitement."
updated: 2026-11-03
exports:
  - "Bookings Export : tous les champs des réservations au statut Reservation, Hired ou Returned"
  - "Paiements ajoutés à chaque réservation (date, type, référence, montant, frais du prestataire de paiement)"
  - "Excel, CSV ou PDF (Excel ou CSV recommandé)"
steps:
  - "Dans Rental Car Manager, allez dans Reports, puis Other Reports, puis Bookings Export."
  - "Choisissez All Dates, cochez Include Payments et lancez-le."
  - "Exportez vers Excel ou CSV."
  - "Dans RoveHQ, ouvrez Flotte, puis Importer, choisissez Rental Car Manager et importez le fichier."
---
Rental Car Manager présente le Bookings Export comme une extraction de données à analyser dans un tableur, ce qui en fait un bon moyen de déménager. RoveHQ le reconnaît à ses en-têtes.

## Comment les statuts sont repris

- **Reservation** devient une réservation à venir.
- **Hired** devient une location en cours.
- **Returned** devient une location passée.

Les colonnes masquées dans le rapport sont aussi absentes de l’export : affichez donc tout avant d’exporter.

Vous hésitez encore ? Lisez notre [comparatif Rental Car Manager vs RoveHQ](/guides/rental-car-manager-vs-rovehq).

## Import gratuit

L’import est gratuit dans toutes les formules. RoveHQ reconnaît les exports Rental Car Manager et les lit immédiatement. Vous voyez chaque véhicule, réservation et paiement avant tout enregistrement, et vous pouvez annuler tout l’import pendant 30 jours. Si vous préférez ne pas le faire vous-même, [envoyez-nous les fichiers](/contact) et nous les importerons pour vous.
