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
  lines.push("rovehq.io");

  return { type: "text", text: lines.join("\n") };
}

