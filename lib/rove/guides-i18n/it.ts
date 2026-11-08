import { h, p, ul, type GuideTranslations } from "./blocks";

const it: GuideTranslations = {
  "do-i-need-an-international-driving-permit": {
    title: "Serve il permesso di guida internazionale? Paese per paese",
    description: "Quali paesi chiedono ai visitatori il permesso di guida internazionale, quale versione accettano e cos'altro portare nelle mete di noleggio più popolari.",
    standfirst: "Il permesso internazionale (PI) è una traduzione della tua patente. Alcuni paesi lo richiedono, altri no. Ecco come funziona e cosa chiedono le mete più popolari.",
    body: [
      h("Cos'è un PI e cosa non è"),
      p("Il permesso di guida internazionale traduce la tua patente in un formato standard riconosciuto dalle convenzioni internazionali sulla circolazione stradale. Vale solo insieme alla tua patente completa di origine e solo per le categorie di veicoli che questa copre. Si ottiene prima di partire, nel paese che ha rilasciato la patente."),
      p("Esistono tre versioni, che prendono il nome dalle convenzioni da cui derivano: 1926, 1949 e 1968. Ogni paese accetta la versione (o le versioni) delle convenzioni a cui aderisce, quindi quella giusta dipende da dove vai."),
      h("Cosa chiedono le mete più popolari"),
      ul([
        "Unione Europea: una patente di un paese UE o SEE è valida in tutta l'UE. Chi arriva da altrove deve verificare paese per paese; il governo britannico indica Portogallo, Grecia, Italia e Croazia sotto la convenzione del 1968, Spagna e Malta sotto quella del 1949.",
        "Giappone: è accettato solo il PI cartaceo della Convenzione di Ginevra del 1949. Le patenti di Svizzera, Germania, Francia, Belgio, Monaco e Taiwan si usano invece con una traduzione giapponese autorizzata. Puoi guidare fino a un anno dall'arrivo.",
        "Stati Uniti: in genere i visitatori possono guidare con la patente di origine, ma le regole cambiano da stato a stato e può servire un PI (la versione del 1949). Controlla ogni stato in cui guiderai e le regole del noleggiatore.",
        "Nuova Zelanda: puoi guidare con una patente estera valida per un periodo limitato; se non è in inglese, porta con te una traduzione inglese approvata.",
        "Costa Rica: una patente di origine valida basta per tutta la durata del soggiorno turistico, di norma fino a 90 giorni.",
        "Emirati Arabi Uniti: i visitatori di oltre 30 paesi possono guidare con la patente di origine con visto turistico; gli altri hanno bisogno di un PI.",
        "Marocco: secondo il governo britannico, i conducenti britannici devono avere il PI del 1968, mentre la versione del 1949 non è più accettata.",
        "Thailandia e Indonesia: i visitatori hanno bisogno di un PI insieme alla patente e, per gli scooter, entrambi devono includere la moto. Leggi le nostre guide su Thailandia e Bali."
      ]),
      h("I noleggiatori possono chiedere di più"),
      p("Anche dove la legge non richiede un PI, un noleggiatore può pretenderlo, insieme a un'età minima o ad almeno un anno di patente. Se un noleggiatore su Rove chiede documenti, te lo dirà quando conferma la prenotazione."),
      h("Scooter e moto"),
      p("Una patente auto non copre automaticamente uno scooter. In Grecia, per esempio, serve almeno la categoria A1 (motociclo leggero) per noleggiare un ciclomotore. Guidare senza la patente giusta può anche far sì che l'assicurazione di viaggio non paghi dopo un incidente.")
    ]
  },
  "car-rental-insurance-explained": {
    title: "Assicurazione auto a noleggio: CDW, franchigia e deposito",
    description: "Cosa copre la CDW, cos'è la franchigia, perché viene bloccato un deposito sulla carta e come evitare addebiti a sorpresa quando noleggi all'estero.",
    standfirst: "Le coperture del noleggio sono piene di sigle. Ecco cosa significano CDW, franchigia e deposito, e cosa controllare prima di firmare.",
    body: [
      h("Responsabilità civile"),
      p("L'assicurazione di responsabilità civile copre i danni o le lesioni che causi ad altri. Nell'UE ogni veicolo a noleggio deve averla, di norma inclusa nel prezzo. Negli EAU la copertura verso terzi è inclusa per legge. In Messico è obbligatoria una responsabilità civile di un assicuratore messicano, e le polizze statunitensi o canadesi lì non valgono."),
      h("CDW (limitazione danni) e franchigia"),
      p("La CDW limita quanto paghi se il veicolo a noleggio si danneggia, ma raramente azzera il costo. Quello che resta è la franchigia: il massimo che pagheresti per i danni. Spesso la CDW esclude pneumatici e cristalli, quindi verifica cosa copre la tua."),
      p("I noleggiatori vendono spesso coperture extra che riducono la franchigia (a volte a zero). Possono costare care. Un'assicurazione franchigia indipendente costa spesso meno, ma paghi prima il noleggiatore e poi chiedi il rimborso."),
      h("Deposito"),
      p("Il deposito è di solito un blocco su una carta di credito intestata al conducente. Non puoi spendere quell'importo finché è bloccato, e viene sbloccato quando il veicolo torna senza danni, multe o pedaggi non pagati. Negli EAU, per esempio, dovrebbe essere sbloccato entro 30 giorni. Su Rove ogni veicolo mostra il suo deposito prima della prenotazione."),
      h("Evitare addebiti a sorpresa"),
      ul([
        "Prima di partire, fai il giro del veicolo con il noleggiatore e fotografalo o filmalo da ogni lato, anche all'interno, compreso il livello del carburante. Assicurati che ogni danno sia annotato sul verbale di consegna.",
        "Controlla la politica carburante, eventuali limiti di chilometraggio e il prezzo degli extra come i seggiolini per bambini.",
        "Conserva una copia del contratto e dei verbali di ritiro e riconsegna.",
        "Se una controversia con un noleggiatore di un altro paese UE non si risolve, il Centro Europeo Consumatori del tuo paese può aiutarti gratuitamente."
      ]),
      h("Scooter e quad"),
      p("L'assicurazione venduta con scooter e quad è spesso solo verso terzi, quindi i danni al veicolo li paghi tu. Molte polizze di viaggio escludono i quad, e guidare senza la patente giusta può annullare la copertura.")
    ]
  },
  "renting-a-car-in-europe": {
    title: "Noleggiare un'auto in Europa: patente, pedaggi e ZTL",
    description: "Cosa serve per noleggiare e guidare un'auto in Europa: patente ed età, pedaggi elettronici, ZTL italiane, dotazioni obbligatorie, limiti alcol e assicurazione.",
    standfirst: "In Europa le regole cambiano da paese a paese. Queste sono quelle che sorprendono più spesso i visitatori.",
    body: [
      h("Patente ed età"),
      p("Una patente di un paese UE o SEE è valida in tutta l'UE. Con una patente di altri paesi, controlla ogni paese in cui guiderai; alcuni chiedono il permesso di guida internazionale. L'età minima per guidare un'auto è 18 anni in Portogallo, Spagna, Grecia, Italia e Croazia, ma i noleggiatori fissano spesso un proprio minimo (a Malta è comune 21) e possono chiedere di più sotto i 25 anni."),
      h("Pedaggi e zone urbane"),
      ul([
        "Portogallo: alcune autostrade hanno solo pedaggio elettronico. Chiedi se l'auto ha un transponder per il telepedaggio.",
        "Italia: molti centri storici sono zone a traffico limitato (ZTL) controllate da telecamere. Entrare senza permesso comporta una multa, spesso inviata in seguito tramite il noleggiatore.",
        "Spagna: alcune città hanno zone a basse emissioni, e Barcellona chiede ai veicoli stranieri di registrarsi in anticipo."
      ]),
      h("Cosa deve avere a bordo l'auto"),
      p("In Croazia ogni auto deve avere triangolo, kit di pronto soccorso e giubbotti catarifrangenti. Controlla che ci siano al ritiro. Porta sempre con te patente e documento d'identità quando guidi; in Portogallo è obbligatorio."),
      h("Su strada"),
      ul([
        "Si guida a destra ovunque tranne a Malta, Cipro, in Irlanda e nel Regno Unito.",
        "Il limite alcolico abituale in Portogallo, Spagna e Grecia è dello 0,05% (0,5 g/l), più basso per i neopatentati.",
        "In Spagna usare il telefono alla guida è vietato anche da fermi a bordo strada, e i bambini sotto 1,35 m hanno bisogno del seggiolino."
      ]),
      h("Assicurazione"),
      p("La responsabilità civile è inclusa in ogni noleggio nell'UE. I danni all'auto stessa sono in genere coperti da una CDW con franchigia; leggi la nostra guida su CDW, franchigia e deposito.")
    ]
  },
  "renting-a-scooter-in-greece": {
    title: "Noleggiare uno scooter o un quad in Grecia",
    description: "La patente per noleggiare ciclomotore, scooter o quad in Grecia, regole e multe sul casco, buchi nell'assicurazione e consigli per le isole.",
    standfirst: "Scooter e quad sono ovunque sulle isole greche. Le regole sulla patente sono più severe di quanto molti visitatori si aspettino.",
    body: [
      h("La patente che serve"),
      p("Per noleggiare un ciclomotore o uno scooter in Grecia serve una patente valida con almeno la categoria A1 (motociclo leggero). La sola patente auto non basta, e la categoria P britannica per ciclomotori fino a 50 cc non è valida in Grecia. I fogli rosa non valgono per nessun veicolo."),
      h("Casco"),
      p("Conducenti e passeggeri di ciclomotori e quad devono indossare il casco. Se la polizia ti ferma senza, ti multa e ti ritira la patente, e guidare senza casco può invalidare l'assicurazione."),
      h("Quad: massima attenzione"),
      ul([
        "I quad causano ogni anno lesioni gravi e morti. Fatti spiegare bene come guidarlo prima di partire e ricorda che condividi la strada con veicoli più grandi e veloci.",
        "L'assicurazione venduta con un quad è di solito solo verso terzi: probabilmente il noleggiatore ti addebiterà qualsiasi danno al quad.",
        "Molte polizze di viaggio considerano il quad uno sport estremo e lo escludono. Leggi la tua polizza prima di partire."
      ]),
      h("Su strada"),
      ul([
        "In Grecia si guida a destra.",
        "Il traffico può essere veloce e caotico, e gli automobilisti non sempre si fermano sulle strisce pedonali.",
        "Guidare in stato di ebbrezza è un reato grave, con multe e possibile carcere."
      ]),
      h("Prima di partire"),
      ul([
        "Controlla che il veicolo sia in buone condizioni: freni, pneumatici e luci.",
        "Fotografalo insieme al noleggiatore, compresi i danni già presenti, e concordate deposito e orario di riconsegna."
      ])
    ]
  },
  "renting-a-scooter-in-thailand": {
    title: "Scooter a noleggio in Thailandia: patente, casco, polizza",
    description: "Cosa serve per guidare legalmente uno scooter a noleggio in Thailandia: la patente giusta e il PI, regole e multe sul casco, deposito e assicurazione.",
    standfirst: "Lo scooter è il modo più semplice per muoversi sulla maggior parte delle isole thailandesi. Ecco cosa serve per guidarlo in regola e cosa controllare prima di partire.",
    body: [
      h("La patente che serve"),
      p("Per guidare uno scooter o una moto in Thailandia da visitatore serve una patente valida per le moto, più un permesso di guida internazionale (PI) che riporti la categoria moto. La sola patente auto non copre uno scooter, qualunque cosa ti dica il noleggiatore."),
      p("Il governo thailandese indica i PI rilasciati secondo la Convenzione di Ginevra del 1949, e sono accettate anche le patenti degli altri paesi ASEAN. Il governo britannico consiglia ai conducenti britannici di portare la versione del 1968. Procurati il PI nel tuo paese prima di partire: in Thailandia non puoi ottenerlo."),
      h("Il casco è obbligatorio, per entrambi"),
      p("Conducente e passeggero devono indossare il casco secondo l'articolo 122 del Land Traffic Act. La polizia può multarti fino a 2.000 baht, e dal 1° giugno 2025 i controlli sono stati intensificati in tutto il paese. Chiedi al noleggiatore un casco della tua misura, per te e per chi viaggia con te."),
      h("Assicurazione: cosa copre e cosa no"),
      ul([
        "Ogni veicolo immatricolato deve avere l'assicurazione obbligatoria (Por Ror Bor). Copre lesioni e morte, ma non i danni allo scooter né ai beni altrui.",
        "Chiedi al noleggiatore per cos'altro è assicurato lo scooter e quanto pagheresti se venisse danneggiato o rubato.",
        "Verifica che la tua assicurazione di viaggio copra la guida della moto. Molte polizze pagano solo se hai la patente giusta per il veicolo, quindi senza potresti restare scoperto."
      ]),
      h("Deposito"),
      p("Aspettati di lasciare un deposito, restituito quando riporti lo scooter nelle stesse condizioni. Non lasciare il passaporto come deposito o garanzia: i governi britannico e australiano lo sconsigliano entrambi. Su Rove ogni veicolo mostra il suo deposito prima della prenotazione."),
      h("Prima di partire"),
      ul([
        "Fai il giro dello scooter con il noleggiatore e fotografa graffi e ammaccature, così nessuno potrà contestarli dopo.",
        "Controlla freni, pneumatici, luci e clacson, e che libretto e documenti assicurativi siano con lo scooter.",
        "Concordate carburante, orario di riconsegna e chi chiamare in caso di guasto.",
        "Salva il numero di telefono o la chat del noleggiatore prima di partire."
      ]),
      h("Su strada"),
      ul([
        "In Thailandia si guida a sinistra.",
        "La Thailandia ha uno dei tassi di mortalità stradale più alti al mondo, e i motociclisti sono i più a rischio. Guida con prudenza e fai particolare attenzione con la pioggia.",
        "Festività come il Songkran portano più traffico e più alcol. Non guidare mai dopo aver bevuto."
      ])
    ]
  },
  "international-driving-permit-thailand": {
    title: "Permesso di guida internazionale per la Thailandia",
    description: "Serve il permesso di guida internazionale per guidare auto o scooter in Thailandia? Quale tipo prendere, dove ottenerlo e cosa portare con sé.",
    standfirst: "La maggior parte dei visitatori ha bisogno del permesso di guida internazionale per guidare in Thailandia. Ecco quale, dove ottenerlo e cosa portare.",
    body: [
      h("Cos'è un PI"),
      p("Il permesso di guida internazionale è una traduzione della patente in un formato standard, riconosciuto da accordi internazionali. Non sostituisce la patente: devi avere con te entrambi ogni volta che guidi."),
      h("Serve in Thailandia?"),
      p("Sì, a meno che tu non abbia una patente thailandese o di un altro paese ASEAN. Il governo thailandese indica i PI rilasciati secondo la Convenzione di Ginevra del 1949. Il governo britannico dice ai conducenti britannici di portare la versione del 1968 per la Thailandia, quindi verifica con la tua autorità competente quale tipo rilascia per la Thailandia."),
      p("Senza una patente valida rischi una multa, e l'assicurazione di viaggio può rifiutare un rimborso dopo un incidente. Il governo australiano avverte che guidare senza la patente corretta può portare all'arresto."),
      h("Scooter e moto"),
      p("Il PI copre solo ciò che copre la patente di origine. Per guidare uno scooter o una moto, entrambi devono includere la categoria moto; patente e PI solo per auto non coprono uno scooter."),
      h("Dove ottenerlo"),
      p("Il PI si ottiene nel paese che ha rilasciato la patente, prima di partire: in Thailandia non puoi ottenerlo. Nel Regno Unito, per esempio, si acquista di persona nei negozi con servizio PayPoint, a 5,50 £."),
      h("Cosa portare"),
      ul([
        "La patente completa di origine (una patente digitale potrebbe non essere accettata).",
        "Il PI.",
        "Il passaporto o una copia, e i documenti del veicolo, che il noleggiatore lascia sul veicolo."
      ]),
      h("Resti più a lungo?"),
      p("Se vivi in Thailandia, puoi richiedere una patente thailandese. Il governo thailandese descrive anche una patente temporanea di 30 giorni per i turisti la cui patente non può essere usata, rilasciata dal Provincial Land Transport Office.")
    ]
  },
  "monthly-car-rental-thailand": {
    title: "Noleggio auto mensile in Thailandia: come funziona",
    description: "Come funziona il noleggio mensile di auto e scooter in Thailandia: costo rispetto alle tariffe giornaliere, deposito, rinnovo ogni mese e cosa controllare.",
    standfirst: "Resti un mese o più? Noleggiare al mese da un'attività locale costa di solito molto meno al giorno che noleggiare giorno per giorno.",
    body: [
      h("Perché noleggiare al mese"),
      p("I noleggiatori locali in Thailandia hanno spesso un prezzo mensile molto più basso al giorno rispetto alla tariffa giornaliera, perché un noleggio lungo fa loro risparmiare consegne, pulizie e giorni vuoti. Se resti tre settimane o più, confronta le due opzioni prima di prenotare."),
      h("Come funziona su Rove"),
      ul([
        "Scegli «Mensile, senza data di fine» nella ricerca per vedere i prezzi mensili. Un noleggio mensile senza data di fine prosegue mese per mese finché non dai disdetta.",
        "Scegli invece una data di fine se sai quando parti: Rove mostra il totale esatto per le tue date, calcolato come lo addebita il noleggiatore.",
        "La prenotazione va direttamente al noleggiatore. Conferma con te la consegna, e lo paghi alle condizioni indicate sulla sua pagina."
      ]),
      h("Deposito"),
      p("Un noleggio mensile prevede di norma un deposito, restituito quando il veicolo torna nelle stesse condizioni. Su Rove ogni veicolo mostra il suo deposito prima della prenotazione. Non lasciare il passaporto come deposito: le avvertenze ufficiali per i viaggiatori lo sconsigliano."),
      h("Cosa controllare prima di firmare"),
      ul([
        "Cosa succede alla fine di ogni mese: come e quando paghi, e con quanto preavviso devi disdire.",
        "Per cosa è assicurato il veicolo. L'assicurazione obbligatoria (Por Ror Bor) copre solo lesioni e morte, non i danni al veicolo.",
        "Chi paga manutenzione e riparazioni durante un noleggio lungo, e cosa fare in caso di guasto.",
        "Se puoi portare il veicolo fuori dall'isola o dalla provincia, e se c'è un limite di chilometraggio.",
        "Se consegna e ritiro sono inclusi."
      ]),
      h("La patente conta sempre"),
      p("I visitatori hanno bisogno della patente di origine più un permesso di guida internazionale per guidare in Thailandia. Se vivi in Thailandia, puoi invece richiedere una patente thailandese.")
    ]
  },
  "renting-a-scooter-in-bali": {
    title: "Noleggiare uno scooter a Bali",
    description: "Cosa serve per noleggiare e guidare uno scooter a Bali: permesso internazionale, casco, controlli di polizia, assicurazione e regole per i turisti.",
    standfirst: "A Bali gli scooter sono ovunque, e anche i controlli di polizia. Ecco cosa serve per guidare in regola e in sicurezza.",
    body: [
      h("La patente che serve"),
      p("In Indonesia la patente di origine da sola non basta: serve un permesso di guida internazionale (o una patente indonesiana), e deve coprire le moto. Procurati il PI nel tuo paese prima di partire."),
      p("La polizia controlla. A maggio 2025 un'operazione di tre giorni a Badung, che comprende Canggu, Kuta, Seminyak e Uluwatu, ha sanzionato 81 conducenti, 30 dei quali turisti, e sequestrato 56 veicoli."),
      h("Le regole per i turisti potrebbero cambiare"),
      p("Il governo provinciale di Bali ha proposto di vietare ai turisti di breve soggiorno di noleggiare moto da guidare personalmente. Al nostro ultimo controllo era una proposta, non una regola in vigore. Chiedi al noleggiatore com'è la situazione prima di prenotare."),
      h("Casco"),
      p("Indossa un casco in buone condizioni ogni volta che guidi, e assicurati che anche il passeggero ne abbia uno."),
      h("Assicurazione"),
      p("Verifica che la tua assicurazione di viaggio copra la guida della moto in Indonesia con la patente che hai. Guidare senza la patente giusta, o senza rispettare le regole, può portare al rifiuto di un rimborso."),
      h("Su strada"),
      ul([
        "In Indonesia si guida a sinistra.",
        "Il traffico è intenso e imprevedibile, soprattutto nel sud. Se non sei un guidatore esperto, un'auto con autista potrebbe fare più al caso tuo.",
        "In caso di incidente, aspetta la polizia sul posto e denuncialo in un posto di polizia.",
        "Durante Nyepi, il giorno del silenzio di Bali, gli spostamenti sull'isola si fermano per tutta la giornata."
      ]),
      h("Prima di partire"),
      ul([
        "Fotografa lo scooter insieme al noleggiatore, compresi i danni già presenti.",
        "Controlla freni, pneumatici e luci, e concordate deposito, carburante e orario di riconsegna.",
        "Salva il numero di telefono o la chat del noleggiatore."
      ])
    ]
  }
};

export default it;
