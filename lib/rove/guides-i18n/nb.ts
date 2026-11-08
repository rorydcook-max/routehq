import { h, p, ul, type GuideTranslations } from "./blocks";

const nb: GuideTranslations = {
  "do-i-need-an-international-driving-permit": {
    title: "Trenger jeg internasjonalt førerkort? Land for land",
    description: "Hvilke land krever internasjonalt førerkort av besøkende, hvilken versjon de godtar og hva du ellers bør ha med til populære leiebilmål.",
    standfirst: "Et internasjonalt førerkort (IDP) er en oversettelse av førerkortet ditt. Noen land krever det, andre ikke. Slik fungerer det, og dette krever populære reisemål.",
    body: [
      h("Hva et IDP er, og ikke er"),
      p("Et internasjonalt førerkort oversetter førerkortet ditt til et standardformat som anerkjennes etter internasjonale veitrafikkonvensjoner. Det gjelder bare sammen med det fullstendige førerkortet ditt hjemmefra, og bare for de kjøretøyklassene det dekker. Du skaffer det før reisen, i landet som utstedte førerkortet ditt."),
      p("Det finnes tre versjoner, oppkalt etter konvensjonene bak dem: 1926, 1949 og 1968. Et land godtar versjonen (eller versjonene) fra konvensjonene det er tilsluttet, så hvilken du trenger avhenger av hvor du skal."),
      h("Hva populære reisemål krever"),
      ul([
        "EU: et førerkort fra et EU- eller EØS-land gjelder i hele EU. Besøkende fra andre land bør sjekke hvert land; britiske myndigheter oppgir Portugal, Hellas, Italia og Kroatia under 1968-konvensjonen, og Spania og Malta under 1949-konvensjonen.",
        "Japan: bare papir-IDP etter Genève-konvensjonen fra 1949 godtas. Førerkort fra Sveits, Tyskland, Frankrike, Belgia, Monaco og Taiwan brukes i stedet med en autorisert japansk oversettelse. Du kan kjøre i opptil ett år etter ankomst.",
        "USA: besøkende kan vanligvis kjøre på førerkortet hjemmefra, men reglene varierer fra delstat til delstat, og et IDP kan være nødvendig (1949-versjonen). Sjekk hver delstat du skal kjøre i, og utleierens egne regler.",
        "New Zealand: du kan kjøre på et gyldig utenlandsk førerkort i en begrenset periode; er det ikke på engelsk, ha med en godkjent engelsk oversettelse.",
        "Costa Rica: et gyldig førerkort hjemmefra gjelder så lenge turistoppholdet varer, vanligvis opptil 90 dager.",
        "De forente arabiske emirater: besøkende fra over 30 land kan kjøre på førerkortet hjemmefra med besøksvisum; andre trenger et IDP.",
        "Marokko: ifølge britiske myndigheter trenger britiske sjåfører 1968-versjonen av IDP, og 1949-versjonen godtas ikke lenger.",
        "Thailand og Indonesia: besøkende trenger et IDP sammen med førerkortet, og for scooter må begge omfatte motorsykkel. Se guidene våre om Thailand og Bali."
      ]),
      h("Utleiere kan kreve mer"),
      p("Selv der loven ikke krever IDP, kan en utleier gjøre det, i tillegg til en minstealder eller ett år eller mer med kjøreerfaring. Hvis en utleier på Rove vil se dokumenter, sier de fra når de bekrefter bestillingen din."),
      h("Scootere og motorsykler"),
      p("Et bilførerkort dekker ikke automatisk en scooter. I Hellas trenger du for eksempel minst klasse A1 (lett motorsykkel) for å leie en moped. Å kjøre uten riktig førerkort kan også føre til at reiseforsikringen ikke betaler etter en ulykke.")
    ]
  },
  "car-rental-insurance-explained": {
    title: "Leiebilforsikring forklart: CDW, egenandel og depositum",
    description: "Hva en CDW dekker, hva egenandelen er, hvorfor et depositum reserveres på kortet ditt og hvordan du unngår overraskende kostnader i utlandet.",
    standfirst: "Leieforsikring er full av forkortelser. Dette betyr CDW, egenandel og depositum, og dette bør du sjekke før du signerer.",
    body: [
      h("Ansvarsforsikring"),
      p("Ansvarsforsikringen dekker skade du påfører andre mennesker og deres eiendom. I EU må alle leiekjøretøy ha den, vanligvis inkludert i prisen. I De forente arabiske emirater er den inkludert ved lov. I Mexico kreves ansvarsforsikring fra et meksikansk forsikringsselskap, og amerikanske eller kanadiske forsikringer gjelder ikke der."),
      h("CDW (kaskoforsikring) og egenandel"),
      p("En CDW begrenser hva du betaler hvis selve leiekjøretøyet skades, men fjerner sjelden hele kostnaden. Det som gjenstår er egenandelen: det meste du betaler for en skade. CDW unntar ofte dekk og glass, så sjekk hva din dekker."),
      p("Utleiere selger ofte tilleggsdekning som senker egenandelen (noen ganger til null). Det kan bli dyrt. En frittstående egenandelsforsikring er ofte billigere, men da betaler du utleieren først og krever pengene tilbake etterpå."),
      h("Depositum"),
      p("Depositumet er vanligvis en reservasjon på et kredittkort i førerens navn. Du kan ikke bruke beløpet mens det er reservert, og det frigis når kjøretøyet kommer tilbake uten skader, bøter eller ubetalte bompenger. I De forente arabiske emirater skal det for eksempel frigis innen 30 dager. På Rove viser hvert kjøretøy depositumet før du bestiller."),
      h("Unngå overraskende kostnader"),
      ul([
        "Før du kjører, gå rundt kjøretøyet sammen med utleieren og fotografer eller film det fra alle sider, også innvendig og drivstoffnivået. Sørg for at alle skader står i overleveringsskjemaet.",
        "Sjekk drivstoffreglene, eventuell kilometergrense og prisen på tillegg som barneseter.",
        "Ta vare på kopier av kontrakten og rapportene ved henting og levering.",
        "Hvis en tvist med en utleier i et annet EU-land står fast, kan Forbrukereuropa (ditt lands europeiske forbrukersenter) hjelpe deg gratis."
      ]),
      h("Scootere og firehjulinger"),
      p("Forsikringen som selges med scootere og firehjulinger dekker ofte bare tredjepart, så skader på selve kjøretøyet betaler du selv. Mange reiseforsikringer unntar kjøring med firehjuling, og å kjøre uten riktig førerkort kan gjøre forsikringen ugyldig.")
    ]
  },
  "renting-a-car-in-europe": {
    title: "Leie bil i Europa: førerkort, bompenger og bysoner",
    description: "Hva du trenger for å leie og kjøre bil i Europa: førerkort og alder, elektroniske bompenger, Italias ZTL-soner, påbudt utstyr og forsikring.",
    standfirst: "Reglene i Europa varierer fra land til land. Her er de som oftest overrasker besøkende.",
    body: [
      h("Førerkort og alder"),
      p("Et førerkort fra et EU- eller EØS-land gjelder i hele EU. Har du førerkort fra et annet land, sjekk hvert land du skal kjøre i; noen krever internasjonalt førerkort. Minstealderen for å kjøre bil er 18 år i Portugal, Spania, Hellas, Italia og Kroatia, men utleiere har ofte sin egen minstealder (21 er vanlig på Malta) og kan ta mer betalt av sjåfører under 25."),
      h("Bompenger og bysoner"),
      ul([
        "Portugal: noen motorveier har bare elektronisk bompengeinnkreving. Spør om bilen har bombrikke.",
        "Italia: mange bysentre er soner med begrenset trafikk (ZTL) som overvåkes med kameraer. Kjører du inn uten tillatelse, får du bot, ofte sendt senere via utleieren.",
        "Spania: noen byer har lavutslippssoner, og Barcelona ber utenlandske kjøretøy om å registrere seg på forhånd."
      ]),
      h("Hva bilen må ha med"),
      p("I Kroatia må alle biler ha varseltrekant, førstehjelpsskrin og refleksvester. Sjekk at de ligger i bilen ved henting. Ha alltid med førerkort og legitimasjon når du kjører; i Portugal er det påbudt."),
      h("På veien"),
      ul([
        "Det er høyrekjøring overalt unntatt på Malta og Kypros, i Irland og i Storbritannia.",
        "Den vanlige promillegrensen i Portugal, Spania og Hellas er 0,05 % (0,5 promille), lavere for nye sjåfører.",
        "I Spania er det forbudt å bruke mobilen mens du kjører, selv når du har stoppet i veikanten, og barn under 1,35 m må ha barnesete."
      ]),
      h("Forsikring"),
      p("Ansvarsforsikring er inkludert i all bilutleie i EU. Skader på selve bilen dekkes vanligvis av en CDW med egenandel; se guiden vår om CDW, egenandel og depositum.")
    ]
  },
  "renting-a-scooter-in-greece": {
    title: "Leie scooter eller firehjuling i Hellas",
    description: "Førerkortet du trenger for å leie moped, scooter eller firehjuling i Hellas, hjelmregler og bøter, hull i forsikringen og sikkerhetstips for øyene.",
    standfirst: "Scootere og firehjulinger er overalt på de greske øyene. Førerkortreglene er strengere enn mange besøkende tror.",
    body: [
      h("Førerkortet du trenger"),
      p("For å leie moped eller scooter i Hellas trenger du et gyldig førerkort med minst klasse A1 (lett motorsykkel). Bilførerkort alene er ikke nok, og den britiske klassen P for mopeder opptil 50 cc gjelder ikke i Hellas. Midlertidige førerkort gjelder ikke for noe kjøretøy."),
      h("Hjelm"),
      p("Førere og passasjerer på moped og firehjuling må bruke hjelm. Stopper politiet deg uten, får du bot og førerkortet blir inndratt, og kjøring uten hjelm kan gjøre forsikringen ugyldig."),
      h("Firehjulinger: vær ekstra forsiktig"),
      ul([
        "Firehjulinger forårsaker alvorlige skader og dødsfall hvert år. Få skikkelig opplæring før du kjører, og husk at du deler veien med større og raskere trafikk.",
        "Forsikringen som selges med en firehjuling dekker vanligvis bare tredjepart: utleieren vil sannsynligvis fakturere deg for skader på selve kjøretøyet.",
        "Mange reiseforsikringer regner kjøring med firehjuling som ekstremsport og unntar det. Les forsikringen din før du kjører."
      ]),
      h("På veien"),
      ul([
        "Hellas har høyrekjøring.",
        "Trafikken kan være rask og kaotisk, og bilister stopper ikke alltid ved fotgjengeroverganger.",
        "Promillekjøring er et alvorlig lovbrudd, med bøter og mulig fengsel."
      ]),
      h("Før du kjører"),
      ul([
        "Sjekk at kjøretøyet er i god stand: bremser, dekk og lys.",
        "Fotografer det sammen med utleieren, også eksisterende skader, og avtal depositum og leveringstidspunkt."
      ])
    ]
  },
  "renting-a-scooter-in-thailand": {
    title: "Leie scooter i Thailand: førerkort, hjelm og forsikring",
    description: "Hva du trenger for å kjøre en leid scooter lovlig i Thailand: riktig førerkort og IDP, hjelmregler og bøter, depositum og forsikring.",
    standfirst: "Scooter er den enkleste måten å komme seg rundt på de fleste thailandske øyer. Dette trenger du for å kjøre lovlig, og dette bør du sjekke før du drar.",
    body: [
      h("Førerkortet du trenger"),
      p("For å kjøre scooter eller motorsykkel i Thailand som besøkende trenger du et førerkort som omfatter motorsykkel, pluss et internasjonalt førerkort (IDP) der motorsykkelklassen står. Bilførerkort alene dekker ikke scooter, uansett hva utleieren sier."),
      p("Thailands myndigheter oppgir IDP etter Genève-konvensjonen fra 1949, og førerkort fra andre ASEAN-land godtas også. Britiske myndigheter råder britiske sjåfører til å ha med 1968-versjonen. Skaff IDP i hjemlandet før du reiser: du kan ikke få det når du først er i Thailand."),
      h("Hjelm er påbudt, for dere begge"),
      p("Både fører og passasjer må bruke hjelm etter paragraf 122 i Land Traffic Act. Politiet kan gi bot på opptil 2 000 baht, og kontrollene ble skjerpet i hele landet fra 1. juni 2025. Be utleieren om en hjelm som passer, til deg og den som sitter bakpå."),
      h("Forsikring: hva som dekkes og ikke"),
      ul([
        "Alle registrerte kjøretøy må ha den obligatoriske ansvarsforsikringen (Por Ror Bor). Den betaler ved personskade og dødsfall, men ikke for skader på scooteren eller på andres eiendom.",
        "Spør utleieren hva scooteren ellers er forsikret for, og hva du må betale hvis den skades eller blir stjålet.",
        "Sjekk at reiseforsikringen din dekker kjøring med motorsykkel. Mange forsikringer betaler bare hvis du har riktig førerkort for kjøretøyet, så uten det kan du stå uten dekning."
      ]),
      h("Depositum"),
      p("Regn med å legge igjen et depositum, som du får tilbake når du leverer scooteren i samme stand. Ikke gi fra deg passet som depositum eller sikkerhet: både britiske og australske myndigheter advarer mot det. På Rove viser hvert kjøretøy depositumet før du bestiller."),
      h("Før du kjører"),
      ul([
        "Gå rundt scooteren sammen med utleieren og fotografer riper og bulker, så ingen krangler om dem senere.",
        "Sjekk bremser, dekk, lys og horn, og at vognkort og forsikringspapirer følger med scooteren.",
        "Avtal drivstoff, leveringstidspunkt og hvem du ringer hvis den bryter sammen.",
        "Lagre utleierens telefon- eller chattnummer før du drar."
      ]),
      h("På veien"),
      ul([
        "Thailand har venstrekjøring.",
        "Thailand har en av verdens høyeste dødsrater i trafikken, og motorsyklister er mest utsatt. Kjør defensivt og vær ekstra forsiktig i regnvær.",
        "Høytider som Songkran gir mer trafikk og mer alkohol. Kjør aldri etter at du har drukket."
      ])
    ]
  },
  "international-driving-permit-thailand": {
    title: "Internasjonalt førerkort for Thailand",
    description: "Trenger du internasjonalt førerkort for å kjøre bil eller scooter i Thailand? Hvilken type du bør ha, hvor du får det og hva du må ha med.",
    standfirst: "De fleste besøkende trenger internasjonalt førerkort for å kjøre i Thailand. Her er hvilket, hvor du får det og hva du må ha med.",
    body: [
      h("Hva et IDP er"),
      p("Et internasjonalt førerkort er en oversettelse av førerkortet ditt i et standardformat, anerkjent etter internasjonale avtaler. Det erstatter ikke førerkortet ditt; du har begge med deg hele tiden mens du kjører."),
      h("Trenger du det i Thailand?"),
      p("Ja, med mindre du har thailandsk førerkort eller førerkort fra et annet ASEAN-land. Thailands myndigheter oppgir IDP etter Genève-konvensjonen fra 1949. Britiske myndigheter ber britiske sjåfører ha med 1968-versjonen for Thailand, så sjekk med din egen førerkortmyndighet hvilken type de utsteder for Thailand."),
      p("Uten gyldig førerkort kan du få bot, og reiseforsikringen kan avslå et krav etter en ulykke. Australske myndigheter advarer om at kjøring uten riktig førerkort kan føre til arrestasjon."),
      h("Scootere og motorsykler"),
      p("IDP-et ditt dekker bare det førerkortet hjemmefra dekker. For å kjøre scooter eller motorsykkel må begge omfatte motorsykkelklassen; førerkort og IDP bare for bil dekker ikke scooter."),
      h("Hvor du får det"),
      p("Du får IDP i landet som utstedte førerkortet ditt, før du reiser: du kan ikke få det når du først er i Thailand. I Storbritannia selges IDP for eksempel ved personlig oppmøte i butikker med PayPoint-tjenester, for 5,50 £."),
      h("Hva du må ha med"),
      ul([
        "Det fullstendige førerkortet ditt hjemmefra (et digitalt førerkort godtas kanskje ikke).",
        "IDP-et ditt.",
        "Passet ditt eller en kopi, og kjøretøyets papirer, som utleieren oppbevarer i kjøretøyet."
      ]),
      h("Blir du lenger?"),
      p("Bor du i Thailand, kan du søke om thailandsk førerkort. Thailands myndigheter beskriver også et midlertidig førerkort på 30 dager for turister med førerkort som ikke kan brukes, utstedt av Provincial Land Transport Office.")
    ]
  },
  "monthly-car-rental-thailand": {
    title: "Leie bil per måned i Thailand: slik fungerer det",
    description: "Slik fungerer månedsleie av bil og scooter i Thailand: pris sammenlignet med dagspris, depositum, fornyelse hver måned og hva du bør sjekke.",
    standfirst: "Blir du en måned eller mer? Å leie per måned fra et lokalt firma er vanligvis mye billigere per dag enn å leie dag for dag.",
    body: [
      h("Hvorfor leie per måned"),
      p("Lokale utleiere i Thailand har ofte en månedspris som blir mye lavere per dag enn dagsprisen, fordi en lang leie sparer dem for overleveringer, vask og tomme dager. Blir du tre uker eller mer, sammenlign begge før du bestiller."),
      h("Slik fungerer det på Rove"),
      ul([
        "Velg «Månedlig, ingen sluttdato» i søket for å se månedspriser. En månedsleie uten sluttdato fortsetter måned for måned til du sier opp.",
        "Velg i stedet en sluttdato hvis du vet når du reiser: Rove viser nøyaktig totalpris for datoene dine, regnet ut slik utleieren tar betalt.",
        "Bestillingen din går rett til utleieren. De bekrefter overleveringen med deg, og du betaler dem etter vilkårene på siden deres."
      ]),
      h("Depositum"),
      p("En månedsleie har normalt et depositum, som betales tilbake når kjøretøyet kommer tilbake i samme stand. På Rove viser hvert kjøretøy depositumet før du bestiller. Ikke gi fra deg passet som depositum: offisielle reiseråd advarer mot det."),
      h("Sjekk dette før du signerer"),
      ul([
        "Hva som skjer på slutten av hver måned: hvordan og når du betaler, og hvor lang oppsigelsestid som gjelder når du vil avslutte.",
        "Hva kjøretøyet er forsikret for. Den obligatoriske forsikringen (Por Ror Bor) dekker bare personskade og dødsfall, ikke skader på kjøretøyet.",
        "Hvem som betaler service og reparasjoner under en lang leie, og hva du gjør hvis kjøretøyet bryter sammen.",
        "Om du kan ta kjøretøyet med fra øya eller ut av provinsen, og om det er en kilometergrense.",
        "Om levering og henting er inkludert."
      ]),
      h("Førerkortet ditt teller fortsatt"),
      p("Besøkende trenger førerkortet hjemmefra pluss et internasjonalt førerkort for å kjøre i Thailand. Bor du i Thailand, kan du i stedet søke om thailandsk førerkort.")
    ]
  },
  "renting-a-scooter-in-bali": {
    title: "Leie scooter på Bali",
    description: "Hva du trenger for å leie og kjøre scooter på Bali: internasjonalt førerkort, hjelm, politikontroller, forsikring og de nyeste reglene for turister.",
    standfirst: "Scootere er overalt på Bali, og det er politikontroller også. Dette trenger du for å kjøre lovlig og trygt.",
    body: [
      h("Førerkortet du trenger"),
      p("Førerkortet hjemmefra er ikke nok alene i Indonesia: du trenger et internasjonalt førerkort (eller et indonesisk førerkort), og det må omfatte motorsykkel. Skaff IDP i hjemlandet før du reiser."),
      p("Politiet kontrollerer. I mai 2025 fikk 81 førere, 30 av dem turister, forelegg og 56 kjøretøy ble beslaglagt under en tredagers aksjon i Badung, som omfatter Canggu, Kuta, Seminyak og Uluwatu."),
      h("Reglene for turister kan endres"),
      p("Balis provinsmyndigheter har foreslått å nekte korttidsturister å leie motorsykler de kjører selv. Da vi sjekket sist, var dette et forslag, ikke en gjeldende regel. Spør utleieren om situasjonen nå før du bestiller."),
      h("Hjelm"),
      p("Bruk en hjelm i god stand hver gang du kjører, og sørg for at en passasjer også har en."),
      h("Forsikring"),
      p("Sjekk at reiseforsikringen din dekker kjøring med motorsykkel i Indonesia med førerkortet du har. Kjøring uten riktig førerkort, eller uten å følge reglene, kan føre til at et krav blir avslått."),
      h("På veien"),
      ul([
        "Indonesia har venstrekjøring.",
        "Trafikken er tett og uforutsigbar, særlig i sør. Er du ikke en trygg sjåfør, passer en bil med sjåfør kanskje bedre.",
        "Havner du i en ulykke, vent på stedet til politiet kommer, og meld det på en politistasjon.",
        "På Nyepi, Balis stille dag, stanser all ferdsel på øya hele dagen."
      ]),
      h("Før du kjører"),
      ul([
        "Fotografer scooteren sammen med utleieren, også eksisterende skader.",
        "Sjekk bremser, dekk og lys, og avtal depositum, drivstoff og leveringstidspunkt.",
        "Lagre utleierens telefon- eller chattnummer."
      ])
    ]
  }
};

export default nb;
