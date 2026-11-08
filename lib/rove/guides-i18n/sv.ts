import { h, p, ul, type GuideTranslations } from "./blocks";

const sv: GuideTranslations = {
  "do-i-need-an-international-driving-permit": {
    title: "Behöver jag internationellt körkort? Land för land",
    description: "Vilka länder kräver internationellt körkort av besökare, vilken version de godtar och vad du mer ska ha med dig till populära hyrbilsresmål.",
    standfirst: "Ett internationellt körkort (IDP) är en översättning av ditt körkort. Vissa länder kräver det, andra inte. Så fungerar det, och det här kräver populära resmål.",
    body: [
      h("Vad ett IDP är, och inte är"),
      p("Ett internationellt körkort översätter ditt körkort till ett standardformat som erkänns enligt internationella vägtrafikkonventioner. Det gäller bara tillsammans med ditt fullständiga körkort hemifrån, och bara för de fordonsbehörigheter som det körkortet omfattar. Du skaffar det före resan, i det land som utfärdade ditt körkort."),
      p("Det finns tre versioner, uppkallade efter konventionerna bakom dem: 1926, 1949 och 1968. Ett land godtar versionen (eller versionerna) från de konventioner det har anslutit sig till, så vilken du behöver beror på vart du ska."),
      h("Vad populära resmål kräver"),
      ul([
        "EU: ett körkort från ett EU- eller EES-land gäller i hela EU. Besökare från andra länder bör kontrollera varje land; brittiska regeringen anger Portugal, Grekland, Italien och Kroatien under 1968 års konvention, och Spanien och Malta under 1949 års.",
        "Japan: endast pappers-IDP enligt Genèvekonventionen från 1949 godtas. Körkort från Schweiz, Tyskland, Frankrike, Belgien, Monaco och Taiwan används i stället med en auktoriserad japansk översättning. Du får köra i upp till ett år efter ankomsten.",
        "USA: besökare får oftast köra på sitt hemlandskörkort, men reglerna skiljer sig mellan delstater och ett IDP kan behövas (1949 års version). Kontrollera varje delstat du kör i, och uthyrarens egna regler.",
        "Nya Zeeland: du får köra på ett giltigt utländskt körkort under en begränsad tid; om det inte är på engelska ska du ha en godkänd engelsk översättning med dig.",
        "Costa Rica: ett giltigt hemlandskörkort gäller under din turistvistelse, normalt upp till 90 dagar.",
        "Förenade Arabemiraten: besökare från fler än 30 länder får köra på sitt hemlandskörkort med besöksvisum; andra behöver ett IDP.",
        "Marocko: enligt brittiska regeringen behöver brittiska förare 1968 års IDP, och 1949 års version godtas inte längre.",
        "Thailand och Indonesien: besökare behöver ett IDP tillsammans med sitt körkort, och för skoter måste båda omfatta motorcykel. Läs våra guider om Thailand och Bali."
      ]),
      h("Uthyrare kan kräva mer"),
      p("Även där lagen inte kräver ett IDP kan en uthyrare göra det, liksom en lägsta ålder eller ett år eller mer av körvana. Om en uthyrare på Rove vill se dokument säger de det när de bekräftar din bokning."),
      h("Skotrar och motorcyklar"),
      p("Ett bilkörkort omfattar inte automatiskt en skoter. I Grekland behöver du till exempel minst behörighet A1 (lätt motorcykel) för att hyra en moped. Att köra utan rätt körkort kan också innebära att reseförsäkringen inte betalar efter en olycka.")
    ]
  },
  "car-rental-insurance-explained": {
    title: "Hyrbilsförsäkring förklarad: CDW, självrisk och deposition",
    description: "Vad en CDW täcker, vad självrisken är, varför en deposition reserveras på ditt kort och hur du undviker oväntade avgifter när du hyr bil eller skoter utomlands.",
    standfirst: "Hyrförsäkringar är fulla av förkortningar. Det här betyder CDW, självrisk och deposition, och det här ska du kontrollera innan du skriver på.",
    body: [
      h("Trafikförsäkring (ansvar mot tredje part)"),
      p("Ansvarsförsäkringen täcker skador du orsakar andra människor och deras egendom. I EU måste varje hyrfordon ha den, normalt inräknad i priset. I Förenade Arabemiraten ingår den enligt lag. I Mexiko krävs ansvarsförsäkring från ett mexikanskt försäkringsbolag, och amerikanska eller kanadensiska försäkringar gäller inte där."),
      h("CDW (skadeförsäkring) och självrisk"),
      p("En CDW begränsar vad du betalar om själva hyrfordonet skadas, men tar sällan bort hela kostnaden. Det som återstår är självrisken: det mesta du betalar för en skada. CDW undantar ofta däck och glas, så kontrollera vad din täcker."),
      p("Uthyrare säljer ofta tilläggsskydd som sänker självrisken (ibland till noll). Det kan bli dyrt. En fristående självriskförsäkring är ofta billigare, men då betalar du uthyraren först och begär tillbaka pengarna efteråt."),
      h("Deposition"),
      p("Depositionen är oftast en reservation på ett kreditkort i förarens namn. Du kan inte använda det beloppet medan det är reserverat, och det frigörs när fordonet kommer tillbaka utan skador, böter eller obetalda vägavgifter. I Förenade Arabemiraten ska det till exempel frigöras inom 30 dagar. På Rove visar varje fordon sin deposition innan du bokar."),
      h("Undvik oväntade avgifter"),
      ul([
        "Innan du kör iväg, gå runt fordonet tillsammans med uthyraren och fotografera eller filma det från alla håll, även invändigt och bränslenivån. Se till att alla skador står i överlämningsprotokollet.",
        "Kontrollera bränslevillkoren, eventuell körsträckegräns och priset på tillval som barnstolar.",
        "Spara kopior av avtalet och av protokollen vid hämtning och återlämning.",
        "Om en tvist med en uthyrare i ett annat EU-land inte leder någonstans kan Konsument Europa (ditt lands europeiska konsumentcentrum) hjälpa dig gratis."
      ]),
      h("Skotrar och fyrhjulingar"),
      p("Försäkringen som säljs med skotrar och fyrhjulingar täcker ofta bara tredje part, så skador på själva fordonet betalar du själv. Många reseförsäkringar undantar fyrhjulingskörning, och att köra utan rätt körkort kan göra försäkringen ogiltig.")
    ]
  },
  "renting-a-car-in-europe": {
    title: "Hyra bil i Europa: körkort, vägtullar och stadszoner",
    description: "Vad du behöver för att hyra och köra bil i Europa: körkort och ålder, elektroniska vägtullar, Italiens ZTL-zoner, obligatorisk utrustning.",
    standfirst: "Reglerna i Europa varierar från land till land. Här är de som oftast överraskar besökare.",
    body: [
      h("Körkort och ålder"),
      p("Ett körkort från ett EU- eller EES-land gäller i hela EU. Har du körkort från ett annat land, kontrollera varje land du kör i; vissa kräver internationellt körkort. Lägsta ålder för att köra bil är 18 år i Portugal, Spanien, Grekland, Italien och Kroatien, men uthyrare har ofta en egen lägsta ålder (21 är vanligt på Malta) och kan ta mer betalt av förare under 25."),
      h("Vägtullar och stadszoner"),
      ul([
        "Portugal: vissa motorvägar har bara elektronisk vägtull. Fråga om bilen har en tulltransponder.",
        "Italien: många stadskärnor är zoner med begränsad trafik (ZTL) som övervakas med kameror. Kör du in utan tillstånd får du böter, ofta skickade senare via uthyraren.",
        "Spanien: vissa städer har miljözoner, och Barcelona ber utländska fordon att registrera sig i förväg."
      ]),
      h("Vad bilen måste ha med sig"),
      p("I Kroatien måste varje bil ha varningstriangel, första hjälpen-kit och reflexvästar. Kontrollera att de finns i bilen vid hämtningen. Ha alltid körkort och id-handling med dig när du kör; i Portugal är det obligatoriskt."),
      h("På vägen"),
      ul([
        "Det är högertrafik överallt utom på Malta och Cypern, i Irland och i Storbritannien.",
        "Den vanliga promillegränsen i Portugal, Spanien och Grekland är 0,05 % (0,5 promille), lägre för nya förare.",
        "I Spanien är det förbjudet att använda mobilen när du kör, även stillastående vid vägkanten, och barn under 1,35 m behöver bilbarnstol."
      ]),
      h("Försäkring"),
      p("Ansvarsförsäkring ingår i varje hyra inom EU. Skador på själva bilen täcks oftast av en CDW med självrisk; läs vår guide om CDW, självrisk och deposition.")
    ]
  },
  "renting-a-scooter-in-greece": {
    title: "Hyra skoter eller fyrhjuling i Grekland",
    description: "Körkortet du behöver för att hyra moped, skoter eller fyrhjuling i Grekland, hjälmregler och böter, försäkringsluckor och säkerhetstips för öarna.",
    standfirst: "Skotrar och fyrhjulingar finns överallt på de grekiska öarna. Körkortsreglerna är strängare än många besökare tror.",
    body: [
      h("Körkortet du behöver"),
      p("För att hyra moped eller skoter i Grekland behöver du ett giltigt körkort med minst behörighet A1 (lätt motorcykel). Bara bilkörkort räcker inte, och den brittiska behörigheten P för mopeder upp till 50 cc gäller inte i Grekland. Provisoriska körkort gäller inte för något fordon."),
      h("Hjälm"),
      p("Förare och passagerare på mopeder och fyrhjulingar måste bära hjälm. Om polisen stoppar dig utan hjälm får du böter och körkortet dras in, och att köra utan hjälm kan göra försäkringen ogiltig."),
      h("Fyrhjulingar: var extra försiktig"),
      ul([
        "Fyrhjulingar orsakar allvarliga skador och dödsfall varje år. Få ordentliga instruktioner innan du kör, och kom ihåg att du delar vägen med större och snabbare trafik.",
        "Försäkringen som säljs med en fyrhjuling täcker oftast bara tredje part: uthyraren debiterar dig troligen för skador på själva fordonet.",
        "Många reseförsäkringar räknar fyrhjulingskörning som extremsport och undantar den. Läs din försäkring innan du kör."
      ]),
      h("På vägen"),
      ul([
        "Grekland har högertrafik.",
        "Trafiken kan vara snabb och kaotisk, och bilister stannar inte alltid vid övergångsställen.",
        "Rattfylleri är ett allvarligt brott, med böter och möjligt fängelse."
      ]),
      h("Innan du kör iväg"),
      ul([
        "Kontrollera att fordonet är i gott skick: bromsar, däck och lyktor.",
        "Fotografera det tillsammans med uthyraren, även befintliga skador, och kom överens om deposition och återlämningstid."
      ])
    ]
  },
  "renting-a-scooter-in-thailand": {
    title: "Hyra skoter i Thailand: körkort, hjälm och försäkring",
    description: "Vad du behöver för att lagligt köra en hyrd skoter i Thailand: rätt körkort och IDP, hjälmregler och böter, deposition och försäkring.",
    standfirst: "Skotern är det enklaste sättet att ta sig runt på de flesta thailändska öar. Det här behöver du för att köra lagligt, och det här ska du kontrollera innan du åker.",
    body: [
      h("Körkortet du behöver"),
      p("För att köra skoter eller motorcykel i Thailand som besökare behöver du ett körkort som omfattar motorcykel, plus ett internationellt körkort (IDP) där motorcykelbehörigheten står. Bara bilkörkort omfattar inte en skoter, vad uthyraren än säger."),
      p("Thailands regering anger IDP enligt Genèvekonventionen från 1949, och körkort från andra ASEAN-länder godtas också. Brittiska regeringen råder brittiska förare att ha 1968 års version med sig. Skaffa ditt IDP i hemlandet före resan: du kan inte få ett när du väl är i Thailand."),
      h("Hjälm är lag, för er båda"),
      p("Både förare och passagerare måste bära hjälm enligt paragraf 122 i Land Traffic Act. Polisen kan ge böter på upp till 2 000 baht, och kontrollerna skärptes i hela landet från den 1 juni 2025. Be uthyraren om en hjälm som passar, till dig och till den som åker med."),
      h("Försäkring: vad som täcks och inte"),
      ul([
        "Varje registrerat fordon måste ha den obligatoriska trafikförsäkringen (Por Ror Bor). Den betalar vid personskada och dödsfall, men inte för skador på skotern eller på någons egendom.",
        "Fråga uthyraren vad skotern i övrigt är försäkrad för, och vad du betalar om den skadas eller blir stulen.",
        "Kontrollera att din reseförsäkring täcker motorcykelkörning. Många försäkringar betalar bara om du har rätt körkort för fordonet, så utan det kan du stå utan skydd."
      ]),
      h("Deposition"),
      p("Räkna med att lämna en deposition, som du får tillbaka när du lämnar tillbaka skotern i samma skick. Lämna inte ditt pass som deposition eller säkerhet: både brittiska och australiska regeringen varnar för det. På Rove visar varje fordon sin deposition innan du bokar."),
      h("Innan du kör iväg"),
      ul([
        "Gå runt skotern med uthyraren och fotografera repor och bucklor, så att ingen kan bråka om dem senare.",
        "Kontrollera bromsar, däck, lyktor och tuta, och att registrerings- och försäkringspapperen följer med skotern.",
        "Kom överens om bränsle, återlämningstid och vem du ringer om den går sönder.",
        "Spara uthyrarens telefon- eller chattnummer innan du åker."
      ]),
      h("På vägen"),
      ul([
        "Thailand har vänstertrafik.",
        "Thailand har en av de högsta trafikdödligheterna i världen, och motorcyklister är mest utsatta. Kör defensivt och var extra försiktig när det regnar.",
        "Helger som Songkran innebär mer trafik och mer alkohol. Kör aldrig efter att du har druckit."
      ])
    ]
  },
  "international-driving-permit-thailand": {
    title: "Internationellt körkort för Thailand",
    description: "Behöver du internationellt körkort för att köra bil eller skoter i Thailand? Vilken typ du ska ha, var du skaffar det och vad du ska ha med dig.",
    standfirst: "De flesta besökare behöver internationellt körkort för att köra i Thailand. Här är vilket, var du skaffar det och vad du ska ha med dig.",
    body: [
      h("Vad ett IDP är"),
      p("Ett internationellt körkort är en översättning av ditt körkort i ett standardformat, erkänt enligt internationella överenskommelser. Det ersätter inte ditt körkort; du har båda med dig hela tiden du kör."),
      h("Behöver du ett i Thailand?"),
      p("Ja, om du inte har thailändskt körkort eller körkort från ett annat ASEAN-land. Thailands regering anger IDP enligt Genèvekonventionen från 1949. Brittiska regeringen säger åt brittiska förare att ha 1968 års version för Thailand, så kontrollera med din egen körkortsmyndighet vilken typ den utfärdar för Thailand."),
      p("Utan giltigt körkort kan du få böter, och reseförsäkringen kan neka ersättning efter en olycka. Australiska regeringen varnar för att körning utan rätt körkort kan leda till gripande."),
      h("Skotrar och motorcyklar"),
      p("Ditt IDP omfattar bara det ditt hemlandskörkort omfattar. För att köra skoter eller motorcykel måste båda innehålla motorcykelbehörighet; körkort och IDP för bara bil omfattar inte en skoter."),
      h("Var du skaffar det"),
      p("Du skaffar ett IDP i det land som utfärdade ditt körkort, före resan: du kan inte få ett när du väl är i Thailand. I Storbritannien säljs IDP till exempel på plats i butiker med PayPoint-tjänster, för 5,50 £."),
      h("Vad du ska ha med dig"),
      ul([
        "Ditt fullständiga körkort hemifrån (ett digitalt körkort godtas kanske inte).",
        "Ditt IDP.",
        "Ditt pass eller en kopia, och fordonets papper, som uthyraren förvarar i fordonet."
      ]),
      h("Stannar du längre?"),
      p("Om du bor i Thailand kan du ansöka om thailändskt körkort. Thailands regering beskriver också ett tillfälligt körkort på 30 dagar för turister vars körkort inte kan användas, utfärdat av Provincial Land Transport Office.")
    ]
  },
  "monthly-car-rental-thailand": {
    title: "Hyra bil per månad i Thailand: så fungerar det",
    description: "Så fungerar månadshyra av bil och skoter i Thailand: kostnad jämfört med dagspris, deposition, förnyelse varje månad och vad du ska kontrollera.",
    standfirst: "Stannar du en månad eller mer? Att hyra per månad från ett lokalt företag är oftast mycket billigare per dag än att hyra dag för dag.",
    body: [
      h("Varför hyra per månad"),
      p("Lokala uthyrare i Thailand har ofta ett månadspris som blir mycket lägre per dag än dagspriset, eftersom en lång hyra sparar dem överlämningar, städning och tomma dagar. Stannar du tre veckor eller mer, jämför båda innan du bokar."),
      h("Så fungerar det på Rove"),
      ul([
        "Välj ”Månadsvis, inget slutdatum” i sökningen för att se månadspriser. En månadshyra utan slutdatum löper vidare månad för månad tills du säger upp den.",
        "Välj i stället ett slutdatum om du vet när du åker: Rove visar exakt totalpris för dina datum, räknat på det sätt uthyraren debiterar.",
        "Din bokning går direkt till uthyraren. De bekräftar överlämningen med dig, och du betalar dem enligt villkoren på deras sida."
      ]),
      h("Deposition"),
      p("En månadshyra kommer normalt med en deposition, som återbetalas när fordonet kommer tillbaka i samma skick. På Rove visar varje fordon sin deposition innan du bokar. Lämna inte ditt pass som deposition: officiella reseråd varnar för det."),
      h("Kontrollera innan du skriver på"),
      ul([
        "Vad som händer i slutet av varje månad: hur och när du betalar, och hur lång uppsägningstid som gäller när du vill sluta.",
        "Vad fordonet är försäkrat för. Den obligatoriska trafikförsäkringen (Por Ror Bor) täcker bara personskada och dödsfall, inte skador på fordonet.",
        "Vem som betalar service och reparationer under en lång hyra, och vad du gör om fordonet går sönder.",
        "Om du får ta fordonet från ön eller utanför provinsen, och om det finns en körsträckegräns.",
        "Om leverans och hämtning ingår."
      ]),
      h("Ditt körkort spelar fortfarande roll"),
      p("Besökare behöver sitt hemlandskörkort plus ett internationellt körkort för att köra i Thailand. Om du bor i Thailand kan du i stället ansöka om thailändskt körkort.")
    ]
  },
  "renting-a-scooter-in-bali": {
    title: "Hyra skoter på Bali",
    description: "Vad du behöver för att hyra och köra skoter på Bali: internationellt körkort, hjälm, poliskontroller, försäkring och de senaste reglerna för turister.",
    standfirst: "Skotrar finns överallt på Bali, och det gör poliskontroller också. Det här behöver du för att köra lagligt och säkert.",
    body: [
      h("Körkortet du behöver"),
      p("Ditt hemlandskörkort räcker inte ensamt i Indonesien: du behöver ett internationellt körkort (eller ett indonesiskt körkort), och det måste omfatta motorcykel. Skaffa ditt IDP i hemlandet före resan."),
      p("Polisen kontrollerar. I maj 2025 bötfälldes 81 förare, varav 30 turister, och 56 fordon beslagtogs vid en tredagarsinsats i Badung, som omfattar Canggu, Kuta, Seminyak och Uluwatu."),
      h("Reglerna för turister kan ändras"),
      p("Balis provinsregering har föreslagit att turister på kortare besök inte ska få hyra motorcyklar för att köra själva. När vi senast kontrollerade var det ett förslag, inte en gällande regel. Fråga uthyraren hur det ser ut nu innan du bokar."),
      h("Hjälm"),
      p("Bär en hjälm i gott skick varje gång du kör, och se till att en passagerare också har en."),
      h("Försäkring"),
      p("Kontrollera att din reseförsäkring täcker motorcykelkörning i Indonesien med det körkort du har. Att köra utan rätt körkort, eller utan att följa reglerna, kan innebära att ett anspråk avslås."),
      h("På vägen"),
      ul([
        "Indonesien har vänstertrafik.",
        "Trafiken är tät och oförutsägbar, särskilt i söder. Om du inte är en säker förare passar en bil med chaufför dig kanske bättre.",
        "Om du är med om en olycka, vänta på platsen tills polisen kommer och anmäl det på en polisstation.",
        "Under Nyepi, Balis tysta dag, står all trafik på ön still hela dagen."
      ]),
      h("Innan du kör iväg"),
      ul([
        "Fotografera skotern tillsammans med uthyraren, även befintliga skador.",
        "Kontrollera bromsar, däck och lyktor, och kom överens om deposition, bränsle och återlämningstid.",
        "Spara uthyrarens telefon- eller chattnummer."
      ])
    ]
  }
};

export default sv;
