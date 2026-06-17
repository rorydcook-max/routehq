import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDefaultOrganizationSlug } from "@/lib/supabase/config";
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

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export type SummaryData = {
  orgName: string;
  lineUserId: string;
  timezone: string;
  currency: string;
  notificationSettings: Record<string, boolean>;
  activeRentals: any[];
  returningToday: any[];
  returningTomorrow: any[];
  overdueRentals: any[];
  paymentsExpectedToday: any[];
  urgentCompliance: any[];
  monthRevenue: number;
};

export async function fetchSummaryData(): Promise<SummaryData | null> {
  const supabase = createSupabaseAdminClient() as any;

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, settings, timezone, currency")
    .eq("slug", getDefaultOrganizationSlug())
    .is("deleted_at", null)
    .single();

  if (!org) return null;

  const lineUserId: string = org.settings?.line_user_id || "";
  if (!lineUserId) return null;

  const timezone: string = org.timezone || "Asia/Bangkok";
  const today = todayStr(timezone);
  const tomorrow = tomorrowStr(timezone);
  const in7Days = addDays(today, 7);

  const [rentalsRes, transactionsRes, vehiclesRes] = await Promise.all([
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
      .in("type", ["rental_income", "deposit"])
      .gte("transaction_date", today.slice(0, 7) + "-01")
      .lte("transaction_date", today)
      .is("deleted_at", null),
    supabase
      .from("vehicles")
      .select("id, make, model, registration_number, metadata")
      .eq("organization_id", org.id)
      .is("deleted_at", null)
  ]);

  const rentals: any[] = rentalsRes.data || [];
  const transactions: any[] = transactionsRes.data || [];
  const vehicles: any[] = vehiclesRes.data || [];

  const activeRentals = rentals.filter((r) => r.status === "active" || r.status === "due_soon");
  const returningToday = rentals.filter((r) => r.end_date === today);
  const returningTomorrow = rentals.filter((r) => r.end_date === tomorrow);
  const overdueRentals = rentals.filter((r) => r.status === "overdue" || (r.end_date && r.end_date < today && r.status !== "completed"));

  // Payments expected today = rentals with balance_due > 0 and end_date = today
  const paymentsExpectedToday = rentals.filter((r) => Number(r.balance_due || 0) > 0 && r.end_date === today);

  // Compliance alerts: vehicles with compliance dates within 7 days
  const urgentCompliance: Array<{ vehicle: string; item: string; expiry: string }> = [];
  for (const v of vehicles) {
    const compliance = v.metadata?.compliance || {};
    const label = `${v.make} ${v.model} (${v.registration_number})`;
    const checks = [
      { key: "tax_expiry_date", item: "Vehicle Tax (ต่อภาษี)" },
      { key: "porbor_expiry_date", item: "Compulsory Insurance (พรบ)" },
      { key: "insurance_expiry_date", item: "Full Insurance" },
      { key: "next_service_date", item: "Scheduled Service" }
    ];
    for (const { key, item } of checks) {
      const expiry = compliance[key];
      if (expiry && expiry >= today && expiry <= in7Days) {
        urgentCompliance.push({ vehicle: label, item, expiry });
      }
    }
  }

  const monthRevenue = transactions.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);

  return {
    orgName: org.name,
    lineUserId,
    timezone,
    currency: org.currency || "THB",
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

  // Try to build a Flex Message for rich display
  const bubbles: any[] = [];

  // Header bubble
  const now = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: data.timezone });
  bubbles.push(buildHeaderBubble(data.orgName, now));

  // Active rentals section
  if (ns.daily_active_rentals !== false && data.activeRentals.length > 0) {
    bubbles.push(buildRentalsBubble(data.activeRentals, data.returningToday, data.returningTomorrow));
  }

  // Overdue
  if (ns.daily_overdue !== false && data.overdueRentals.length > 0) {
    bubbles.push(buildOverdueBubble(data.overdueRentals));
  }

  // Payments today
  if (ns.daily_payments !== false && data.paymentsExpectedToday.length > 0) {
    bubbles.push(buildPaymentsBubble(data.paymentsExpectedToday));
  }

  // Compliance
  if (ns.daily_compliance !== false && data.urgentCompliance.length > 0) {
    bubbles.push(buildComplianceBubble(data.urgentCompliance));
  }

  // Month metric
  if (ns.daily_revenue !== false) {
    bubbles.push(buildRevenueBubble(data.monthRevenue));
  }

  if (bubbles.length === 0) {
    return [lineText(`Good morning! 🌅\n\nNo urgent items for today. Have a great day!`)];
  }

  return [
    lineFlex("FleetOS Daily Summary", {
      type: "carousel",
      contents: bubbles
    })
  ];
}

function buildHeaderBubble(orgName: string, dateStr: string) {
  return {
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "FleetOS", size: "xs", color: "#ffffff80", weight: "bold" },
        { type: "text", text: "Good morning! 🌅", size: "xl", color: "#ffffff", weight: "bold" },
        { type: "text", text: dateStr, size: "xs", color: "#ffffff99" }
      ],
      backgroundColor: "#0f766e",
      paddingAll: "20px"
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: orgName, size: "sm", color: "#667085", wrap: true }
      ],
      paddingAll: "16px"
    }
  };
}

function buildRentalsBubble(active: any[], today: any[], tomorrow: any[]) {
  const rows: any[] = [];

  rows.push({ type: "text", text: `🚗 Active Rentals (${active.length})`, weight: "bold", size: "sm", color: "#172026" });

  const returning = [...today, ...tomorrow];
  for (const r of returning.slice(0, 5)) {
    const customer = r.customers?.full_name || "Customer";
    const vehicle = `${r.vehicles?.make || ""} ${r.vehicles?.model || ""}`.trim() || r.vehicles?.registration_number || "Vehicle";
    const isToday = r.end_date === todayStr();
    rows.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: isToday ? "⬅ TODAY" : "↩ TMW", size: "xs", color: isToday ? "#dc2626" : "#d97706", flex: 2 },
        { type: "text", text: customer, size: "xs", flex: 4, wrap: true },
        { type: "text", text: vehicle, size: "xs", color: "#667085", flex: 4, wrap: true }
      ],
      margin: "sm"
    });
  }

  if (returning.length === 0) {
    rows.push({ type: "text", text: "No returns today or tomorrow", size: "xs", color: "#667085", margin: "sm" });
  }

  return {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      contents: rows,
      paddingAll: "16px",
      spacing: "sm"
    }
  };
}

function buildOverdueBubble(overdue: any[]) {
  const rows: any[] = [
    { type: "text", text: `⚠️ Overdue Returns (${overdue.length})`, weight: "bold", size: "sm", color: "#dc2626" }
  ];

  for (const r of overdue.slice(0, 5)) {
    const customer = r.customers?.full_name || "Customer";
    const vehicle = `${r.vehicles?.make || ""} ${r.vehicles?.model || ""}`.trim() || r.vehicles?.registration_number || "Vehicle";
    const balance = Number(r.balance_due || 0);
    rows.push({
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: customer, size: "sm", weight: "bold" },
        { type: "text", text: `${vehicle} · Due ${formatDate(r.end_date)}`, size: "xs", color: "#667085" },
        balance > 0
          ? { type: "text", text: `Balance: ${THB(balance)}`, size: "xs", color: "#dc2626" }
          : { type: "text", text: " ", size: "xs" }
      ],
      margin: "sm"
    });
  }

  return {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      contents: rows,
      paddingAll: "16px",
      spacing: "sm"
    }
  };
}

function buildPaymentsBubble(payments: any[]) {
  const total = payments.reduce((s, r) => s + Number(r.balance_due || 0), 0);
  const rows: any[] = [
    { type: "text", text: `💰 Payments Due Today`, weight: "bold", size: "sm", color: "#172026" },
    { type: "text", text: THB(total), size: "lg", weight: "bold", color: "#0f766e" }
  ];

  for (const r of payments.slice(0, 4)) {
    const customer = r.customers?.full_name || "Customer";
    rows.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: customer, size: "xs", flex: 5 },
        { type: "text", text: THB(Number(r.balance_due || 0)), size: "xs", flex: 3, align: "end", weight: "bold" }
      ],
      margin: "sm"
    });
  }

  return {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      contents: rows,
      paddingAll: "16px",
      spacing: "sm"
    }
  };
}

function buildComplianceBubble(items: Array<{ vehicle: string; item: string; expiry: string }>) {
  const rows: any[] = [
    { type: "text", text: `🔴 Compliance Alerts (${items.length})`, weight: "bold", size: "sm", color: "#dc2626" }
  ];

  for (const c of items.slice(0, 5)) {
    rows.push({
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: c.item, size: "xs", weight: "bold", color: "#172026" },
        { type: "text", text: `${c.vehicle} · Expires ${formatDate(c.expiry)}`, size: "xs", color: "#667085", wrap: true }
      ],
      margin: "sm"
    });
  }

  return {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      contents: rows,
      paddingAll: "16px",
      spacing: "sm"
    }
  };
}

function buildRevenueBubble(monthRevenue: number) {
  return {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "📈 This Month So Far", weight: "bold", size: "sm", color: "#172026" },
        { type: "text", text: THB(monthRevenue), size: "xxl", weight: "bold", color: "#0f766e", margin: "md" },
        { type: "text", text: "Fleet revenue (income + deposits)", size: "xs", color: "#667085", margin: "sm" }
      ],
      paddingAll: "16px",
      spacing: "sm"
    }
  };
}

export async function sendDailySummary(lineUserId?: string): Promise<{ sent: boolean; reason?: string }> {
  const data = await fetchSummaryData();

  if (!data) {
    return { sent: false, reason: "Organization not found or LINE not connected." };
  }

  const targetUserId = lineUserId || data.lineUserId;
  if (!targetUserId) {
    return { sent: false, reason: "No LINE userId stored. Operator must message the OA first." };
  }

  const messages = buildDailySummaryMessages(data);
  await sendLinePushMessage(targetUserId, messages);

  return { sent: true };
}
