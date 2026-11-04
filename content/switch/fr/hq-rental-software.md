---
title: "Passer de HQ Rental Software à RoveHQ"
description: "Exportez vos réservations, véhicules et clients HQ Rental Software vers Excel et importez-les dans RoveHQ. Nous l’importons gratuitement."
updated: 2026-11-03
exports:
  - "N’importe quel tableau (réservations, véhicules, clients) vers Excel, avec les colonnes de votre choix"
  - "Rapports vers Excel ou PDF"
  - "Une API pour les développeurs"
steps:
  - "Dans HQ Rental Software, ouvrez Car Rental, puis Reservations, filtrez si besoin et ajoutez les colonnes voulues."
  - "Cliquez sur le menu en haut à droite du tableau, puis Actions, puis Export."
  - "Faites de même pour Vehicles et Customers."
  - "Dans RoveHQ, ouvrez Flotte, puis Importer, choisissez HQ Rental Software et importez les fichiers ensemble."
faq:
  - q: "Ai-je besoin de l’API de HQ ?"
    a: "Non. Les exports Excel suffisent. L’API est là si un développeur la préfère."
---
Selon la base de connaissances de HQ, chaque tableau et chaque rapport du système peut être exporté vers Excel. RoveHQ reconnaît les exports de réservations et de véhicules HQ à leurs en-têtes (dates et lieux de prise en charge et de retour, catégorie de véhicule, plaque, compteur kilométrique).

## Comment les statuts sont repris

- Les réservations **Open** et **Pending** deviennent des réservations à venir.
- Les réservations **Rental** deviennent des locations en cours.
- Les réservations **Completed** deviennent des locations passées.
- **Quote**, **Cancelled** et **No Show** sont listées mais laissées de côté, sauf si vous les cochez.

Le total payé et la caution sont repris séparément : une caution que vous détenez n’est jamais comptée comme revenu.

Vous hésitez encore ? Lisez notre [comparatif HQ Rental Software vs RoveHQ](/guides/hq-rental-software-vs-rovehq).

## Import gratuit

L’import est gratuit dans toutes les formules. RoveHQ reconnaît les exports HQ Rental Software et les lit immédiatement. Vous voyez chaque véhicule, réservation et paiement avant tout enregistrement, et vous pouvez annuler tout l’import pendant 30 jours. Si vous préférez ne pas le faire vous-même, [envoyez-nous les fichiers](/contact) et nous les importerons pour vous.
