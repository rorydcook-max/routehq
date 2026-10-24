/**
 * Reading a column from its header alone, for when the AI mapping isn't available (no credit, rate limit, a
 * bad answer) or skipped a column. Common English and Thai headers from owners' own sheets. Checked in order:
 * the specific ones first ("Tax Cost" before "Tax Expiry", "Purchase Mileage" before "Current Mileage",
 * "Next payment" before "End date", "Monthly price" before "Rent").
 */
const DATE_WORD = "(expir|due|date|until|valid|หมดอายุ|ครบ|วันที่)";
const RULES: Array<[string, RegExp]> = [
  ["registration_number", /plate(?! ?province)|registration|\breg\b|reg\.? ?no|licen[cs]e ?(no|number)|ทะเบียน/i],
  ["next_payment_date", /next ?(payment|pay|due)|payment ?due|ครบกำหนดจ่าย|จ่ายครั้งถัดไป|งวดถัดไป/i],
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
  ["rental_rate", /^\s*rent\s*$|rent(al)?\s*(rate|amount|price|paid|฿)|ค่าเช่า/i],
  ["amount_paid", /amount ?paid|paid ?so ?far|ชำระแล้ว/i],
  ["rented_now", /rental ?status|rented ?(out|now)?\s*\??\s*$|on ?rent|is ?rented|ให้เช่าอยู่|สถานะการเช่า/i],
  ["paid", /^\s*(received|paid\??|is paid|payment received|ได้รับ(เงิน)?แล้ว|จ่ายแล้ว|รับแล้ว)\s*$/i],
  ["booking_status", /^\s*(status|booking status|state)\s*$|สถานะ/i],
  ["start_date", /start|from|since|pick ?up|out ?date|date ?out|rented ?on|วันเริ่ม|รับรถ|เริ่มเช่า/i],
  ["end_date", /\bend\b|end ?date|until|return|due ?back|date ?in|\bto ?date\b|rented ?to|วันคืน|คืนรถ|สิ้นสุด/i],
  ["phone", /phone|\btel\b|mobile|whats ?app|contact ?no|เบอร์|โทร/i],
  ["email", /e-?mail|อีเมล/i],
  ["nationality", /nationality|สัญชาติ/i],
  ["passport_number", /passport|พาสปอร์ต|หนังสือเดินทาง/i],
  ["driving_licence_number", /driv(ing|er'?s?) ?licen[cs]e|ใบขับขี่/i],
  ["customer_name", /renter(?! ?(info|contract|messenger|tel|email|whats))|customer|tenant|client|hirer|guest|ผู้เช่า|ลูกค้า|ชื่อ/i],
  ["vehicle_name", /^\s*(car|vehicle|bike|scooter|motorbike|van|truck|รถ)\s*$|vehicle ?name|car ?model|make ?(and|&|\/) ?model/i],
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
  ["notes", /note|remark|comment|หมายเหตุ|^\s*receipt\s*$|slip|สลิป|ใบเสร็จ/i],
  // Money sheets: plain one-word headers, checked last so a vehicle sheet's specific columns win.
  ["date", /^\s*(date|day|transaction date|paid on|วันที่|วัน)\s*$/i],
  ["amount", /^\s*(amount|cost|price|total|value|sum|฿|ยอด|ยอดเงิน|จำนวนเงิน|ราคา)\s*$/i],
  ["type", /^\s*(purchase|item|description|category|type|what|details?|expense|รายการ|ประเภท|รายละเอียด)\s*$/i]
];

/** The RouteHQ field a header most likely means, skipping fields already used. Null if nothing fits. */
export function guessField(header: string, used: Set<string>): string | null {
  const text = String(header || "").trim();
  if (!text) return null;
  for (const [field, pattern] of RULES) {
    if (used.has(field)) continue;
    if (pattern.test(text)) return field;
  }
  return null;
}
