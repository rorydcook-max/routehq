/**
 * Reading a column from its header alone, for when the AI mapping isn't available (no credit, rate limit, a
 * bad answer) or skipped a column. Common English and Thai headers from owners' own sheets. Checked in order:
 * the specific ones first ("Next payment" before "End", "Monthly price" before "Rent").
 */
const RULES: Array<[string, RegExp]> = [
  ["registration_number", /plate|registration|\breg\b|reg\.? ?no|licen[cs]e ?(no|number)|ทะเบียน/i],
  ["next_payment_date", /next ?(payment|pay|due)|payment ?due|due ?date|ครบกำหนด|จ่ายครั้งถัดไป|งวดถัดไป/i],
  ["porbor_expiry_date", /por ?ror ?bor|\bprb\b|compulsory|พ\.?ร\.?บ/i],
  ["tax_expiry_date", /\btax\b|road ?tax|ภาษี/i],
  ["insurance_expiry_date", /insurance|ประกัน/i],
  ["next_service_date", /next ?service|service ?due/i],
  ["last_service_date", /last ?service|serviced/i],
  ["mileage_at_start", /(mileage|km|odometer).*(start|out|rented|handover)|ไมล์.*(รับ|เริ่ม)/i],
  ["current_mileage", /mileage|odometer|\bkm\b|kilomet|เลขไมล์|ไมล์/i],
  ["daily_rate", /(price|rate|ราคา).*(day|daily|วัน)|(day|daily)\s*(price|rate)|ราคาต่อวัน/i],
  ["weekly_rate", /(price|rate|ราคา).*(week|สัปดาห์)|(week|weekly)\s*(price|rate)/i],
  ["monthly_rate", /(price|rate|list|ราคา).*(month|mo\b|เดือน)|(month|monthly)\s*(price|rate)|ราคาต่อเดือน/i],
  ["deposit_amount", /deposit|bond|มัดจำ|ประกันรถ/i],
  ["rental_rate", /^\s*rent\s*$|rent(al)?\s*(rate|amount|price|paid|฿)|ค่าเช่า/i],
  ["amount_paid", /amount ?paid|paid ?so ?far|ชำระแล้ว/i],
  ["start_date", /start|from|since|pick ?up|out ?date|date ?out|rented ?on|วันเริ่ม|รับรถ|เริ่มเช่า/i],
  ["end_date", /\bend\b|end ?date|until|return|due ?back|date ?in|วันคืน|คืนรถ|สิ้นสุด/i],
  ["booking_status", /^\s*(status|booking status|state)\s*$|สถานะ/i],
  ["phone", /phone|\btel\b|mobile|whats ?app|contact ?no|เบอร์|โทร/i],
  ["email", /e-?mail|อีเมล/i],
  ["nationality", /nationality|country|สัญชาติ/i],
  ["passport_number", /passport|พาสปอร์ต|หนังสือเดินทาง/i],
  ["driving_licence_number", /driv(ing|er'?s?) ?licen[cs]e|ใบขับขี่/i],
  ["customer_name", /renter|customer|tenant|client|hirer|driver|guest|ผู้เช่า|ลูกค้า|ชื่อ/i],
  ["make", /^\s*(make|brand|manufacturer)\s*$|ยี่ห้อ/i],
  ["model", /^\s*model\s*$|รุ่น/i],
  ["vehicle_name", /^\s*(car|vehicle|bike|scooter|motorbike|van|truck|รถ)\s*$|vehicle ?name|car ?model|make ?(and|&|\/) ?model/i],
  ["year", /year|^\s*ปี\s*$|ปีรถ|ปีจด|ปีผลิต/i],
  ["color", /colou?r|^\s*สี\s*$|สีรถ/i],
  ["transmission", /gear|transmission|เกียร์/i],
  ["vin", /\bvin\b|chassis|frame|เลขตัวถัง/i],
  ["purchase_price", /purchase ?price|bought ?for|cost ?price|ราคาซื้อ/i],
  ["notes", /note|remark|comment|หมายเหตุ/i]
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
