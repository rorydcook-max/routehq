---
title: "Passa da HQ Rental Software a RoveHQ"
description: "Esporta prenotazioni, veicoli e clienti da HQ Rental Software in Excel e portali in RoveHQ. Li importiamo gratis."
updated: 2026-11-03
exports:
  - "Qualsiasi tabella (prenotazioni, veicoli, clienti) in Excel, con le colonne che scegli"
  - "Report in Excel o PDF"
  - "Un'API per sviluppatori"
steps:
  - "In HQ Rental Software, apri Car Rental, poi Reservations, filtra se serve e aggiungi le colonne che vuoi."
  - "Clicca sul menu in alto a destra della tabella, poi su Actions e infine su Export."
  - "Fai lo stesso per Vehicles e Customers."
  - "In RoveHQ, apri Flotta, poi Importa, scegli HQ Rental Software e carica i file tutti insieme."
faq:
  - q: "Mi serve l'API di HQ?"
    a: "No. Gli export in Excel bastano. L'API c'è se uno sviluppatore la preferisce."
---
La knowledge base di HQ dice che puoi esportare in Excel ogni tabella e ogni report del sistema. RoveHQ riconosce gli export di prenotazioni e veicoli di HQ dalle intestazioni (date e luoghi di ritiro e riconsegna, categoria del veicolo, targa, contachilometri).

## Come vengono riportati gli stati

- Le prenotazioni **Open** e **Pending** diventano prenotazioni in arrivo.
- Le prenotazioni **Rental** diventano noleggi in corso.
- Le prenotazioni **Completed** diventano noleggi passati.
- **Quote**, **Cancelled** e **No Show** compaiono nell'elenco, ma non vengono importati se non li selezioni.

Il totale pagato e la cauzione arrivano separati, quindi una cauzione che trattieni non viene mai contata come incasso.

Stai ancora decidendo? Leggi il nostro [confronto HQ Rental Software vs RoveHQ](/guides/hq-rental-software-vs-rovehq).

## Importazione gratuita

L'importazione è gratuita in ogni piano. RoveHQ riconosce gli export di HQ Rental Software e li legge subito. Vedi ogni veicolo, prenotazione e pagamento prima che venga salvato qualcosa, e puoi annullare l'intera importazione entro 30 giorni. Se preferisci non farlo tu, [mandaci i file](/contact) e li importiamo noi per te.
