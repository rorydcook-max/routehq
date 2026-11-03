import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendLinePushMessage, lineFlex } from "@/lib/providers/messaging/line";

const THB = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);

type OrgLineSettings = {
  lineUserId: string;
  notifications: Record<string, boolean>;
};

/** The LINE account alerts for this business go to, or null when LINE is off / not connected. */
async function getOrgLineSettings(organizationId: string): Promise<OrgLineSettings | null> {
  if (!organizationId) return null;
  try {
    const supabase = createSupabaseAdminClient() as any;
    const { data: org } = await supabase
      .from("organizations")
      .select("settings, line_user_id, line_notifications_enabled")
      .eq("id", organizationId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!org || org.line_notifications_enabled === false) return null;
    const lineUserId = org.line_user_id || org.settings?.line_user_id;
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

function buildEventBubble(emoji: string, title: string, body: string, color = "#0e5e6f") {
  return lineFlex(`RoveHQ: ${title}`, {
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
  organizationId: string;
  amount: number;
  customerName: string;
  vehicleLabel: string;
}): Promise<void> {
  const settings = await getOrgLineSettings(params.organizationId);
  if (!settings || !isEnabled(settings.notifications, "event_payment_received")) return;

  const msg = buildEventBubble(
    "💸",
    "Payment received",
    `${THB(params.amount)} from ${params.customerName} for ${params.vehicleLabel}`,
    "#16a34a"
  );

  await sendLinePushMessage(settings.lineUserId, [msg]).catch(() => null);
}

