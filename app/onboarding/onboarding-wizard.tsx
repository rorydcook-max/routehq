"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Car, CheckCircle2, FileSpreadsheet, Languages } from "lucide-react";
import { finishOnboarding, saveBusinessProfile, skipFirstVehicle } from "@/app/actions/onboarding";

type Organization = {
  id: string;
  name: string;
  default_locale: string;
  settings?: Record<string, any>;
};

const locationOptions = [
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
  }
];
const thaiLocationLabels: Record<string, string> = {
  Thailand: "ประเทศไทย",
  Indonesia: "อินโดนีเซีย",
  Philippines: "ฟิลิปปินส์",
  Vietnam: "เวียดนาม",
  Malaysia: "มาเลเซีย",
  Singapore: "สิงคโปร์",
  Laos: "ลาว",
  Cambodia: "กัมพูชา",
  China: "จีน",
  Japan: "ญี่ปุ่น",
  Taiwan: "ไต้หวัน",
  "South Korea": "เกาหลีใต้",
  Brunei: "บรูไน",
  India: "อินเดีย",
  Bangladesh: "บังกลาเทศ",
  "Sri Lanka": "ศรีลังกา",
  Other: "อื่นๆ",
  "Surat Thani": "สุราษฎร์ธานี",
  "Pattaya / Chonburi": "พัทยา / ชลบุรี",
  Phuket: "ภูเก็ต",
  Krabi: "กระบี่",
  "Chiang Mai": "เชียงใหม่",
  Bangkok: "กรุงเทพฯ",
  "Prachuap Khiri Khan": "ประจวบคีรีขันธ์",
  "Mae Hong Son": "แม่ฮ่องสอน",
  Trat: "ตราด",
  Satun: "สตูล",
  Bali: "บาหลี",
  Jakarta: "จาการ์ตา",
  "Kuala Lumpur": "กัวลาลัมเปอร์",
  Penang: "ปีนัง",
  "Ho Chi Minh City": "โฮจิมินห์ซิตี้",
  "Da Nang": "ดานัง",
  "Koh Samui": "เกาะสมุย",
  "Koh Phangan": "เกาะพะงัน",
  "Koh Tao": "เกาะเต่า",
  Donsak: "ดอนสัก",
  "Surat Thani City": "เมืองสุราษฎร์ธานี",
  "Pattaya City": "เมืองพัทยา",
  Jomtien: "จอมเทียน",
  "Na Jomtien": "นาจอมเทียน",
  "Bang Lamung": "บางละมุง",
  Sattahip: "สัตหีบ",
  Patong: "ป่าตอง",
  Rawai: "ราไวย์",
  Chalong: "ฉลอง",
  "Kata / Karon": "กะตะ / กะรน",
  Thalang: "ถลาง",
  "Phuket Town": "เมืองภูเก็ต",
  "Ao Nang": "อ่าวนาง",
  "Krabi Town": "เมืองกระบี่",
  "Koh Lanta": "เกาะลันตา",
  "Old City": "เมืองเก่า",
  Nimman: "นิมมาน",
  "Mae Rim": "แม่ริม",
  "Hang Dong": "หางดง",
  Sukhumvit: "สุขุมวิท",
  "Silom / Sathorn": "สีลม / สาทร",
  "Don Mueang": "ดอนเมือง",
  Suvarnabhumi: "สุวรรณภูมิ",
  "Hua Hin": "หัวหิน",
  Pranburi: "ปราณบุรี",
  Pai: "ปาย",
  "Koh Chang": "เกาะช้าง",
  "Koh Lipe": "เกาะหลีเป๊ะ",
  Canggu: "ชางกู",
  Seminyak: "เซมินยัก",
  Ubud: "อูบุด",
  Denpasar: "เดนปาซาร์",
  Kuta: "กูตา",
  "Central Jakarta": "จาการ์ตากลาง",
  "South Jakarta": "จาการ์ตาใต้",
  "North Jakarta": "จาการ์ตาเหนือ",
  KLCC: "เคแอลซีซี",
  "Bukit Bintang": "บูกิตบินตัง",
  "Mont Kiara": "มอนต์คีอารา",
  "George Town": "จอร์จทาวน์",
  "Batu Ferringhi": "บาตูเฟอร์ริงกี",
  "District 1": "เขต 1",
  "Thao Dien": "เถาเดียน",
  "My Khe": "หมีเค",
  "Hai Chau": "ไห่เจิว"
  ,
  "West Java": "ชวาตะวันตก",
  "East Java": "ชวาตะวันออก",
  Yogyakarta: "ยอกยาการ์ตา",
  Lombok: "ลอมบอก",
  Bandung: "บันดุง",
  Bogor: "โบกอร์",
  Bekasi: "เบกาซี",
  Surabaya: "สุราบายา",
  Malang: "มาลัง",
  "Yogyakarta City": "เมืองยอกยาการ์ตา",
  Sleman: "สเลมัน",
  Mataram: "มาตารัม",
  Senggigi: "เซงกิกี",
  "Kuta Lombok": "กูตาลอมบอก",
  "Metro Manila": "เมโทรมะนิลา",
  Cebu: "เซบู",
  Palawan: "ปาลาวัน",
  Aklan: "อัคลัน",
  Davao: "ดาเวา",
  Makati: "มาคาติ",
  "BGC / Taguig": "บีจีซี / ตากีก",
  Pasay: "ปาไซ",
  "Quezon City": "เกซอนซิตี",
  Manila: "มะนิลา",
  "Cebu City": "เมืองเซบู",
  Mactan: "มักตัน",
  "Lapu-Lapu": "ลาปู-ลาปู",
  Moalboal: "โมอัลโบอัล",
  "Puerto Princesa": "ปูเอร์โตปรินเซซา",
  "El Nido": "เอลนิโด",
  Coron: "โครอน",
  Boracay: "โบราไกย์",
  Kalibo: "คาลิโบ",
  Caticlan: "คาติคลัน",
  "Davao City": "เมืองดาเวา",
  Samal: "ซามัล",
  Hanoi: "ฮานอย",
  "Khanh Hoa": "คั้ญฮว่า",
  "Quang Nam": "กว๋างนาม",
  "Kien Giang": "เกียนซาง",
  "District 7": "เขต 7",
  "Tan Binh": "เตินบิ่ญ",
  "Hoan Kiem": "ฮหว่านเกี๊ยม",
  "Tay Ho": "เตย์โฮ",
  "Ba Dinh": "บาดิ่ญ",
  "Nha Trang": "ญาจาง",
  "Cam Ranh": "กามรัญ",
  "Hoi An": "ฮอยอัน",
  "An Bang": "อันบ่าง",
  "Phu Quoc": "ฟู้โกว๊ก",
  "Duong Dong": "เซืองดง",
  Selangor: "สลังงอร์",
  Johor: "ยะโฮร์",
  Langkawi: "ลังกาวี",
  Sabah: "ซาบาห์",
  "Bayan Lepas": "บายันเลปาส",
  "Petaling Jaya": "เปตาลิงจายา",
  "Subang Jaya": "ซูบังจายา",
  "Shah Alam": "ชาห์อาลัม",
  "Johor Bahru": "ยะโฮร์บาห์รู",
  "Iskandar Puteri": "อิสกันดาร์ปูเตรี",
  Kuah: "กัวห์",
  "Pantai Cenang": "ปันไตเจอนัง",
  "Kota Kinabalu": "โกตากินาบาลู",
  Semporna: "เซมปอร์นา",
  "Central Region": "ภาคกลาง",
  "East Region": "ภาคตะวันออก",
  "West Region": "ภาคตะวันตก",
  "North Region": "ภาคเหนือ",
  "North-East Region": "ภาคตะวันออกเฉียงเหนือ",
  "Marina Bay": "มารีนาเบย์",
  Orchard: "ออร์ชาร์ด",
  Bugis: "บูกิส",
  Novena: "โนเวนา",
  Changi: "ชางงี",
  Tampines: "แทมพินีส์",
  "Paya Lebar": "พายาเลบาร์",
  Jurong: "จูรง",
  Clementi: "เคลเมนตี",
  Tuas: "ตูอัส",
  Woodlands: "วูดแลนด์ส",
  Yishun: "ยีชุน",
  Serangoon: "เซรังกูน",
  Punggol: "ปุงโกล",
  Hougang: "โฮกัง",
  "Vientiane Capital": "นครหลวงเวียงจันทน์",
  "Luang Prabang": "หลวงพระบาง",
  Champasak: "จำปาสัก",
  "Vang Vieng": "วังเวียง",
  "Vientiane Center": "ใจกลางเวียงจันทน์",
  Wattay: "วัดไต",
  Sikhottabong: "สีโคตบอง",
  "Luang Prabang Town": "เมืองหลวงพระบาง",
  "Ban Xiengkeo": "บ้านเชียงแก้ว",
  Pakse: "ปากเซ",
  "Don Det": "ดอนเดด",
  "Vang Vieng Town": "เมืองวังเวียง",
  "Phnom Penh": "พนมเปญ",
  "Siem Reap": "เสียมราฐ",
  Sihanoukville: "สีหนุวิลล์",
  Kampot: "กำปอต",
  BKK1: "บีเคเค 1",
  "Daun Penh": "โดนเปญ",
  "Toul Kork": "ตวลกอก",
  "Siem Reap City": "เมืองเสียมราฐ",
  "Old Market": "ตลาดเก่า",
  "Sihanoukville City": "เมืองสีหนุวิลล์",
  Otres: "โอเตรส",
  "Kampot Town": "เมืองกำปอต",
  Kep: "แกบ",
  Beijing: "ปักกิ่ง",
  Shanghai: "เซี่ยงไฮ้",
  Guangdong: "กวางตุ้ง",
  Hainan: "ไหหลำ",
  Yunnan: "ยูนนาน",
  Chaoyang: "เฉาหยาง",
  Dongcheng: "ตงเฉิง",
  Haidian: "ไห่เตี้ยน",
  Pudong: "ผู่ตง",
  Huangpu: "หวงผู่",
  "Jing'an": "จิ้งอัน",
  Guangzhou: "กว่างโจว",
  Shenzhen: "เซินเจิ้น",
  Zhuhai: "จูไห่",
  Sanya: "ซานย่า",
  Haikou: "ไหโข่ว",
  Kunming: "คุนหมิง",
  Dali: "ต้าหลี่",
  Lijiang: "ลี่เจียง",
  Tokyo: "โตเกียว",
  Osaka: "โอซาก้า",
  Kyoto: "เกียวโต",
  Hokkaido: "ฮอกไกโด",
  Okinawa: "โอกินาวะ",
  Shinjuku: "ชินจูกุ",
  Shibuya: "ชิบูยา",
  Haneda: "ฮาเนดะ",
  Narita: "นาริตะ",
  Namba: "นัมบะ",
  Umeda: "อุเมดะ",
  "Kansai Airport": "สนามบินคันไซ",
  "Kyoto Station": "สถานีเกียวโต",
  Gion: "กิออน",
  Sapporo: "ซัปโปโร",
  "New Chitose": "นิวชิโตเสะ",
  Niseko: "นิเซโกะ",
  Naha: "นาฮะ",
  Chatan: "ชาตัน",
  Ishigaki: "อิชิงากิ",
  Taipei: "ไทเป",
  "New Taipei": "นิวไทเป",
  Taichung: "ไถจง",
  Kaohsiung: "เกาสง",
  Hualien: "ฮวาเหลียน",
  Xinyi: "ซินอี้",
  Zhongshan: "จงซาน",
  Songshan: "ซงซาน",
  Banqiao: "ป่านเฉียว",
  Tamsui: "ตั้นสุ่ย",
  Xitun: "ซีถุน",
  "Central District": "เขตกลาง",
  Zuoying: "จั่วอิ๋ง",
  Lingya: "หลิงยา",
  "Hualien City": "เมืองฮวาเหลียน",
  Taroko: "ทาโรโกะ",
  Seoul: "โซล",
  Busan: "ปูซาน",
  Jeju: "เชจู",
  Incheon: "อินชอน",
  Gyeonggi: "คยองกี",
  Gangnam: "กังนัม",
  Hongdae: "ฮงแด",
  Myeongdong: "เมียงดง",
  Haeundae: "แฮอุนแด",
  Seomyeon: "ซอมยอน",
  "Jeju City": "เมืองเชจู",
  Seogwipo: "ซอกวีโพ",
  "Incheon Airport": "สนามบินอินชอน",
  Songdo: "ซงโด",
  Suwon: "ซูวอน",
  Seongnam: "ซองนัม",
  "Brunei-Muara": "บรูไน-มัวรา",
  Belait: "เบอไลต์",
  Tutong: "ตูตง",
  Temburong: "เต็มบูรง",
  "Bandar Seri Begawan": "บันดาร์เสรีเบกาวัน",
  Gadong: "กาดง",
  Jerudong: "เจอรูดง",
  "Kuala Belait": "กัวลาเบอไลต์",
  Seria: "เซเรีย",
  "Tutong Town": "เมืองตูตง",
  Bangar: "บางาร์",
  "Delhi NCR": "เดลี เอ็นซีอาร์",
  Maharashtra: "มหาราษฏระ",
  Karnataka: "กรณาฏกะ",
  Goa: "กัว",
  "Tamil Nadu": "ทมิฬนาฑู",
  Kerala: "เกรละ",
  "New Delhi": "นิวเดลี",
  Gurugram: "คุรุคราม",
  Noida: "นอยดา",
  Mumbai: "มุมไบ",
  Pune: "ปูเณ่",
  Bengaluru: "เบงกาลูรู",
  Mysuru: "ไมซูรู",
  Panaji: "ปณชี",
  "North Goa": "กัวเหนือ",
  "South Goa": "กัวใต้",
  Chennai: "เจนไน",
  Coimbatore: "โคอิมบาโตร์",
  Kochi: "โคจิ",
  Thiruvananthapuram: "ติรุวนันทปุรัม",
  Dhaka: "ธากา",
  Chattogram: "จิตตะกอง",
  Sylhet: "ซิลเฮต",
  Khulna: "คุลนา",
  Gulshan: "กุลชาน",
  Banani: "บานานี",
  Uttara: "อุตตรา",
  Dhanmondi: "ธันมอนดี",
  "Chattogram City": "เมืองจิตตะกอง",
  "Cox's Bazar": "ค็อกซ์บาซาร์",
  "Sylhet City": "เมืองซิลเฮต",
  "Khulna City": "เมืองคุลนา",
  "Western Province": "จังหวัดตะวันตก",
  "Central Province": "จังหวัดกลาง",
  "Southern Province": "จังหวัดใต้",
  "Eastern Province": "จังหวัดตะวันออก",
  Colombo: "โคลัมโบ",
  Negombo: "เนกอมโบ",
  "Mount Lavinia": "เมาท์ลาวิเนีย",
  Kandy: "แคนดี",
  "Nuwara Eliya": "นูวาราเอลิยา",
  Galle: "กอลล์",
  Mirissa: "มิริสซา",
  Matara: "มาตารา",
  Trincomalee: "ทรินโคมาลี",
  "Arugam Bay": "อารูกัมเบย์"
};
const fleetSizes = ["1-5", "6-15", "16-50", "50+"];

const fieldClass = "mt-1 w-full";
const labelClass = "font-semibold text-[var(--foreground-secondary)]";

const currencyOptionsByCountry: Record<string, string[]> = {
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
  "Sri Lanka": ["LKR", "USD"]
};

function currencyOptionsForCountry(country: string) {
  return currencyOptionsByCountry[country] || ["USD"];
}

function defaultCurrencyForCountry(country: string) {
  return currencyOptionsForCountry(country)[0] || "USD";
}

function formatDateForDisplay(value: string | null | undefined, language: string) {
  const iso = normalizeDateToIso(value);
  if (!iso) return String(value || "");
  const [year, month, day] = iso.split("-");
  const displayYear = language === "th" ? Number(year) + 543 : Number(year);
  return `${day}/${month}/${displayYear}`;
}

function normalizeDateToIso(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]) > 2400 ? Number(isoMatch[1]) - 543 : Number(isoMatch[1]);
    return `${year.toString().padStart(4, "0")}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  }
  const slashMatch = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (slashMatch) {
    let year = Number(slashMatch[3]);
    if (year < 100) year += 2000;
    if (year > 2400) year -= 543;
    return `${year.toString().padStart(4, "0")}-${slashMatch[2].padStart(2, "0")}-${slashMatch[1].padStart(2, "0")}`;
  }
  return raw;
}

// The wizard keeps its own words because the language is chosen on its first screen, before it is saved to the account.
const copy = {
  en: {
    setupTitle: "Set up RouteHQ",
    saving: "Saving…",
    continue: "Continue",
    setupComplete: "All set",
    setupCompleteBody: "Opening your dashboard…",
    step1Title: "Welcome to RouteHQ",
    step1Subtitle: "Three short steps and you are ready to take bookings.",
    businessName: "Business name",
    mainLocation: "Where you are based",
    mainLocationHint: "You can add more locations later.",
    country: "Country",
    region: "Province or region",
    town: "Town or area",
    customCountry: "Type your country",
    customRegion: "Type your province or region",
    customTown: "Type your town or area",
    fleetType: "What you rent out",
    fleetSize: "How many vehicles",
    primaryLanguage: "Language",
    carsOnly: "Cars",
    motorcyclesOnly: "Motorbikes",
    mixedFleet: "Both",
    vehicles: "vehicles",
    english: "English",
    thai: "ภาษาไทย (Thai)",
    step2Title: "Add your first vehicle",
    step2Subtitle: "One is enough to start. You can add the rest any time.",
    addVehicle: "Add a vehicle",
    addVehicleBody: "Photograph the registration book and we fill in the details, or type them in. You come back here afterwards.",
    importVehicles: "Bring in a list",
    importVehiclesBody: "Have your vehicles in a spreadsheet? Add them all at once.",
    addVehiclesLater: "I'll add vehicles later",
    step3Title: "You are ready",
    step3Subtitle: "Here is what happens next.",
    vehicleAdded: (name: string) => `${name} is in your fleet`,
    expiresInDays: (item: string, days: number) => `${item} runs out in ${days} ${days === 1 ? "day" : "days"}`,
    alreadyExpired: (item: string) => `${item} has already run out`,
    nextUpcoming: (item: string, date: string) => `Next date: ${item}, ${date}. We will remind you before then.`,
    remindersTitle: "Reminders before things run out",
    remindersBody: "Tax, insurance and services: RouteHQ tells you before they are due.",
    vehicleLater: "Add your vehicles any time from Fleet.",
    lineTitle: "Get alerts on LINE",
    lineBody: "A morning summary, and an alert when a customer books, pays or is late. Connect LINE from Settings; it takes a minute.",
    finish: "Open my dashboard",
    finishLine: "Finish and connect LINE",
    finishing: "Finishing…",
    profileFailed: "That did not save. Check your connection and try again.",
    finishFailed: "That did not finish. Check your connection and try again.",
    vehicleTax: "Road tax",
    compulsoryInsurance: "Compulsory insurance",
    voluntaryInsurance: "Insurance",
    nextService: "Next service"
  },
  th: {
    setupTitle: "ตั้งค่า RouteHQ",
    saving: "กำลังบันทึก…",
    continue: "ต่อไป",
    setupComplete: "เรียบร้อยแล้ว",
    setupCompleteBody: "กำลังเปิดหน้าหลักของคุณ…",
    step1Title: "ยินดีต้อนรับสู่ RouteHQ",
    step1Subtitle: "อีกแค่สามขั้นตอนสั้น ๆ คุณก็พร้อมรับการจอง",
    businessName: "ชื่อธุรกิจ",
    mainLocation: "ธุรกิจของคุณอยู่ที่ไหน",
    mainLocationHint: "เพิ่มสถานที่อื่นได้ภายหลัง",
    country: "ประเทศ",
    region: "จังหวัดหรือภูมิภาค",
    town: "เมืองหรือย่าน",
    customCountry: "พิมพ์ชื่อประเทศ",
    customRegion: "พิมพ์ชื่อจังหวัดหรือภูมิภาค",
    customTown: "พิมพ์ชื่อเมืองหรือย่าน",
    fleetType: "คุณให้เช่าอะไร",
    fleetSize: "มีรถกี่คัน",
    primaryLanguage: "ภาษา",
    carsOnly: "รถยนต์",
    motorcyclesOnly: "มอเตอร์ไซค์",
    mixedFleet: "ทั้งสองอย่าง",
    vehicles: "คัน",
    english: "English",
    thai: "ภาษาไทย",
    step2Title: "เพิ่มรถคันแรก",
    step2Subtitle: "คันเดียวก็เริ่มได้ ที่เหลือเพิ่มได้ทุกเมื่อ",
    addVehicle: "เพิ่มรถ",
    addVehicleBody: "ถ่ายรูปเล่มทะเบียนแล้วเรากรอกรายละเอียดให้ หรือพิมพ์เองก็ได้ เสร็จแล้วจะกลับมาที่หน้านี้",
    importVehicles: "นำเข้ารายการรถ",
    importVehiclesBody: "มีรายการรถในสเปรดชีตอยู่แล้ว? เพิ่มทั้งหมดได้ในครั้งเดียว",
    addVehiclesLater: "ไว้เพิ่มรถทีหลัง",
    step3Title: "พร้อมใช้งานแล้ว",
    step3Subtitle: "ต่อจากนี้จะเป็นแบบนี้",
    vehicleAdded: (name: string) => `${name} อยู่ในรายการรถของคุณแล้ว`,
    expiresInDays: (item: string, days: number) => `${item}จะหมดอายุในอีก ${days} วัน`,
    alreadyExpired: (item: string) => `${item}หมดอายุแล้ว`,
    nextUpcoming: (item: string, date: string) => `วันถัดไป: ${item} ${date} เราจะเตือนคุณก่อนถึงวันนั้น`,
    remindersTitle: "เตือนก่อนหมดอายุ",
    remindersBody: "ภาษี ประกัน และเช็กระยะ RouteHQ จะบอกคุณก่อนถึงกำหนด",
    vehicleLater: "เพิ่มรถได้ทุกเมื่อจากเมนูรถ",
    lineTitle: "รับการแจ้งเตือนทาง LINE",
    lineBody: "สรุปทุกเช้า และแจ้งเตือนเมื่อลูกค้าจอง จ่ายเงิน หรือคืนรถช้า เชื่อมต่อ LINE ได้ในหน้าตั้งค่า ใช้เวลาประมาณหนึ่งนาที",
    finish: "เปิดหน้าหลักของฉัน",
    finishLine: "เสร็จสิ้นและเชื่อมต่อ LINE",
    finishing: "กำลังดำเนินการ…",
    profileFailed: "บันทึกไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง",
    finishFailed: "ดำเนินการไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง",
    vehicleTax: "ภาษีรถ",
    compulsoryInsurance: "พ.ร.บ.",
    voluntaryInsurance: "ประกันภัย",
    nextService: "เช็กระยะครั้งถัดไป"
  }
};

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const today = new Date();
  const target = new Date(value);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function soonestCompliance(vehicle: any, t: (typeof copy)["en"]) {
  const entries = [
    [t.vehicleTax, vehicle?.compliance?.tax_expiry_date],
    [t.compulsoryInsurance, vehicle?.compliance?.porbor_expiry_date],
    [t.voluntaryInsurance, vehicle?.compliance?.insurance_expiry_date],
    [t.nextService, vehicle?.compliance?.next_service_date]
  ]
    .map(([label, date]) => ({ label, date, days: daysUntil(date as string) }))
    .filter((entry) => entry.days !== null)
    .sort((a, b) => Number(a.days) - Number(b.days));

  return entries[0] || null;
}

function countryOption(country: string) {
  return locationOptions.find((option) => option.country === country) || locationOptions[0];
}

function regionOptions(country: string) {
  const regions = countryOption(country).regions;
  return regions.some((region) => region.name === "Other") ? regions : [...regions, { name: "Other", towns: ["Other"] }];
}

function townOptions(country: string, region: string) {
  const towns = regionOptions(country).find((option) => option.name === region)?.towns || regionOptions(country)[0]?.towns || [];
  return towns.includes("Other") ? towns : [...towns, "Other"];
}

function mainLocationLabel(country: string, region: string, town: string) {
  return [town, region, country].filter(Boolean).join(", ");
}

function localizedLocationLabel(value: string, language: string) {
  return language === "th" ? thaiLocationLabels[value] || value : value;
}

type FirstVehicle = { make: string; model: string; registrationNumber: string; compliance?: Record<string, string | null> | null };

/**
 * First-time setup: the business, a first vehicle, then the dashboard.
 *
 * The vehicle itself is added on the normal Add vehicle screen (one form to
 * keep right, with the registration book reader). Until setup is finished the
 * app sends the person back here, and the page picks up at the right step.
 */
export function OnboardingWizard({
  organization,
  initialStep = 1,
  initialLanguage,
  firstVehicle = null
}: {
  organization: Organization;
  initialStep?: number;
  initialLanguage?: string;
  firstVehicle?: FirstVehicle | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [vehicleSkipped, setVehicleSkipped] = useState(false);
  const vehicle = firstVehicle;
  const savedLocation = organization.settings?.main_location || {};
  const [profile, setProfile] = useState({
    businessName: organization.name || "",
    country: savedLocation.country || "Thailand",
    region: savedLocation.region || "Surat Thani",
    town: savedLocation.town || organization.settings?.location || "Koh Samui",
    customCountry: "",
    customRegion: "",
    customTown: "",
    fleetType: organization.settings?.fleet_type || "mixed",
    fleetSize: organization.settings?.fleet_size || "1-5",
    language: initialLanguage || organization.default_locale || "en"
  });

  const selectedCountry = profile.country === "Other" ? profile.customCountry : profile.country;
  const selectedRegion = profile.region === "Other" ? profile.customRegion : profile.region;
  const selectedTown = profile.town === "Other" ? profile.customTown : profile.town;
  const locationValue = mainLocationLabel(selectedCountry, selectedRegion, selectedTown);
  const t = copy[profile.language === "th" ? "th" : "en"];
  const currentRegions = regionOptions(profile.country);
  const currentTowns = townOptions(profile.country, profile.region);
  const fleetTypeOptions = [
    { value: "cars", label: t.carsOnly },
    { value: "motorcycles", label: t.motorcyclesOnly },
    { value: "mixed", label: t.mixedFleet }
  ];
  const fleetSizeOptions = fleetSizes.map((size) => ({ value: size, label: `${size} ${t.vehicles}` }));
  const languageOptions = [
    { value: "en", label: t.english },
    { value: "th", label: t.thai }
  ];
  const compliance = useMemo(() => soonestCompliance(vehicle, t), [vehicle, t]);
  const vehicleName = vehicle ? [vehicle.registrationNumber, vehicle.make, vehicle.model].filter(Boolean).join(" ") : "";

  function submitBusinessProfile() {
    setError("");
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("organizationId", organization.id);
        formData.set("businessName", profile.businessName);
        formData.set("location", locationValue);
        formData.set("country", selectedCountry);
        formData.set("region", selectedRegion);
        formData.set("town", selectedTown);
        formData.set("fleetType", profile.fleetType);
        formData.set("fleetSize", profile.fleetSize);
        formData.set("language", profile.language);
        formData.set("currency", defaultCurrencyForCountry(selectedCountry));
        await saveBusinessProfile(formData);
        setStep(vehicle ? 3 : 2);
      } catch {
        setError(t.profileFailed);
      }
    });
  }

  function skipVehicle() {
    setError("");
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("organizationId", organization.id);
        await skipFirstVehicle(formData);
        setVehicleSkipped(true);
        setStep(3);
      } catch {
        setError(t.profileFailed);
      }
    });
  }

  function complete(destination: string) {
    setError("");
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("organizationId", organization.id);
        formData.set("lineId", "");
        formData.set("lineConnected", "false");
        await finishOnboarding(formData);
        setSuccess(true);
        setTimeout(() => router.push(destination as never), 1500);
      } catch {
        setError(t.finishFailed);
      }
    });
  }

  const tileClass = "rounded-xl bg-[var(--panel-secondary)] p-3.5";

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-5 text-[var(--foreground)]">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-xl flex-col">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-[22px] font-bold">{t.setupTitle}</h1>
          <div aria-hidden="true" className="flex gap-2">
            {[1, 2, 3].map((entry) => (
              <span className={`h-3 w-3 rounded-full ${entry <= step ? "bg-[var(--primary)]" : "bg-[var(--border-strong)]"}`} key={entry} />
            ))}
          </div>
        </header>

        <section className="card flex-1 p-4 sm:p-7">
          {success ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
              <div className="success-pop flex h-24 w-24 items-center justify-center rounded-full bg-[var(--success-light)] text-[var(--success)]">
                <CheckCircle2 size={52} />
              </div>
              <h2 className="mt-5 text-[26px] font-bold">{t.setupComplete}</h2>
              <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{t.setupCompleteBody}</p>
            </div>
          ) : null}

          {!success && step === 1 ? (
            <div>
              <StepTitle icon={Languages} subtitle={t.step1Subtitle} title={t.step1Title} />
              <div className="mt-5 grid gap-4">
                <ChoiceGrid label={t.primaryLanguage} onChange={(language) => setProfile({ ...profile, language })} options={languageOptions} value={profile.language} />
                <label className="block">
                  <span className={labelClass}>{t.businessName}</span>
                  <input className={fieldClass} maxLength={120} onChange={(event) => setProfile({ ...profile, businessName: event.target.value })} required value={profile.businessName} />
                </label>
                <div className={tileClass}>
                  <p className="text-[16px] font-bold text-[var(--foreground)]">{t.mainLocation}</p>
                  <p className="font-medium text-[var(--foreground-secondary)]">{t.mainLocationHint}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="block">
                      <span className={labelClass}>{t.country}</span>
                      <select
                        className={fieldClass}
                        onChange={(event) => {
                          const nextCountry = event.target.value;
                          const nextRegion = regionOptions(nextCountry)[0]?.name || "Other";
                          const nextTown = townOptions(nextCountry, nextRegion)[0] || "Other";
                          setProfile({ ...profile, country: nextCountry, region: nextRegion, town: nextTown });
                        }}
                        value={profile.country}
                      >
                        {locationOptions.map((option) => (
                          <option key={option.country} value={option.country}>
                            {localizedLocationLabel(option.country, profile.language)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className={labelClass}>{t.region}</span>
                      <select
                        className={fieldClass}
                        onChange={(event) => {
                          const nextRegion = event.target.value;
                          const nextTown = townOptions(profile.country, nextRegion)[0] || "Other";
                          setProfile({ ...profile, region: nextRegion, town: nextTown });
                        }}
                        value={profile.region}
                      >
                        {currentRegions.map((region) => (
                          <option key={region.name} value={region.name}>
                            {localizedLocationLabel(region.name, profile.language)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className={labelClass}>{t.town}</span>
                      <select className={fieldClass} onChange={(event) => setProfile({ ...profile, town: event.target.value })} value={profile.town}>
                        {currentTowns.map((town) => (
                          <option key={town} value={town}>
                            {localizedLocationLabel(town, profile.language)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {profile.country === "Other" || profile.region === "Other" || profile.town === "Other" ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      {profile.country === "Other" ? <input aria-label={t.customCountry} className="w-full" onChange={(event) => setProfile({ ...profile, customCountry: event.target.value })} placeholder={t.customCountry} value={profile.customCountry} /> : null}
                      {profile.region === "Other" ? <input aria-label={t.customRegion} className="w-full" onChange={(event) => setProfile({ ...profile, customRegion: event.target.value })} placeholder={t.customRegion} value={profile.customRegion} /> : null}
                      {profile.town === "Other" ? <input aria-label={t.customTown} className="w-full" onChange={(event) => setProfile({ ...profile, customTown: event.target.value })} placeholder={t.customTown} value={profile.customTown} /> : null}
                    </div>
                  ) : null}
                </div>
                <ChoiceGrid label={t.fleetType} onChange={(fleetType) => setProfile({ ...profile, fleetType })} options={fleetTypeOptions} value={profile.fleetType} />
                <ChoiceGrid label={t.fleetSize} onChange={(fleetSize) => setProfile({ ...profile, fleetSize })} options={fleetSizeOptions} value={profile.fleetSize} />
              </div>
              <FooterActions error={error} onPrimary={submitBusinessProfile} pending={isPending || profile.businessName.trim().length < 2} primaryLabel={t.continue} savingLabel={isPending ? t.saving : t.continue} />
            </div>
          ) : null}

          {!success && step === 2 ? (
            <div>
              <StepTitle icon={Car} subtitle={t.step2Subtitle} title={t.step2Title} />
              <div className="mt-5 grid gap-2">
                <a className="pressable flex items-start gap-3 rounded-xl bg-[var(--primary)] p-4 text-white" href="/fleet/new">
                  <Camera className="mt-0.5 shrink-0" size={26} />
                  <span>
                    <span className="block text-[17px] font-bold">{t.addVehicle}</span>
                    <span className="block font-medium text-white/90">{t.addVehicleBody}</span>
                  </span>
                </a>
                <a className={`pressable flex items-start gap-3 ${tileClass}`} href="/fleet/import?from=onboarding">
                  <FileSpreadsheet className="mt-0.5 shrink-0 text-[var(--primary)]" size={26} />
                  <span>
                    <span className="block text-[17px] font-bold text-[var(--foreground)]">{t.importVehicles}</span>
                    <span className="block font-medium text-[var(--foreground-secondary)]">{t.importVehiclesBody}</span>
                  </span>
                </a>
              </div>
              {error ? <p className="mt-4 rounded-xl bg-[var(--warning-light)] p-3 font-semibold text-[var(--foreground)]">{error}</p> : null}
              <button className="secondary-action pressable mt-4 w-full" disabled={isPending} onClick={skipVehicle} type="button">
                {isPending ? t.saving : t.addVehiclesLater}
              </button>
            </div>
          ) : null}

          {!success && step === 3 ? (
            <div>
              <StepTitle icon={CheckCircle2} subtitle={t.step3Subtitle} title={t.step3Title} />
              <div className="mt-5 space-y-2">
                {vehicle ? (
                  <div className={tileClass}>
                    <p className="text-[16px] font-bold text-[var(--foreground)]">{t.vehicleAdded(vehicleName)}</p>
                  </div>
                ) : null}
                <div className={tileClass}>
                  <p className="text-[16px] font-bold text-[var(--foreground)]">
                    {vehicle && compliance && Number(compliance.days) < 0
                      ? t.alreadyExpired(compliance.label)
                      : vehicle && compliance && Number(compliance.days) <= 60
                        ? t.expiresInDays(compliance.label, Number(compliance.days))
                        : t.remindersTitle}
                  </p>
                  <p className="font-medium text-[var(--foreground-secondary)]">
                    {vehicle && compliance && Number(compliance.days) >= 0 ? t.nextUpcoming(compliance.label, formatDateForDisplay(String(compliance.date), profile.language)) : t.remindersBody}
                  </p>
                </div>
                {vehicleSkipped || !vehicle ? (
                  <div className={tileClass}>
                    <p className="font-medium text-[var(--foreground-secondary)]">{t.vehicleLater}</p>
                  </div>
                ) : null}
                {/* LINE is connected properly from Settings. This step used to show a made-up QR code and a button that claimed LINE was connected. */}
                <div className={tileClass}>
                  <p className="text-[16px] font-bold text-[var(--foreground)]">{t.lineTitle}</p>
                  <p className="font-medium text-[var(--foreground-secondary)]">{t.lineBody}</p>
                </div>
              </div>
              {error ? <p className="mt-4 rounded-xl bg-[var(--warning-light)] p-3 font-semibold text-[var(--foreground)]">{error}</p> : null}
              <div className="mt-5 grid gap-2">
                <button className="primary-action pressable w-full" disabled={isPending} onClick={() => complete("/")} type="button">
                  {isPending ? t.finishing : t.finish}
                </button>
                <button className="secondary-action pressable w-full" disabled={isPending} onClick={() => complete("/settings?tab=notifications")} type="button">
                  {t.finishLine}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function StepTitle({ icon: Icon, title, subtitle }: { icon: typeof Car; title: string; subtitle: string }) {
  return (
    <div>
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
        <Icon size={24} />
      </span>
      <h2 className="mt-3 text-[26px] font-bold leading-tight text-[var(--foreground)]">{title}</h2>
      <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{subtitle}</p>
    </div>
  );
}

function ChoiceGrid({ label, options, value, onChange }: { label: string; options: Array<{ value: string; label: string }>; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            aria-pressed={value === option.value}
            className={`pressable min-h-11 rounded-full px-4 font-bold ${value === option.value ? "bg-[var(--primary)] text-white" : "bg-[var(--panel-secondary)] text-[var(--foreground)]"}`}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function FooterActions({ error, onPrimary, pending, primaryLabel, savingLabel }: { error: string; onPrimary: () => void; pending: boolean; primaryLabel: string; savingLabel: string }) {
  return (
    <div className="mt-5">
      {error ? <p className="mb-3 rounded-xl bg-[var(--warning-light)] p-3 font-semibold text-[var(--foreground)]">{error}</p> : null}
      <button className="primary-action pressable w-full" disabled={pending} onClick={onPrimary} type="button">
        {pending ? savingLabel : primaryLabel}
      </button>
    </div>
  );
}
