import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { amountDueNowByRental } from "@/lib/rental-balances";
import { lineFlex, lineText, sendLinePushMessage, type LineMessage } from "@/lib/providers/messaging/line";

const THB = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);

function todayStr(timezone = "Asia/Bangkok") {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: timezone }).format(new Date());
}

function tomorrowStr(timezone = "Asia/Bangkok") {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: timezone }).format(d);
}

function addDays(date: string, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// The summary goes to the owner's LINE, so it is written in the owner's language (falling back to the business's).
type SummaryLocale = "en" | "th";
const WORDS = {
  en: {
    goodMorning: "Good morning! 🌅",
    nothingToday: "Good morning! 🌅\n\nNothing urgent today. Have a great day!",
    altText: "Lokalfleet daily summary",
    active: (n: number) => `🚗 On hire (${n})`,
    today: "⬅ TODAY",
    tomorrow: "↩ TMW",
    noReturns: "No returns today or tomorrow",
    customer: "Customer",
    vehicle: "Vehicle",
    overdue: (n: number) => `⚠️ Late returns (${n})`,
    due: (d: string) => `Due ${d}`,
    owed: (a: string) => `Owed: ${a}`,
    paymentsToday: "💰 Payments due today",
    compliance: (n: number) => `🔴 Paperwork due (${n})`,
    expires: (d: string) => `Expires ${d}`,
    monthSoFar: "📈 This month so far",
    monthNote: "Rent received this month (deposits not included)",
    tax: "Road tax (ต่อภาษี)",
    porbor: "Compulsory insurance (พรบ)",
    insurance: "Full insurance",
    service: "Service"
  },
  th: {
    goodMorning: "อรุณสวัสดิ์ 🌅",
    nothingToday: "อรุณสวัสดิ์ 🌅\n\nวันนี้ไม่มีเรื่องด่วน ขอให้เป็นวันที่ดี!",
    altText: "สรุปประจำวันจาก Lokalfleet",
    active: (n: number) => `🚗 กำลังเช่าอยู่ (${n})`,
    today: "⬅ วันนี้",
    tomorrow: "↩ พรุ่งนี้",
    noReturns: "ไม่มีรถคืนวันนี้หรือพรุ่งนี้",
    customer: "ลูกค้า",
    vehicle: "รถ",
    overdue: (n: number) => `⚠️ คืนรถเกินกำหนด (${n})`,
    due: (d: string) => `กำหนดคืน ${d}`,
    owed: (a: string) => `ค้างชำระ: ${a}`,
    paymentsToday: "💰 ยอดที่ต้องเก็บวันนี้",
    compliance: (n: number) => `🔴 เอกสารใกล้หมดอายุ (${n})`,
    expires: (d: string) => `หมดอายุ ${d}`,
    monthSoFar: "📈 รายได้เดือนนี้",
    monthNote: "ค่าเช่าที่ได้รับเดือนนี้ (ไม่รวมเงินมัดจำ)",
    tax: "ต่อภาษีรถ",
    porbor: "พรบ",
    insurance: "ประกันภัย",
    service: "เข้าศูนย์ตามระยะ"
  }
};
type Words = (typeof WORDS)["en"];

function formatDate(dateStr: string, locale: SummaryLocale = "en") {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short" });
}

export type SummaryData = {
  orgName: string;
  lineUserId: string;
  timezone: string;
  currency: string;
  locale: SummaryLocale;
  notificationSettings: Record<string, boolean>;
  activeRentals: any[];
  returningToday: any[];
  returningTomorrow: any[];
  overdueRentals: any[];
  paymentsExpectedToday: any[];
  urgentCompliance: Array<{ vehicle: string; item: ComplianceItem; expiry: string }>;
  monthRevenue: number;
};

type ComplianceItem = "tax" | "porbor" | "insurance" | "service";

export async function fetchSummaryData(organizationId: string): Promise<SummaryData | null> {
  const supabase = createSupabaseAdminClient() as any;

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, trading_name, settings, timezone, currency, line_user_id, default_locale")
    .eq("id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!org) return null;

  const lineUserId: string = org.line_user_id || org.settings?.line_user_id || "";
  if (!lineUserId) return null;

  const timezone: string = org.timezone || "Asia/Bangkok";
  const today = todayStr(timezone);
  const tomorrow = tomorrowStr(timezone);
  const in7Days = addDays(today, 7);

  const [rentalsRes, transactionsRes, vehiclesRes, ownerRes] = await Promise.all([
    supabase
      .from("rentals")
      .select("id, start_date, end_date, status, balance_due, customers!rentals_customer_id_fkey(full_name, phone), vehicles!rentals_vehicle_id_fkey(make, model, registration_number, metadata)")
      .eq("organization_id", org.id)
      .in("status", ["active", "overdue", "due_soon"])
      .is("deleted_at", null),
    supabase
      .from("transactions")
      .select("amount, type, transaction_date")
      .eq("organization_id", org.id)
      // Income is rent plus any deposit that was kept. Deposits held or handed back are not income.
      .in("type", ["rental_income", "charge_recovered", "deposit_forfeited", "deposit_deduction"])
      .neq("voided", true)
      .gte("transaction_date", today.slice(0, 7) + "-01")
      .lte("transaction_date", today)
      .is("deleted_at", null),
    supabase
      .from("vehicles")
      .select("id, make, model, registration_number, metadata")
      .eq("organization_id", org.id)
      .is("deleted_at", null),
    supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", org.id)
      .eq("role", "owner")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle()
  ]);
  const ownerId = (ownerRes.data as any)?.user_id;
  const { data: owner } = ownerId
    ? await supabase.from("users").select("preferred_locale").eq("id", ownerId).maybeSingle()
    : { data: null };
  const ownerLocale = owner?.preferred_locale || org.default_locale;
  const locale: SummaryLocale = String(ownerLocale || "").startsWith("th") ? "th" : "en";

  // "Balance" on a late return is what is owed now, as on every screen — not the whole balance, which counts rent months ahead.
  const dueNow = await amountDueNowByRental(supabase, (rentalsRes.data || []).map((r: any) => r.id));
  const rentals: any[] = (rentalsRes.data || []).map((r: any) => ({ ...r, balance_due: dueNow.get(r.id) || 0 }));
  const transactions: any[] = transactionsRes.data || [];
  const vehicles: any[] = vehiclesRes.data || [];

  const activeRentals = rentals.filter((r) => r.status === "active" || r.status === "due_soon");
  const returningToday = rentals.filter((r) => r.end_date === today);
  const returningTomorrow = rentals.filter((r) => r.end_date === tomorrow);
  const overdueRentals = rentals.filter((r) => r.status === "overdue" || (r.end_date && r.end_date < today && r.status !== "completed"));

  // Payments expected today: unpaid payment rows due today, grouped by rental.
  // (This used to be "rentals ending today with any balance", which missed
  // monthly rent entirely and showed the whole remaining balance.)
  const { data: dueTodayRows } = await supabase
    .from("rental_payments")
    .select("rental_id, amount, voided, metadata, rentals!inner(customers!rentals_customer_id_fkey(full_name))")
    .eq("organization_id", org.id)
    .eq("due_date", today)
    .in("status", ["scheduled", "pending", "overdue"])
    .is("deleted_at", null);
  const dueByRental = new Map<string, any>();
  for (const row of (dueTodayRows || []) as any[]) {
    if (row.voided || row.metadata?.voided) continue;
    const entry = dueByRental.get(row.rental_id) || { customers: row.rentals?.customers, balance_due: 0 };
    entry.balance_due += Number(row.amount || 0);
    dueByRental.set(row.rental_id, entry);
  }
  const paymentsExpectedToday = Array.from(dueByRental.values());

  // Compliance alerts: vehicles with compliance dates within 7 days
  const urgentCompliance: SummaryData["urgentCompliance"] = [];
  for (const v of vehicles) {
    const compliance = v.metadata?.compliance || {};
    const label = `${v.make} ${v.model} (${v.registration_number})`;
    const checks: Array<{ key: string; item: ComplianceItem }> = [
      { key: "tax_expiry_date", item: "tax" },
      { key: "porbor_expiry_date", item: "porbor" },
      { key: "insurance_expiry_date", item: "insurance" },
      { key: "next_service_date", item: "service" }
    ];
    for (const { key, item } of checks) {
      const expiry = compliance[key];
      // Already expired is the most urgent case, so it is included too. Tax and insurance also get a heads-up
      // 90, 60 and 30 days out: time to get quotes, and Por Ror Bor needs 90+ days left to pay road tax online.
      const headsUp = item !== "service" && [addDays(today, 90), addDays(today, 60), addDays(today, 30)].includes(String(expiry || "").slice(0, 10));
      if (expiry && (expiry <= in7Days || headsUp)) {
        urgentCompliance.push({ vehicle: label, item, expiry });
      }
    }
  }

  const monthRevenue = transactions.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);

  return {
    orgName: org.trading_name || org.name,
    lineUserId,
    timezone,
    currency: org.currency || "THB",
    locale,
    notificationSettings: org.settings?.line_notifications || {},
    activeRentals,
    returningToday,
    returningTomorrow,
    overdueRentals,
    paymentsExpectedToday,
    urgentCompliance,
    monthRevenue
  };
}

export function buildDailySummaryMessages(data: SummaryData): LineMessage[] {
  const ns = data.notificationSettings;
  const w = WORDS[data.locale] || WORDS.en;
  const loc = data.locale;
  const bubbles: any[] = [];

  const now = new Date().toLocaleDateString(loc === "th" ? "th-TH" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: data.timezone });
  bubbles.push(buildHeaderBubble(w, data.orgName, now));

  if (ns.daily_active_rentals !== false && data.activeRentals.length > 0) {
    bubbles.push(buildRentalsBubble(w, data.activeRentals, data.returningToday, data.returningTomorrow, todayStr(data.timezone)));
  }
  if (ns.daily_overdue !== false && data.overdueRentals.length > 0) {
    bubbles.push(buildOverdueBubble(w, loc, data.overdueRentals));
  }
  if (ns.daily_payments !== false && data.paymentsExpectedToday.length > 0) {
    bubbles.push(buildPaymentsBubble(w, data.paymentsExpectedToday));
  }
  if (ns.daily_compliance !== false && data.urgentCompliance.length > 0) {
    bubbles.push(buildComplianceBubble(w, loc, data.urgentCompliance));
  }
  if (ns.daily_revenue !== false) {
    bubbles.push(buildRevenueBubble(w, data.monthRevenue));
  }

  // Only the greeting: nothing worth a card.
  if (bubbles.length <= 1) {
    return [lineText(w.nothingToday)];
  }

  return [lineFlex(w.altText, { type: "carousel", contents: bubbles })];
}

function card(rows: any[]) {
  return {
    type: "bubble",
    size: "kilo",
    body: { type: "box", layout: "vertical", contents: rows, paddingAll: "16px", spacing: "sm" }
  };
}

function names(w: Words, r: any) {
  const customer = r.customers?.full_name || w.customer;
  const vehicle = `${r.vehicles?.make || ""} ${r.vehicles?.model || ""}`.trim() || r.vehicles?.registration_number || w.vehicle;
  return { customer, vehicle };
}

function buildHeaderBubble(w: Words, orgName: string, dateStr: string) {
  return {
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "Lokalfleet", size: "xs", color: "#ffffff80", weight: "bold" },
        { type: "text", text: w.goodMorning, size: "xl", color: "#ffffff", weight: "bold" },
        { type: "text", text: dateStr, size: "xs", color: "#ffffff99" }
      ],
      backgroundColor: "#0e5e6f",
      paddingAll: "20px"
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [{ type: "text", text: orgName, size: "sm", color: "#667085", wrap: true }],
      paddingAll: "16px"
    }
  };
}

function buildRentalsBubble(w: Words, active: any[], today: any[], tomorrow: any[], todayDate: string) {
  const rows: any[] = [{ type: "text", text: w.active(active.length), weight: "bold", size: "sm", color: "#172026" }];
  const returning = [...today, ...tomorrow];
  for (const r of returning.slice(0, 5)) {
    const { customer, vehicle } = names(w, r);
    const isToday = r.end_date === todayDate;
    rows.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: isToday ? w.today : w.tomorrow, size: "xs", color: isToday ? "#dc2626" : "#d97706", flex: 2 },
        { type: "text", text: customer, size: "xs", flex: 4, wrap: true },
        { type: "text", text: vehicle, size: "xs", color: "#667085", flex: 4, wrap: true }
      ],
      margin: "sm"
    });
  }
  if (returning.length === 0) {
    rows.push({ type: "text", text: w.noReturns, size: "xs", color: "#667085", margin: "sm" });
  }
  return card(rows);
}

function buildOverdueBubble(w: Words, loc: SummaryLocale, overdue: any[]) {
  const rows: any[] = [{ type: "text", text: w.overdue(overdue.length), weight: "bold", size: "sm", color: "#dc2626" }];
  for (const r of overdue.slice(0, 5)) {
    const { customer, vehicle } = names(w, r);
    const balance = Number(r.balance_due || 0);
    const lines: any[] = [
      { type: "text", text: customer, size: "sm", weight: "bold", wrap: true },
      { type: "text", text: `${vehicle} · ${w.due(formatDate(r.end_date, loc))}`, size: "xs", color: "#667085", wrap: true }
    ];
    if (balance > 0) lines.push({ type: "text", text: w.owed(THB(balance)), size: "xs", color: "#dc2626" });
    rows.push({ type: "box", layout: "vertical", contents: lines, margin: "sm" });
  }
  return card(rows);
}

function buildPaymentsBubble(w: Words, payments: any[]) {
  const total = payments.reduce((s, r) => s + Number(r.balance_due || 0), 0);
  const rows: any[] = [
    { type: "text", text: w.paymentsToday, weight: "bold", size: "sm", color: "#172026" },
    { type: "text", text: THB(total), size: "lg", weight: "bold", color: "#0e5e6f" }
  ];
  for (const r of payments.slice(0, 4)) {
    rows.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: r.customers?.full_name || w.customer, size: "xs", flex: 5, wrap: true },
        { type: "text", text: THB(Number(r.balance_due || 0)), size: "xs", flex: 3, align: "end", weight: "bold" }
      ],
      margin: "sm"
    });
  }
  return card(rows);
}

function buildComplianceBubble(w: Words, loc: SummaryLocale, items: SummaryData["urgentCompliance"]) {
  const rows: any[] = [{ type: "text", text: w.compliance(items.length), weight: "bold", size: "sm", color: "#dc2626" }];
  for (const c of items.slice(0, 5)) {
    rows.push({
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: w[c.item], size: "xs", weight: "bold", color: "#172026" },
        { type: "text", text: `${c.vehicle} · ${w.expires(formatDate(c.expiry, loc))}`, size: "xs", color: "#667085", wrap: true }
      ],
      margin: "sm"
    });
  }
  return card(rows);
}

function buildRevenueBubble(w: Words, monthRevenue: number) {
  return card([
    { type: "text", text: w.monthSoFar, weight: "bold", size: "sm", color: "#172026" },
    { type: "text", text: THB(monthRevenue), size: "xxl", weight: "bold", color: "#0e5e6f", margin: "md" },
    { type: "text", text: w.monthNote, size: "xs", color: "#667085", margin: "sm", wrap: true }
  ]);
}

export async function sendDailySummary(organizationId: string): Promise<{ sent: boolean; reason?: string; messages?: LineMessage[]; lineUserId?: string }> {
  const data = await fetchSummaryData(organizationId);

  if (!data) {
    return { sent: false, reason: "LINE is not connected for this business." };
  }

  const messages = buildDailySummaryMessages(data);
  try {
    await sendLinePushMessage(data.lineUserId, messages);
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : "LINE message failed.", messages, lineUserId: data.lineUserId };
  }

  return { sent: true, messages, lineUserId: data.lineUserId };
}
