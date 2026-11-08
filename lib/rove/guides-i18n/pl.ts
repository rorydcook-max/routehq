import { h, p, ul, type GuideTranslations } from "./blocks";

const pl: GuideTranslations = {
  "do-i-need-an-international-driving-permit": {
    title: "Czy potrzebuję międzynarodowego prawa jazdy? Kraj po kraju",
    description: "Które kraje wymagają od turystów międzynarodowego prawa jazdy, jaką wersję akceptują i co jeszcze zabrać do popularnych miejsc wynajmu.",
    standfirst: "Międzynarodowe prawo jazdy (MPJ) to tłumaczenie Twojego prawa jazdy. Niektóre kraje go wymagają, inne nie. Oto jak działa i czego wymagają popularne kierunki.",
    body: [
      h("Czym jest MPJ, a czym nie jest"),
      p("Międzynarodowe prawo jazdy tłumaczy Twoje prawo jazdy na standardowy format uznawany na mocy międzynarodowych konwencji o ruchu drogowym. Jest ważne tylko razem z pełnym prawem jazdy z Twojego kraju i tylko dla kategorii pojazdów, które ono obejmuje. Wyrabiasz je przed podróżą, w kraju, który wydał Twoje prawo jazdy."),
      p("Istnieją trzy wersje, nazwane od konwencji, na których się opierają: 1926, 1949 i 1968. Każdy kraj akceptuje wersję (lub wersje) konwencji, których jest stroną, więc właściwa zależy od celu podróży."),
      h("Czego wymagają popularne kierunki"),
      ul([
        "Unia Europejska: prawo jazdy z kraju UE lub EOG jest ważne w całej UE. Osoby spoza nich powinny sprawdzić każdy kraj; rząd brytyjski wymienia Portugalię, Grecję, Włochy i Chorwację w ramach konwencji z 1968 r., a Hiszpanię i Maltę w ramach konwencji z 1949 r.",
        "Japonia: akceptowane jest tylko papierowe MPJ według konwencji genewskiej z 1949 r. Prawa jazdy ze Szwajcarii, Niemiec, Francji, Belgii, Monako i Tajwanu używa się zamiast tego z autoryzowanym tłumaczeniem na japoński. Możesz prowadzić do roku od przyjazdu.",
        "Stany Zjednoczone: turyści zwykle mogą jeździć na swoim krajowym prawie jazdy, ale przepisy różnią się w zależności od stanu i MPJ może być potrzebne (wersja z 1949 r.). Sprawdź każdy stan, w którym będziesz jeździć, oraz zasady wypożyczalni.",
        "Nowa Zelandia: możesz przez ograniczony czas jeździć na ważnym zagranicznym prawie jazdy; jeśli nie jest po angielsku, miej przy sobie zatwierdzone tłumaczenie na angielski.",
        "Kostaryka: ważne krajowe prawo jazdy wystarcza na czas pobytu turystycznego, zwykle do 90 dni.",
        "Zjednoczone Emiraty Arabskie: turyści z ponad 30 krajów mogą jeździć na krajowym prawie jazdy z wizą turystyczną; pozostali potrzebują MPJ.",
        "Maroko: według rządu brytyjskiego kierowcy z Wielkiej Brytanii potrzebują MPJ z 1968 r., a wersja z 1949 r. nie jest już akceptowana.",
        "Tajlandia i Indonezja: turyści potrzebują MPJ razem z prawem jazdy, a w przypadku skuterów oba dokumenty muszą obejmować motocykle. Zobacz nasze poradniki o Tajlandii i Bali."
      ]),
      h("Wypożyczalnie mogą wymagać więcej"),
      p("Nawet tam, gdzie prawo nie wymaga MPJ, wypożyczalnia może go żądać, a także minimalnego wieku lub co najmniej roku doświadczenia za kierownicą. Jeśli firma na Rove będzie potrzebować dokumentów, poinformuje o tym przy potwierdzeniu rezerwacji."),
      h("Skutery i motocykle"),
      p("Prawo jazdy na samochód nie obejmuje automatycznie skutera. W Grecji na przykład, aby wypożyczyć motorower, potrzebujesz co najmniej kategorii A1 (lekki motocykl). Jazda bez odpowiedniego prawa jazdy może też sprawić, że ubezpieczenie podróżne nie wypłaci odszkodowania po wypadku.")
    ]
  },
  "car-rental-insurance-explained": {
    title: "Ubezpieczenie wynajmu auta: CDW, udział własny, kaucja",
    description: "Co obejmuje CDW, czym jest udział własny, dlaczego blokuje się kaucję na karcie i jak uniknąć niespodziewanych opłat przy wynajmie auta lub skutera za granicą.",
    standfirst: "Ubezpieczenia przy wynajmie są pełne skrótów. Oto co znaczą CDW, udział własny i kaucja oraz co sprawdzić przed podpisaniem umowy.",
    body: [
      h("OC (odpowiedzialność cywilna)"),
      p("Ubezpieczenie OC obejmuje szkody lub obrażenia, które wyrządzisz innym. W UE każdy pojazd z wypożyczalni musi je mieć, zwykle w cenie. W ZEA ochrona wobec osób trzecich jest wliczona z mocy prawa. W Meksyku wymagane jest OC meksykańskiego ubezpieczyciela, a polisy z USA czy Kanady nie są tam ważne."),
      h("CDW (ograniczenie odpowiedzialności za szkody) i udział własny"),
      p("CDW ogranicza to, ile zapłacisz, jeśli uszkodzisz sam wynajęty pojazd, ale rzadko całkowicie znosi koszty. To, co zostaje, to udział własny: maksymalna kwota, jaką zapłacisz za szkodę. CDW często nie obejmuje opon i szyb, więc sprawdź, co obejmuje Twoja."),
      p("Wypożyczalnie często sprzedają dodatkową ochronę, która obniża udział własny (czasem do zera). Może być droga. Niezależne ubezpieczenie udziału własnego bywa tańsze, ale najpierw płacisz wypożyczalni, a potem odzyskujesz pieniądze."),
      h("Kaucja"),
      p("Kaucja to zwykle blokada środków na karcie kredytowej kierowcy. Nie możesz wydać tej kwoty, dopóki jest zablokowana, a zostaje zwolniona, gdy pojazd wróci bez uszkodzeń, mandatów i nieopłaconych opłat drogowych. W ZEA na przykład powinna zostać zwolniona w ciągu 30 dni. Na Rove każdy pojazd pokazuje kaucję przed rezerwacją."),
      h("Jak uniknąć niespodziewanych opłat"),
      ul([
        "Przed odjazdem obejdź pojazd razem z wypożyczalnią i sfotografuj lub nagraj go z każdej strony, także w środku, łącznie z poziomem paliwa. Dopilnuj, by każda usterka była wpisana do protokołu wydania.",
        "Sprawdź zasady dotyczące paliwa, ewentualny limit kilometrów i ceny dodatków, takich jak foteliki dziecięce.",
        "Zachowaj kopie umowy oraz protokołów odbioru i zwrotu.",
        "Jeśli spór z wypożyczalnią w innym kraju UE utknie w miejscu, Europejskie Centrum Konsumenckie w Twoim kraju pomoże bezpłatnie."
      ]),
      h("Skutery i quady"),
      p("Ubezpieczenie sprzedawane ze skuterami i quadami to często tylko OC, więc za szkody w samym pojeździe płacisz sam. Wiele ubezpieczeń podróżnych wyklucza jazdę quadem, a jazda bez odpowiedniego prawa jazdy może unieważnić ochronę.")
    ]
  },
  "renting-a-car-in-europe": {
    title: "Wynajem auta w Europie: prawo jazdy, opłaty, strefy",
    description: "Czego potrzebujesz, by wynająć auto w Europie: prawo jazdy i wiek, elektroniczne opłaty drogowe, strefy ZTL we Włoszech, obowiązkowe wyposażenie.",
    standfirst: "Przepisy w Europie różnią się w zależności od kraju. Oto te, które najczęściej zaskakują turystów.",
    body: [
      h("Prawo jazdy i wiek"),
      p("Prawo jazdy z kraju UE lub EOG jest ważne w całej UE. Z prawem jazdy z innego kraju sprawdź każde państwo, w którym będziesz jeździć; niektóre wymagają międzynarodowego prawa jazdy. Minimalny wiek do prowadzenia samochodu to 18 lat w Portugalii, Hiszpanii, Grecji, Włoszech i Chorwacji, ale wypożyczalnie często ustalają własny próg (na Malcie zwykle 21 lat) i mogą pobierać wyższe opłaty od osób poniżej 25 lat."),
      h("Opłaty drogowe i strefy miejskie"),
      ul([
        "Portugalia: na niektórych autostradach opłaty pobierane są tylko elektronicznie. Zapytaj, czy auto ma transponder.",
        "Włochy: wiele centrów miast to strefy ograniczonego ruchu (ZTL) monitorowane kamerami. Wjazd bez zezwolenia oznacza mandat, często przesyłany później przez wypożyczalnię.",
        "Hiszpania: niektóre miasta mają strefy niskiej emisji, a Barcelona prosi zagraniczne pojazdy o wcześniejszą rejestrację."
      ]),
      h("Co musi być w samochodzie"),
      p("W Chorwacji każdy samochód musi mieć trójkąt ostrzegawczy, apteczkę i kamizelki odblaskowe. Sprawdź przy odbiorze, czy są w aucie. Zawsze miej przy sobie prawo jazdy i dokument tożsamości, gdy prowadzisz; w Portugalii to obowiązek."),
      h("Na drodze"),
      ul([
        "Wszędzie obowiązuje ruch prawostronny, z wyjątkiem Malty, Cypru, Irlandii i Wielkiej Brytanii.",
        "Typowy limit alkoholu w Portugalii, Hiszpanii i Grecji to 0,05% (0,5 promila), niższy dla młodych kierowców.",
        "W Hiszpanii korzystanie z telefonu podczas jazdy jest zabronione nawet po zatrzymaniu na poboczu, a dzieci poniżej 1,35 m muszą jechać w foteliku."
      ]),
      h("Ubezpieczenie"),
      p("OC jest wliczone w każdy wynajem w UE. Szkody w samym aucie zwykle pokrywa CDW z udziałem własnym; zobacz nasz poradnik o CDW, udziale własnym i kaucji.")
    ]
  },
  "renting-a-scooter-in-greece": {
    title: "Wynajem skutera lub quada w Grecji",
    description: "Jakie prawo jazdy jest potrzebne, by wypożyczyć motorower, skuter lub quada w Grecji, przepisy i mandaty za kask, luki w ubezpieczeniu i porady na wyspach.",
    standfirst: "Skutery i quady są na greckich wyspach wszędzie. Przepisy dotyczące prawa jazdy są surowsze, niż wielu turystów się spodziewa.",
    body: [
      h("Wymagane prawo jazdy"),
      p("Aby wypożyczyć motorower lub skuter w Grecji, potrzebujesz ważnego prawa jazdy z co najmniej kategorią A1 (lekki motocykl). Samo prawo jazdy na samochód nie wystarczy, a brytyjska kategoria P na motorowery do 50 cm³ nie jest w Grecji ważna. Tymczasowe prawa jazdy nie uprawniają do prowadzenia żadnego pojazdu."),
      h("Kaski"),
      p("Kierowcy i pasażerowie motorowerów i quadów muszą nosić kask. Jeśli policja zatrzyma Cię bez kasku, dostaniesz mandat i stracisz prawo jazdy, a jazda bez kasku może unieważnić ubezpieczenie."),
      h("Quady: szczególna ostrożność"),
      ul([
        "Quady co roku powodują poważne obrażenia i wypadki śmiertelne. Przed jazdą poproś o porządny instruktaż i pamiętaj, że dzielisz drogę z większymi, szybszymi pojazdami.",
        "Ubezpieczenie sprzedawane z quadem to zwykle tylko OC: wypożyczalnia prawdopodobnie obciąży Cię za każdą szkodę w samym quadzie.",
        "Wiele ubezpieczeń podróżnych traktuje jazdę quadem jako sport ekstremalny i ją wyklucza. Przeczytaj swoją polisę przed jazdą."
      ]),
      h("Na drodze"),
      ul([
        "W Grecji obowiązuje ruch prawostronny.",
        "Ruch bywa szybki i chaotyczny, a kierowcy nie zawsze zatrzymują się przed przejściami dla pieszych.",
        "Jazda po alkoholu to poważne przestępstwo, grożą za nią grzywny i więzienie."
      ]),
      h("Zanim ruszysz"),
      ul([
        "Sprawdź, czy pojazd jest w dobrym stanie: hamulce, opony i światła.",
        "Sfotografuj go razem z wypożyczalnią, łącznie z istniejącymi uszkodzeniami, i uzgodnij kaucję oraz godzinę zwrotu."
      ])
    ]
  },
  "renting-a-scooter-in-thailand": {
    title: "Wynajem skutera w Tajlandii: prawo jazdy, kask, polisa",
    description: "Czego potrzebujesz, by legalnie jeździć wynajętym skuterem w Tajlandii: odpowiednie prawo jazdy i MPJ, przepisy i mandaty za kask, kaucja i ubezpieczenie.",
    standfirst: "Skuter to najprostszy sposób poruszania się po większości tajskich wysp. Oto czego potrzebujesz, by jeździć legalnie, i co sprawdzić przed wyjazdem.",
    body: [
      h("Wymagane prawo jazdy"),
      p("Aby jako turysta jeździć w Tajlandii skuterem lub motocyklem, potrzebujesz prawa jazdy obejmującego motocykle oraz międzynarodowego prawa jazdy (MPJ) z kategorią motocyklową. Samo prawo jazdy na samochód nie obejmuje skutera, cokolwiek powie Ci wypożyczalnia."),
      p("Rząd Tajlandii wymienia MPJ wydawane według konwencji genewskiej z 1949 r.; akceptowane są też prawa jazdy z innych krajów ASEAN. Rząd brytyjski radzi kierowcom z Wielkiej Brytanii mieć wersję z 1968 r. Wyrób MPJ w swoim kraju przed podróżą: w Tajlandii nie można go już uzyskać."),
      h("Kask to obowiązek, dla was obojga"),
      p("Kierowca i pasażer muszą nosić kask zgodnie z art. 122 ustawy o ruchu drogowym (Land Traffic Act). Policja może nałożyć mandat do 2000 batów, a od 1 czerwca 2025 r. kontrole w całym kraju zostały zaostrzone. Poproś wypożyczalnię o dopasowany kask dla siebie i każdego, kto jedzie z Tobą."),
      h("Ubezpieczenie: co obejmuje, a czego nie"),
      ul([
        "Każdy zarejestrowany pojazd musi mieć obowiązkowe ubezpieczenie (Por Ror Bor). Pokrywa ono obrażenia i śmierć, ale nie szkody w skuterze ani w cudzym mieniu.",
        "Zapytaj wypożyczalnię, od czego jeszcze ubezpieczony jest skuter i ile zapłacisz, jeśli zostanie uszkodzony lub skradziony.",
        "Sprawdź, czy ubezpieczenie podróżne obejmuje jazdę motocyklem. Wiele polis wypłaca odszkodowanie tylko, jeśli masz odpowiednie prawo jazdy na dany pojazd, więc bez niego możesz zostać bez ochrony."
      ]),
      h("Kaucja"),
      p("Licz się z kaucją, zwracaną, gdy oddasz skuter w tym samym stanie. Nie zostawiaj paszportu jako kaucji ani zabezpieczenia: odradzają to zarówno rząd brytyjski, jak i australijski. Na Rove każdy pojazd pokazuje kaucję przed rezerwacją."),
      h("Zanim ruszysz"),
      ul([
        "Obejdź skuter razem z wypożyczalnią i sfotografuj rysy i wgniecenia, by nikt później się o nie nie spierał.",
        "Sprawdź hamulce, opony, światła i klakson oraz czy dowód rejestracyjny i dokumenty ubezpieczenia są przy skuterze.",
        "Uzgodnij zasady dotyczące paliwa, godzinę zwrotu i to, do kogo dzwonić w razie awarii.",
        "Zapisz numer telefonu lub czatu wypożyczalni przed wyjazdem."
      ]),
      h("Na drodze"),
      ul([
        "W Tajlandii obowiązuje ruch lewostronny.",
        "Tajlandia ma jeden z najwyższych wskaźników śmiertelności na drogach na świecie, a motocykliści są najbardziej narażeni. Jedź defensywnie i szczególnie uważaj w deszczu.",
        "Święta takie jak Songkran oznaczają większy ruch i więcej alkoholu. Nigdy nie jedź po alkoholu."
      ])
    ]
  },
  "international-driving-permit-thailand": {
    title: "Międzynarodowe prawo jazdy w Tajlandii",
    description: "Czy potrzebujesz międzynarodowego prawa jazdy, by prowadzić auto lub skuter w Tajlandii? Jaki rodzaj wyrobić, gdzie go dostać i co mieć przy sobie.",
    standfirst: "Większość turystów potrzebuje międzynarodowego prawa jazdy, by prowadzić w Tajlandii. Oto które, gdzie je wyrobić i co mieć przy sobie.",
    body: [
      h("Czym jest MPJ"),
      p("Międzynarodowe prawo jazdy to tłumaczenie Twojego prawa jazdy w standardowym formacie, uznawane na mocy umów międzynarodowych. Nie zastępuje prawa jazdy; podczas jazdy zawsze masz przy sobie oba dokumenty."),
      h("Czy potrzebujesz go w Tajlandii?"),
      p("Tak, chyba że masz tajskie prawo jazdy lub prawo jazdy z innego kraju ASEAN. Rząd Tajlandii wymienia MPJ wydawane według konwencji genewskiej z 1949 r. Rząd brytyjski zaleca kierowcom z Wielkiej Brytanii wersję z 1968 r. dla Tajlandii, więc sprawdź w swoim urzędzie, jaki rodzaj wydaje on dla Tajlandii."),
      p("Bez ważnego prawa jazdy grozi Ci mandat, a ubezpieczenie podróżne może odmówić wypłaty po wypadku. Rząd Australii ostrzega, że jazda bez właściwego prawa jazdy może skończyć się aresztowaniem."),
      h("Skutery i motocykle"),
      p("MPJ obejmuje tylko to, co obejmuje Twoje krajowe prawo jazdy. Aby jeździć skuterem lub motocyklem, oba dokumenty muszą zawierać kategorię motocyklową; prawo jazdy i MPJ tylko na samochód nie obejmują skutera."),
      h("Gdzie je wyrobić"),
      p("MPJ wyrabia się w kraju, który wydał Twoje prawo jazdy, przed podróżą: w Tajlandii nie można go już uzyskać. W Wielkiej Brytanii na przykład MPJ sprzedaje się osobiście w sklepach z usługą PayPoint, za 5,50 £."),
      h("Co mieć przy sobie"),
      ul([
        "Pełne prawo jazdy z Twojego kraju (cyfrowe prawo jazdy może nie zostać zaakceptowane).",
        "MPJ.",
        "Paszport lub jego kopię oraz dokumenty pojazdu, które wypożyczalnia trzyma w pojeździe."
      ]),
      h("Zostajesz dłużej?"),
      p("Jeśli mieszkasz w Tajlandii, możesz ubiegać się o tajskie prawo jazdy. Rząd Tajlandii opisuje też tymczasowe, 30-dniowe prawo jazdy dla turystów, których prawa jazdy nie można używać, wydawane przez Provincial Land Transport Office.")
    ]
  },
  "monthly-car-rental-thailand": {
    title: "Miesięczny wynajem auta w Tajlandii: jak to działa",
    description: "Jak działa miesięczny wynajem auta i skutera w Tajlandii: koszt w porównaniu ze stawkami dziennymi, kaucja, przedłużanie co miesiąc i co sprawdzić.",
    standfirst: "Zostajesz na miesiąc lub dłużej? Wynajem na miesiąc od lokalnej firmy jest zwykle dużo tańszy w przeliczeniu na dzień niż wynajem dzienny.",
    body: [
      h("Dlaczego wynajmować na miesiąc"),
      p("Lokalne wypożyczalnie w Tajlandii często mają cenę miesięczną, która w przeliczeniu na dzień wychodzi dużo niżej niż stawka dzienna, bo długi wynajem oszczędza im wydań, sprzątania i pustych dni. Jeśli zostajesz na trzy tygodnie lub dłużej, porównaj obie opcje przed rezerwacją."),
      h("Jak to działa na Rove"),
      ul([
        "Wybierz w wyszukiwarce „Miesięcznie, bez daty końca”, by zobaczyć ceny miesięczne. Wynajem miesięczny bez daty końca trwa z miesiąca na miesiąc, dopóki go nie wypowiesz.",
        "Wybierz datę końca, jeśli wiesz, kiedy wyjeżdżasz: Rove pokaże dokładną sumę za Twoje daty, wyliczoną tak, jak nalicza ją firma.",
        "Rezerwacja trafia prosto do firmy. Firma potwierdza z Tobą wydanie pojazdu, a płacisz jej na warunkach podanych na jej stronie."
      ]),
      h("Kaucja"),
      p("Do wynajmu miesięcznego zwykle należy kaucja, zwracana, gdy pojazd wróci w tym samym stanie. Na Rove każdy pojazd pokazuje kaucję przed rezerwacją. Nie zostawiaj paszportu jako kaucji: oficjalne porady dla podróżnych przed tym ostrzegają."),
      h("Co sprawdzić przed podpisaniem"),
      ul([
        "Co dzieje się pod koniec każdego miesiąca: jak i kiedy płacisz oraz z jakim wyprzedzeniem trzeba wypowiedzieć wynajem.",
        "Od czego ubezpieczony jest pojazd. Obowiązkowe ubezpieczenie (Por Ror Bor) obejmuje tylko obrażenia i śmierć, nie szkody w pojeździe.",
        "Kto płaci za serwis i naprawy podczas długiego wynajmu i co zrobić w razie awarii.",
        "Czy możesz zabrać pojazd poza wyspę lub prowincję i czy obowiązuje limit kilometrów.",
        "Czy dostawa i odbiór są wliczone."
      ]),
      h("Prawo jazdy wciąż się liczy"),
      p("Turyści potrzebują krajowego prawa jazdy oraz międzynarodowego prawa jazdy, by prowadzić w Tajlandii. Jeśli mieszkasz w Tajlandii, możesz zamiast tego ubiegać się o tajskie prawo jazdy.")
    ]
  },
  "renting-a-scooter-in-bali": {
    title: "Wynajem skutera na Bali",
    description: "Czego potrzebujesz, by wynająć skuter i jeździć nim na Bali: międzynarodowe prawo jazdy, kask, kontrole policji, ubezpieczenie i najnowsze zasady dla turystów.",
    standfirst: "Skutery są na Bali wszędzie, kontrole policji też. Oto czego potrzebujesz, by jeździć legalnie i bezpiecznie.",
    body: [
      h("Wymagane prawo jazdy"),
      p("Samo krajowe prawo jazdy w Indonezji nie wystarczy: potrzebujesz międzynarodowego prawa jazdy (lub indonezyjskiego), które musi obejmować motocykle. Wyrób MPJ w swoim kraju przed podróżą."),
      p("Policja naprawdę kontroluje. W maju 2025 r. podczas trzydniowej akcji w Badung, obejmującym Canggu, Kutę, Seminyak i Uluwatu, ukarano 81 kierowców, w tym 30 turystów, i zatrzymano 56 pojazdów."),
      h("Zasady dla turystów mogą się zmienić"),
      p("Władze prowincji Bali zaproponowały zakaz wynajmowania motocykli do samodzielnej jazdy przez turystów na krótkich pobytach. Przy naszej ostatniej weryfikacji była to propozycja, a nie obowiązujący przepis. Przed rezerwacją zapytaj firmę o aktualną sytuację."),
      h("Kaski"),
      p("Za każdym razem jeźdź w kasku w dobrym stanie i dopilnuj, by pasażer też go miał."),
      h("Ubezpieczenie"),
      p("Sprawdź, czy ubezpieczenie podróżne obejmuje jazdę motocyklem w Indonezji z prawem jazdy, które posiadasz. Jazda bez odpowiedniego prawa jazdy lub łamanie przepisów może oznaczać odmowę wypłaty."),
      h("Na drodze"),
      ul([
        "W Indonezji obowiązuje ruch lewostronny.",
        "Ruch jest duży i nieprzewidywalny, zwłaszcza na południu. Jeśli nie czujesz się pewnie na jednośladzie, lepszy może być samochód z kierowcą.",
        "Po wypadku zaczekaj na miejscu na policję i zgłoś zdarzenie na komisariacie.",
        "W Nyepi, balijski Dzień Ciszy, ruch na wyspie zamiera na cały dzień."
      ]),
      h("Zanim ruszysz"),
      ul([
        "Sfotografuj skuter razem z firmą, łącznie z istniejącymi uszkodzeniami.",
        "Sprawdź hamulce, opony i światła oraz uzgodnij kaucję, paliwo i godzinę zwrotu.",
        "Zapisz numer telefonu lub czatu firmy."
      ])
    ]
  }
};

export default pl;
