/**
 * Reading a column from its header alone, for when the AI mapping isn't available (no credit, rate limit, a
 * bad answer) or skipped a column. Common English and Thai headers from owners' own sheets and booking-system
 * exports. Checked in order: the specific ones first ("Tax Cost" before "Tax Expiry", "Purchase Mileage" before
 * "Current Mileage", "Next payment" before "End date", "Monthly price" before "Rent"). Whole-header patterns (^…$)
 * are used where a word on its own means one thing but inside a longer header means another ("Due" is the rent's
 * due date, "Tax due" is the road tax's).
 */
const DATE_WORD = "(expir|due|date|until|valid|หมดอายุ|ครบ|วันที่)";
const RULES: Array<[string, RegExp]> = [
  ["registration_number", /plate(?! ?province)|registration|\breg\b|reg\.? ?no|licen[cs]e ?(no|number)|ทะเบียน/i],
  ["next_payment_date", /next ?(payment|pay|due)|payment ?due|^\s*due( ?date| on)?\s*$|^\s*(วัน)?ครบกำหนด(ชำระ|จ่าย)?\s*$|ครบกำหนดจ่าย|จ่ายครั้งถัดไป|งวดถัดไป/i],
  // Costs and copies before the expiry dates they sit next to.
  ["porbor_cost", /(por ?ror ?bor|p\.?r\.?b|compulsory|พ\.?ร\.?บ).*(cost|price|fee|ค่า)|(cost|ค่า).*(p\.?r\.?b|พ\.?ร\.?บ)/i],
  ["tax_cost", /tax.*(cost|price|fee)|(cost|ค่า)\s*ภาษี/i],
  ["insurance_cost", /insurance.*(cost|price|premium)|ค่าประกัน|เบี้ยประกัน/i],
  ["insurance_sum_insured", /sum ?insured|ทุนประกัน/i],
  ["insurance_excess", /excess|deductible|ค่าเสียหายส่วนแรก/i],
  ["porbor_expiry_date", new RegExp(`(por ?ror ?bor|\\bp\\.?r\\.?b\\.?|compulsory|พ\\.?ร\\.?บ).*${DATE_WORD}|^\\s*(พ\\.?ร\\.?บ\\.?|p\\.?r\\.?b\\.?)\\s*$`, "i")],
  ["tax_expiry_date", new RegExp(`tax.*${DATE_WORD}|^\\s*(road ?)?tax\\s*$|ภาษี`, "i")],
  ["insurance_expiry_date", new RegExp(`insurance.*${DATE_WORD}|^\\s*insurance\\s*$|^\\s*ประกัน\\s*$|ประกันหมดอายุ`, "i")],
  ["next_service_date", /next ?service|service ?due/i],
  ["last_service_date", /last ?service|serviced/i],
  ["finance_end_date", /finance.*(end|until|last)/i],
  ["finance_monthly_payment", /finance.*(payment|p\/m|month|instal)|ค่างวด|ผ่อนต่อเดือน/i],
  ["finance_outstanding", /outstanding ?balance|still ?owed|finance ?owed|ยอดคงเหลือ/i],
  ["purchase_date", /purchase ?date|date ?(bought|purchased)|bought ?on|วันที่ซื้อ/i],
  ["purchase_price", /purchase ?price|bought ?for|cost ?price|ราคาซื้อ/i],
  ["purchase_mileage", /purchase ?mileage|mileage ?(at|when) ?(purchase|bought)|ไมล์ตอนซื้อ/i],
  ["estimated_value", /valuation|current ?value|worth|มูลค่า/i],
  ["mileage_at_start", /(mileage|km|odometer).*(start|out|rent|handover)|ไมล์.*(รับ|เริ่ม)/i],
  ["current_mileage", /mileage(?!.*(return|recorded|date))|odometer|\bkm\b|kilomet|เลขไมล์|ไมล์/i],
  ["daily_rate", /(price|rate|ราคา).*(day|daily|วัน)|(day|daily)\s*(price|rate)|ราคาต่อวัน/i],
  ["weekly_rate", /(price|rate|ราคา).*(week|สัปดาห์)|(week|weekly)\s*(price|rate)/i],
  ["monthly_rate", /(price|list|ราคา).*(month|mo\b|เดือน)|(month|monthly)\s*(price|rate)|ราคาต่อเดือน/i],
  ["deposit_amount", /deposit|bond|มัดจำ/i],
  ["rental_total", /total ?(price|cost|amount|rent|charge)|(booking|rental|order) ?total|^\s*grand ?total\s*$|ยอดรวม/i],
  ["rental_rate", /^\s*(rent|rate|rental)\s*$|(monthly|weekly|daily)\s*(rent|rental)\b|rent\s*(per|\/)\s*(month|week|day)|rent(al)?\s*(rate|amount|price|paid|฿)|ค่าเช่า/i],
  ["amount_paid", /amount ?paid|paid ?so ?far|paid ?amount|ชำระแล้ว/i],
  ["rental_days", /^\s*(days|no\.? ?of ?days|number of days|duration|total days|rental days|จำนวนวัน|กี่วัน)\s*$/i],
  ["returned", /^\s*(returned\??|is returned|back\??|came back|คืนแล้ว|คืนรถแล้ว)\s*$/i],
  ["rented_now", /rental ?status|rented ?(out|now)?\s*\??\s*$|on ?rent|is ?rented|ให้เช่าอยู่|สถานะการเช่า/i],
  ["paid", /^\s*(received|paid\??|is paid|payment received|ได้รับ(เงิน)?แล้ว|จ่ายแล้ว|รับแล้ว)\s*$/i],
  ["money_in", /^\s*(in|money in|income|incoming|credit|revenue|รายรับ|รับ|เงินเข้า)\s*(฿|thb|\(฿\))?\s*$/i],
  ["money_out", /^\s*(out|money out|expenses?|outgoing|spent|debit|paid out|รายจ่าย|จ่าย|เงินออก)\s*(฿|thb|\(฿\))?\s*$/i],
  ["booking_status", /^\s*(status|booking status|state)\s*$|สถานะ/i],
  ["start_date", /start|from|since|pick[\s-]?up|out ?date|date ?out|rented ?on|check[\s-]?out|วันเริ่ม|รับรถ|เริ่มเช่า/i],
  ["end_date", /\bend\b|end ?date|until|return|due ?back|date ?in|\bto ?date\b|^\s*to\s*$|rented ?to|drop[\s-]?off|check[\s-]?in|วันคืน|คืนรถ|สิ้นสุด/i],
  ["phone_country_code", /country ?code|dial(ling)? ?code|calling ?code|รหัสประเทศ/i],
  ["phone", /phone|\btel\b|mobile|whats ?app|contact ?no|เบอร์|โทร/i],
  ["email", /e-?mail|อีเมล/i],
  ["nationality", /nationality|country|สัญชาติ/i],
  ["passport_number", /passport|พาสปอร์ต|หนังสือเดินทาง/i],
  ["driving_licence_number", /driv(ing|er'?s?) ?licen[cs]e|ใบขับขี่/i],
  ["first_name", /first ?name|given ?name|forename|ชื่อจริง/i],
  ["last_name", /last ?name|surname|family ?name|นามสกุล(?!.*ชื่อ)/i],
  ["customer_name", /renter(?! ?(info|contract|messenger|tel|email|whats))|rented ?by|customer|tenant|client|hirer|guest|^\s*(full ?)?name\s*$|ผู้เช่า|ลูกค้า|ชื่อ/i],
  ["vehicle_name", /^\s*(car|vehicle|bike|scooter|motorbike|motorcycle|van|truck|unit|รถ)\s*$|vehicle ?name|car ?model|make ?(and|&|\/) ?model/i],
  ["make", /\b(make|brand|manufacturer)\b|ยี่ห้อ/i],
  ["model", /\bmodel\b(?!\s*year)|รุ่น(?!ปี)/i],
  ["trim", /trim|variant|grade|sub ?model/i],
  ["year", /year|^\s*ปี\s*$|ปีรถ|ปีจด|ปีผลิต/i],
  ["color", /colou?r|^\s*สี\s*$|สีรถ/i],
  ["transmission", /gear|transmission|เกียร์/i],
  ["engine_cc", /engine|\bcc\b|ซีซี/i],
  ["fuel_type", /fuel ?type|เชื้อเพลิง/i],
  ["body_type", /body|ประเภทรถ/i],
  ["vin", /\bvin\b|chassis|frame|เลขตัวถัง/i],
  ["gps_tracker_url", /\bgps\b|tracker/i],
  ["notes", /note|remark|comment|หมายเหตุ|^\s*receipt\s*$|slip|สลิป|ใบเสร็จ|method|วิธีชำระ/i],
  // Money sheets: plain one-word headers, checked last so a vehicle sheet's specific columns win.
  ["date", /^\s*(date|day|transaction date|paid on|payment date|date paid|วันที่|วัน|วันที่จ่าย|วันที่ชำระ)\s*$/i],
  ["amount", /^\s*(amount|cost|price|total|value|sum|฿|thb|ยอด|ยอดเงิน|จำนวนเงิน|ราคา|จำนวน)\s*(\(฿\)|฿|thb)?\s*$/i],
  ["type", /^\s*(purchase|item|description|category|type|what|details?|expense item|for|รายการ|ประเภท|รายละเอียด)\s*$/i]
];

/** The RoveHQ field a header most likely means, skipping fields already used. Null if nothing fits. */
export function guessField(header: string, used: Set<string>): string | null {
  // "Date (2)", "Date (heading)": the same heading again, or a date written as a heading row.
  const text = String(header || "").replace(/\s*\((\d+|heading)\)\s*$/, "").trim();
  if (!text) return null;
  for (const [field, pattern] of RULES) {
    if (used.has(field)) continue;
    if (pattern.test(text)) return field;
  }
  return null;
}
