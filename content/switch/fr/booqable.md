---
title: "Passer de Booqable à RoveHQ"
description: "Exportez vos commandes, clients et inventaire Booqable en CSV et importez-les dans RoveHQ en quelques minutes. Nous l’importons gratuitement."
updated: 2026-11-03
exports:
  - "Orders (réservations) en CSV, depuis la liste Orders"
  - "Clients en CSV"
  - "Inventaire en CSV, une ligne par article quand les produits sont suivis individuellement"
  - "Rapports (performance des produits, clients) en CSV"
steps:
  - "Dans Booqable, ouvrez Orders, descendez en bas de la liste et cliquez sur Export."
  - "Faites de même dans Customers et dans Inventory."
  - "Dans RoveHQ, ouvrez Flotte, puis Importer, choisissez Booqable et importez les fichiers CSV ensemble."
  - "Vérifiez ce qui a été trouvé, puis importez-le."
faq:
  - q: "RoveHQ reprend-il les cautions Booqable comme des revenus ?"
    a: "Non. Une caution sur une commande est enregistrée comme caution détenue, pas comme revenu."
  - q: "Puis-je importer plusieurs fichiers Booqable à la fois ?"
    a: "Oui. Importez commandes, clients et inventaire ensemble et RoveHQ les relie."
---
Les exports Booqable sont des fichiers CSV avec une colonne par champ de la page, et vous pouvez ajouter ou retirer des colonnes avant l’export. RoveHQ reconnaît les fichiers de commandes, de clients et d’inventaire Booqable à leurs en-têtes et les lit sans deviner.

## Comment les statuts sont repris

- Les commandes **Reserved** deviennent des réservations à venir.
- Les commandes **Started** (véhicule récupéré) deviennent des locations en cours.
- Les commandes **Stopped** (véhicule rendu) et **archived** deviennent des locations passées.
- Les commandes **Draft** et **cancelled** sont listées mais laissées de côté, sauf si vous les cochez.

L’identifiant d’un article (souvent la plaque ou un numéro de flotte) devient la plaque du véhicule. Les commandes sont reliées aux clients par leur nom, et aux véhicules quand l’identifiant figure dans l’export.

Vous hésitez encore ? Lisez notre [comparatif Booqable vs RoveHQ](/guides/booqable-vs-rovehq) ou notre liste d’[alternatives à Booqable pour la location de véhicules](/guides/booqable-alternatives).

## Import gratuit

L’import est gratuit dans toutes les formules. RoveHQ reconnaît les exports Booqable et les lit immédiatement. Vous voyez chaque véhicule, réservation et paiement avant tout enregistrement, et vous pouvez annuler tout l’import pendant 30 jours. Si vous préférez ne pas le faire vous-même, [envoyez-nous les fichiers](/contact) et nous les importerons pour vous.
