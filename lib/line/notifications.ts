import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDefaultOrganizationSlug } from "@/lib/supabase/config";
import { sendLinePushMessage, lineText, lineFlex } from "@/lib/providers/messaging/line";

const THB = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);

type OrgLineSettings = {
  lineUserId: string;
  notifications: Record<string, boolean>;
};

async function getOrgLineSettings(): Promise<OrgLineSettings | null> {
  try {
    const supabase = createSupabaseAdminClient() as any;
    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("slug", getDefaultOrganizationSlug())
      .is("deleted_at", null)
      .single();

    const lineUserId = org?.settings?.line_user_id;
    if (!lineUserId) return null;

    return {
      lineUserId,
      notifications: org?.settings?.line_notifications || {}
    };
  } catch {
    return null;
  }
}

function isEnabled(ns: Record<string, boolean>, key: string): boolean {
  return ns[key] !== false; // defaults to true
}

function buildEventBubble(emoji: string, title: string, body: string, color = "#0f766e") {
  return lineFlex(`FleetOS: ${title}`, {
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: `${emoji} ${title}`, weight: "bold", color: "#ffffff", size: "sm", wrap: true }
      ],
      backgroundColor: color,
      paddingAll: "16px"
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: body, size: "sm", color: "#344054", wrap: true }
      ],
      paddingAll: "16px"
    }
  });
}

export async function notifyPaymentReceived(params: {
  amount: number;
  customerName: string;
  vehicleLabel: string;
}): Promise<void> {
  const settings = await getOrgLineSettings();
  if (!settings || !isEnabled(settings.notifications, "event_payment_received")) return;

  const msg = buildEventBubble(
    "💸",
    "Payment received",
    `${THB(params.amount)} from ${params.customerName} for ${params.vehicleLabel}`,
    "#16a34a"
  );

  await sendLinePushMessage(settings.lineUserId, [msg]).catch(() => null);
}

export async function notifyContractSigned(params: {
  customerName: string;
  vehicleLabel: string;
}): Promise<void> {
  const settings = await getOrgLineSettings();
  if (!settings || !isEnabled(settings.notifications, "event_contract_signed")) return;

  const msg = buildEventBubble(
    "✍️",
    "Contract signed",
    `${params.customerName} has signed the rental contract for ${params.vehicleLabel}`
  );

  await sendLinePushMessage(settings.lineUserId, [msg]).catch(() => null);
}

export async function notifyGpsOffline(params: { vehicleLabel: string }): Promise<void> {
  const settings = await getOrgLineSettings();
  if (!settings || !isEnabled(settings.notifications, "event_gps_offline")) return;

  const msg = buildEventBubble(
    "📡",
    "GPS offline",
    `${params.vehicleLabel} GPS tracker has been offline for more than 1 hour`,
    "#d97706"
  );

  await sendLinePushMessage(settings.lineUserId, [msg]).catch(() => null);
}

export async function notifyComplianceExpiringSoon(params: {
  vehicleLabel: string;
  item: string;
  expiryDate: string;
  daysUntilExpiry: number;
}): Promise<void> {
  const settings = await getOrgLineSettings();
  if (!settings || !isEnabled(settings.notifications, "event_compliance_expiry")) return;

  const urgency = params.daysUntilExpiry <= 1 ? "#dc2626" : "#d97706";
  const when = params.daysUntilExpiry === 0 ? "expires TODAY" : params.daysUntilExpiry === 1 ? "expires TOMORROW" : `expires in ${params.daysUntilExpiry} days`;

  const msg = buildEventBubble(
    "🔴",
    "Compliance alert",
    `${params.vehicleLabel} — ${params.item} ${when} (${params.expiryDate})`,
    urgency
  );

  await sendLinePushMessage(settings.lineUserId, [msg]).catch(() => null);
}

export async function notifyRentalOverdue(params: {
  customerName: string;
  vehicleLabel: string;
  endDate: string;
}): Promise<void> {
  const settings = await getOrgLineSettings();
  if (!settings || !isEnabled(settings.notifications, "event_rental_overdue")) return;

  const msg = buildEventBubble(
    "⚠️",
    "Overdue return",
    `${params.vehicleLabel} was due back on ${params.endDate} — ${params.customerName} has not returned it`,
    "#dc2626"
  );

  await sendLinePushMessage(settings.lineUserId, [msg]).catch(() => null);
}

export async function notifyNewBookingRequest(params: {
  customerName: string;
  vehicleLabel: string;
}): Promise<void> {
  const settings = await getOrgLineSettings();
  if (!settings || !isEnabled(settings.notifications, "event_new_booking")) return;

  const msg = buildEventBubble(
    "📋",
    "New booking request",
    `New booking request for ${params.vehicleLabel} from ${params.customerName}`
  );

  await sendLinePushMessage(settings.lineUserId, [msg]).catch(() => null);
}

// Customer payment reminder — sent to CUSTOMER via their LINE (if they have one)
// or falls back to sending a note to the operator.
export async function sendCustomerPaymentReminder(params: {
  customerLineUserId: string | null;
  customerName: string;
  vehicleLabel: string;
  amountDue: number;
  dueDateLabel: string;
  operatorName: string;
  promptpayId: string | null;
  daysOffset: number; // -5, -1, 0, 1 (positive = overdue)
}): Promise<void> {
  if (!params.customerLineUserId) return;

  let emoji = "💬";
  let title = "Friendly payment reminder";
  let detail = `Your payment of ${THB(params.amountDue)} for ${params.vehicleLabel} is due on ${params.dueDateLabel}.`;

  if (params.daysOffset === -1) {
    emoji = "⏰";
    title = "Payment due tomorrow";
    detail = `Your payment of ${THB(params.amountDue)} for ${params.vehicleLabel} is due tomorrow.`;
  } else if (params.daysOffset === 0) {
    emoji = "📅";
    title = "Payment due today";
    detail = `Your payment of ${THB(params.amountDue)} for ${params.vehicleLabel} is due today.`;
  } else if (params.daysOffset > 0) {
    emoji = "🔴";
    title = "Payment overdue";
    detail = `Your payment of ${THB(params.amountDue)} for ${params.vehicleLabel} is overdue. Please pay as soon as possible.`;
  }

  const bodyLines = [detail];
  if (params.promptpayId) {
    bodyLines.push(`\nPromptPay: ${params.promptpayId}`);
  }
  bodyLines.push(`\nFor help, contact: ${params.operatorName}`);

  const msg = buildEventBubble(emoji, title, bodyLines.join("\n"), params.daysOffset > 0 ? "#dc2626" : "#0f766e");

  await sendLinePushMessage(params.customerLineUserId, [msg]).catch(() => null);
}
