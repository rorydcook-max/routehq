import { h, p, ul, type GuideTranslations } from "./blocks";

const tr: GuideTranslations = {
  "do-i-need-an-international-driving-permit": {
    title: "Uluslararası sürücü belgesi gerekli mi? Ülke ülke rehber",
    description: "Hangi ülkeler ziyaretçilerden uluslararası sürücü belgesi istiyor, hangi sürümü kabul ediyor ve popüler kiralama noktalarında yanınızda başka neler olmalı.",
    standfirst: "Uluslararası sürücü belgesi (USB), ehliyetinizin bir çevirisidir. Bazı ülkeler ister, bazıları istemez. Nasıl işlediğini ve popüler destinasyonların ne istediğini anlatıyoruz.",
    body: [
      h("USB nedir, ne değildir"),
      p("Uluslararası sürücü belgesi, ehliyetinizi uluslararası karayolu trafik sözleşmeleri kapsamında tanınan standart bir biçime çevirir. Yalnızca ülkenizden aldığınız tam ehliyetle birlikte geçerlidir ve yalnızca o ehliyetin kapsadığı araç sınıfları için geçerlidir. Seyahatten önce, ehliyetinizi veren ülkede alırsınız."),
      p("Dayandıkları sözleşmelerin adını taşıyan üç sürümü vardır: 1926, 1949 ve 1968. Her ülke taraf olduğu sözleşmelerin sürümünü (veya sürümlerini) kabul eder, yani doğru olanı gideceğiniz yere bağlıdır."),
      h("Popüler destinasyonlar ne istiyor"),
      ul([
        "Avrupa Birliği: AB veya AEA ülkesinden alınmış bir ehliyet tüm AB'de geçerlidir. Başka yerlerden gelenler her ülkeyi ayrı kontrol etmelidir; Birleşik Krallık hükümeti Portekiz, Yunanistan, İtalya ve Hırvatistan'ı 1968 sözleşmesi, İspanya ve Malta'yı 1949 sözleşmesi altında listeliyor.",
        "Japonya: yalnızca 1949 Cenevre Sözleşmesi'ne göre verilmiş kâğıt USB kabul edilir. İsviçre, Almanya, Fransa, Belçika, Monako ve Tayvan ehliyetleri bunun yerine yetkili bir Japonca çeviriyle kullanılır. Varışınızdan sonra bir yıla kadar araç kullanabilirsiniz.",
        "Amerika Birleşik Devletleri: ziyaretçiler genellikle kendi ehliyetleriyle araç kullanabilir, ancak kurallar eyaletten eyalete değişir ve USB gerekebilir (1949 sürümü). Araç kullanacağınız her eyaleti ve kiralama şirketinin kurallarını kontrol edin.",
        "Yeni Zelanda: geçerli bir yabancı ehliyetle sınırlı bir süre araç kullanabilirsiniz; ehliyetiniz İngilizce değilse onaylı bir İngilizce çeviri bulundurun.",
        "Kosta Rika: geçerli bir yerel ehliyet turist olarak kaldığınız süre boyunca, genellikle 90 güne kadar geçerlidir.",
        "Birleşik Arap Emirlikleri: 30'dan fazla ülkeden gelen ziyaretçiler ziyaret vizesiyle kendi ehliyetleriyle araç kullanabilir; diğerlerinin USB'ye ihtiyacı vardır.",
        "Fas: Birleşik Krallık hükümetine göre İngiliz sürücülerin 1968 USB'sine ihtiyacı var ve 1949 sürümü artık kabul edilmiyor.",
        "Tayland ve Endonezya: ziyaretçilerin ehliyetle birlikte USB'ye ihtiyacı vardır ve scooter için ikisinin de motosiklet sınıfını içermesi gerekir. Tayland ve Bali rehberlerimize göz atın."
      ]),
      h("Kiralama şirketleri daha fazlasını isteyebilir"),
      p("Yasa USB istemese bile bir kiralama şirketi isteyebilir; ayrıca asgari yaş veya bir yıl ya da daha fazla sürüş deneyimi de şart koşabilir. Rove'daki bir işletme belge isterse, rezervasyonunuzu onaylarken bunu size bildirir."),
      h("Scooter ve motosikletler"),
      p("Otomobil ehliyeti scooter'ı otomatik olarak kapsamaz. Örneğin Yunanistan'da moped kiralamak için en az A1 sınıfı (hafif motosiklet) gerekir. Doğru ehliyet olmadan sürmek, kazadan sonra seyahat sigortanızın ödeme yapmamasına da yol açabilir.")
    ]
  },
  "car-rental-insurance-explained": {
    title: "Araç kiralama sigortası: CDW, muafiyet ve depozito",
    description: "CDW neyi kapsar, muafiyet nedir, kartınızda neden depozito bloke edilir ve yurt dışında araba veya scooter kiralarken sürpriz masraflardan nasıl kaçınılır.",
    standfirst: "Kiralama sigortası kısaltmalarla dolu. CDW, muafiyet ve depozitonun ne anlama geldiğini ve imzalamadan önce neleri kontrol etmeniz gerektiğini anlatıyoruz.",
    body: [
      h("Üçüncü şahıs sorumluluk sigortası"),
      p("Sorumluluk sigortası başkalarına verdiğiniz hasarı veya yaralanmayı karşılar. AB'de her kiralık araçta bulunması zorunludur ve genellikle fiyata dahildir. BAE'de üçüncü şahıs sigortası yasa gereği dahildir. Meksika'da Meksikalı bir sigortacıdan sorumluluk sigortası zorunludur; ABD veya Kanada poliçeleri orada geçerli değildir."),
      h("CDW (çarpışma hasarı muafiyeti) ve muafiyet tutarı"),
      p("CDW, kiralık aracın kendisi hasar görürse ödeyeceğiniz tutarı sınırlar ama maliyeti nadiren tamamen ortadan kaldırır. Geriye kalan muafiyettir: hasar için ödeyeceğiniz en yüksek tutar. CDW çoğu zaman lastik ve camları kapsamaz, bu yüzden sizinkinin neyi kapsadığını kontrol edin."),
      p("Kiralama şirketleri genellikle muafiyeti düşüren (bazen sıfırlayan) ek güvence satar. Pahalı olabilir. Bağımsız muafiyet sigortası çoğu zaman daha ucuzdur ama önce şirkete ödeme yapar, parayı sonra geri talep edersiniz."),
      h("Depozito"),
      p("Depozito genellikle sürücü adına olan bir kredi kartında yapılan provizyondur. Bloke edildiği sürece bu tutarı harcayamazsınız; araç hasarsız, cezasız ve ödenmemiş geçiş ücreti olmadan döndüğünde serbest bırakılır. Örneğin BAE'de 30 gün içinde serbest bırakılması gerekir. Rove'da her araç, rezervasyondan önce depozitosunu gösterir."),
      h("Sürpriz masraflardan kaçınmak"),
      ul([
        "Yola çıkmadan önce aracın etrafında işletmeyle birlikte dolaşın ve içi dahil her açıdan, yakıt seviyesiyle birlikte fotoğrafını veya videosunu çekin. Her hasarın teslim formuna yazıldığından emin olun.",
        "Yakıt politikasını, varsa kilometre sınırını ve çocuk koltuğu gibi ekstraların fiyatını kontrol edin.",
        "Sözleşmenin, teslim alma ve iade raporlarının kopyalarını saklayın.",
        "Başka bir AB ülkesindeki bir işletmeyle anlaşmazlığınız çözülmezse, ülkenizdeki Avrupa Tüketici Merkezi size ücretsiz yardımcı olabilir."
      ]),
      h("Scooter ve ATV'ler"),
      p("Scooter ve ATV'lerle satılan sigorta çoğu zaman yalnızca üçüncü şahıs sigortasıdır, yani aracın kendisindeki hasarı siz ödersiniz. Birçok seyahat sigortası ATV kullanımını kapsam dışı bırakır ve doğru ehliyet olmadan sürmek teminatınızı geçersiz kılabilir.")
    ]
  },
  "renting-a-car-in-europe": {
    title: "Avrupa'da araba kiralamak: ehliyet, geçiş ücreti, bölgeler",
    description: "Avrupa'da araba kiralamak için gerekenler: ehliyet ve yaş, elektronik geçiş ücretleri, İtalya'nın ZTL bölgeleri, zorunlu ekipman ve sigorta.",
    standfirst: "Avrupa'da kurallar ülkeden ülkeye değişir. Ziyaretçileri en çok şaşırtanlar bunlar.",
    body: [
      h("Ehliyet ve yaş"),
      p("AB veya AEA ülkesinden alınmış bir ehliyet tüm AB'de geçerlidir. Başka bir yerden alınmış ehliyetle, araç kullanacağınız her ülkeyi kontrol edin; bazıları uluslararası sürücü belgesi ister. Portekiz, İspanya, Yunanistan, İtalya ve Hırvatistan'da araba kullanmak için asgari yaş 18'dir, ancak kiralama şirketleri çoğu zaman kendi alt sınırlarını belirler (Malta'da 21 yaygındır) ve 25 yaş altı için daha fazla ücret alabilir."),
      h("Geçiş ücretleri ve şehir bölgeleri"),
      ul([
        "Portekiz: bazı otoyollarda yalnızca elektronik geçiş ücreti alınır. Arabada geçiş cihazı olup olmadığını sorun.",
        "İtalya: birçok şehir merkezi kameralarla denetlenen sınırlı trafik bölgesidir (ZTL). İzinsiz girmek para cezası demektir; ceza çoğu zaman sonradan kiralama şirketi aracılığıyla gelir.",
        "İspanya: bazı şehirlerde düşük emisyon bölgeleri vardır ve Barselona yabancı araçların önceden kayıt yaptırmasını ister."
      ]),
      h("Arabada bulunması gerekenler"),
      p("Hırvatistan'da her arabada reflektör üçgen, ilk yardım çantası ve reflektörlü yelek bulunmalıdır. Teslim alırken arabada olduklarını kontrol edin. Araç kullanırken ehliyetinizi ve kimliğinizi her zaman yanınızda bulundurun; Portekiz'de bu zorunludur."),
      h("Yolda"),
      ul([
        "Malta, Kıbrıs, İrlanda ve Birleşik Krallık dışında her yerde sağdan gidilir.",
        "Portekiz, İspanya ve Yunanistan'da olağan alkol sınırı %0,05'tir (0,5 promil), yeni sürücüler için daha düşüktür.",
        "İspanya'da araç kullanırken telefon kullanmak, yol kenarında durmuşken bile yasaktır ve boyu 1,35 m'nin altındaki çocukların çocuk koltuğu kullanması gerekir."
      ]),
      h("Sigorta"),
      p("Üçüncü şahıs sorumluluk sigortası AB'deki her kiralamaya dahildir. Arabanın kendisindeki hasar genellikle muafiyetli bir CDW ile karşılanır; CDW, muafiyet ve depozito rehberimize bakın.")
    ]
  },
  "renting-a-scooter-in-greece": {
    title: "Yunanistan'da scooter veya ATV kiralamak",
    description: "Yunanistan'da moped, scooter veya ATV kiralamak için gereken ehliyet, kask kuralları ve cezalar, sigorta açıkları ve adalar için güvenlik ipuçları.",
    standfirst: "Yunan adalarında scooter ve ATV her yerde. Ehliyet kuralları birçok ziyaretçinin sandığından daha katı.",
    body: [
      h("Gereken ehliyet"),
      p("Yunanistan'da moped veya scooter kiralamak için en az A1 sınıfı (hafif motosiklet) içeren geçerli bir ehliyet gerekir. Yalnızca otomobil ehliyeti yetmez ve Birleşik Krallık'ın 50 cc'ye kadar mopedler için P sınıfı Yunanistan'da geçerli değildir. Geçici ehliyetler hiçbir araç için geçerli değildir."),
      h("Kask"),
      p("Moped ve ATV'lerde sürücülerin ve yolcuların kask takması zorunludur. Polis sizi kasksız durdurursa para cezası keser ve ehliyetinize el koyar; kasksız sürmek sigortanızı da geçersiz kılabilir."),
      h("ATV'ler: ekstra dikkat"),
      ul([
        "ATV'ler her yıl ağır yaralanmalara ve ölümlere neden oluyor. Sürmeden önce düzgün bir eğitim alın ve yolu daha büyük, daha hızlı araçlarla paylaştığınızı unutmayın.",
        "ATV ile satılan sigorta genellikle yalnızca üçüncü şahıs sigortasıdır: işletme ATV'nin kendisindeki her hasarı büyük olasılıkla size fatura eder.",
        "Birçok seyahat sigortası ATV kullanımını ekstrem spor sayar ve kapsam dışı bırakır. Sürmeden önce poliçenizi okuyun."
      ]),
      h("Yolda"),
      ul([
        "Yunanistan'da sağdan gidilir.",
        "Trafik hızlı ve kaotik olabilir ve sürücüler yaya geçitlerinde her zaman durmaz.",
        "Alkollü araç kullanmak ağır bir suçtur; para cezası ve hapis cezası gerektirebilir."
      ]),
      h("Yola çıkmadan önce"),
      ul([
        "Aracın iyi durumda olduğunu kontrol edin: frenler, lastikler ve farlar.",
        "Mevcut hasarlar dahil, işletmeyle birlikte fotoğrafını çekin; depozito ve iade saatinde anlaşın."
      ])
    ]
  },
  "renting-a-scooter-in-thailand": {
    title: "Tayland'da scooter kiralamak: ehliyet, kask ve sigorta",
    description: "Tayland'da kiralık scooter'ı yasal olarak sürmek için gerekenler: doğru ehliyet ve USB, kask kuralları ve cezalar, depozito ve sigorta.",
    standfirst: "Tayland adalarının çoğunda dolaşmanın en kolay yolu scooter. Yasal olarak sürmek için gerekenleri ve yola çıkmadan önce kontrol etmeniz gerekenleri anlatıyoruz.",
    body: [
      h("Gereken ehliyet"),
      p("Tayland'da ziyaretçi olarak scooter veya motosiklet sürmek için motosikleti kapsayan bir ehliyete ve motosiklet sınıfını gösteren bir uluslararası sürücü belgesine (USB) ihtiyacınız var. Kiralama dükkânı ne derse desin, yalnızca otomobil ehliyeti scooter'ı kapsamaz."),
      p("Tayland hükümeti 1949 Cenevre Sözleşmesi'ne göre verilen USB'leri listeliyor; diğer ASEAN ülkelerinin ehliyetleri de kabul ediliyor. Birleşik Krallık hükümeti İngiliz sürücülere 1968 sürümünü taşımalarını öneriyor. USB'nizi seyahatten önce kendi ülkenizde alın: Tayland'a geldikten sonra alamazsınız."),
      h("Kask yasal zorunluluk, ikiniz için de"),
      p("Kara Trafiği Kanunu'nun (Land Traffic Act) 122. maddesine göre sürücü ve yolcunun ikisi de kask takmalıdır. Polis 2.000 bahta kadar ceza kesebilir ve 1 Haziran 2025'ten itibaren denetimler ülke genelinde sıklaştırıldı. İşletmeden kendiniz ve yanınızdaki kişi için başınıza uyan bir kask isteyin."),
      h("Sigorta: neler kapsanıyor, neler kapsanmıyor"),
      ul([
        "Tescilli her araçta zorunlu trafik sigortası (Por Ror Bor) bulunmalıdır. Yaralanma ve ölüm için ödeme yapar, ancak scooter'daki veya başkasının malındaki hasarı karşılamaz.",
        "İşletmeye scooter'ın başka neye karşı sigortalı olduğunu ve hasar görürse ya da çalınırsa ne ödeyeceğinizi sorun.",
        "Seyahat sigortanızın motosiklet kullanımını kapsadığını kontrol edin. Birçok poliçe yalnızca araca uygun ehliyetiniz varsa ödeme yapar; ehliyetsiz sürmek sizi teminatsız bırakabilir."
      ]),
      h("Depozito"),
      p("Scooter'ı aynı durumda iade ettiğinizde geri verilen bir depozito bırakmayı bekleyin. Pasaportunuzu depozito veya teminat olarak bırakmayın: Birleşik Krallık ve Avustralya hükümetleri buna karşı uyarıyor. Rove'da her araç, rezervasyondan önce depozitosunu gösterir."),
      h("Yola çıkmadan önce"),
      ul([
        "Scooter'ın etrafında işletmeyle birlikte dolaşın ve çizik ile göçükleri fotoğraflayın, böylece kimse sonradan bunlar için tartışmaz.",
        "Frenleri, lastikleri, farları ve kornayı kontrol edin; ruhsat ve sigorta belgelerinin scooter'la birlikte olduğundan emin olun.",
        "Yakıt düzenlemesinde, iade saatinde ve arıza durumunda kimi arayacağınızda anlaşın.",
        "Yola çıkmadan işletmenin telefon veya mesajlaşma numarasını kaydedin."
      ]),
      h("Yolda"),
      ul([
        "Tayland'da soldan gidilir.",
        "Tayland dünyada trafik kazalarında ölüm oranı en yüksek ülkelerden biridir ve en büyük risk motosikletlilerdedir. Savunmacı sürün ve yağmurda ekstra dikkatli olun.",
        "Songkran gibi bayramlar daha fazla trafik ve daha fazla alkol getirir. İçtikten sonra asla araç kullanmayın."
      ])
    ]
  },
  "international-driving-permit-thailand": {
    title: "Tayland için uluslararası sürücü belgesi",
    description: "Tayland'da araba veya scooter kullanmak için uluslararası sürücü belgesi gerekir mi? Hangi türü almalı, nereden alınır ve yanınızda neler olmalı.",
    standfirst: "Ziyaretçilerin çoğunun Tayland'da araç kullanmak için uluslararası sürücü belgesine ihtiyacı var. Hangisi, nereden alınır ve yanınızda neler olmalı.",
    body: [
      h("USB nedir"),
      p("Uluslararası sürücü belgesi, ehliyetinizin uluslararası anlaşmalarla tanınan standart bir biçimdeki çevirisidir. Ehliyetinizin yerini tutmaz; araç kullandığınız her an ikisini birden yanınızda taşırsınız."),
      h("Tayland'da gerekli mi?"),
      p("Evet, Tayland ehliyetiniz veya başka bir ASEAN ülkesinden ehliyetiniz yoksa. Tayland hükümeti 1949 Cenevre Sözleşmesi'ne göre verilen USB'leri listeliyor. Birleşik Krallık hükümeti İngiliz sürücülere Tayland için 1968 sürümünü taşımalarını söylüyor; bu yüzden kendi ehliyet kurumunuza Tayland için hangi türü verdiğini sorun."),
      p("Geçerli bir ehliyetiniz yoksa para cezası alabilirsiniz ve seyahat sigortanız bir kazadan sonra talebinizi reddedebilir. Avustralya hükümeti, doğru ehliyet olmadan araç kullanmanın tutuklanmaya yol açabileceği konusunda uyarıyor."),
      h("Scooter ve motosikletler"),
      p("USB'niz yalnızca ülkenizdeki ehliyetin kapsadığı şeyleri kapsar. Scooter veya motosiklet sürmek için ikisinin de motosiklet sınıfını içermesi gerekir; yalnızca otomobil için olan ehliyet ve USB scooter'ı kapsamaz."),
      h("Nereden alınır"),
      p("USB, ehliyetinizi veren ülkede, seyahatten önce alınır: Tayland'a geldikten sonra alamazsınız. Örneğin Birleşik Krallık'ta USB, PayPoint hizmeti sunan mağazalarda şahsen 5,50 £'a satılır."),
      h("Yanınızda neler olmalı"),
      ul([
        "Ülkenizden aldığınız tam ehliyet (dijital ehliyet kabul edilmeyebilir).",
        "USB'niz.",
        "Pasaportunuz veya bir kopyası ve kiralama şirketinin araçta bıraktığı araç belgeleri."
      ]),
      h("Daha uzun mu kalacaksınız?"),
      p("Tayland'da yaşıyorsanız Tayland ehliyetine başvurabilirsiniz. Tayland hükümeti ayrıca ehliyeti kullanılamayan turistler için İl Kara Ulaştırma Ofisi (Provincial Land Transport Office) tarafından verilen 30 günlük geçici bir ehliyet de tanımlıyor.")
    ]
  },
  "monthly-car-rental-thailand": {
    title: "Tayland'da aylık araba kiralama: nasıl işler",
    description: "Tayland'da aylık araba ve scooter kiralama nasıl işler: günlük fiyatlara göre maliyet, depozito, her ay yenileme ve kontrol etmeniz gerekenler.",
    standfirst: "Bir ay veya daha uzun mu kalıyorsunuz? Yerel bir işletmeden aylık kiralamak, gün gün kiralamaya göre genellikle günlük bazda çok daha ucuzdur.",
    body: [
      h("Neden aylık kiralamalı"),
      p("Tayland'daki yerel kiralama işletmelerinin aylık fiyatı çoğu zaman günlük bazda günlük fiyatlarından çok daha düşüktür, çünkü uzun bir kiralama onlara teslimat, temizlik ve boş günlerden tasarruf sağlar. Üç hafta veya daha uzun kalacaksanız, rezervasyondan önce ikisini karşılaştırın."),
      h("Rove'da nasıl işler"),
      ul([
        "Aylık fiyatları görmek için aramada “Aylık, bitiş tarihi yok” seçeneğini seçin. Bitiş tarihi olmayan aylık kiralama, siz bildirimde bulunana kadar aydan aya devam eder.",
        "Ne zaman ayrılacağınızı biliyorsanız bunun yerine bir bitiş tarihi seçin: Rove, tarihleriniz için işletmenin ücretlendirdiği şekilde hesaplanmış kesin toplamı gösterir.",
        "Rezervasyonunuz doğrudan işletmeye gider. İşletme teslimi sizinle teyit eder ve ödemeyi sayfasında belirtilen koşullarla ona yaparsınız."
      ]),
      h("Depozito"),
      p("Aylık kiralamada normalde bir depozito vardır ve araç aynı durumda döndüğünde iade edilir. Rove'da her araç, rezervasyondan önce depozitosunu gösterir. Pasaportunuzu depozito olarak bırakmayın: resmi seyahat uyarıları buna karşı uyarıyor."),
      h("İmzalamadan önce kontrol edin"),
      ul([
        "Her ayın sonunda ne olur: nasıl ve ne zaman ödeme yaparsınız, bırakmak istediğinizde ne kadar önceden bildirmeniz gerekir.",
        "Aracın neye karşı sigortalı olduğu. Zorunlu trafik sigortası (Por Ror Bor) yalnızca yaralanma ve ölümü kapsar, araçtaki hasarı kapsamaz.",
        "Uzun bir kiralamada bakım ve onarımları kimin ödediği ve araç arızalanırsa ne yapacağınız.",
        "Aracı adanın veya ilin dışına çıkarıp çıkaramayacağınız ve kilometre sınırı olup olmadığı.",
        "Teslimat ve geri almanın dahil olup olmadığı."
      ]),
      h("Ehliyetiniz hâlâ önemli"),
      p("Ziyaretçilerin Tayland'da araç kullanmak için kendi ehliyetlerine ek olarak uluslararası sürücü belgesine ihtiyacı vardır. Tayland'da yaşıyorsanız bunun yerine Tayland ehliyetine başvurabilirsiniz.")
    ]
  },
  "renting-a-scooter-in-bali": {
    title: "Bali'de scooter kiralamak",
    description: "Bali'de scooter kiralayıp sürmek için gerekenler: uluslararası sürücü belgesi, kask, polis denetimleri, sigorta ve turistler için en yeni kurallar.",
    standfirst: "Bali'de scooter her yerde, polis denetimleri de. Yasal ve güvenli sürmek için gerekenler şunlar.",
    body: [
      h("Gereken ehliyet"),
      p("Endonezya'da ülkenizdeki ehliyet tek başına yetmez: uluslararası sürücü belgesine (veya Endonezya ehliyetine) ihtiyacınız var ve bu belge motosikleti kapsamalı. USB'nizi seyahatten önce kendi ülkenizde alın."),
      p("Polis denetim yapıyor. Mayıs 2025'te Canggu, Kuta, Seminyak ve Uluwatu'yu kapsayan Badung'da üç günlük bir operasyonda, 30'u turist olmak üzere 81 sürücüye ceza kesildi ve 56 araca el konuldu."),
      h("Turistler için kurallar değişebilir"),
      p("Bali il yönetimi, kısa süreli kalan turistlerin kendileri sürmek üzere motosiklet kiralamasını yasaklamayı önerdi. Son kontrolümüzde bu bir öneriydi, yürürlükte bir kural değildi. Rezervasyondan önce işletmeye güncel durumu sorun."),
      h("Kask"),
      p("Her sürüşte iyi durumda bir kask takın ve yolcunuzun da kaskı olduğundan emin olun."),
      h("Sigorta"),
      p("Seyahat sigortanızın, sahip olduğunuz ehliyetle Endonezya'da motosiklet kullanımını kapsadığını kontrol edin. Doğru ehliyet olmadan veya kurallara uymadan sürmek, talebinizin reddedilmesine yol açabilir."),
      h("Yolda"),
      ul([
        "Endonezya'da soldan gidilir.",
        "Trafik yoğun ve öngörülemez, özellikle güneyde. Kendinize güvenen bir sürücü değilseniz, şoförlü bir araba size daha uygun olabilir.",
        "Kaza yaparsanız olay yerinde polisi bekleyin ve kazayı bir karakola bildirin.",
        "Bali'nin sessizlik günü Nyepi'de adadaki tüm ulaşım gün boyu durur."
      ]),
      h("Yola çıkmadan önce"),
      ul([
        "Mevcut hasarlar dahil, scooter'ın işletmeyle birlikte fotoğrafını çekin.",
        "Frenleri, lastikleri ve farları kontrol edin; depozito, yakıt ve iade saatinde anlaşın.",
        "İşletmenin telefon veya mesajlaşma numarasını kaydedin."
      ])
    ]
  }
};

export default tr;
