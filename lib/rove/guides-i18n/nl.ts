import { h, p, ul, type GuideTranslations } from "./blocks";

const nl: GuideTranslations = {
  "do-i-need-an-international-driving-permit": {
    title: "Internationaal rijbewijs nodig? Per land uitgelegd",
    description: "Welke landen bezoekers om een internationaal rijbewijs vragen, welke versie ze accepteren en wat je verder meeneemt naar populaire huurbestemmingen.",
    standfirst: "Een internationaal rijbewijs (IRB) is een vertaling van je rijbewijs. Sommige landen eisen het, andere niet. Zo werkt het, en dit vragen populaire bestemmingen.",
    body: [
      h("Wat een IRB is, en wat niet"),
      p("Een internationaal rijbewijs vertaalt je rijbewijs in een standaardformaat dat erkend wordt onder internationale verkeersverdragen. Het geldt alleen samen met je volledige rijbewijs uit je thuisland, en alleen voor de voertuigcategorieën die dat rijbewijs dekt. Je haalt het vóór vertrek, in het land dat je rijbewijs heeft afgegeven."),
      p("Er zijn drie versies, vernoemd naar de verdragen erachter: 1926, 1949 en 1968. Een land accepteert de versie (of versies) van de verdragen waarbij het is aangesloten, dus welke je nodig hebt hangt af van je bestemming."),
      h("Wat populaire bestemmingen vragen"),
      ul([
        "Europese Unie: een rijbewijs uit een EU- of EER-land is geldig in de hele EU. Kom je van elders, controleer dan elk land; de Britse overheid noemt Portugal, Griekenland, Italië en Kroatië onder het verdrag van 1968, en Spanje en Malta onder dat van 1949.",
        "Japan: alleen het papieren IRB volgens het Verdrag van Genève van 1949 wordt geaccepteerd. Rijbewijzen uit Zwitserland, Duitsland, Frankrijk, België, Monaco en Taiwan worden in plaats daarvan gebruikt met een erkende Japanse vertaling. Je mag tot een jaar na aankomst rijden.",
        "Verenigde Staten: bezoekers mogen meestal rijden met hun eigen rijbewijs, maar de regels verschillen per staat en een IRB kan nodig zijn (de versie van 1949). Controleer elke staat waarin je rijdt, en de regels van het verhuurbedrijf.",
        "Nieuw-Zeeland: je mag een beperkte tijd rijden met een geldig buitenlands rijbewijs; is het niet in het Engels, neem dan een goedgekeurde Engelse vertaling mee.",
        "Costa Rica: een geldig rijbewijs uit je thuisland volstaat zolang je toeristenverblijf duurt, normaal tot 90 dagen.",
        "Verenigde Arabische Emiraten: bezoekers uit meer dan 30 landen mogen met een bezoekersvisum op hun eigen rijbewijs rijden; anderen hebben een IRB nodig.",
        "Marokko: volgens de Britse overheid hebben Britse bestuurders het IRB van 1968 nodig, en wordt de versie van 1949 niet meer geaccepteerd.",
        "Thailand en Indonesië: bezoekers hebben een IRB naast hun rijbewijs nodig, en voor scooters moeten beide motoren dekken. Zie onze gidsen over Thailand en Bali."
      ]),
      h("Verhuurbedrijven kunnen meer vragen"),
      p("Ook waar de wet geen IRB eist, kan een verhuurbedrijf erom vragen, net als een minimumleeftijd of een jaar of meer rijervaring. Als een bedrijf op Rove documenten wil zien, laat het dat weten wanneer het je boeking bevestigt."),
      h("Scooters en motoren"),
      p("Een autorijbewijs dekt niet automatisch een scooter. In Griekenland heb je bijvoorbeeld minstens categorie A1 (lichte motorfiets) nodig om een bromfiets te huren. Rijden zonder het juiste rijbewijs kan er ook toe leiden dat je reisverzekering na een ongeluk niet uitkeert.")
    ]
  },
  "car-rental-insurance-explained": {
    title: "Autohuurverzekering uitgelegd: CDW, eigen risico en borg",
    description: "Wat een CDW dekt, wat het eigen risico is, waarom er een borg op je creditcard wordt geblokkeerd en hoe je onverwachte kosten voorkomt.",
    standfirst: "Huurverzekeringen zitten vol afkortingen. Dit betekenen CDW, eigen risico en borg, en dit controleer je voordat je tekent.",
    body: [
      h("WA-verzekering"),
      p("Een aansprakelijkheidsverzekering (WA) dekt schade of letsel dat je anderen toebrengt. In de EU moet elk huurvoertuig die hebben, meestal inbegrepen in de prijs. In de VAE is WA wettelijk inbegrepen. In Mexico is een aansprakelijkheidsverzekering van een Mexicaanse verzekeraar verplicht, en Amerikaanse of Canadese polissen gelden daar niet."),
      h("CDW (schadeafkoop) en eigen risico"),
      p("Een CDW beperkt wat je betaalt als het huurvoertuig zelf beschadigd raakt, maar haalt de kosten zelden helemaal weg. Wat overblijft is het eigen risico: het maximum dat je aan schade betaalt. Banden en ruiten vallen er vaak buiten, dus controleer wat jouw CDW dekt."),
      p("Verhuurbedrijven verkopen vaak extra dekking die het eigen risico verlaagt (soms tot nul). Dat kan duur zijn. Een losse eigenrisicoverzekering is vaak goedkoper, maar dan betaal je eerst het verhuurbedrijf en vraag je het geld daarna terug."),
      h("Borg"),
      p("De borg is meestal een reservering op een creditcard op naam van de bestuurder. Dat bedrag kun je niet uitgeven zolang het geblokkeerd is, en het wordt vrijgegeven als het voertuig terugkomt zonder schade, boetes of onbetaalde tol. In de VAE moet dat bijvoorbeeld binnen 30 dagen gebeuren. Op Rove zie je bij elk voertuig de borg voordat je boekt."),
      h("Onverwachte kosten voorkomen"),
      ul([
        "Loop voor vertrek samen met het verhuurbedrijf om het voertuig heen en fotografeer of film het van alle kanten, ook binnen, inclusief de brandstofstand. Zorg dat alle schade op het overdrachtsformulier staat.",
        "Controleer de brandstofregeling, een eventuele kilometerlimiet en de prijs van extra's zoals kinderzitjes.",
        "Bewaar kopieën van het contract en van de ophaal- en inleverrapporten.",
        "Loopt een geschil met een verhuurbedrijf in een ander EU-land vast, dan helpt het Europees Consumentencentrum van je eigen land je gratis."
      ]),
      h("Scooters en quads"),
      p("De verzekering bij scooters en quads is vaak alleen WA, dus schade aan het voertuig zelf betaal je zelf. Veel reisverzekeringen sluiten quadrijden uit, en rijden zonder het juiste rijbewijs kan je dekking ongeldig maken.")
    ]
  },
  "renting-a-car-in-europe": {
    title: "Auto huren in Europa: rijbewijs, tol en milieuzones",
    description: "Wat je nodig hebt om in Europa een auto te huren: rijbewijs en leeftijd, elektronische tol, Italiaanse ZTL-zones, verplichte uitrusting, alcohol.",
    standfirst: "De regels in Europa verschillen per land. Dit zijn de regels waar bezoekers het vaakst over struikelen.",
    body: [
      h("Rijbewijs en leeftijd"),
      p("Een rijbewijs uit een EU- of EER-land is geldig in de hele EU. Met een rijbewijs van elders controleer je elk land waar je rijdt; sommige vragen een internationaal rijbewijs. De minimumleeftijd om auto te rijden is 18 in Portugal, Spanje, Griekenland, Italië en Kroatië, maar verhuurbedrijven hanteren vaak hun eigen minimum (21 is gebruikelijk op Malta) en kunnen onder de 25 meer rekenen."),
      h("Tol en stadszones"),
      ul([
        "Portugal: op sommige snelwegen betaal je alleen elektronisch tol. Vraag of de auto een tolkastje heeft.",
        "Italië: veel stadscentra zijn zones met beperkt verkeer (ZTL), gecontroleerd met camera's. Wie er zonder vergunning in rijdt, krijgt een boete, vaak later via het verhuurbedrijf.",
        "Spanje: sommige steden hebben milieuzones, en Barcelona vraagt buitenlandse voertuigen zich vooraf te registreren."
      ]),
      h("Wat de auto aan boord moet hebben"),
      p("In Kroatië moet elke auto een gevarendriehoek, een verbanddoos en veiligheidshesjes aan boord hebben. Controleer bij het ophalen of ze in de auto liggen. Heb tijdens het rijden altijd je rijbewijs en identiteitsbewijs bij je; in Portugal is dat verplicht."),
      h("Onderweg"),
      ul([
        "Overal wordt rechts gereden, behalve op Malta en Cyprus, in Ierland en in het Verenigd Koninkrijk.",
        "De gebruikelijke alcohollimiet in Portugal, Spanje en Griekenland is 0,05% (0,5 promille), lager voor beginnende bestuurders.",
        "In Spanje is bellen achter het stuur verboden, zelfs als je langs de kant staat, en kinderen kleiner dan 1,35 m moeten in een kinderzitje."
      ]),
      h("Verzekering"),
      p("WA is bij elke huur in de EU inbegrepen. Schade aan de auto zelf wordt meestal gedekt door een CDW met eigen risico; zie onze gids over CDW, eigen risico en borg.")
    ]
  },
  "renting-a-scooter-in-greece": {
    title: "Een scooter of quad huren in Griekenland",
    description: "Welk rijbewijs je nodig hebt voor een brommer, scooter of quad in Griekenland, helmplicht en boetes, gaten in je verzekering en veiligheidstips.",
    standfirst: "Scooters en quads zie je overal op de Griekse eilanden. De rijbewijsregels zijn strenger dan veel bezoekers verwachten.",
    body: [
      h("Het rijbewijs dat je nodig hebt"),
      p("Om in Griekenland een brommer of scooter te huren heb je een geldig rijbewijs nodig met minstens categorie A1 (lichte motorfiets). Een autorijbewijs alleen is niet genoeg, en de Britse categorie P voor bromfietsen tot 50 cc is in Griekenland niet geldig. Voorlopige rijbewijzen gelden voor geen enkel voertuig."),
      h("Helmen"),
      p("Bestuurders en passagiers van brommers en quads moeten een helm dragen. Houdt de politie je zonder helm aan, dan krijg je een boete en wordt je rijbewijs ingenomen, en rijden zonder helm kan je verzekering ongeldig maken."),
      h("Quads: wees extra voorzichtig"),
      ul([
        "Quads veroorzaken elk jaar ernstig letsel en dodelijke ongelukken. Laat je goed instrueren voordat je gaat rijden, en bedenk dat je de weg deelt met groter, sneller verkeer.",
        "De verzekering bij een quad is meestal alleen WA: het verhuurbedrijf rekent schade aan de quad zelf waarschijnlijk aan jou door.",
        "Veel reisverzekeringen zien quadrijden als extreme sport en sluiten het uit. Lees je polis voordat je gaat rijden."
      ]),
      h("Onderweg"),
      ul([
        "In Griekenland wordt rechts gereden.",
        "Het verkeer kan snel en chaotisch zijn, en automobilisten stoppen niet altijd bij zebrapaden.",
        "Rijden onder invloed is een ernstig vergrijp, met boetes en mogelijk gevangenisstraf."
      ]),
      h("Voordat je wegrijdt"),
      ul([
        "Controleer of het voertuig in goede staat is: remmen, banden en verlichting.",
        "Fotografeer het samen met het verhuurbedrijf, inclusief bestaande schade, en spreek de borg en het inlevertijdstip af."
      ])
    ]
  },
  "renting-a-scooter-in-thailand": {
    title: "Scooter huren in Thailand: rijbewijs, helm en verzekering",
    description: "Wat je nodig hebt om in Thailand legaal op een huurscooter te rijden: het juiste rijbewijs en IRB, helmplicht en boetes, borg en verzekering.",
    standfirst: "Op de meeste Thaise eilanden kom je het makkelijkst rond met een scooter. Dit heb je nodig om legaal te rijden, en dit controleer je voordat je vertrekt.",
    body: [
      h("Het rijbewijs dat je nodig hebt"),
      p("Om als bezoeker in Thailand op een scooter of motor te rijden heb je een rijbewijs nodig dat motoren dekt, plus een internationaal rijbewijs (IRB) waarop de motorcategorie staat. Een autorijbewijs alleen dekt geen scooter, wat een verhuurder je ook vertelt."),
      p("De Thaise overheid noemt IRB's volgens het Verdrag van Genève van 1949, en rijbewijzen uit andere ASEAN-landen worden ook geaccepteerd. De Britse overheid raadt Britse bestuurders aan de versie van 1968 bij zich te hebben. Haal je IRB vóór vertrek in je thuisland: in Thailand kun je er geen meer krijgen."),
      h("Een helm is verplicht, voor jullie allebei"),
      p("Bestuurder en passagier moeten allebei een helm dragen volgens artikel 122 van de Land Traffic Act. De politie kan je tot 2.000 baht beboeten, en sinds 1 juni 2025 wordt landelijk strenger gecontroleerd. Vraag het verhuurbedrijf om een helm die past, voor jezelf en voor wie er achterop zit."),
      h("Verzekering: wat wel en niet gedekt is"),
      ul([
        "Elk geregistreerd voertuig moet de verplichte motorrijtuigenverzekering (Por Ror Bor) hebben. Die keert uit bij letsel en overlijden, maar niet bij schade aan de scooter of aan andermans eigendommen.",
        "Vraag het verhuurbedrijf waarvoor de scooter verder verzekerd is, en wat je betaalt als hij beschadigd of gestolen wordt.",
        "Controleer of je reisverzekering motorrijden dekt. Veel polissen keren alleen uit als je het juiste rijbewijs voor het voertuig hebt, dus zonder dat sta je mogelijk onverzekerd."
      ]),
      h("Borg"),
      p("Reken op een borg, die je terugkrijgt als je de scooter in dezelfde staat inlevert. Geef je paspoort niet af als borg of onderpand: de Britse en de Australische overheid waarschuwen daar allebei voor. Op Rove zie je bij elk voertuig de borg voordat je boekt."),
      h("Voordat je wegrijdt"),
      ul([
        "Loop samen met het verhuurbedrijf om de scooter heen en fotografeer krassen en deuken, zodat niemand er later over kan discussiëren.",
        "Controleer remmen, banden, verlichting en claxon, en of de kenteken- en verzekeringspapieren bij de scooter zitten.",
        "Spreek de brandstofregeling, het inlevertijdstip en wie je belt bij pech af.",
        "Sla het telefoon- of chatnummer van het verhuurbedrijf op voordat je vertrekt."
      ]),
      h("Onderweg"),
      ul([
        "In Thailand wordt links gereden.",
        "Thailand heeft een van de hoogste aantallen verkeersdoden ter wereld, en motorrijders lopen het meeste risico. Rijd defensief en wees extra voorzichtig in de regen.",
        "Feestdagen zoals Songkran brengen meer verkeer en meer drank. Rijd nooit na het drinken."
      ])
    ]
  },
  "international-driving-permit-thailand": {
    title: "Internationaal rijbewijs voor Thailand",
    description: "Heb je een internationaal rijbewijs nodig om in Thailand auto of scooter te rijden? Welk type je haalt, waar je het haalt en wat je bij je hebt.",
    standfirst: "De meeste bezoekers hebben een internationaal rijbewijs nodig om in Thailand te rijden. Welk, waar je het haalt en wat je bij je hebt.",
    body: [
      h("Wat een IRB is"),
      p("Een internationaal rijbewijs is een vertaling van je rijbewijs in een standaardformaat, erkend onder internationale afspraken. Het vervangt je rijbewijs niet; je hebt ze allebei bij je zolang je rijdt."),
      h("Heb je er in Thailand een nodig?"),
      p("Ja, tenzij je een Thais rijbewijs hebt of een rijbewijs uit een ander ASEAN-land. De Thaise overheid noemt IRB's volgens het Verdrag van Genève van 1949. De Britse overheid zegt Britse bestuurders voor Thailand de versie van 1968 mee te nemen, dus vraag bij je eigen rijbewijsinstantie na welk type die voor Thailand afgeeft."),
      p("Zonder geldig rijbewijs kun je een boete krijgen, en je reisverzekering kan na een ongeluk weigeren uit te keren. De Australische overheid waarschuwt dat rijden zonder het juiste rijbewijs tot arrestatie kan leiden."),
      h("Scooters en motoren"),
      p("Je IRB dekt alleen wat je rijbewijs uit je thuisland dekt. Om scooter of motor te rijden moeten beide de motorcategorie bevatten; een rijbewijs en IRB voor alleen de auto dekken geen scooter."),
      h("Waar je het haalt"),
      p("Je haalt een IRB vóór vertrek in het land dat je rijbewijs heeft afgegeven: in Thailand kun je er geen meer krijgen. In het Verenigd Koninkrijk worden IRB's bijvoorbeeld persoonlijk verkocht in winkels met PayPoint, voor £5,50."),
      h("Wat je bij je hebt"),
      ul([
        "Je volledige rijbewijs uit je thuisland (een digitaal rijbewijs wordt mogelijk niet geaccepteerd).",
        "Je IRB.",
        "Je paspoort of een kopie, en de voertuigpapieren, die het verhuurbedrijf bij het voertuig bewaart."
      ]),
      h("Blijf je langer?"),
      p("Woon je in Thailand, dan kun je een Thais rijbewijs aanvragen. De Thaise overheid beschrijft ook een tijdelijk rijbewijs van 30 dagen voor toeristen van wie het rijbewijs niet gebruikt kan worden, afgegeven door het Provincial Land Transport Office.")
    ]
  },
  "monthly-car-rental-thailand": {
    title: "Auto per maand huren in Thailand: zo werkt het",
    description: "Hoe maandhuur van auto's en scooters in Thailand werkt: kosten vergeleken met dagprijzen, borg, elke maand verlengen en wat je moet controleren.",
    standfirst: "Blijf je een maand of langer? Per maand huren bij een lokaal bedrijf is per dag meestal veel goedkoper dan per dag huren.",
    body: [
      h("Waarom per maand huren"),
      p("Lokale verhuurbedrijven in Thailand hebben vaak een maandprijs die per dag veel lager uitvalt dan hun dagprijs, omdat een lange huur hun overdrachten, schoonmaak en lege dagen bespaart. Blijf je drie weken of langer, vergelijk dan beide voordat je boekt."),
      h("Zo werkt het op Rove"),
      ul([
        "Kies „Per maand, geen einddatum” in de zoekfunctie om maandprijzen te zien. Een maandhuur zonder einddatum loopt maand voor maand door tot je opzegt.",
        "Kies in plaats daarvan een einddatum als je weet wanneer je vertrekt: Rove toont het exacte totaal voor jouw data, berekend zoals het bedrijf het in rekening brengt.",
        "Je boeking gaat rechtstreeks naar het bedrijf. Het bevestigt de overdracht met je, en je betaalt volgens de voorwaarden op hun pagina."
      ]),
      h("Borg"),
      p("Bij een maandhuur hoort normaal een borg, die je terugkrijgt als het voertuig in dezelfde staat terugkomt. Op Rove zie je bij elk voertuig de borg voordat je boekt. Geef je paspoort niet af als borg: officiële reisadviezen waarschuwen daarvoor."),
      h("Wat je controleert voordat je tekent"),
      ul([
        "Wat er aan het eind van elke maand gebeurt: hoe en wanneer je betaalt, en hoeveel opzegtermijn je moet geven als je wilt stoppen.",
        "Waarvoor het voertuig verzekerd is. De verplichte verzekering (Por Ror Bor) dekt alleen letsel en overlijden, geen schade aan het voertuig.",
        "Wie onderhoud en reparaties betaalt tijdens een lange huur, en wat je doet als het voertuig kapotgaat.",
        "Of je het voertuig van het eiland of buiten de provincie mag meenemen, en of er een kilometerlimiet is.",
        "Of bezorgen en ophalen inbegrepen zijn."
      ]),
      h("Je rijbewijs telt nog steeds"),
      p("Bezoekers hebben hun eigen rijbewijs plus een internationaal rijbewijs nodig om in Thailand te rijden. Woon je in Thailand, dan kun je in plaats daarvan een Thais rijbewijs aanvragen.")
    ]
  },
  "renting-a-scooter-in-bali": {
    title: "Een scooter huren op Bali",
    description: "Wat je nodig hebt om op Bali een scooter te huren: internationaal rijbewijs, helm, politiecontroles, verzekering en de nieuwste regels voor toeristen.",
    standfirst: "Scooters zie je overal op Bali, politiecontroles ook. Dit heb je nodig om legaal en veilig te rijden.",
    body: [
      h("Het rijbewijs dat je nodig hebt"),
      p("Je eigen rijbewijs is in Indonesië niet genoeg: je hebt een internationaal rijbewijs nodig (of een Indonesisch rijbewijs), en het moet motoren dekken. Haal je IRB vóór vertrek in je thuisland."),
      p("De politie controleert echt. In mei 2025 werden bij een driedaagse actie in Badung, waaronder Canggu, Kuta, Seminyak en Uluwatu vallen, 81 rijders bekeurd, van wie 30 toeristen, en 56 voertuigen in beslag genomen."),
      h("De regels voor toeristen kunnen veranderen"),
      p("De provinciale overheid van Bali heeft voorgesteld kortverblijvende toeristen te verbieden motoren te huren om zelf te rijden. Bij onze laatste controle was dit een voorstel, geen geldende regel. Vraag het bedrijf vóór het boeken naar de actuele situatie."),
      h("Helmen"),
      p("Draag elke keer dat je rijdt een helm in goede staat, en zorg dat een passagier er ook een heeft."),
      h("Verzekering"),
      p("Controleer of je reisverzekering motorrijden in Indonesië dekt met het rijbewijs dat je hebt. Rijden zonder het juiste rijbewijs, of zonder je aan de regels te houden, kan betekenen dat een claim wordt afgewezen."),
      h("Onderweg"),
      ul([
        "In Indonesië wordt links gereden.",
        "Het verkeer is druk en onvoorspelbaar, vooral in het zuiden. Ben je geen zelfverzekerde rijder, dan past een auto met chauffeur misschien beter.",
        "Heb je een ongeluk, wacht dan ter plekke op de politie en doe aangifte op een politiebureau.",
        "Op Nyepi, de dag van stilte op Bali, ligt het verkeer op het eiland een dag lang stil."
      ]),
      h("Voordat je wegrijdt"),
      ul([
        "Fotografeer de scooter samen met het bedrijf, inclusief bestaande schade.",
        "Controleer remmen, banden en verlichting, en spreek borg, brandstof en inlevertijdstip af.",
        "Sla het telefoon- of chatnummer van het bedrijf op."
      ])
    ]
  }
};

export default nl;
