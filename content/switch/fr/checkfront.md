---
title: "Passer de Checkfront à RoveHQ"
description: "Exportez vos réservations Checkfront depuis le Booking Index en CSV ou Excel et importez-les dans RoveHQ. Nous l’importons gratuitement."
updated: 2026-11-03
exports:
  - "Réservations depuis le Booking Index en CSV, Excel, PDF ou XML"
  - "Toutes les colonnes ou seulement celles affichées"
  - "Dates ISO (2026-11-03) si vous cochez l’option"
steps:
  - "Dans Checkfront, ouvrez le Booking Index et filtrez-le sur les réservations à transférer."
  - "Cliquez sur Export, choisissez CSV ou Excel, All columns, et cochez Use ISO dates."
  - "Dans RoveHQ, ouvrez Flotte, puis Importer, choisissez Checkfront et importez le fichier."
  - "Vérifiez ce qui a été trouvé, puis importez-le."
faq:
  - q: "Checkfront est conçu pour les visites et activités. Les locations fonctionneront-elles ?"
    a: "Oui. Chaque réservation devient une location avec ses dates, son client et son prix. Les articles sans plaque attendent que vous choisissiez le véhicule."
---
RoveHQ reconnaît l’export de réservations Checkfront à ses en-têtes (réservation, statut, nom et e-mail du client, dates de début et de fin, total et montant payé). Les réservations annulées, invalidées et en attente sont listées mais laissées de côté, sauf si vous les cochez.

Cocher **Use ISO dates** dans Checkfront évite toute erreur de lecture des dates. Sans cette option, RoveHQ déduit l’ordre des dates à partir du fichier, et vous demande quand il ne peut pas trancher.

## Import gratuit

L’import est gratuit dans toutes les formules. RoveHQ reconnaît les exports Checkfront et les lit immédiatement. Vous voyez chaque véhicule, réservation et paiement avant tout enregistrement, et vous pouvez annuler tout l’import pendant 30 jours. Si vous préférez ne pas le faire vous-même, [envoyez-nous les fichiers](/contact) et nous les importerons pour vous.
