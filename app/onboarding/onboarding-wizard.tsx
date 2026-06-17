"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Camera, Car, CheckCircle2, FileSpreadsheet, ImagePlus, Languages, LineChart, MapPin, ScanLine, X } from "lucide-react";
import { createOnboardingVehicle, finishOnboarding, saveBusinessProfile, skipFirstVehicle } from "@/app/actions/onboarding";
import { fetchVehicleMakesForCategory, fetchVehicleModels, fetchVehicleTrims, type VehicleMake, type VehicleModel, type VehicleTrim } from "@/lib/vehicle-catalog-db";

type Category = {
  id: string;
  code: string;
  name: string;
};

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

const fieldClass = "mt-1 w-full rounded-lg border border-[#cfe2de] bg-white px-3 text-[13px] font-semibold text-[#10252b] outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15";

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

const colorTranslations: Record<string, { en: string; th: string }> = {
  black: { en: "Black", th: "สีดำ" },
  blue: { en: "Blue", th: "สีน้ำเงิน" },
  bronze: { en: "Bronze", th: "สีบรอนซ์" },
  brown: { en: "Brown", th: "สีน้ำตาล" },
  gold: { en: "Gold", th: "สีทอง" },
  gray: { en: "Gray", th: "สีเทา" },
  grey: { en: "Gray", th: "สีเทา" },
  green: { en: "Green", th: "สีเขียว" },
  orange: { en: "Orange", th: "สีส้ม" },
  pink: { en: "Pink", th: "สีชมพู" },
  purple: { en: "Purple", th: "สีม่วง" },
  red: { en: "Red", th: "สีแดง" },
  silver: { en: "Silver", th: "สีเงิน" },
  white: { en: "White", th: "สีขาว" },
  yellow: { en: "Yellow", th: "สีเหลือง" },
  "ดำ": { en: "Black", th: "สีดำ" },
  "น้ำเงิน": { en: "Blue", th: "สีน้ำเงิน" },
  "ฟ้า": { en: "Light Blue", th: "สีฟ้า" },
  "น้ำตาล": { en: "Brown", th: "สีน้ำตาล" },
  "ทอง": { en: "Gold", th: "สีทอง" },
  "เทา": { en: "Gray", th: "สีเทา" },
  "เขียว": { en: "Green", th: "สีเขียว" },
  "ส้ม": { en: "Orange", th: "สีส้ม" },
  "ชมพู": { en: "Pink", th: "สีชมพู" },
  "ม่วง": { en: "Purple", th: "สีม่วง" },
  "แดง": { en: "Red", th: "สีแดง" },
  "เงิน": { en: "Silver", th: "สีเงิน" },
  "ขาว": { en: "White", th: "สีขาว" },
  "เหลือง": { en: "Yellow", th: "สีเหลือง" }
};

function currencyOptionsForCountry(country: string) {
  return currencyOptionsByCountry[country] || ["USD"];
}

function defaultCurrencyForCountry(country: string) {
  return currencyOptionsForCountry(country)[0] || "USD";
}

function normalizeColor(value: string | null | undefined, language: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const normalized = raw.toLowerCase().replace(/^สี/, "").trim();
  const direct = colorTranslations[normalized] || colorTranslations[raw];
  if (direct) return language === "th" ? direct.th : direct.en;
  const foundKey = Object.keys(colorTranslations).find((key) => raw.includes(key));
  const found = foundKey ? colorTranslations[foundKey] : null;
  return found ? (language === "th" ? found.th : found.en) : raw;
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

const copy = {
  en: {
    setupEyebrow: "FleetOS setup",
    setupTitle: "Get operational in minutes",
    saving: "Saving...",
    continue: "Continue",
    setupComplete: "Setup complete",
    setupCompleteBody: "Your FleetOS account is ready. Opening your dashboard now.",
    step1Title: "Welcome to FleetOS",
    step1Subtitle: "Let's set up your account in a few steps",
    businessName: "Business name",
    mainLocation: "Main location",
    mainLocationHint: "This becomes your default main branch. You can add more locations later.",
    country: "Country",
    region: "Province / region",
    town: "Town / subdistrict",
    customCountry: "Enter country",
    customRegion: "Enter province, state, or region",
    customTown: "Enter town or subdistrict",
    fleetType: "Fleet type",
    fleetSize: "Approximate fleet size",
    primaryLanguage: "Primary language",
    carsOnly: "Cars only",
    motorcyclesOnly: "Motorcycles only",
    mixedFleet: "Mixed fleet",
    vehicles: "vehicles",
    english: "English",
    thai: "ภาษาไทย (Thai)",
    step2Title: "Add your first vehicle",
    step2Subtitle: "Scan your Registration Book for the fastest setup",
    scanBlueBook: "Scan Registration Book",
    scanBlueBookBody: "Take a photo of your vehicle registration book. We'll read it automatically.",
    uploadPhotos: "Upload vehicle photos",
    uploadPhotosBody: "Optional, but useful for your fleet profile.",
    photosSelected: (count: number) => `${count} photo${count === 1 ? "" : "s"} selected`,
    importVehicles: "Import vehicles",
    importVehiclesBody: "Use the smart importer for CSV, Excel, or Google Sheets.",
    enterManually: "Enter manually",
    enterManuallyBody: "Fill in the details yourself below.",
    readingBlueBook: "Reading Registration Book...",
    renewalHelp: "These dates help FleetOS remind you before renewals are due.",
    confirmVehicle: "Confirm and add vehicle",
    addVehiclesLater: "I'll add vehicles later",
    step3Title: "See your first alert",
    step3Subtitle: "FleetOS turns dates into operational reminders",
    attentionSoon: "Attention soon",
    complianceGood: "Compliance looks good",
    expiresInDays: (item: string, days: number) => `${item} expires in ${days} days`,
    allComplianceGood: (vehicleName: string) => `All compliance looks good for your ${vehicleName}`,
    nextUpcoming: (item: string, date: string) => `Next upcoming date: ${item} on ${date}`,
    sampleAlert: "Sample alert",
    sampleAlertTitle: "Vehicle tax expires in 24 days",
    sampleAlertBody: "Once you add your vehicles, FleetOS tracks all renewal dates and alerts you before they expire.",
    vehicleLater: "You can add your first vehicle from the Fleet page after setup.",
    alertSchedule: "FleetOS will alert you 1 month, 2 weeks, and 1 week before any expiry by notification and LINE message.",
    step4Title: "Get daily updates on LINE",
    step4Subtitle: "Most operators find this the most useful feature",
    lineBenefits: [
      "Daily morning summary - active rentals, returns due, payments expected",
      "Instant alerts - compliance expiring, GPS offline, overdue returns",
      "Payment reminders - automatically sent to your customers"
    ],
    lineId: "Or enter your LINE ID",
    scanLine: "Scan with your LINE app to connect",
    connectedLine: "I've connected LINE",
    skipNow: "Skip for now",
    finishing: "Finishing...",
    ocrFailed: "OCR failed.",
    scanFailed: "Unable to scan Registration Book.",
    profileFailed: "Unable to save business profile.",
    vehicleFailed: "Unable to create vehicle.",
    finishFailed: "Unable to finish onboarding.",
    vehicleTax: "Vehicle tax",
    compulsoryInsurance: "Compulsory insurance",
    voluntaryInsurance: "Voluntary insurance",
    nextService: "Next service",
    fields: {
      category: "Vehicle category",
      vin: "VIN / frame number",
      make: "Make",
      model: "Model",
      trim: "Trim",
      year: "Year",
      registration: "Registration number",
      color: "Colour",
      mileage: "Current mileage",
      currency: "Currency",
      rate: "Rate",
      dailyRate: "Daily rental rate",
      weeklyRate: "Weekly rental rate",
      monthlyRate: "Monthly rental rate",
      dailyShort: "Daily",
      weeklyShort: "Weekly",
      monthlyShort: "Monthly",
      taxExpiry: "Tax expiry",
      porborExpiry: "Compulsory insurance expiry",
      insuranceExpiry: "Voluntary insurance expiry",
      nextService: "Next service due",
      transmission: "Transmission",
      fuelType: "Fuel type",
      engineCc: "Engine CC",
      seating: "Seating capacity"
    }
  },
  th: {
    setupEyebrow: "ตั้งค่า FleetOS",
    setupTitle: "เริ่มใช้งานได้ในไม่กี่นาที",
    saving: "กำลังบันทึก...",
    continue: "ดำเนินการต่อ",
    setupComplete: "ตั้งค่าเสร็จแล้ว",
    setupCompleteBody: "บัญชี FleetOS ของคุณพร้อมใช้งานแล้ว กำลังเปิดแดชบอร์ด",
    step1Title: "ยินดีต้อนรับสู่ FleetOS",
    step1Subtitle: "มาตั้งค่าบัญชีของคุณในไม่กี่ขั้นตอน",
    businessName: "ชื่อธุรกิจ",
    mainLocation: "สถานที่หลัก",
    mainLocationHint: "ส่วนนี้จะเป็นสาขาหลักเริ่มต้น คุณสามารถเพิ่มสถานที่อื่นได้ภายหลัง",
    country: "ประเทศ",
    region: "จังหวัด / ภูมิภาค",
    town: "เมือง / ตำบล",
    customCountry: "ระบุประเทศ",
    customRegion: "ระบุจังหวัด รัฐ หรือภูมิภาค",
    customTown: "ระบุเมืองหรือตำบล",
    fleetType: "ประเภทยานพาหนะ",
    fleetSize: "ขนาดกองยานโดยประมาณ",
    primaryLanguage: "ภาษาหลัก",
    carsOnly: "รถยนต์เท่านั้น",
    motorcyclesOnly: "มอเตอร์ไซค์เท่านั้น",
    mixedFleet: "กองยานผสม",
    vehicles: "คัน",
    english: "English",
    thai: "ภาษาไทย",
    step2Title: "เพิ่มรถคันแรก",
    step2Subtitle: "สแกนเล่มทะเบียนเพื่อเริ่มต้นได้เร็วที่สุด",
    scanBlueBook: "สแกนเล่มทะเบียน",
    scanBlueBookBody: "ถ่ายรูปสมุดทะเบียนรถ แล้วระบบจะอ่านข้อมูลให้อัตโนมัติ",
    uploadPhotos: "Upload vehicle photos",
    uploadPhotosBody: "Optional, but useful for your fleet profile.",
    photosSelected: (count: number) => `${count} photos selected`,
    importVehicles: "Import vehicles",
    importVehiclesBody: "Use the smart importer for CSV, Excel, or Google Sheets.",
    enterManually: "กรอกเอง",
    enterManuallyBody: "กรอกรายละเอียดรถด้วยตัวเองด้านล่าง",
    readingBlueBook: "กำลังอ่านเล่มทะเบียน...",
    renewalHelp: "วันที่เหล่านี้ช่วยให้ FleetOS แจ้งเตือนคุณก่อนถึงกำหนดต่ออายุ",
    confirmVehicle: "ยืนยันและเพิ่มรถ",
    addVehiclesLater: "ฉันจะเพิ่มรถภายหลัง",
    step3Title: "ดูการแจ้งเตือนแรกของคุณ",
    step3Subtitle: "FleetOS เปลี่ยนวันหมดอายุให้เป็นการแจ้งเตือนที่ใช้งานได้จริง",
    attentionSoon: "ใกล้ถึงกำหนด",
    complianceGood: "ข้อมูลต่ออายุเรียบร้อย",
    expiresInDays: (item: string, days: number) => `${item} จะหมดอายุใน ${days} วัน`,
    allComplianceGood: (vehicleName: string) => `ข้อมูลต่ออายุของ ${vehicleName} เรียบร้อยดี`,
    nextUpcoming: (item: string, date: string) => `รายการถัดไป: ${item} วันที่ ${date}`,
    sampleAlert: "ตัวอย่างการแจ้งเตือน",
    sampleAlertTitle: "ภาษีรถจะหมดอายุใน 24 วัน",
    sampleAlertBody: "เมื่อคุณเพิ่มรถ FleetOS จะติดตามวันต่ออายุทั้งหมดและแจ้งเตือนก่อนหมดอายุ",
    vehicleLater: "คุณสามารถเพิ่มรถคันแรกได้จากหน้า Fleet หลังตั้งค่าเสร็จ",
    alertSchedule: "FleetOS จะแจ้งเตือนก่อนหมดอายุ 1 เดือน, 2 สัปดาห์ และ 1 สัปดาห์ ผ่านการแจ้งเตือนและ LINE",
    step4Title: "รับอัปเดตประจำวันทาง LINE",
    step4Subtitle: "ผู้ประกอบการส่วนใหญ่พบว่านี่เป็นฟีเจอร์ที่มีประโยชน์มาก",
    lineBenefits: [
      "สรุปตอนเช้า - รถที่กำลังเช่า, รถที่ต้องคืน, ยอดเงินที่คาดว่าจะได้รับ",
      "แจ้งเตือนทันที - ต่ออายุใกล้หมด, GPS ออฟไลน์, คืนรถเกินกำหนด",
      "เตือนชำระเงิน - ส่งเตือนลูกค้าอัตโนมัติ"
    ],
    lineId: "หรือกรอก LINE ID ของคุณ",
    scanLine: "สแกนด้วยแอป LINE เพื่อเชื่อมต่อ",
    connectedLine: "ฉันเชื่อมต่อ LINE แล้ว",
    skipNow: "ข้ามตอนนี้",
    finishing: "กำลังเสร็จสิ้น...",
    ocrFailed: "อ่านเอกสารไม่สำเร็จ",
    scanFailed: "ไม่สามารถสแกนเล่มทะเบียนได้",
    profileFailed: "ไม่สามารถบันทึกข้อมูลธุรกิจได้",
    vehicleFailed: "ไม่สามารถเพิ่มรถได้",
    finishFailed: "ไม่สามารถตั้งค่าให้เสร็จสิ้นได้",
    vehicleTax: "ภาษีรถ",
    compulsoryInsurance: "ประกันภาคบังคับ",
    voluntaryInsurance: "ประกันสมัครใจ",
    nextService: "บริการครั้งถัดไป",
    fields: {
      category: "ประเภทรถ",
      vin: "VIN / เลขตัวถัง",
      make: "ยี่ห้อ",
      model: "รุ่น",
      trim: "รุ่นย่อย",
      year: "ปี",
      registration: "ทะเบียนรถ",
      color: "สี",
      mileage: "เลขไมล์ปัจจุบัน",
      currency: "Currency",
      dailyRate: "Daily rental rate",
      weeklyRate: "Weekly rental rate",
      monthlyRate: "Monthly rental rate",
      rate: "Rate",
      dailyShort: "Daily",
      weeklyShort: "Weekly",
      monthlyShort: "Monthly",
      taxExpiry: "วันหมดอายุภาษี",
      porborExpiry: "วันหมดอายุ พ.ร.บ.",
      insuranceExpiry: "วันหมดอายุประกันสมัครใจ",
      nextService: "กำหนดเข้าบริการครั้งถัดไป",
      transmission: "เกียร์",
      fuelType: "เชื้อเพลิง",
      engineCc: "ขนาดเครื่องยนต์ CC",
      seating: "จำนวนที่นั่ง"
    }
  }
};

function bestCategory(categories: Category[], fleetType: string) {
  const preferred = fleetType === "motorcycles" ? ["motorcycle", "scooter"] : ["car"];
  return categories.find((category) => preferred.includes(category.code))?.id || categories[0]?.id || "";
}

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

function normalizeCatalogMatch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function yearsForTrims(trims: VehicleTrim[]) {
  const thisYear = new Date().getFullYear();
  const years = new Set<number>();
  trims.forEach((trim) => {
    const endYear = Math.min(trim.year_to || thisYear + 1, thisYear + 1);
    for (let year = endYear; year >= trim.year_from; year -= 1) years.add(year);
  });
  return Array.from(years).sort((left, right) => right - left);
}

function defaultVehicleYears() {
  const newestYear = new Date().getFullYear() + 1;
  return Array.from({ length: newestYear - 2004 }, (_, index) => newestYear - index);
}

function trimCoversYear(trim: VehicleTrim, yearValue: string) {
  const parsedYear = Number(yearValue);
  if (!parsedYear) return true;
  return parsedYear >= trim.year_from && parsedYear <= (trim.year_to || new Date().getFullYear() + 1);
}

function trimQualityScore(trim: VehicleTrim) {
  return [
    trim.name.length,
    trim.engine_cc ? 8 : 0,
    trim.transmission ? 8 : 0,
    trim.fuel_type ? 4 : 0,
    trim.seating_capacity ? 4 : 0,
    trim.drivetrain ? 8 : 0
  ].reduce((total, score) => total + score, 0);
}

function trimVariantCode(name: string) {
  const cleaned = name
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-zA-Z0-9. ]/g, " ")
    .trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const codeToken = tokens.find((token) => /[a-zA-Z]/.test(token) && !/^\d+(\.\d+)?L?$/i.test(token));
  return codeToken ? normalizeCatalogMatch(codeToken) : "";
}

function isShortLegacyTrim(trim: VehicleTrim) {
  const tokenCount = trim.name.replace(/\([^)]*\)/g, " ").split(/\s+/).filter(Boolean).length;
  return tokenCount <= 3 && !trim.transmission && !trim.drivetrain;
}

function dedupeTrimsForPicker(trims: VehicleTrim[]) {
  const withoutBundledRows = trims.filter((trim) => !trim.name.includes(" / "));
  const bestByName = new Map<string, VehicleTrim>();

  withoutBundledRows.forEach((trim) => {
    const key = normalizeCatalogMatch(trim.name);
    const existing = bestByName.get(key);
    if (!existing || trimQualityScore(trim) > trimQualityScore(existing)) {
      bestByName.set(key, trim);
    }
  });

  const exactDeduped = Array.from(bestByName.values());
  return exactDeduped.filter((trim) => {
    if (!isShortLegacyTrim(trim)) return true;
    const code = trimVariantCode(trim.name);
    if (!code) return true;
    return !exactDeduped.some((candidate) => {
      if (candidate.id === trim.id || isShortLegacyTrim(candidate)) return false;
      return trimVariantCode(candidate.name) === code && trimCoversYear(candidate, String(trim.year_from));
    });
  });
}

export function OnboardingWizard({ categories, organization }: { categories: Category[]; organization: Organization }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const photoRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [ocrLoading, setOcrLoading] = useState(false);
  const [vehiclePhotoCount, setVehiclePhotoCount] = useState(0);
  const [vehiclePhotoFiles, setVehiclePhotoFiles] = useState<File[]>([]);
  const [vehiclePhotoPreviews, setVehiclePhotoPreviews] = useState<Array<{ id: string; name: string; url: string }>>([]);
  const [success, setSuccess] = useState(false);
  const [vehicleSkipped, setVehicleSkipped] = useState(false);
  const [vehicle, setVehicle] = useState<any>(null);
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
    language: organization.default_locale || "en"
  });
  const [vehicleFields, setVehicleFields] = useState({
    categoryId: bestCategory(categories, organization.settings?.fleet_type || "mixed"),
    make: "",
    model: "",
    trim: "",
    year: "",
    registrationNumber: "",
    vin: "",
    color: "",
    mileage: "",
    transmission: "",
    fuelType: "",
    seatingCapacity: "",
    engineCc: "",
    taxExpiryDate: "",
    porborExpiryDate: "",
    insuranceExpiryDate: "",
    nextServiceDate: "",
    currency: defaultCurrencyForCountry(savedLocation.country || "Thailand"),
    dailyRate: "",
    weeklyRate: "",
    monthlyRate: ""
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

  function updateVehicle(updates: Partial<typeof vehicleFields>) {
    setVehicleFields((current) => ({ ...current, ...updates }));
  }

  function updateVehiclePhotoPreviews(files: FileList | null | undefined) {
    vehiclePhotoPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    const nextFiles = Array.from(files || []);
    const previews = nextFiles.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name || "Vehicle photo",
      url: URL.createObjectURL(file)
    }));
    setVehiclePhotoFiles(nextFiles);
    setVehiclePhotoCount(previews.length);
    setVehiclePhotoPreviews(previews);
  }

  function removeVehiclePhoto(photoId: string) {
    setVehiclePhotoPreviews((current) => {
      const removedIndex = current.findIndex((photo) => photo.id === photoId);
      const removed = current[removedIndex];
      if (removed) URL.revokeObjectURL(removed.url);
      const nextPreviews = current.filter((photo) => photo.id !== photoId);
      setVehiclePhotoFiles((files) => files.filter((_, index) => index !== removedIndex));
      setVehiclePhotoCount(nextPreviews.length);
      if (photoRef.current && nextPreviews.length === 0) photoRef.current.value = "";
      return nextPreviews;
    });
  }

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
        formData.set("currency", vehicleFields.currency || defaultCurrencyForCountry(selectedCountry));
        await saveBusinessProfile(formData);
        updateVehicle({ categoryId: bestCategory(categories, profile.fleetType), currency: defaultCurrencyForCountry(selectedCountry) });
        setStep(2);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : t.profileFailed);
      }
    });
  }

  async function runOcr(file: File) {
    setError("");
    setOcrLoading(true);
    try {
      const payload = new FormData();
      payload.set("file", file);
      const response = await fetch("/api/ocr/vehicle-logbook", { method: "POST", body: payload });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || t.ocrFailed);
      }
      const extracted = result.extracted || {};
      updateVehicle({
        make: extracted.make || vehicleFields.make,
        model: extracted.model || vehicleFields.model,
        trim: extracted.trim || vehicleFields.trim,
        year: extracted.year ? String(extracted.year) : vehicleFields.year,
        registrationNumber: extracted.registration_number || vehicleFields.registrationNumber,
        vin: extracted.vin || vehicleFields.vin,
        color: normalizeColor(extracted.color, profile.language) || vehicleFields.color,
        engineCc: extracted.engine_cc ? String(extracted.engine_cc) : vehicleFields.engineCc,
        seatingCapacity: extracted.seating_capacity ? String(extracted.seating_capacity) : vehicleFields.seatingCapacity,
        transmission: extracted.transmission || vehicleFields.transmission,
        taxExpiryDate: formatDateForDisplay(extracted.tax_expiry_date, profile.language) || vehicleFields.taxExpiryDate,
        porborExpiryDate: formatDateForDisplay(extracted.porbor_expiry_date, profile.language) || vehicleFields.porborExpiryDate,
        insuranceExpiryDate: formatDateForDisplay(extracted.insurance_expiry_date, profile.language) || vehicleFields.insuranceExpiryDate
      });
    } catch (ocrError) {
      setError(ocrError instanceof Error ? ocrError.message : t.scanFailed);
    } finally {
      setOcrLoading(false);
    }
  }

  function createVehicle() {
    setError("");
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("organizationId", organization.id);
        Object.entries(vehicleFields).forEach(([key, value]) => {
          const normalizedValue = ["taxExpiryDate", "porborExpiryDate", "insuranceExpiryDate", "nextServiceDate"].includes(key)
            ? normalizeDateToIso(value)
            : value;
          formData.set(key, normalizedValue);
        });
        vehiclePhotoFiles.forEach((file) => formData.append("vehiclePhotos", file));
        const created = await createOnboardingVehicle(formData);
        setVehicle(created);
        setVehicleSkipped(false);
        setStep(3);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : t.vehicleFailed);
      }
    });
  }

  function skipVehicle() {
    setError("");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("organizationId", organization.id);
      await skipFirstVehicle(formData);
      setVehicleSkipped(true);
      setStep(3);
    });
  }

  function complete(lineConnected: boolean) {
    setError("");
    startTransition(async () => {
      try {
        const formData = new FormData();
        const lineInput = document.getElementById("lineId") as HTMLInputElement | null;
        formData.set("organizationId", organization.id);
        formData.set("lineId", lineInput?.value || "");
        formData.set("lineConnected", String(lineConnected));
        await finishOnboarding(formData);
        setSuccess(true);
        setTimeout(() => router.push("/"), 2000);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : t.finishFailed);
      }
    });
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#d9f7f0,transparent_38%),linear-gradient(135deg,#f8fffd,#eef7f5)] px-4 py-5 text-[#10252b]">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-xl flex-col">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#0f766e]">{t.setupEyebrow}</p>
            <h1 className="text-2xl font-black">{t.setupTitle}</h1>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((entry) => (
              <span className={`h-3 w-3 rounded-full ${entry <= step ? "bg-[#0f766e]" : "bg-[#cfe2de]"}`} key={entry} />
            ))}
          </div>
        </header>

        <section className="flex-1 rounded-lg border border-[#cfe2de] bg-white/92 p-3 shadow-[0_18px_60px_rgba(16,37,43,0.08)] sm:p-7">
          {success ? (
            <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
              <div className="success-pop flex h-24 w-24 items-center justify-center rounded-full bg-[#dcfce7] text-[#166534]">
                <CheckCircle2 size={52} />
              </div>
              <h2 className="mt-5 text-3xl font-black">{t.setupComplete}</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-[#667085]">{t.setupCompleteBody}</p>
              <div className="confetti mt-6" />
            </div>
          ) : null}

          {!success && step === 1 ? (
            <div className="mx-auto max-w-xl">
              <StepTitle icon={Languages} title={t.step1Title} subtitle={t.step1Subtitle} />
              <div className="mt-6 grid gap-3">
                <ChoiceGrid label={t.primaryLanguage} options={languageOptions} value={profile.language} onChange={(language) => setProfile({ ...profile, language })} />
                <label>
                  <span className="text-sm font-black">{t.businessName}</span>
                  <input className={fieldClass} onChange={(event) => setProfile({ ...profile, businessName: event.target.value })} required value={profile.businessName} />
                </label>
                <div className="rounded-lg border border-[#cfe2de] bg-[#f8fffd] p-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-black">{t.mainLocation}</p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#667085]" title={t.mainLocationHint}>
                      {t.mainLocationHint}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label>
                      <span className="text-xs font-black uppercase text-[#667085]">{t.country}</span>
                      <select
                        className={fieldClass}
                        onChange={(event) => {
                          const nextCountry = event.target.value;
                          const nextRegion = regionOptions(nextCountry)[0]?.name || "Other";
                          const nextTown = townOptions(nextCountry, nextRegion)[0] || "Other";
                          setProfile({ ...profile, country: nextCountry, region: nextRegion, town: nextTown });
                          updateVehicle({ currency: defaultCurrencyForCountry(nextCountry) });
                        }}
                        value={profile.country}
                      >
                        {locationOptions.map((option) => <option key={option.country} value={option.country}>{localizedLocationLabel(option.country, profile.language)}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="text-xs font-black uppercase text-[#667085]">{t.region}</span>
                      <select
                        className={fieldClass}
                        onChange={(event) => {
                          const nextRegion = event.target.value;
                          const nextTown = townOptions(profile.country, nextRegion)[0] || "Other";
                          setProfile({ ...profile, region: nextRegion, town: nextTown });
                        }}
                        value={profile.region}
                      >
                        {currentRegions.map((region) => <option key={region.name} value={region.name}>{localizedLocationLabel(region.name, profile.language)}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="text-xs font-black uppercase text-[#667085]">{t.town}</span>
                      <select className={fieldClass} onChange={(event) => setProfile({ ...profile, town: event.target.value })} value={profile.town}>
                        {currentTowns.map((town) => <option key={town} value={town}>{localizedLocationLabel(town, profile.language)}</option>)}
                      </select>
                    </label>
                  </div>
                  {profile.country === "Other" || profile.region === "Other" || profile.town === "Other" ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      {profile.country === "Other" ? <input className={fieldClass} onChange={(event) => setProfile({ ...profile, customCountry: event.target.value })} placeholder={t.customCountry} value={profile.customCountry} /> : null}
                      {profile.region === "Other" ? <input className={fieldClass} onChange={(event) => setProfile({ ...profile, customRegion: event.target.value })} placeholder={t.customRegion} value={profile.customRegion} /> : null}
                      {profile.town === "Other" ? <input className={fieldClass} onChange={(event) => setProfile({ ...profile, customTown: event.target.value })} placeholder={t.customTown} value={profile.customTown} /> : null}
                    </div>
                  ) : null}
                </div>
                <ChoiceGrid label={t.fleetType} options={fleetTypeOptions} value={profile.fleetType} onChange={(fleetType) => setProfile({ ...profile, fleetType })} />
                <ChoiceGrid label={t.fleetSize} options={fleetSizeOptions} value={profile.fleetSize} onChange={(fleetSize) => setProfile({ ...profile, fleetSize })} />
              </div>
              <FooterActions error={error} pending={isPending} primaryLabel={t.continue} savingLabel={t.saving} onPrimary={submitBusinessProfile} />
            </div>
          ) : null}

          {!success && step === 2 ? (
            <div className="mx-auto max-w-xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <StepTitle icon={ScanLine} title={t.step2Title} subtitle={t.step2Subtitle} />
                <button className="pressable rounded-lg border border-[#cfe2de] bg-white px-4 py-3 text-sm font-black text-[#0f766e]" onClick={skipVehicle} type="button">
                  {t.addVehiclesLater}
                </button>
              </div>
              <input
                accept="image/*,.pdf"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) runOcr(file);
                }}
                ref={fileRef}
                type="file"
              />
              <input
                accept="image/*"
                className="hidden"
                multiple
                onChange={(event) => updateVehiclePhotoPreviews(event.target.files)}
                ref={photoRef}
                type="file"
              />
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button className="pressable rounded-lg bg-[#0f766e] p-3 text-left text-white shadow-lg" onClick={() => fileRef.current?.click()} type="button">
                  <Camera size={28} />
                  <p className="mt-3 text-lg font-black">{t.scanBlueBook}</p>
                  <p className="mt-1 text-sm text-white/85">{t.scanBlueBookBody}</p>
                </button>
                <button className="pressable rounded-lg border border-[#cfe2de] bg-[#f8fffd] p-3 text-left" onClick={() => router.push("/fleet/import?from=onboarding")} type="button">
                  <FileSpreadsheet className="text-[#0f766e]" size={28} />
                  <p className="mt-3 text-lg font-black">{t.importVehicles}</p>
                  <p className="mt-1 text-sm text-[#667085]">{t.importVehiclesBody}</p>
                </button>
              </div>
              <div className="mt-4 rounded-lg border border-[#cfe2de] bg-[#f8fffd] p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#e6fffb] text-[#0f766e]">
                      <ImagePlus size={24} />
                    </span>
                    <div>
                      <p className="text-lg font-black text-[#10252b]">{t.uploadPhotos}</p>
                      <p className="mt-1 text-sm text-[#667085]">{vehiclePhotoCount ? t.photosSelected(vehiclePhotoCount) : t.uploadPhotosBody}</p>
                    </div>
                  </div>
                  <button className="pressable rounded-lg bg-white px-4 py-3 text-sm font-black text-[#0f766e] shadow-sm ring-1 ring-[#cfe2de]" onClick={() => photoRef.current?.click()} type="button">
                    {t.uploadPhotos}
                  </button>
                </div>
              </div>
              {vehiclePhotoPreviews.length > 0 ? (
                <div className="mt-4 rounded-lg border border-[#cfe2de] bg-white p-3">
                  <p className="text-sm font-black text-[#10252b]">{t.photosSelected(vehiclePhotoPreviews.length)}</p>
                  <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {vehiclePhotoPreviews.map((photo) => (
                      <div className="relative overflow-hidden rounded-lg border border-[#d7e5e1] bg-[#f8fffd]" key={photo.id}>
                        <button
                          aria-label={`Remove ${photo.name}`}
                          className="pressable absolute right-1 top-1 z-10 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-[#be123c] shadow-sm"
                          onClick={() => removeVehiclePhoto(photo.id)}
                          type="button"
                        >
                          <X size={15} strokeWidth={3} />
                        </button>
                        <img alt={photo.name} className="aspect-square w-full object-cover" src={photo.url} />
                        <p className="truncate px-2 py-1 text-[11px] font-bold text-[#667085]">{photo.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {ocrLoading ? <p className="mt-4 rounded-lg bg-[#e6fffb] p-3 text-sm font-bold text-[#0f766e]">{t.readingBlueBook}</p> : null}
              <VehicleFields categories={categories} fields={vehicleFields} labels={t.fields} language={profile.language} onChange={updateVehicle} selectedCountry={selectedCountry} />
              <p className="mt-4 rounded-lg border border-[#cfe2de] bg-[#f8fffd] p-3 text-sm font-semibold text-[#667085]">
                {t.renewalHelp}
              </p>
              <FooterActions
                error={error}
                pending={isPending}
                primaryLabel={t.confirmVehicle}
                savingLabel={t.saving}
                onPrimary={createVehicle}
              />
            </div>
          ) : null}

          {!success && step === 3 ? (
            <div className="mx-auto flex min-h-[520px] max-w-xl flex-col justify-center">
              <StepTitle icon={LineChart} title={t.step3Title} subtitle={t.step3Subtitle} />
              <div className="mt-6 rounded-lg border border-[#cfe2de] bg-[#f8fffd] p-3">
                {vehicle && compliance ? (
                  <div>
                    <p className={`text-sm font-black uppercase ${Number(compliance.days) <= 60 ? "text-[#b7791f]" : "text-[#16a34a]"}`}>
                      {Number(compliance.days) <= 60 ? t.attentionSoon : t.complianceGood}
                    </p>
                    <h3 className="mt-2 text-2xl font-black">
                      {Number(compliance.days) <= 60
                        ? t.expiresInDays(compliance.label, Number(compliance.days))
                        : t.allComplianceGood(`${vehicle.make} ${vehicle.model}`)}
                    </h3>
                    <p className="mt-2 text-sm text-[#667085]">{t.nextUpcoming(compliance.label, String(compliance.date))}</p>
                  </div>
                ) : vehicle ? (
                  <h3 className="text-2xl font-black">{t.allComplianceGood(`${vehicle.make} ${vehicle.model}`)}</h3>
                ) : (
                  <div>
                    <p className="text-sm font-black uppercase text-[#0f766e]">{t.sampleAlert}</p>
                    <h3 className="mt-2 text-2xl font-black">{t.sampleAlertTitle}</h3>
                    <p className="mt-2 text-sm text-[#667085]">{t.sampleAlertBody}</p>
                  </div>
                )}
                {vehicleSkipped ? <p className="mt-4 rounded-lg bg-white p-3 text-sm font-bold text-[#667085]">{t.vehicleLater}</p> : null}
              </div>
              <p className="mt-5 text-sm leading-6 text-[#667085]">{t.alertSchedule}</p>
              <FooterActions error={error} pending={false} primaryLabel={t.continue} savingLabel={t.saving} onPrimary={() => setStep(4)} />
            </div>
          ) : null}

          {!success && step === 4 ? (
            <div className="mx-auto max-w-xl">
              <StepTitle icon={MapPin} title={t.step4Title} subtitle={t.step4Subtitle} />
              <div className="mt-6 grid gap-3 md:grid-cols-[1fr_220px]">
                <div className="space-y-3">
                  {t.lineBenefits.map((item) => (
                    <div className="rounded-lg border border-[#cfe2de] bg-[#f8fffd] p-3 text-sm font-bold text-[#344054]" key={item}>{item}</div>
                  ))}
                  <label className="block">
                    <span className="text-sm font-black">{t.lineId}</span>
                    <input className={fieldClass} id="lineId" placeholder="@yourlineid" />
                  </label>
                </div>
                <div className="rounded-lg border border-[#cfe2de] bg-white p-3 text-center">
                  <div className="mx-auto grid h-44 w-44 grid-cols-6 gap-1 rounded-lg bg-white p-3 shadow-inner">
                    {Array.from({ length: 36 }).map((_, index) => (
                      <span className={`${[0, 1, 2, 6, 12, 13, 14, 5, 11, 17, 23, 29, 35, 30, 31, 32, 18, 20, 21, 26, 27].includes(index) ? "bg-[#10252b]" : "bg-[#e6fffb]"} rounded-sm`} key={index} />
                    ))}
                  </div>
                  <p className="mt-3 text-sm font-bold text-[#667085]">{t.scanLine}</p>
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button className="pressable min-h-12 rounded-lg bg-[#0f766e] px-5 py-3 text-sm font-black text-white disabled:opacity-70" disabled={isPending} onClick={() => complete(true)} type="button">
                  {isPending ? t.finishing : t.connectedLine}
                </button>
                <button className="pressable min-h-12 rounded-lg border border-[#cfe2de] bg-white px-5 py-3 text-sm font-black text-[#344054]" disabled={isPending} onClick={() => complete(false)} type="button">
                  {t.skipNow}
                </button>
              </div>
              {error ? <p className="mt-4 rounded-lg bg-[#ffe4e6] p-3 text-sm font-bold text-[#be123c]">{error}</p> : null}
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
      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#e6fffb] text-[#0f766e]">
        <Icon size={24} />
      </span>
      <h2 className="mt-4 text-3xl font-black text-[#10252b]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#667085]">{subtitle}</p>
    </div>
  );
}

function ChoiceGrid({ label, options, value, onChange }: { label: string; options: Array<{ value: string; label: string }>; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <p className="mb-2 text-sm font-black">{label}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <button
            className={`pressable min-h-12 rounded-lg border px-4 py-3 text-left text-sm font-black ${value === option.value ? "border-[#0f766e] bg-[#e6fffb] text-[#0f766e]" : "border-[#cfe2de] bg-white text-[#344054]"}`}
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

function VehicleFields({
  categories,
  fields,
  labels,
  language,
  onChange,
  selectedCountry
}: {
  categories: Category[];
  fields: Record<string, string>;
  labels: (typeof copy)["en"]["fields"];
  language: string;
  onChange: (updates: any) => void;
  selectedCountry: string;
}) {
  const selectedCategory = categories.find((category) => category.id === fields.categoryId);
  const selectedCategoryText = `${selectedCategory?.code || ""} ${selectedCategory?.name || ""}`.toLowerCase();
  const categoryCode = selectedCategory?.code || categories[0]?.code || "car";
  const isTwoWheeler =
    selectedCategoryText.includes("motorcycle") ||
    selectedCategoryText.includes("scooter") ||
    selectedCategoryText.includes("e-bike") ||
    selectedCategoryText.includes("ebike");
  const [makes, setMakes] = useState<VehicleMake[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [trims, setTrims] = useState<VehicleTrim[]>([]);
  const [selectedMakeId, setSelectedMakeId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [selectedTrimId, setSelectedTrimId] = useState("");
  const [manualMake, setManualMake] = useState(false);
  const [manualModel, setManualModel] = useState(false);
  const [manualTrim, setManualTrim] = useState(false);
  const [makeDropdownOpen, setMakeDropdownOpen] = useState(false);
  const [makeSearch, setMakeSearch] = useState("");
  const catalogYears = useMemo(() => yearsForTrims(trims), [trims]);
  const fallbackYears = useMemo(() => (selectedModelId || manualModel || fields.model ? defaultVehicleYears() : []), [fields.model, manualModel, selectedModelId]);
  const yearOptions = catalogYears.length > 0 ? catalogYears : fallbackYears;
  const visibleTrims = useMemo(() => dedupeTrimsForPicker(trims.filter((trim) => trimCoversYear(trim, fields.year))), [trims, fields.year]);
  const searchedMakes = useMemo(() => {
    const needle = normalizeCatalogMatch(makeSearch);
    return needle ? makes.filter((make) => normalizeCatalogMatch(make.name).includes(needle)) : makes;
  }, [makeSearch, makes]);

  useEffect(() => {
    let mounted = true;
    fetchVehicleMakesForCategory(categoryCode)
      .then((nextMakes) => {
        if (!mounted) return;
        setMakes(nextMakes);
        const matchedMake = nextMakes.find((make) => normalizeCatalogMatch(make.name) === normalizeCatalogMatch(fields.make));
        setSelectedMakeId(matchedMake?.id || "");
        setManualMake(Boolean(fields.make && !matchedMake));
        if (matchedMake) setMakeSearch("");
      })
      .catch(() => {
        if (!mounted) return;
        setMakes([]);
      });

    return () => {
      mounted = false;
    };
  }, [categoryCode, fields.make]);

  useEffect(() => {
    if (!selectedMakeId) {
      setModels([]);
      return;
    }

    let mounted = true;
    fetchVehicleModels(selectedMakeId, categoryCode)
      .then((nextModels) => {
        if (!mounted) return;
        setModels(nextModels);
        const matchedModel = nextModels.find((model) => normalizeCatalogMatch(model.name) === normalizeCatalogMatch(fields.model));
        setSelectedModelId(matchedModel?.id || "");
        setManualModel(Boolean(fields.model && !matchedModel));
      })
      .catch(() => {
        if (!mounted) return;
        setModels([]);
      });

    return () => {
      mounted = false;
    };
  }, [categoryCode, fields.model, selectedMakeId]);

  useEffect(() => {
    if (!selectedModelId) {
      setTrims([]);
      setSelectedTrimId("");
      return;
    }

    let mounted = true;
    fetchVehicleTrims(selectedModelId)
      .then((nextTrims) => {
        if (!mounted) return;
        setTrims(nextTrims);
        const matchedTrim = nextTrims.find((trim) => normalizeCatalogMatch(trim.name) === normalizeCatalogMatch(fields.trim));
        setSelectedTrimId(matchedTrim?.id || "");
        setManualTrim(Boolean(fields.trim && !matchedTrim));
      })
      .catch(() => {
        if (!mounted) return;
        setTrims([]);
      });

    return () => {
      mounted = false;
    };
  }, [fields.trim, selectedModelId]);

  function handleMakeChange(value: string) {
    setSelectedModelId("");
    setSelectedTrimId("");
    setModels([]);
    setTrims([]);
    setManualModel(false);
    setManualTrim(false);
    setMakeDropdownOpen(false);
    setMakeSearch("");

    if (value === "__manual__") {
      setManualMake(true);
      setSelectedMakeId("");
      onChange({ make: "", model: "", year: "", trim: "" });
      return;
    }

    const nextMake = makes.find((make) => make.id === value);
    setManualMake(false);
    setSelectedMakeId(nextMake?.id || "");
    onChange({ make: nextMake?.name || "", model: "", year: "", trim: "" });
  }

  function handleModelChange(value: string) {
    setSelectedTrimId("");
    setTrims([]);
    setManualTrim(false);

    if (value === "__manual__") {
      setManualModel(true);
      setSelectedModelId("");
      onChange({ model: "", year: "", trim: "" });
      return;
    }

    const nextModel = models.find((model) => model.id === value);
    setManualModel(false);
    setSelectedModelId(nextModel?.id || "");
    onChange({ model: nextModel?.name || "", year: "", trim: "" });
  }

  function applyTrim(nextTrim: VehicleTrim) {
    setSelectedTrimId(nextTrim.id);
    onChange({
      trim: nextTrim.name,
      engineCc: nextTrim.engine_cc ? String(nextTrim.engine_cc) : fields.engineCc,
      transmission: nextTrim.transmission || fields.transmission,
      fuelType: nextTrim.fuel_type || fields.fuelType,
      seatingCapacity: nextTrim.seating_capacity ? String(nextTrim.seating_capacity) : fields.seatingCapacity
    });
  }

  function handleTrimChange(value: string) {
    if (value === "__manual__") {
      setManualTrim(true);
      setSelectedTrimId("");
      onChange({ trim: "" });
      return;
    }

    setManualTrim(false);
    const nextTrim = visibleTrims.find((trim) => trim.id === value);
    if (nextTrim) {
      applyTrim(nextTrim);
    } else {
      setSelectedTrimId("");
      onChange({ trim: "" });
    }
  }

  return (
    <div className="mt-6 space-y-3">
      <div className="rounded-lg border border-[#cfe2de] bg-[#f8fffd] p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label>
            <span className="text-sm font-black">{labels.category}</span>
            <select
              className={fieldClass}
              onChange={(event) => {
                setSelectedMakeId("");
                setSelectedModelId("");
                setSelectedTrimId("");
                setModels([]);
                setTrims([]);
                setManualMake(false);
                setManualModel(false);
                setManualTrim(false);
                setMakeSearch("");
                setMakeDropdownOpen(false);
                onChange({ categoryId: event.target.value, make: "", model: "", year: "", trim: "", seatingCapacity: "" });
              }}
              value={fields.categoryId}
            >
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <TextField label={labels.vin} name="vin" value={fields.vin} onChange={onChange} />
          <div>
            <span className="text-sm font-black">{labels.make}</span>
            <div className="relative mt-2">
              <button
                className="pressable flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-[#cfe2de] bg-white px-4 py-3 text-left text-[#10252b] outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15"
                onClick={() => setMakeDropdownOpen((open) => !open)}
                type="button"
              >
                <span className="flex min-w-0 items-center gap-3">
                  {selectedMakeId ? (
                    (() => {
                      const selected = makes.find((make) => make.id === selectedMakeId);
                      return selected?.logo_url ? (
                        <img alt="" className="h-7 w-7 shrink-0 rounded bg-white object-contain" src={selected.logo_url} />
                      ) : (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#dff9f4] text-xs font-bold text-[#0f766e]">{selected?.name.slice(0, 2) || "?"}</span>
                      );
                    })()
                  ) : (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#eef8f6] text-xs font-bold text-[#0f766e]">+</span>
                  )}
                  <span className={fields.make ? "truncate font-semibold" : "truncate text-[#98a2b3]"}>
                    {manualMake ? "Other / custom make" : fields.make || (makes.length ? `Select ${selectedCategory?.name || "vehicle"} brand` : "Loading makes...")}
                  </span>
                </span>
                <span className="text-[#667085]">v</span>
              </button>
              {makeDropdownOpen ? (
                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-[#cfe2de] bg-white shadow-xl shadow-[#10252b]/10">
                  <div className="border-b border-[#edf2f7] p-3">
                    <input
                      className="w-full rounded-lg border border-[#d6e5e2] bg-white px-3 py-2 text-sm text-[#10252b] outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15"
                      onChange={(event) => setMakeSearch(event.target.value)}
                      placeholder={`Search ${selectedCategory?.name?.toLowerCase() || "vehicle"} brand`}
                      value={makeSearch}
                    />
                  </div>
                  <div className="max-h-72 overflow-y-auto py-1">
                    {searchedMakes.map((make) => (
                      <button
                        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[#eef8f6]"
                        key={make.id}
                        onClick={() => handleMakeChange(make.id)}
                        type="button"
                      >
                        {make.logo_url ? (
                          <img alt="" className="h-7 w-7 shrink-0 rounded bg-white object-contain" src={make.logo_url} />
                        ) : (
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#dff9f4] text-xs font-bold text-[#0f766e]">{make.name.slice(0, 2)}</span>
                        )}
                        <span className="font-semibold text-[#10252b]">{make.name}</span>
                        <span className="ml-auto text-xs uppercase text-[#98a2b3]">{make.origin_country || ""}</span>
                      </button>
                    ))}
                    <button
                      className="flex w-full items-center gap-3 border-t border-[#edf2f7] px-3 py-2 text-left text-sm font-semibold text-[#0f766e] hover:bg-[#eef8f6]"
                      onClick={() => handleMakeChange("__manual__")}
                      type="button"
                    >
                      Other / custom make
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            {manualMake ? <TextField label="" name="make" required value={fields.make} onChange={onChange} placeholder="Make" /> : null}
          </div>
          <div>
            <label>
              <span className="text-sm font-black">{labels.model}</span>
              <select className={fieldClass} disabled={!selectedMakeId && !manualMake} onChange={(event) => handleModelChange(event.target.value)} value={manualModel ? "__manual__" : (models.find((model) => normalizeCatalogMatch(model.name) === normalizeCatalogMatch(fields.model))?.id || "")}>
                <option value="">{selectedMakeId ? "Select model" : "Select make first"}</option>
                {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                <option value="__manual__">Other / custom</option>
              </select>
            </label>
            {manualModel || manualMake ? <TextField label="" name="model" required value={fields.model} onChange={onChange} placeholder="Model" /> : null}
          </div>
          <label>
            <span className="text-sm font-black">{labels.year}</span>
            {yearOptions.length > 0 ? (
              <select className={fieldClass} onChange={(event) => onChange({ year: event.target.value, trim: "" })} value={fields.year}>
                <option value="">Select year</option>
                {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            ) : (
              <input className={fieldClass} min="1900" onChange={(event) => onChange({ year: event.target.value })} type="number" value={fields.year} />
            )}
          </label>
          <div>
            <label>
              <span className="text-sm font-black">{labels.trim}</span>
              {visibleTrims.length > 0 ? (
                <select className={fieldClass} onChange={(event) => handleTrimChange(event.target.value)} value={manualTrim ? "__manual__" : selectedTrimId}>
                  <option value="">Select trim</option>
                  {visibleTrims.map((trim) => <option key={trim.id} value={trim.id}>{trim.name}</option>)}
                  <option value="__manual__">Other / custom trim</option>
                </select>
              ) : (
                <input className={fieldClass} onChange={(event) => onChange({ trim: event.target.value })} placeholder="Trim" value={fields.trim} />
              )}
            </label>
            {manualTrim && visibleTrims.length > 0 ? <TextField label="" name="trim" value={fields.trim} onChange={onChange} placeholder="Trim" /> : null}
          </div>
          <TextField label={labels.registration} name="registrationNumber" required value={fields.registrationNumber} onChange={onChange} />
          <TextField label={labels.color} name="color" value={fields.color} onChange={onChange} />
        </div>
      </div>

      <div className="rounded-lg border border-[#d7e5ff] bg-[#f5f8ff] p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TextField label={labels.transmission} name="transmission" value={fields.transmission} onChange={onChange} />
          <TextField label={labels.fuelType} name="fuelType" value={fields.fuelType} onChange={onChange} />
          <TextField label={labels.engineCc} name="engineCc" type="number" value={fields.engineCc} onChange={onChange} />
          {!isTwoWheeler && <TextField label={labels.seating} name="seatingCapacity" type="number" value={fields.seatingCapacity} onChange={onChange} />}
          <TextField label={labels.mileage} name="mileage" type="number" value={fields.mileage} onChange={onChange} />
        </div>
      </div>

      <div className="rounded-lg border border-[#fde7c3] bg-[#fffbeb] p-3">
        <span className="text-sm font-black">{labels.rate}</span>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_112px]">
          <CompactRateField label={labels.dailyShort} name="dailyRate" value={fields.dailyRate} onChange={onChange} />
          <CompactRateField label={labels.weeklyShort} name="weeklyRate" value={fields.weeklyRate} onChange={onChange} />
          <CompactRateField label={labels.monthlyShort} name="monthlyRate" value={fields.monthlyRate} onChange={onChange} />
          <label>
            <span className="text-xs font-black text-[#667085]">{labels.currency}</span>
            <select className={`${fieldClass} mt-1`} onChange={(event) => onChange({ currency: event.target.value })} value={fields.currency}>
              {currencyOptionsForCountry(selectedCountry).map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-[#d7f2df] bg-[#f0fdf4] p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <DateField label={labels.taxExpiry} language={language} name="taxExpiryDate" value={fields.taxExpiryDate} onChange={onChange} />
          <DateField label={labels.porborExpiry} language={language} name="porborExpiryDate" value={fields.porborExpiryDate} onChange={onChange} />
          <DateField label={labels.insuranceExpiry} language={language} name="insuranceExpiryDate" value={fields.insuranceExpiryDate} onChange={onChange} />
          <DateField label={labels.nextService} language={language} name="nextServiceDate" value={fields.nextServiceDate} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}

function DateField({
  label,
  language,
  name,
  onChange,
  value
}: {
  label: string;
  language: string;
  name: string;
  onChange: (updates: any) => void;
  value: string;
}) {
  const pickerRef = useRef<HTMLInputElement | null>(null);
  const isoValue = normalizeDateToIso(value);

  function openPicker() {
    const picker = pickerRef.current;
    if (!picker) return;
    if (typeof picker.showPicker === "function") {
      picker.showPicker();
    } else {
      picker.click();
    }
  }

  return (
    <label>
      <span className="text-sm font-black">{label}</span>
      <div className="relative mt-2">
        <input
          className={`${fieldClass} mt-0 pr-12`}
          onChange={(event) => onChange({ [name]: event.target.value })}
          placeholder="DD/MM/YYYY"
          value={value}
        />
        <button
          aria-label={`Choose ${label}`}
          className="pressable absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg bg-[#e6fffb] text-[#0f766e]"
          onClick={openPicker}
          type="button"
        >
          <CalendarDays size={18} />
        </button>
        <input
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-0 h-px w-px opacity-0"
          onChange={(event) => onChange({ [name]: formatDateForDisplay(event.target.value, language) })}
          ref={pickerRef}
          tabIndex={-1}
          type="date"
          value={isoValue.includes("-") ? isoValue : ""}
        />
      </div>
    </label>
  );
}

function CompactRateField({ label, name, onChange, value }: { label: string; name: string; onChange: (updates: any) => void; value: string }) {
  return (
    <label>
      <span className="text-xs font-black text-[#667085]">{label}</span>
      <input
        className={`${fieldClass} mt-1`}
        inputMode="decimal"
        onChange={(event) => onChange({ [name]: event.target.value })}
        type="number"
        value={value}
      />
    </label>
  );
}

function TextField({
  label,
  name,
  onChange,
  placeholder,
  required = false,
  type = "text",
  value
}: {
  label: string;
  name: string;
  onChange: (updates: any) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label>
      {label ? <span className="text-sm font-black">{label}</span> : null}
      <input className={fieldClass} onChange={(event) => onChange({ [name]: event.target.value })} placeholder={placeholder} required={required} type={type} value={value} />
    </label>
  );
}

function FooterActions({
  error,
  onPrimary,
  onSecondary,
  pending,
  primaryLabel,
  savingLabel,
  secondaryLabel
}: {
  error: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  pending: boolean;
  primaryLabel: string;
  savingLabel: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="mt-6">
      {error ? <p className="mb-3 rounded-lg bg-[#ffe4e6] p-3 text-sm font-bold text-[#be123c]">{error}</p> : null}
      <div className="flex flex-col gap-3 sm:flex-row">
        {onSecondary && secondaryLabel ? (
          <button className="pressable min-h-12 rounded-lg border border-[#cfe2de] bg-white px-5 py-3 text-sm font-black text-[#344054]" disabled={pending} onClick={onSecondary} type="button">
            {secondaryLabel}
          </button>
        ) : null}
        <button className="pressable min-h-12 flex-1 rounded-lg bg-[#0f766e] px-5 py-3 text-sm font-black text-white disabled:opacity-70" disabled={pending} onClick={onPrimary} type="button">
          {pending ? savingLabel : primaryLabel}
        </button>
      </div>
    </div>
  );
}
