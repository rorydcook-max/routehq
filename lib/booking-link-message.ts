import { customerDateTime } from "@/lib/i18n/customer-dates";
import { customerMessageText } from "@/lib/i18n/customer-message-text";

/**
 * The message the owner sends with a booking link (WhatsApp, LINE, SMS, email or copied), in the customer's language,
 * with the deadline on the business's clock (Rory, 8 Nov 2026): "The vehicle is held for you until Tue 10 Nov,
 * 6:00 PM." while the booking holds the vehicle, otherwise "This link is valid until ...".
 */
export async function bookingLinkMessage(input: {
  customerName?: string | null;
  vehicle: string;
  url: string;
  business: string;
  locale?: string | null;
  /** booking_links.hold_until, while the hold is running. */
  holdUntil?: string | null;
  /** booking_links.expires_at. */
  expiresAt?: string | null;
}) {
  const wording = await customerMessageText(input.locale);
  const firstName = String(input.customerName || "").trim().split(/\s+/)[0] || "";
  const ahead = (iso: string | null | undefined) => Boolean(iso) && new Date(String(iso)).getTime() > Date.now();
  const deadline = ahead(input.holdUntil)
    ? wording.t("linkHeldUntil", { time: customerDateTime(String(input.holdUntil), wording.locale) })
    : ahead(input.expiresAt)
      ? wording.t("linkValidUntil", { time: customerDateTime(String(input.expiresAt), wording.locale) })
      : "";
  return [
    firstName ? wording.t("hi", { name: firstName }) : wording.t("hiNoName"),
    `${wording.t("linkIntro", { vehicle: input.vehicle || "vehicle" })}\n${input.url}`,
    wording.t("linkAsk"),
    deadline,
    input.business
  ]
    .filter(Boolean)
    .join("\n\n");
}
