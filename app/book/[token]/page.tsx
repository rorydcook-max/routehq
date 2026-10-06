import type { ReactNode } from "react";
import { AlertTriangle, CalendarDays, Clock, CreditCard, MapPin, ReceiptText, ShieldCheck } from "lucide-react";
import { VehicleKindIcon } from "@/components/vehicle-kind-icon";
import { kindFromCategory } from "@/lib/vehicle-groups";
import { ActiveRentalPortal } from "./active-rental-portal";
import { CancelBooking } from "./cancel-booking";
import { BookingCompletionForm } from "./booking-completion-form";
import { getPublicBookingDetail } from "@/lib/public-booking";
import { BusinessLogoImage } from "@/components/business-logo-image";
import { isMapsUrl, formatDeliveryLocation } from "@/lib/delivery-location";
import { toWallTime } from "@/lib/business-time";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPortalPayments } from "@/lib/payment-receipts";
import { bookingRules } from "@/lib/booking-rules";
import { rentalRateCard } from "@/lib/rental-estimate";
import { nextMonthlyDue } from "@/lib/open-ended-billing";
import { chatInvites } from "@/lib/customer-chat-link";
import { promptPayQrSvg } from "@/lib/promptpay";
import { PortalPayments } from "./portal-payments";
import { getLocale, getTranslations } from "next-intl/server";
import { CustomerLanguagePicker } from "@/components/customer-language-picker";

/** The page's words in the customer's language. Passed to the helpers below so they stay plain functions. */
type T = Awaited<ReturnType<typeof getTranslations>>;

/** An amendment waiting for this customer's signature, if any. */
async function pendingAmendmentFor(rentalId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("rental_amendments")
    .select("token, expires_at")
    .eq("rental_id", rentalId)
    .eq("status", "awaiting_signature")
    .maybeSingle();
  return data && new Date(data.expires_at).getTime() > Date.now() ? (data.token as string) : null;
}

function money(value: unknown, currency = "THB") {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

function rateLabel(rental: any, t: T) {
  const currency = String(rental?.currency || "THB");
  const rate = money(rental?.rental_rate, currency);
  const period = String(rental?.pricing_model || "monthly").toLowerCase().replace(/_/g, " ").trim();
  if (period === "daily") {
    // Daily rent is paid in one go, so say what the whole stay comes to.
    const start = String(rental?.start_date || "").slice(0, 10);
    const end = String(rental?.end_date || "").slice(0, 10);
    const days = start && end ? Math.round((new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000) : 0;
    return days > 1 ? `${t("perDay", { rate })}\n${t("totalForDays", { total: money(Number(rental?.rental_rate || 0) * days, currency), days })}` : t("perDay", { rate });
  }
  if (period === "weekly") return t("perWeek", { rate });
  if (period === "custom") return t("forTheRental", { rate });
  return t("perMonth", { rate });
}

function vehicleTitle(vehicle: any) {
  return [vehicle?.make, vehicle?.model, vehicle?.trim].filter(Boolean).join(" ");
}

function includedItems(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function contactHref(phone: string | null | undefined) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  const normalized = digits.startsWith("0") ? `66${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}`;
}

function normalizedDeliveryMethod(value: unknown) {
  if (value === "deliver") return "delivery";
  if (value === "collect") return "collection";
  if (value === "collection" || value === "tbd" || value === "delivery") return value;
  return "delivery";
}

function deliveryText(rental: any, bookingData: Record<string, unknown>, t: T, locale: string) {
  const method = normalizedDeliveryMethod(rental?.delivery_method || bookingData.delivery_method);
  const rawLocation = String(bookingData.delivery_location || rental?.delivery_location || "").trim();
  const locationWasMapsUrl = isMapsUrl(rawLocation);
  const location = locationWasMapsUrl ? formatDeliveryLocation(rawLocation) : rawLocation;
  const dateTime = toWallTime(bookingData.delivery_datetime || rental?.delivery_datetime || "");
  const methodLabel = method === "tbd" ? t("handoverToBeArranged") : method === "collection" ? t("youCollect") : t("weDeliver");
  const mapsUrl = deliveryMapsUrl(bookingData, rawLocation);
  const displayLocation = locationWasMapsUrl ? location : formatDeliveryAddress(location);

  return {
    location: location ? `${methodLabel}:\n${displayLocation}${mapsUrl ? `\n${mapsUrl}` : ""}` : method === "tbd" ? methodLabel : `${methodLabel}\n${t("placeToBeConfirmed")}`,
    time: formatDeliveryDateTime(dateTime, t, locale)
  };
}

function coordinate(value: unknown, limit: number) {
  // Number(null) and Number("") are 0, which put customers at 0,0 in the Atlantic.
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

function deliveryMapsUrl(bookingData: Record<string, unknown>, address: string) {
  const placeId = String(bookingData.delivery_place_id || "").trim();
  const lat = coordinate(bookingData.delivery_lat, 90);
  const lng = coordinate(bookingData.delivery_lng, 180);
  if (lat !== null && lng !== null && !(lat === 0 && lng === 0)) {
    const query = `${lat},${lng}`;
    return placeId
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&query_place_id=${encodeURIComponent(placeId)}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  if (address) {
    // No usable coordinates: search for the address as typed.
    return placeId
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}&query_place_id=${encodeURIComponent(placeId)}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
  return "";
}

function countryCode(country: string) {
  const codes: Record<string, string> = {
    thailand: "TH",
    indonesia: "ID",
    philippines: "PH",
    vietnam: "VN",
    malaysia: "MY",
    singapore: "SG",
    laos: "LA",
    cambodia: "KH",
    china: "CN",
    japan: "JP",
    taiwan: "TW",
    "south korea": "KR",
    brunei: "BN",
    india: "IN",
    bangladesh: "BD",
    "sri lanka": "LK"
  };
  // Only real countries get a code. Guessing from the first two letters turned
  // "Lamai Beach, Koh Samui" into "Lamai Beach / KO".
  return codes[country.toLowerCase()] || null;
}

function formatDeliveryAddress(address: string) {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return address;

  // The last part is only a country if we recognise it; otherwise it is part of the address.
  const countrySuffix = countryCode(parts.at(-1) || "") || "";
  const addressParts = countrySuffix ? parts.slice(0, -1) : parts;
  const finalArea = addressParts.at(-1) || "";
  const postalMatch = finalArea.match(/\b\d{4,6}(?:-\d{4})?\b$/);
  const postalCode = postalMatch?.[0] || "";
  const region = postalCode ? finalArea.replace(postalCode, "").trim() : finalArea;
  const areaParts = addressParts.slice(0, -1);
  const lines = [
    ...areaParts,
    region,
    [postalCode, countrySuffix].filter(Boolean).join(" ")
  ].filter(Boolean);

  return lines.join("\n");
}

function formatDeliveryDateTime(value: string, t: T, locale: string) {
  if (!value) return t("toBeConfirmed");
  const normalized = value.replace(" ", "T");
  const [datePart, timePart = ""] = normalized.split("T");
  const time = timePart.slice(0, 5);
  return time ? `${formatSummaryDate(datePart, t, locale)}\n${time}` : formatSummaryDate(datePart, t, locale);
}

function paymentDueText(rental: any, bookingData: Record<string, unknown>, t: T, locale: string) {
  const deliveryDateTime = toWallTime(bookingData.delivery_datetime || rental?.delivery_datetime || rental?.start_date || "");
  const firstDueDate = formatSummaryDate(deliveryDateTime, t, locale);
  const period = String(rental?.pricing_model || "monthly").toLowerCase();
  const endDate = rental?.is_indefinite || !rental?.end_date ? "" : formatSummaryDate(rental?.end_date, t, locale);

  // Daily and one-off agreed prices are a single payment for the whole rental.
  if (period === "custom" || period === "daily") return t("onePayment", { date: firstDueDate });

  // A rental that fits in one billing period has one payment - don't describe a repeating schedule.
  const firstIso = String(deliveryDateTime || "").slice(0, 10);
  const endIso = String(rental?.end_date || "").slice(0, 10);
  if (endIso && /^\d{4}-\d{2}-\d{2}$/.test(firstIso)) {
    const next = new Date(`${firstIso}T00:00:00Z`);
    if (period === "daily") next.setUTCDate(next.getUTCDate() + 1);
    else if (period === "weekly") next.setUTCDate(next.getUTCDate() + 7);
    else next.setUTCMonth(next.getUTCMonth() + 1);
    if (next.toISOString().slice(0, 10) >= endIso) return t("onePayment", { date: firstDueDate });
  }

  const weekly = period === "weekly";
  return endDate
    ? `${firstDueDate}\n${t(weekly ? "thenEachWeekUntil" : "thenEachMonthUntil", { end: endDate })}`
    : `${firstDueDate}\n${t(weekly ? "thenEachWeek" : "thenEachMonth")}`;
}

/** "2026-10-01" -> "1 Oct 2026" in the customer's language; the calendar date is kept as written. */
function formatSummaryDate(value: unknown, t: T, locale: string) {
  const raw = String(value || "").trim();
  if (!raw) return t("toBeConfirmed");
  const date = raw.split("T")[0] || raw;
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return date;
  // Western year numbering everywhere, so a date on this page matches the same date on the agreement.
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : `${locale}-u-ca-gregory`, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
}

async function ErrorState({ title, message, contact, rebookHref, rebookLabel }: { title: string; message: string; contact?: string | null; rebookHref?: string | null; rebookLabel?: string }) {
  const t = await getTranslations("customer");
  return (
    <main className="min-h-screen bg-[#fbfaf8] px-4 py-8">
      <div className="mx-auto mb-3 flex max-w-xl justify-end">
        <CustomerLanguagePicker />
      </div>
      <section className="mx-auto max-w-xl rounded-2xl border border-[var(--border)] bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#ffe4e6] text-[#be123c]">
          <AlertTriangle />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-[var(--foreground)]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{message}</p>
        {rebookHref ? (
          <a className="pressable mt-5 inline-flex rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white" href={rebookHref}>
            {rebookLabel || t("chooseOtherDates")}
          </a>
        ) : null}
        {contact ? (
          <a className={`pressable mt-5 inline-flex rounded-xl px-5 py-3 text-sm font-semibold ${rebookHref ? "ml-2 border border-[var(--border)] bg-white text-[var(--foreground)]" : "bg-[var(--primary)] text-white"}`} href={contact}>
            {t("contactBusiness")}
          </a>
        ) : null}
      </section>
    </main>
  );
}

export default async function PublicBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const detail = await getPublicBookingDetail(token);
  const [t, locale] = await Promise.all([getTranslations("customer"), getLocale()]);

  if (detail.state === "not_found") {
    return <ErrorState message={t("notFoundMessage")} title={t("notFoundTitle")} />;
  }

  const organization = detail.organization || {};
  const customer = detail.customer || {};
  const contact = contactHref(organization?.settings?.phone || organization?.settings?.business_phone || customer?.phone);

  if (detail.state === "expired") {
    return <ErrorState contact={contact} message={t("expiredMessage", { business: organization?.name || t("theRentalBusiness") })} title={t("expiredTitle")} />;
  }

  if (detail.state === "taken") {
    const onlineBooking = organization?.settings?.public_booking?.enabled === true && organization?.slug;
    return (
      <ErrorState
        contact={contact}
        message={onlineBooking ? t("takenMessageOnline") : t("takenMessageContact", { business: organization?.name || t("theRentalBusiness") })}
        rebookHref={onlineBooking ? `/rent/${organization.slug}` : null}
        title={t("takenTitle")}
      />
    );
  }

  if (detail.state === "cancelled") {
    const onlineBooking = organization?.settings?.public_booking?.enabled === true && organization?.slug;
    return (
      <ErrorState
        contact={contact}
        message={t("cancelledMessage", { business: organization?.name || t("theRentalBusiness") })}
        rebookHref={onlineBooking ? `/rent/${organization.slug}` : null}
        rebookLabel={t("bookAgain")}
        title={t("cancelledTitle")}
      />
    );
  }

  if (!detail.completion || !detail.documentStatus || !detail.bookingLink) {
    return <ErrorState contact={contact} message={t("incompleteMessage")} title={t("incompleteTitle")} />;
  }

  const vehicle = detail.vehicle || {};
  const rental = detail.rental || {};
  const bookingData = (detail.bookingLink?.booking_data || {}) as Record<string, unknown>;
  const delivery = deliveryText(rental, bookingData, t, locale);
  const businessName = organization?.name || t("theRentalBusiness");
  const handedOver = detail.state === "active" || detail.state === "completed";
  const included = includedItems(detail.bookingLink?.included_items);
  const logoUrl = organization?.logo_display_url || null;
  const ownerContact = organization?.settings?.phone || organization?.settings?.business_phone || organization?.owner_phone || null;
  const executedDownloads = detail.executedAgreementDownloads || null;
  // Payments can be made from this page as soon as the agreement is signed: before handover, on rent,
  // and after the return if anything is still owed.
  const canPayHere = rental?.id && (detail.state === "active" || detail.state === "completed" || (detail.state === "ready" && detail.completion?.agreement));
  const wantsInvites = rental?.id && customer?.id && (detail.state === "active" || (detail.state === "ready" && detail.completion?.agreement));
  // These don't depend on each other: fetch them together.
  const [pendingAmendmentToken, portal, invites] = await Promise.all([
    rental?.id ? pendingAmendmentFor(String(rental.id)) : Promise.resolve(null),
    canPayHere ? getPortalPayments(String(rental.id), detail.org_payment?.promptpay_id) : Promise.resolve({ payments: [], bundle: null } as Awaited<ReturnType<typeof getPortalPayments>>),
    wantsInvites
      ? chatInvites(createSupabaseAdminClient() as any, { organizationId: String(rental.organization_id || organization?.id || ""), customerId: String(customer.id), token }).catch(() => [])
      : Promise.resolve([])
  ]);
  // Before signing, "pay now" shows one QR for what is due at the start.
  // What is due at the start: the first rent and the deposit.
  const firstPaymentAmount = Number(rental?.outstanding_balance || 0) > 0 ? Number(rental.outstanding_balance) : Number(rental?.rental_rate || 0) + Number(rental?.deposit_amount || 0);
  const firstPaymentQr =
    detail.state === "ready" && !detail.completion?.agreement && detail.org_payment?.promptpay_id && String(rental?.currency || "THB") === "THB"
      ? await promptPayQrSvg(detail.org_payment.promptpay_id, firstPaymentAmount)
      : null;

  const bookingSummary = (
    <>
          <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[#fbfaf8] p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
                <VehicleKindIcon boxed={false} kind={kindFromCategory(vehicle.vehicle_categories)} size={28} />
              </span>
              <div>
                <h2 className="text-2xl font-semibold">{vehicleTitle(vehicle)}</h2>
                <p className="mt-1 text-sm font-bold text-[var(--muted)]">{vehicle.registration_number || t("platePending")} {vehicle.color ? `- ${vehicle.color}` : ""}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Info className="col-span-2 sm:col-span-1" icon={CalendarDays} label={t("rentalPeriod")} value={rental.is_indefinite && detail.state !== "completed" ? t("openEndedFrom", { date: formatSummaryDate(rental.start_date, t, locale) }) : t("dateRange", { start: formatSummaryDate(rental.start_date, t, locale), end: formatSummaryDate(rental.end_date, t, locale) })} />
              <Info icon={CreditCard} label={t("rateAndDeposit")} value={`${rateLabel(rental, t)}\n${Number(rental.deposit_amount || 0) > 0 ? t("depositAmount", { amount: money(rental.deposit_amount, rental.currency || "THB") }) : t("noDeposit")}`} />
              {/* Once the customer has the vehicle, where and when it was to be handed over is old news. */}
              {handedOver ? null : <Info icon={ReceiptText} label={t("firstPaymentDue")} value={paymentDueText(rental, bookingData, t, locale)} />}
              {handedOver ? null : <Info icon={MapPin} label={t("handover")} value={delivery.location} />}
              {handedOver ? null : <Info icon={Clock} label={t("handoverTime")} value={delivery.time} />}
            </div>
          </div>

          {included.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {included.map((item) => (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-light)] px-3 py-1.5 text-xs font-bold text-[var(--primary)]" key={item}>
                  <ShieldCheck size={14} />
                  {item}
                </span>
              ))}
            </div>
          ) : null}
    </>
  );

  return (
    <main className="min-h-screen bg-[#fbfaf8] px-4 py-5 text-[var(--foreground)]">
      <div className="mx-auto max-w-3xl space-y-5">
        {pendingAmendmentToken ? (
          <a
            className="pressable flex items-center justify-between gap-3 rounded-2xl border border-[#bfe0db] bg-[var(--primary-light)] p-4 shadow-sm"
            href={`/amend/${pendingAmendmentToken}`}
          >
            <span>
              <span className="block text-sm font-semibold text-[var(--primary)]">{t("changeNeedsSignature")}</span>
              <span className="block text-xs text-[var(--foreground-secondary)]">{t("changeSeeAndSign")}</span>
            </span>
            <span className="shrink-0 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">{t("review")}</span>
          </a>
        ) : null}
        <div className="flex justify-end">
          <CustomerLanguagePicker />
        </div>
        <header className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <BusinessLogoImage
              alt={`${organization.name} logo`}
              className="max-h-[60px] max-w-[160px] object-contain"
              fallback={<span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary)] text-lg font-semibold text-white">{String(organization?.name || "F").slice(0, 1)}</span>}
              src={logoUrl}
            />
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--primary)]">{t("rentalBooking")}</p>
              {logoUrl ? null : <h1 className="text-xl font-semibold">{organization?.name || ""}</h1>}
            </div>
          </div>

          {/* On rent, the page leads with the rental itself; what was booked is one tap away. */}
          {detail.state === "active" ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--primary)]">{t("yourBookingDetails")}</summary>
              {bookingSummary}
            </details>
          ) : (
            bookingSummary
          )}
        </header>

        {invites.length > 0 && detail.state !== "completed" ? (
          <section className="rounded-2xl border border-[#bfe0db] bg-[var(--primary-light)] p-4 shadow-sm">
            <p className="text-sm font-semibold text-[var(--foreground)]">{t("updatesTitle")}</p>
            <p className="mt-1 text-sm leading-6 text-[var(--foreground-secondary)]">
              {t("updatesBody", { business: businessName })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {invites.map((invite) => (
                <a className="pressable inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white" href={invite.url} key={invite.provider} rel="noreferrer" target="_blank">
                  {t("updatesOn", { app: invite.label })}
                </a>
              ))}
            </div>
          </section>
        ) : null}

        {detail.state === "active" ? (
          <ActiveRentalPortal
            bookingData={bookingData}
            deliveryPhotoUrls={detail.deliveryPhotoUrls || []}
            organizationName={businessName}
            endNoticeDays={bookingRules(organization?.settings).endNoticeDays}
            extensionRates={rentalRateCard(vehicle, rental)}
            openEndedOffer={await openEndedOffer(vehicle, rental)}
            orgPayment={detail.org_payment}
            ownerContact={ownerContact}
            paymentBundle={portal.bundle}
            payments={portal.payments}
            rental={rental}
            signedContractUrl={executedDownloads?.originalAgreementUrl || detail.signedContractUrl}
            certificateUrl={executedDownloads?.executionCertificateUrl || null}
            token={token}
            vehicle={vehicle}
          />
        ) : detail.state === "completed" ? (
          <>
          {portal.payments.length > 0 ? (
            <PortalPayments bundle={portal.bundle} orgPayment={detail.org_payment} organizationName={businessName} payments={portal.payments} token={token} />
          ) : null}
          <section className="rounded-2xl border border-[var(--border)] bg-white p-5 text-center shadow-sm">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f0fdf4] text-[#16a34a]">
              <ShieldCheck size={28} />
            </span>
            <h2 className="mt-4 text-2xl font-semibold text-[var(--foreground)]">{t("completedTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {t("vehicleIsBack", { business: businessName })} {portal.payments.length > 0 ? t("stillSomethingToPay") : t("thankYouForRenting")}
            </p>
            {(() => {
              const held = Number(rental.deposit_held || 0);
              if (held <= 0) return null;
              const returned = Number(rental.deposit_refunded_amount || 0);
              const kept = Number(rental.deposit_forfeited_amount || 0);
              const left = Math.max(0, held - returned - kept);
              const reason = String(rental.deposit_deduction_reason || "").split(" — ")[0].trim().toLowerCase();
              const currency = rental.currency || "THB";
              return (
                <div className="mx-auto mt-4 max-w-sm rounded-xl border border-[var(--border)] bg-[#fbfaf8] p-3 text-left text-sm text-[var(--foreground-secondary)]">
                  <p className="font-semibold text-[var(--foreground)]">{t("yourDeposit", { amount: money(held, currency) })}</p>
                  {returned > 0 ? <p className="mt-1">{t("depositReturned", { amount: money(returned, currency) })}</p> : null}
                  {kept > 0 ? <p className="mt-1">{t("depositKept", { amount: money(kept, currency) })}{reason ? ` (${reason})` : ""}</p> : null}
                  {left > 0 ? <p className="mt-1">{t("depositStillToSettle", { amount: money(left, currency) })}</p> : null}
                </div>
              );
            })()}
            {contact ? (
              <a className="pressable mt-5 inline-flex rounded-xl border border-[var(--primary)] bg-white px-5 py-3 text-sm font-semibold text-[var(--primary)]" href={contact}>
                {t("contactNamed", { business: businessName })}
              </a>
            ) : null}
            {executedDownloads?.originalAgreementUrl || executedDownloads?.executionCertificateUrl ? (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {executedDownloads.originalAgreementUrl ? (
                  <a className="pressable inline-flex rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white" href={executedDownloads.originalAgreementUrl} rel="noreferrer" target="_blank">
                    {t("downloadAgreement")}
                  </a>
                ) : null}
                {executedDownloads.executionCertificateUrl ? (
                  <a className="pressable inline-flex rounded-xl border border-[var(--primary)] bg-white px-5 py-3 text-sm font-semibold text-[var(--primary)]" href={executedDownloads.executionCertificateUrl} rel="noreferrer" target="_blank">
                    {t("proofOfSigning")}
                  </a>
                ) : null}
              </div>
            ) : null}
          </section>
          </>
        ) : (
          <div className="flex flex-col gap-5">
          {detail.state === "ready" ? (
            <PortalPayments bundle={portal.bundle} orgPayment={detail.org_payment} organizationName={businessName} payments={portal.payments} token={token} />
          ) : null}
          <BookingCompletionForm
            detail={{
              token,
              organizationName: businessName,
              vehicleWithCustomer: ["active", "due_soon", "overdue", "extended"].includes(String(rental?.status || "")),
              customer,
              completion: detail.completion,
              documentStatus: detail.documentStatus,
              bookingData,
              contractHtml: detail.contractHtml,
              orgPayment: detail.org_payment,
              promptPayQrSvg: firstPaymentQr,
              bookingReference: String(detail.bookingLink?.reference || detail.bookingLink?.reference_number || detail.bookingLink?.id || token).slice(0, 18),
              rentalRate: Number(rental?.rental_rate || 0),
              depositAmount: Number(rental?.deposit_amount || 0),
              outstandingBalance: Number(rental?.outstanding_balance || 0),
              currency: String(rental?.currency || "THB"),
              billingPeriod: String(rental?.billing_interval || rental?.pricing_model || "monthly"),
              rentalDocumentAgreement: detail.rentalDocumentAgreement,
              executedAgreementDownloads: detail.executedAgreementDownloads,
            }}
          />
          {["booked", "draft"].includes(String(rental?.status || "")) ? <CancelBooking organizationName={businessName} token={token} /> : null}
          </div>
        )}
      </div>
    </main>
  );
}

async function Info({ className = "", icon: Icon, label, value }: { className?: string; icon: typeof Clock; label: string; value: string }) {
  const t = await getTranslations("customer");
  const lines = value.split("\n");
  return (
    <div className={`rounded-xl border border-[var(--border)] bg-white p-3 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[var(--muted)]">
        <Icon className="text-[var(--primary)]" size={15} />
        {label}
      </div>
      <p className="mt-1 whitespace-pre-line text-sm font-bold text-[var(--foreground)]">
        {lines.map((line, index) => (
          line.startsWith("https://www.google.com/maps") ? (
            <a className="text-[var(--primary)] underline underline-offset-2" href={line} key={`${line}-${index}`} rel="noreferrer" target="_blank">
              {t("viewOnMap")}
            </a>
          ) : line.startsWith("https://") ? (
            <a className="break-all text-[var(--primary)] underline underline-offset-2" href={line} key={`${line}-${index}`} rel="noreferrer" target="_blank">
              {line}
            </a>
          ) : (
            <span key={`${line}-${index}`}>{line}</span>
          )
        )).reduce<ReactNode[]>((nodes, node, index) => (index ? [...nodes, "\n", node] : [node]), [])}
      </p>
    </div>
  );
}

/** What keeping the vehicle with no end date would cost, when it can be offered. */
async function openEndedOffer(vehicle: any, rental: any) {
  const end = rental?.end_date ? String(rental.end_date).slice(0, 10) : null;
  const monthlyRate = rentalRateCard(vehicle, rental || {}).monthlyRate;
  if (!end || !(monthlyRate > 0)) return null;
  const monthly = String(rental.billing_interval || rental.pricing_model || "").toLowerCase() === "monthly";
  const firstDue = await nextMonthlyDue(createSupabaseAdminClient() as any, String(rental.id), end, monthly).catch(() => end);
  return { monthlyRate, firstDue };
}
