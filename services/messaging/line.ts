export type LineMessage =
  | { type: "text"; text: string }
  | { type: "flex"; altText: string; contents: object };

export async function sendLineMessage(
  accessToken: string,
  to: string,
  messages: LineMessage[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ to, messages })
    });

    if (!res.ok) {
      const body = await res.text();
      return { success: false, error: `LINE API error (${res.status}): ${body}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function formatRevenue(amount: number): string {
  return amount.toLocaleString("en-US");
}

export function buildDailySummaryMessage(params: {
  businessName: string;
  activeRentals: Array<{
    customerName: string;
    vehicleLabel: string;
    returnDate: string | null;
    daysRemaining: number | null;
  }>;
  returnsToday: Array<{
    customerName: string;
    vehicleLabel: string;
    phone: string;
  }>;
  returnsTomorrow: Array<{
    customerName: string;
    vehicleLabel: string;
  }>;
  overdueRentals: Array<{
    customerName: string;
    vehicleLabel: string;
    daysOverdue: number;
  }>;
  urgentCompliance: Array<{
    vehicleLabel: string;
    item: string;
    daysUntil: number;
  }>;
  monthlyRevenue: number;
}): LineMessage {
  const lines: string[] = [];

  lines.push("🚗 RouteHQ Daily Summary");
  lines.push(params.businessName);
  lines.push("──────────────────");

  if (params.overdueRentals.length > 0) {
    lines.push("");
    lines.push(`🔴 OVERDUE RETURNS (${params.overdueRentals.length})`);
    for (const r of params.overdueRentals) {
      lines.push(`  • ${r.customerName} — ${r.vehicleLabel} (${r.daysOverdue}d overdue)`);
    }
  }

  if (params.returnsToday.length > 0) {
    lines.push("");
    lines.push(`📦 RETURNS TODAY (${params.returnsToday.length})`);
    for (const r of params.returnsToday) {
      lines.push(`  • ${r.customerName} — ${r.vehicleLabel}`);
      lines.push(`    📞 ${r.phone}`);
    }
  }

  if (params.returnsTomorrow.length > 0) {
    lines.push("");
    lines.push(`📅 RETURNS TOMORROW (${params.returnsTomorrow.length})`);
    for (const r of params.returnsTomorrow) {
      lines.push(`  • ${r.customerName} — ${r.vehicleLabel}`);
    }
  }

  if (params.urgentCompliance.length > 0) {
    lines.push("");
    lines.push(`⚠️ COMPLIANCE ALERTS (${params.urgentCompliance.length})`);
    for (const c of params.urgentCompliance) {
      lines.push(`  • ${c.vehicleLabel}: ${c.item} in ${c.daysUntil} days`);
    }
  }

  if (params.activeRentals.length > 0) {
    lines.push("");
    lines.push(`🔑 ACTIVE RENTALS (${params.activeRentals.length})`);
    for (const r of params.activeRentals) {
      const returnLabel = r.returnDate || "open-ended";
      lines.push(`  • ${r.customerName} — ${r.vehicleLabel}, ${returnLabel}`);
    }
  }

  lines.push("");
  lines.push("──────────────────");
  lines.push(`💰 Revenue this month: ฿${formatRevenue(params.monthlyRevenue)}`);
  lines.push("routehq.app");

  return { type: "text", text: lines.join("\n") };
}

export function buildPaymentReminderMessage(params: {
  customerName: string;
  vehicleLabel: string;
  amount: number;
  dueDate: string;
  promptpayId: string | null;
  ownerName: string;
  ownerPhone: string;
}): LineMessage {
  const lines: string[] = [];

  lines.push(`💰 Payment Reminder`);
  lines.push(`Hi ${params.customerName},`);
  lines.push("");
  lines.push(
    `This is a friendly reminder that your rental payment of ฿${params.amount.toLocaleString("en-US")} for ${params.vehicleLabel} is due on ${params.dueDate}.`
  );

  if (params.promptpayId) {
    lines.push("");
    lines.push(`PromptPay ID: ${params.promptpayId}`);
  }

  lines.push("");
  lines.push(`Questions? Contact ${params.ownerName} at ${params.ownerPhone}`);
  lines.push("");
  lines.push("Thank you 🙏");
  lines.push("routehq.app");

  return { type: "text", text: lines.join("\n") };
}

export function buildBookingLinkMessage(params: {
  customerName: string;
  vehicleLabel: string;
  bookingUrl: string;
  businessName: string;
  ownerPhone: string;
}): LineMessage {
  const lines: string[] = [];

  lines.push(`📋 Booking Link — ${params.businessName}`);
  lines.push(`Hi ${params.customerName},`);
  lines.push("");
  lines.push(`Here is your booking link for ${params.vehicleLabel}:`);
  lines.push("");
  lines.push(params.bookingUrl);
  lines.push("");
  lines.push("Please complete your details and sign the rental contract through the link above.");
  lines.push("");
  lines.push(`For help, contact us at ${params.ownerPhone}`);
  lines.push("");
  lines.push("routehq.app");

  return { type: "text", text: lines.join("\n") };
}
