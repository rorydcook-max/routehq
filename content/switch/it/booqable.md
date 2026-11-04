---
title: "Passa da Booqable a RoveHQ"
description: "Esporta ordini, clienti e inventario da Booqable in CSV e portali in RoveHQ in pochi minuti. Li importiamo gratis."
updated: 2026-11-03
exports:
  - "Orders (prenotazioni) in CSV, dall'elenco Orders"
  - "Customers (clienti) in CSV"
  - "Inventory (inventario) in CSV, una riga per articolo quando i prodotti sono tracciati singolarmente"
  - "Reports (rendimento prodotti, clienti) in CSV"
steps:
  - "In Booqable, apri Orders, scorri fino in fondo all'elenco e clicca su Export."
  - "Fai lo stesso in Customers e in Inventory."
  - "In RoveHQ, apri Flotta, poi Importa, scegli Booqable e carica i file CSV tutti insieme."
  - "Controlla cosa è stato trovato, poi importalo."
faq:
  - q: "RoveHQ copia le cauzioni di Booqable come incassi?"
    a: "No. La cauzione di un ordine viene registrata come cauzione trattenuta, non come incasso."
  - q: "Posso importare più file di Booqable insieme?"
    a: "Sì. Carica ordini, clienti e inventario insieme e RoveHQ li collega tra loro."
---
Gli export di Booqable sono file CSV con una colonna per ogni campo della pagina, e prima di esportare puoi aggiungere o togliere colonne. RoveHQ riconosce i file di ordini, clienti e inventario di Booqable dalle intestazioni e li legge senza tirare a indovinare.

## Come vengono riportati gli stati

- Gli ordini **Reserved** (prenotati) diventano prenotazioni in arrivo.
- Gli ordini **Started** (ritirati) diventano noleggi in corso.
- Gli ordini **Stopped** (restituiti) e **archived** (archiviati) diventano noleggi passati.
- Gli ordini **Draft** (bozza) e **cancelled** (annullati) compaiono nell'elenco, ma non vengono importati se non li selezioni.

L'identificativo di un articolo (spesso la targa o un numero di flotta) diventa la targa del veicolo. Gli ordini vengono collegati ai clienti in base al nome, e ai veicoli quando l'identificativo è nell'export.

Stai ancora decidendo? Leggi il nostro [confronto Booqable vs RoveHQ](/guides/booqable-vs-rovehq) o la nostra lista di [alternative a Booqable per il noleggio di veicoli](/guides/booqable-alternatives).

## Importazione gratuita

L'importazione è gratuita in ogni piano. RoveHQ riconosce gli export di Booqable e li legge subito. Vedi ogni veicolo, prenotazione e pagamento prima che venga salvato qualcosa, e puoi annullare l'intera importazione entro 30 giorni. Se preferisci non farlo tu, [mandaci i file](/contact) e li importiamo noi per te.
