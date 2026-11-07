/** Countries, provinces and towns offered in setup (moved from the old setup screen, 2 Nov 2026). */
export const locationOptions = [
  {
    country: "United States",
    regions: [
      { name: "Florida", towns: ["Miami", "Miami Beach", "Orlando", "Fort Lauderdale", "Tampa", "Key West", "Fort Myers"] },
      { name: "California", towns: ["Los Angeles", "San Diego", "San Francisco", "Santa Monica", "Palm Springs", "Sacramento"] },
      { name: "Hawaii", towns: ["Honolulu", "Waikiki", "Kahului (Maui)", "Lahaina (Maui)", "Kona", "Lihue (Kauai)"] },
      { name: "Nevada", towns: ["Las Vegas", "Reno"] },
      { name: "New York", towns: ["Manhattan", "Brooklyn", "Queens", "JFK Airport"] },
      { name: "Texas", towns: ["Austin", "Houston", "Dallas", "San Antonio"] },
      { name: "Arizona", towns: ["Phoenix", "Scottsdale", "Sedona", "Tucson"] },
      { name: "Colorado", towns: ["Denver", "Boulder", "Aspen"] }
    ]
  },
  {
    country: "Thailand",
    regions: [
      { name: "Bangkok", towns: ["Sukhumvit", "Silom / Sathorn", "Ari", "Ratchada", "Ladprao", "Don Mueang", "Suvarnabhumi"] },
      { name: "Chonburi", towns: ["Pattaya City", "Jomtien", "Na Jomtien", "Bang Lamung", "Sattahip", "Si Racha", "Chonburi City"] },
      { name: "Surat Thani", towns: ["Koh Samui", "Koh Phangan", "Koh Tao", "Donsak", "Surat Thani City", "Khanom"] },
      { name: "Phuket", towns: ["Phuket Town", "Patong", "Rawai", "Chalong", "Kata / Karon", "Kamala", "Thalang", "Mai Khao"] },
      { name: "Chiang Mai", towns: ["Old City", "Nimman", "Mae Rim", "Hang Dong", "San Sai", "Doi Saket", "Chiang Mai Airport"] },
      { name: "Krabi", towns: ["Ao Nang", "Krabi Town", "Koh Lanta", "Railay", "Klong Muang", "Nong Thale"] },
      { name: "Prachuap Khiri Khan", towns: ["Hua Hin", "Pranburi", "Sam Roi Yot", "Prachuap Town"] },
      { name: "Rayong", towns: ["Rayong City", "Ban Phe", "Koh Samet", "Mae Phim"] },
      { name: "Trat", towns: ["Koh Chang", "Trat Town", "Koh Mak", "Koh Kood"] },
      { name: "Satun", towns: ["Koh Lipe", "Pak Bara", "Satun Town"] },
      { name: "Mae Hong Son", towns: ["Pai", "Mae Hong Son Town", "Mae Sariang"] },
      { name: "Ayutthaya", towns: ["Ayutthaya City", "Bang Pa-in"] },
      { name: "Nakhon Ratchasima", towns: ["Korat", "Pak Chong", "Khao Yai"] },
      { name: "Udon Thani", towns: ["Udon Thani City", "Nong Prajak"] },
      { name: "Khon Kaen", towns: ["Khon Kaen City", "Central Khon Kaen"] },
      { name: "Songkhla", towns: ["Hat Yai", "Songkhla City", "Sadao"] },
      { name: "Chiang Rai", towns: ["Chiang Rai City", "Mae Sai", "Chiang Khong"] }
    ]
  },
  {
    country: "Indonesia",
    regions: [
      { name: "Bali", towns: ["Canggu", "Seminyak", "Ubud", "Denpasar", "Kuta", "Sanur", "Nusa Dua", "Uluwatu"] },
      { name: "Jakarta", towns: ["Central Jakarta", "South Jakarta", "North Jakarta", "West Jakarta", "East Jakarta", "Soekarno-Hatta Airport"] },
      { name: "West Java", towns: ["Bandung", "Bogor", "Bekasi", "Depok", "Cirebon"] },
      { name: "Central Java", towns: ["Semarang", "Surakarta", "Magelang"] },
      { name: "East Java", towns: ["Surabaya", "Malang", "Banyuwangi", "Sidoarjo"] },
      { name: "Yogyakarta", towns: ["Yogyakarta City", "Sleman", "Bantul"] },
      { name: "West Nusa Tenggara", towns: ["Mataram", "Senggigi", "Kuta Lombok", "Gili Trawangan"] },
      { name: "Riau Islands", towns: ["Batam", "Bintan", "Tanjung Pinang"] },
      { name: "North Sumatra", towns: ["Medan", "Lake Toba", "Kualanamu Airport"] },
      { name: "South Sulawesi", towns: ["Makassar", "Maros", "Tana Toraja"] }
    ]
  },
  {
    country: "Philippines",
    regions: [
      { name: "Metro Manila", towns: ["Makati", "BGC / Taguig", "Pasay", "Quezon City", "Manila", "Paranaque", "Alabang"] },
      { name: "Cebu", towns: ["Cebu City", "Mactan", "Lapu-Lapu", "Mandaue", "Moalboal", "Oslob", "Bantayan"] },
      { name: "Palawan", towns: ["Puerto Princesa", "El Nido", "Coron", "Port Barton", "San Vicente"] },
      { name: "Aklan", towns: ["Boracay", "Kalibo", "Caticlan"] },
      { name: "Bohol", towns: ["Tagbilaran", "Panglao", "Anda"] },
      { name: "Davao", towns: ["Davao City", "Samal", "Davao Airport"] },
      { name: "Iloilo", towns: ["Iloilo City", "Mandurriao"] },
      { name: "Negros Oriental", towns: ["Dumaguete", "Dauin", "Siquijor Ferry"] },
      { name: "La Union", towns: ["San Juan", "San Fernando"] },
      { name: "Benguet", towns: ["Baguio", "La Trinidad"] }
    ]
  },
  {
    country: "Vietnam",
    regions: [
      { name: "Ho Chi Minh City", towns: ["District 1", "Thao Dien", "District 7", "Tan Binh", "Binh Thanh", "Phu Nhuan"] },
      { name: "Hanoi", towns: ["Hoan Kiem", "Tay Ho", "Ba Dinh", "Cau Giay", "Noi Bai Airport"] },
      { name: "Da Nang", towns: ["My Khe", "Hai Chau", "Son Tra", "Ngu Hanh Son", "Da Nang Airport"] },
      { name: "Khanh Hoa", towns: ["Nha Trang", "Cam Ranh", "Ninh Hoa"] },
      { name: "Quang Nam", towns: ["Hoi An", "An Bang", "Tam Ky"] },
      { name: "Kien Giang", towns: ["Phu Quoc", "Duong Dong", "An Thoi"] },
      { name: "Lam Dong", towns: ["Da Lat", "Lien Khuong Airport"] },
      { name: "Thua Thien Hue", towns: ["Hue City", "Lang Co"] },
      { name: "Binh Thuan", towns: ["Mui Ne", "Phan Thiet"] },
      { name: "Quang Ninh", towns: ["Ha Long", "Van Don"] }
    ]
  },
  {
    country: "Malaysia",
    regions: [
      { name: "Kuala Lumpur", towns: ["KLCC", "Bukit Bintang", "Mont Kiara", "Bangsar", "Cheras"] },
      { name: "Selangor", towns: ["Petaling Jaya", "Subang Jaya", "Shah Alam", "Klang", "Sepang", "Cyberjaya"] },
      { name: "Penang", towns: ["George Town", "Batu Ferringhi", "Bayan Lepas", "Tanjung Tokong", "Butterworth"] },
      { name: "Johor", towns: ["Johor Bahru", "Iskandar Puteri", "Desaru", "Mersing"] },
      { name: "Kedah", towns: ["Langkawi", "Kuah", "Pantai Cenang", "Alor Setar"] },
      { name: "Sabah", towns: ["Kota Kinabalu", "Semporna", "Sandakan", "Tawau"] },
      { name: "Sarawak", towns: ["Kuching", "Miri", "Sibu"] },
      { name: "Melaka", towns: ["Melaka City", "Ayer Keroh"] },
      { name: "Perak", towns: ["Ipoh", "Taiping", "Pangkor"] },
      { name: "Pahang", towns: ["Kuantan", "Genting Highlands", "Cameron Highlands"] }
    ]
  },
  {
    country: "Singapore",
    regions: [
      { name: "Central Region", towns: ["Marina Bay", "Orchard", "Bugis", "Novena", "River Valley", "Tanjong Pagar"] },
      { name: "East Region", towns: ["Changi", "Tampines", "Paya Lebar", "Bedok", "Katong"] },
      { name: "West Region", towns: ["Jurong", "Clementi", "Tuas", "Bukit Batok"] },
      { name: "North Region", towns: ["Woodlands", "Yishun", "Sembawang"] },
      { name: "North-East Region", towns: ["Serangoon", "Punggol", "Hougang", "Sengkang"] }
    ]
  },
  {
    country: "Laos",
    regions: [
      { name: "Vientiane Capital", towns: ["Vientiane Center", "Wattay", "Sikhottabong", "Sisattanak", "Xaysetha"] },
      { name: "Luang Prabang", towns: ["Luang Prabang Town", "Ban Xiengkeo", "Pak Ou"] },
      { name: "Champasak", towns: ["Pakse", "Don Det", "Don Khon", "Champasak Town"] },
      { name: "Vientiane Province", towns: ["Vang Vieng", "Vang Vieng Town", "Phonhong"] },
      { name: "Savannakhet", towns: ["Savannakhet City", "Kaysone Phomvihane"] },
      { name: "Khammouane", towns: ["Thakhek", "Kong Lor"] },
      { name: "Oudomxay", towns: ["Muang Xay"] },
      { name: "Xieng Khouang", towns: ["Phonsavan"] }
    ]
  },
  {
    country: "Cambodia",
    regions: [
      { name: "Phnom Penh", towns: ["BKK1", "Daun Penh", "Toul Kork", "Chamkar Mon", "Sen Sok"] },
      { name: "Siem Reap", towns: ["Siem Reap City", "Old Market", "Sivutha Boulevard", "Angkor Area"] },
      { name: "Sihanoukville", towns: ["Sihanoukville City", "Otres", "Serendipity Beach"] },
      { name: "Kampot", towns: ["Kampot Town", "Kep", "Bokor"] },
      { name: "Battambang", towns: ["Battambang City"] },
      { name: "Koh Kong", towns: ["Koh Kong City", "Koh Rong", "Koh Rong Sanloem"] },
      { name: "Kandal", towns: ["Ta Khmau", "Akreiy Ksatr"] }
    ]
  },
  {
    country: "China",
    regions: [
      { name: "Beijing", towns: ["Chaoyang", "Dongcheng", "Haidian", "Shunyi", "Daxing"] },
      { name: "Shanghai", towns: ["Pudong", "Huangpu", "Jing'an", "Xuhui", "Hongqiao"] },
      { name: "Guangdong", towns: ["Guangzhou", "Shenzhen", "Zhuhai", "Foshan", "Dongguan"] },
      { name: "Hainan", towns: ["Sanya", "Haikou", "Wanning", "Qionghai"] },
      { name: "Yunnan", towns: ["Kunming", "Dali", "Lijiang", "Xishuangbanna"] },
      { name: "Zhejiang", towns: ["Hangzhou", "Ningbo", "Wenzhou"] },
      { name: "Sichuan", towns: ["Chengdu", "Leshan", "Mianyang"] },
      { name: "Fujian", towns: ["Xiamen", "Fuzhou", "Quanzhou"] }
    ]
  },
  {
    country: "Japan",
    regions: [
      { name: "Tokyo", towns: ["Shinjuku", "Shibuya", "Haneda", "Narita", "Ueno", "Roppongi"] },
      { name: "Osaka", towns: ["Namba", "Umeda", "Kansai Airport", "Shin-Osaka"] },
      { name: "Kyoto", towns: ["Kyoto Station", "Gion", "Arashiyama"] },
      { name: "Hokkaido", towns: ["Sapporo", "New Chitose", "Niseko", "Furano", "Hakodate"] },
      { name: "Okinawa", towns: ["Naha", "Chatan", "Ishigaki", "Miyakojima"] },
      { name: "Fukuoka", towns: ["Hakata", "Tenjin", "Fukuoka Airport"] },
      { name: "Aichi", towns: ["Nagoya", "Chubu Centrair"] },
      { name: "Kanagawa", towns: ["Yokohama", "Kamakura", "Hakone"] }
    ]
  },
  {
    country: "Taiwan",
    regions: [
      { name: "Taipei", towns: ["Xinyi", "Zhongshan", "Songshan", "Da'an", "Taipei Main Station"] },
      { name: "New Taipei", towns: ["Banqiao", "Tamsui", "Xindian", "Ruifang"] },
      { name: "Taichung", towns: ["Xitun", "Central District", "Fengjia"] },
      { name: "Kaohsiung", towns: ["Zuoying", "Lingya", "Cianjin", "Kaohsiung Airport"] },
      { name: "Hualien", towns: ["Hualien City", "Taroko"] },
      { name: "Tainan", towns: ["Anping", "West Central District"] },
      { name: "Taoyuan", towns: ["Taoyuan Airport", "Zhongli"] },
      { name: "Yilan", towns: ["Yilan City", "Luodong"] }
    ]
  },
  {
    country: "South Korea",
    regions: [
      { name: "Seoul", towns: ["Gangnam", "Hongdae", "Myeongdong", "Itaewon", "Jongno"] },
      { name: "Busan", towns: ["Haeundae", "Seomyeon", "Nampo", "Gimhae Airport"] },
      { name: "Jeju", towns: ["Jeju City", "Seogwipo", "Aewol", "Jungmun"] },
      { name: "Incheon", towns: ["Incheon Airport", "Songdo", "Bupyeong"] },
      { name: "Gyeonggi", towns: ["Suwon", "Seongnam", "Goyang", "Yongin"] },
      { name: "Gangwon", towns: ["Sokcho", "Gangneung", "Pyeongchang"] },
      { name: "Daegu", towns: ["Daegu City", "Dongseongno"] },
      { name: "Daejeon", towns: ["Daejeon City", "Yuseong"] }
    ]
  },
  {
    country: "Brunei",
    regions: [
      { name: "Brunei-Muara", towns: ["Bandar Seri Begawan", "Gadong", "Jerudong", "Muara", "Berakas"] },
      { name: "Belait", towns: ["Kuala Belait", "Seria", "Lumut"] },
      { name: "Tutong", towns: ["Tutong Town", "Pekan Tutong"] },
      { name: "Temburong", towns: ["Bangar", "Batang Duri"] }
    ]
  },
  {
    country: "India",
    regions: [
      { name: "Delhi NCR", towns: ["New Delhi", "Gurugram", "Noida", "Faridabad", "Ghaziabad"] },
      { name: "Maharashtra", towns: ["Mumbai", "Pune", "Navi Mumbai", "Nagpur"] },
      { name: "Karnataka", towns: ["Bengaluru", "Mysuru", "Mangalore"] },
      { name: "Goa", towns: ["Panaji", "North Goa", "South Goa", "Dabolim Airport"] },
      { name: "Tamil Nadu", towns: ["Chennai", "Coimbatore", "Madurai"] },
      { name: "Kerala", towns: ["Kochi", "Thiruvananthapuram", "Munnar", "Kozhikode"] },
      { name: "Rajasthan", towns: ["Jaipur", "Udaipur", "Jodhpur"] },
      { name: "Gujarat", towns: ["Ahmedabad", "Surat", "Vadodara"] },
      { name: "Uttar Pradesh", towns: ["Lucknow", "Agra", "Varanasi"] },
      { name: "West Bengal", towns: ["Kolkata", "Siliguri"] }
    ]
  },
  {
    country: "Bangladesh",
    regions: [
      { name: "Dhaka", towns: ["Gulshan", "Banani", "Uttara", "Dhanmondi", "Mirpur", "Motijheel"] },
      { name: "Chattogram", towns: ["Chattogram City", "Cox's Bazar", "Patenga"] },
      { name: "Sylhet", towns: ["Sylhet City", "Sreemangal"] },
      { name: "Khulna", towns: ["Khulna City", "Mongla"] },
      { name: "Rajshahi", towns: ["Rajshahi City"] },
      { name: "Barisal", towns: ["Barisal City", "Kuakata"] },
      { name: "Rangpur", towns: ["Rangpur City"] }
    ]
  },
  {
    country: "Sri Lanka",
    regions: [
      { name: "Western Province", towns: ["Colombo", "Negombo", "Mount Lavinia", "Bandaranaike Airport"] },
      { name: "Central Province", towns: ["Kandy", "Nuwara Eliya", "Ella"] },
      { name: "Southern Province", towns: ["Galle", "Mirissa", "Matara", "Unawatuna", "Tangalle"] },
      { name: "Eastern Province", towns: ["Trincomalee", "Arugam Bay", "Batticaloa"] },
      { name: "Northern Province", towns: ["Jaffna", "Mannar"] },
      { name: "North Central Province", towns: ["Anuradhapura", "Polonnaruwa"] },
      { name: "Uva Province", towns: ["Badulla", "Haputale"] }
    ]
  },
  // Europe (3 Nov 2026): the places small rental businesses are most often found. Any town can still be typed.
  {
    country: "United Kingdom",
    regions: [
      { name: "England", towns: ["London", "Manchester", "Birmingham", "Bristol", "Brighton", "Cornwall", "Lake District"] },
      { name: "Scotland", towns: ["Edinburgh", "Glasgow", "Inverness", "Aberdeen"] },
      { name: "Wales", towns: ["Cardiff", "Swansea", "Snowdonia"] },
      { name: "Northern Ireland", towns: ["Belfast", "Derry"] }
    ]
  },
  {
    country: "Ireland",
    regions: [
      { name: "Leinster", towns: ["Dublin", "Dublin Airport", "Kilkenny"] },
      { name: "Munster", towns: ["Cork", "Shannon", "Killarney", "Limerick"] },
      { name: "Connacht", towns: ["Galway", "Knock"] }
    ]
  },
  {
    country: "Spain",
    regions: [
      { name: "Canary Islands", towns: ["Tenerife", "Gran Canaria", "Lanzarote", "Fuerteventura", "La Palma"] },
      { name: "Balearic Islands", towns: ["Mallorca", "Ibiza", "Menorca", "Formentera"] },
      { name: "Andalusia", towns: ["Málaga", "Marbella", "Seville", "Granada"] },
      { name: "Catalonia", towns: ["Barcelona", "Girona", "Costa Brava"] },
      { name: "Valencia", towns: ["Valencia", "Alicante", "Benidorm"] },
      { name: "Madrid", towns: ["Madrid", "Madrid Airport"] }
    ]
  },
  {
    country: "Portugal",
    regions: [
      { name: "Algarve", towns: ["Faro", "Albufeira", "Lagos", "Portimão"] },
      { name: "Lisbon", towns: ["Lisbon", "Cascais", "Sintra"] },
      { name: "Porto", towns: ["Porto"] },
      { name: "Madeira", towns: ["Funchal"] },
      { name: "Azores", towns: ["Ponta Delgada"] }
    ]
  },
  {
    country: "Italy",
    regions: [
      { name: "Sicily", towns: ["Catania", "Palermo", "Taormina"] },
      { name: "Sardinia", towns: ["Cagliari", "Olbia", "Alghero"] },
      { name: "Campania", towns: ["Naples", "Sorrento", "Amalfi Coast"] },
      { name: "Lazio", towns: ["Rome"] },
      { name: "Tuscany", towns: ["Florence", "Pisa"] },
      { name: "Lombardy", towns: ["Milan", "Lake Como"] }
    ]
  },
  {
    country: "Greece",
    regions: [
      { name: "Crete", towns: ["Heraklion", "Chania", "Rethymno"] },
      { name: "South Aegean", towns: ["Rhodes", "Santorini", "Mykonos", "Kos", "Naxos", "Paros"] },
      { name: "Ionian Islands", towns: ["Corfu", "Zakynthos", "Kefalonia", "Lefkada"] },
      { name: "Attica", towns: ["Athens", "Athens Airport"] },
      { name: "Central Macedonia", towns: ["Thessaloniki", "Halkidiki"] }
    ]
  },
  {
    country: "Croatia",
    regions: [
      { name: "Split-Dalmatia", towns: ["Split", "Hvar", "Makarska"] },
      { name: "Dubrovnik-Neretva", towns: ["Dubrovnik", "Korčula"] },
      { name: "Istria", towns: ["Pula", "Rovinj", "Poreč"] },
      { name: "Zagreb", towns: ["Zagreb"] },
      { name: "Zadar", towns: ["Zadar"] }
    ]
  },
  {
    country: "Cyprus",
    regions: [
      { name: "Paphos", towns: ["Paphos", "Coral Bay"] },
      { name: "Larnaca", towns: ["Larnaca", "Ayia Napa", "Protaras"] },
      { name: "Limassol", towns: ["Limassol"] },
      { name: "Nicosia", towns: ["Nicosia"] }
    ]
  },
  {
    country: "Malta",
    regions: [
      { name: "Malta", towns: ["Valletta", "Sliema", "St Julian's", "Mellieħa", "Malta Airport"] },
      { name: "Gozo", towns: ["Victoria", "Mġarr"] }
    ]
  },
  {
    country: "France",
    regions: [
      { name: "Provence-Alpes-Côte d'Azur", towns: ["Nice", "Cannes", "Marseille"] },
      { name: "Corsica", towns: ["Ajaccio", "Bastia", "Porto-Vecchio"] },
      { name: "Île-de-France", towns: ["Paris"] },
      { name: "Occitanie", towns: ["Montpellier", "Toulouse"] }
    ]
  },
  {
    country: "Germany",
    regions: [
      { name: "Bavaria", towns: ["Munich", "Nuremberg"] },
      { name: "Berlin", towns: ["Berlin"] },
      { name: "Hamburg", towns: ["Hamburg"] },
      { name: "Hesse", towns: ["Frankfurt"] }
    ]
  },
  // Türkiye (4 Nov 2026): the coast where small car, scooter, quad and van rental is busiest, plus the two big cities.
  // Regions are provinces (il); "Muğla" covers the Bodrum–Marmaris–Fethiye coast.
  {
    country: "Türkiye",
    regions: [
      { name: "Antalya", towns: ["Antalya", "Antalya Airport", "Alanya", "Side", "Manavgat", "Kemer", "Belek", "Kaş", "Kalkan", "Demre", "Finike"] },
      { name: "Muğla", towns: ["Bodrum", "Marmaris", "Fethiye", "Ölüdeniz", "Göcek", "Dalaman", "Dalaman Airport", "Datça", "Dalyan", "Milas-Bodrum Airport"] },
      { name: "İzmir", towns: ["İzmir", "İzmir Airport", "Çeşme", "Alaçatı", "Urla", "Foça", "Seferihisar"] },
      { name: "Aydın", towns: ["Kuşadası", "Didim", "Aydın"] },
      { name: "İstanbul", towns: ["İstanbul Airport", "Sabiha Gökçen Airport", "Beyoğlu", "Kadıköy", "Şişli", "Fatih", "Beşiktaş"] },
      { name: "Çanakkale", towns: ["Çanakkale", "Bozcaada", "Gökçeada"] },
      { name: "Balıkesir", towns: ["Ayvalık", "Edremit", "Akçay"] },
      { name: "Nevşehir", towns: ["Göreme", "Ürgüp", "Nevşehir"] },
      { name: "Ankara", towns: ["Ankara", "Esenboğa Airport"] },
      { name: "Trabzon", towns: ["Trabzon", "Trabzon Airport"] }
    ]
  }
];

export const currencyOptionsByCountry: Record<string, string[]> = {
  Thailand: ["THB", "USD"],
  Cambodia: ["USD", "KHR", "THB"],
  Laos: ["LAK", "THB", "USD"],
  Vietnam: ["VND", "USD"],
  Indonesia: ["IDR", "USD"],
  Malaysia: ["MYR", "USD"],
  Singapore: ["SGD", "USD"],
  Philippines: ["PHP", "USD"],
  China: ["CNY", "USD"],
  Japan: ["JPY", "USD"],
  Taiwan: ["TWD", "USD"],
  "South Korea": ["KRW", "USD"],
  Brunei: ["BND", "SGD", "USD"],
  India: ["INR", "USD"],
  Bangladesh: ["BDT", "USD"],
  "Sri Lanka": ["LKR", "USD"],
  "United States": ["USD"],
  "United Kingdom": ["GBP", "EUR"],
  Ireland: ["EUR", "GBP"],
  Spain: ["EUR", "GBP"],
  Portugal: ["EUR", "GBP"],
  Italy: ["EUR"],
  Greece: ["EUR"],
  Croatia: ["EUR"],
  Cyprus: ["EUR", "GBP"],
  Malta: ["EUR"],
  France: ["EUR"],
  Germany: ["EUR"],
  // Lira first (the legal currency, and what locals pay in); many coast businesses price tourists in euros or pounds.
  "Türkiye": ["TRY", "EUR", "GBP", "USD"]
};


/** The currency a business in this country normally charges in. */
export function defaultCurrencyForCountry(country: string) {
  return (currencyOptionsByCountry[country] || ["USD"])[0] || "USD";
}

/** Every town listed for a country, with its province, for the "Town or area" suggestions. */
export function townsFor(country: string) {
  const entry = locationOptions.find((option) => option.country === country);
  return (entry?.regions || []).flatMap((region) => region.towns.map((town) => ({ town, region: region.name })));
}
