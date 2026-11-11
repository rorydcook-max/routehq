import { InspectionForm } from "@/components/inspection-form";
import { canDecideMoney, getCurrentMembership } from "@/lib/auth/roles";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getInspectionContextByRental } from "@/lib/inspection-detail";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { earlyHandoverBlocker } from "@/lib/rental-conflicts";
import { businessToday } from "@/lib/business-time";
import { getTranslations } from "next-intl/server";
import { longDate } from "@/lib/i18n/dates";
import { getLocale } from "next-intl/server";
import { freshPromptPayQrUrl } from "@/lib/promptpay-qr";
import { methodsFor, organizationOffersPromptPay } from "@/lib/payment-methods";
import type { HandoverPayOptions } from "@/components/handover-payment-step";

export default async function DeliveryInspectionPage({ params, searchParams }: { params: Promise<{ rentalId: string }>; searchParams: Promise<{ swap?: string; vehicle?: string }> }) {
  const { rentalId } = await params;
  const query = await searchParams;
  const [userEmail, organization, membership] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), getCurrentMembership()]);
  // ?swap=1: a change of vehicle during the rental (see lib/inspection-detail.ts).
  const context = await getInspectionContextByRental(rentalId, organization.id, "delivery", query.swap === "1" ? { vehicleId: query.vehicle || null } : undefined);

  // A booking sent to the customer that they have not signed yet: say so before the keys change hands.
  let unsigned = false;
  let blocker: string | null = null;
  let blockerLinks: { otherRentalId: string; code: string } | null = null;
  if (query.swap !== "1" && String((context as any).rental?.status || "") === "booked") {
    const supabase = (await createSupabaseServerClient()) as any;
    const { data: links } = await supabase.from("booking_links").select("contract_signed_at").eq("rental_id", rentalId).is("deleted_at", null);
    unsigned = (links || []).length > 0 && (links || []).every((link: any) => !link.contract_signed_at);
    // Handing over early while another customer still has the vehicle: say so here, not after the photos.
    const rental = (context as any).rental;
    const inWay = await earlyHandoverBlocker(supabase, { organizationId: organization.id, vehicleId: String((context as any).vehicle?.id || rental?.vehicle_id || ""), rentalId, startDate: rental?.start_date, endDate: rental?.end_date || null, today: businessToday() });
    if (inWay) {
      blockerLinks = { otherRentalId: inWay.rentalId, code: inWay.code || "" };
      const [t, locale] = await Promise.all([getTranslations("inspection"), getLocale()]);
      const today = businessToday();
      blocker =
        inWay.startDate > today
          ? t("bookedBetweenBlocker", { code: inWay.code || "", customer: inWay.customerName || "", from: longDate(inWay.startDate, locale), to: inWay.endDate ? longDate(inWay.endDate, locale) : "" })
          : t("stillOutBlocker", { code: inWay.code || "", customer: inWay.customerName || "", date: inWay.endDate ? longDate(inWay.endDate, locale) : "" });
    }
  }

  // The payment step: the business's ways of being paid, and the customer's booking page (pay there and send a slip).
  let pay: HandoverPayOptions | null = null;
  if (query.swap !== "1") {
    const supabase = (await createSupabaseServerClient()) as any;
    const { data: link } = await supabase.from("booking_links").select("token, public_url").eq("rental_id", rentalId).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const org = organization as any;
    const base = String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    // PromptPay only for businesses in Thailand (lib/payment-methods.ts).
    const promptPay = organizationOffersPromptPay(org);
    pay = {
      accepted: methodsFor(Array.isArray(org.accepted_payment_methods) ? (org.accepted_payment_methods as string[]) : ["cash"], promptPay),
      defaultMethod: org.default_payment_method === "promptpay" && !promptPay ? null : org.default_payment_method || null,
      promptpayId: (promptPay && org.promptpay_id) || null,
      promptpayQrUrl: promptPay && org.promptpay_qr_url ? await freshPromptPayQrUrl(supabase, org.promptpay_qr_url, 60 * 60).catch(() => null) : null,
      promptpayQrPayload: (promptPay && org.promptpay_qr_url && org.settings?.promptpay_qr_payload) || null,
      bankName: org.bank_name || null,
      bankAccountNumber: org.bank_account_number || null,
      bankAccountName: org.bank_account_name || null,
      wiseLink: org.wise_link || null,
      revolutLink: org.revolut_link || null,
      portalPath: link?.token ? `/book/${link.token}` : null,
      portalUrl: link?.public_url || (link?.token && base ? `${base}/book/${link.token}` : null)
    };
  }

  return (
    <AppShell userEmail={userEmail}>
      <InspectionForm blocker={blocker} blockerLinks={blockerLinks} canWaive={canDecideMoney(membership?.role)} context={context} pay={pay} unsigned={unsigned} />
    </AppShell>
  );
}
