import { InfoTip } from "@/components/info-tip";
import { includedItemKey } from "@/lib/included-items";
import { billingPeriodAmounts } from "@/lib/payment-schedule";
import { firstRentCharge } from "@/lib/payment-schedule";
import type { ReactNode } from "react";
import { customerDate, customerDateTime } from "@/lib/i18n/customer-dates";
import { AlertTriangle, CalendarClock, CalendarDays, Clock, CreditCard, MapPin, ShieldCheck } from "lucide-react";
import { VehicleArt } from "@/components/vehicle-art";
import { kindFromCategory } from "@/lib/vehicle-groups";
import { ActiveRentalPortal } from "./active-rental-portal";
import { CancelBooking } from "./cancel-booking";
import { BookingCompletionForm } from "./booking-completion-form";
import { getPublicBookingDetail } from "@/lib/public-booking";
import { BrandStyle } from "@/components/brand-style";
import { PublicBrand, PublicShell } from "@/components/public-shell";
import { isMapsUrl, formatDeliveryLocation } from "@/lib/delivery-location";
import { toWallTime } from "@/lib/business-time";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { vehiclePhotoUrls } from "@/lib/vehicle-photos";
import { getPortalPayments } from "@/lib/payment-receipts";
import { bookingRules } from "@/lib/booking-rules";
import { rentalRateCard } from "@/lib/rental-estimate";
import { nextMonthlyDue } from "@/lib/open-ended-billing";
import { chatInvites } from "@/lib/customer-chat-link";
import { paymentQrSvg } from "@/lib/promptpay";
import { PortalPayments } from "./portal-payments";
import { getLocale, getTranslations } from "next-intl/server";
import { formatMoney as formatRegionalMoney } from "@/lib/regional";
import { businessCountry } from "@/lib/business-units";
import { dialCodeFor, toInternationalPhone } from "@/lib/phone";

/** The page's words in the customer's language. Passed to the helpers below so they stay plain functions. */
type T = Awaited<ReturnType<typeof getTranslations>>;

/** Paid extras the customer picked (child seat, delivery...), on their own line under the rent. */
function extrasText(rental: any, t: T) {
  const total = Number(rental?.extras_total || 0);
  if (!(total > 0)) return "";
  const names = (Array.isArray(rental?.extras) ? rental.extras : []).filter((line: any) => !line?.removed_at).map((line: any) => String(line?.name || "")).filter(Boolean);
  return "\n" + t("extrasLine", { names: names.join(", ") || "-", amount: money(total, rental?.currency || "THB") });
}

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

/** Handover / return reports finished without the customer, waiting for their signature (lib/inspection-signature.ts). */
async function reportsToSign(rentalId: string) {
  const { data } = await (createSupabaseAdminClient() as any)
    .from("inspections")
    .select("id, type")
    .eq("rental_id", rentalId)
    .in("type", ["delivery", "return"])
    .not("signature_requested_at", "is", null)
    .is("customer_signature", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  return (data || []) as Array<{ id: string; type: "delivery" | "return" }>;
}

function money(value: unknown, currency = "THB") {
  return currency === "THB" ? new Intl.NumberFormat("th-TH", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0)) : formatRegionalMoney(Number(value || 0), currency, "en-GB");
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
    // Once the vehicle is back, the dates are the days it was out, not what was booked and charged (an early return
    // the owner kept as booked): the payments below say what is owed.
    const finished = ["completed", "returned", "closed", "cancelled"].includes(String(rental?.status || ""));
    return days > 1 && !finished ? `${t("perDay", { rate })}\n${t("totalForDays", { total: money(Number(rental?.rental_rate || 0) * days, currency), days })}` : t("perDay", { rate });
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
  // A number saved without its code gets the business's own country code (none when its country isn't set).
  const international = toInternationalPhone(phone, dialCodeFor(businessCountry()));
  const digits = String(international || "").replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits}`;
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
    time: formatDeliveryDateTime(dateTime, t, locale),
    // "Handover to be arranged" already says the time is open too: no second "To be confirmed" line under it.
    arrangeLater: method === "tbd" && !location && !dateTime
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
  // Set dates: say what the later payments are and what it all comes to, so a part month at the end is no surprise.
  const rate = Number(rental?.rental_rate || 0);
  if (endIso && rate > 0 && /^\d{4}-\d{2}-\d{2}$/.test(firstIso) && (period === "monthly" || period === "weekly")) {
    const amounts = billingPeriodAmounts(firstIso, endIso, period, rate, weekly ? 52 : 24);
    if (amounts.length >= 2) {
      const currency = rental?.currency || "THB";
      const total = amounts.reduce((sum, amount) => sum + amount, 0);
      const last = amounts[amounts.length - 1];
      const second = new Date(`${firstIso}T00:00:00Z`);
      if (weekly) second.setUTCDate(second.getUTCDate() + 7);
      else second.setUTCMonth(second.getUTCMonth() + 1);
      const lines = [firstDueDate];
      if (amounts.length === 2) lines.push(t("thenAmountOn", { amount: money(last, currency), date: formatSummaryDate(second.toISOString().slice(0, 10), t, locale) }));
      else {
        lines.push(t(weekly ? "thenEachWeekUntil" : "thenEachMonthUntil", { end: endDate }));
        if (last < rate) lines.push(t("lastPaymentIs", { amount: money(last, currency) }));
      }
      lines.push(t("totalForStay", { amount: money(total, currency) }));
      return lines.join("\n");
    }
  }
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
  return customerDate(date, locale);
}

async function ErrorState({ title, message, contact, rebookHref, rebookLabel, brand }: { title: string; message: string; contact?: string | null; rebookHref?: string | null; rebookLabel?: string; brand?: ReactNode }) {
  const t = await getTranslations("customer");
  return (
    <PublicShell brand={brand} width="narrow">
      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--danger-light)] text-[var(--danger)]">
          <AlertTriangle />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-[var(--foreground)]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{message}</p>
        {rebookHref ? (
          <a className="pressable mt-5 inline-flex rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white" href={rebookHref}>
            {rebookLabel || t("chooseOtherDates")}
          </a>
        ) : null}
        {contact ? (
          <a className={`pressable mt-5 inline-flex rounded-full px-5 py-3 text-sm font-semibold ${rebookHref ? "ml-2 border-2 border-[var(--primary)] bg-white text-[var(--primary)]" : "bg-[var(--primary)] text-white"}`} href={contact}>
            {t("contactBusiness")}
          </a>
        ) : null}
      </section>
    </PublicShell>
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
  // Who the page is from, in the shared header row: the business logo or letter, and its name.
  const errorBrand = organization?.name ? <PublicBrand logoUrl={organization?.logo_display_url || null} name={String(organization.name)} /> : undefined;

  if (detail.state === "expired") {
    return <ErrorState brand={errorBrand} contact={contact} message={t("expiredMessage", { business: organization?.name || t("theRentalBusiness") })} title={t("expiredTitle")} />;
  }

  if (detail.state === "taken") {
    const onlineBooking = organization?.settings?.public_booking?.enabled === true && organization?.slug;
    return (
      <ErrorState
        brand={errorBrand}
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
        brand={errorBrand}
        contact={contact}
        message={t("cancelledMessage", { business: organization?.name || t("theRentalBusiness") })}
        rebookHref={onlineBooking ? `/rent/${organization.slug}` : null}
        rebookLabel={t("bookAgain")}
        title={t("cancelledTitle")}
      />
    );
  }

  // An unsigned booking whose whole period is already over can't be signed for: those dates are gone.
  if (detail.state === "dates_passed") {
    const onlineBooking = organization?.settings?.public_booking?.enabled === true && organization?.slug;
    return (
      <ErrorState
        brand={errorBrand}
        contact={contact}
        message={t("datesPassedMessage", { business: organization?.name || t("theRentalBusiness") })}
        rebookHref={onlineBooking ? `/rent/${organization.slug}` : null}
        rebookLabel={t("bookAgain")}
        title={t("datesPassedTitle")}
      />
    );
  }

  if (!detail.completion || !detail.documentStatus || !detail.bookingLink) {
    return <ErrorState brand={errorBrand} contact={contact} message={t("incompleteMessage")} title={t("incompleteTitle")} />;
  }

  const vehicle = detail.vehicle || {};
  const rental = detail.rental || {};
  // The vehicle's main photo for the renter, when there is one (Rory, 1 Nov 2026: photos everywhere a vehicle is shown).
  const vehiclePhoto =
    vehicle.id && rental.organization_id
      ? ((await vehiclePhotoUrls(createSupabaseAdminClient() as any, String(rental.organization_id), 1, 6 * 3600, String(vehicle.id)).catch(() => new Map())).get(String(vehicle.id))?.[0] as string | undefined) || null
      : null;
  const bookingData = (detail.bookingLink?.booking_data || {}) as Record<string, unknown>;
  const delivery = deliveryText(rental, bookingData, t, locale);
  const businessName = organization?.name || t("theRentalBusiness");
  // Handed over: the link's own stage, or the rental itself (a vehicle handed over before the customer filled in
  // the link is out, though the link still asks for documents and a signature).
  const handedOver =
    detail.state === "active" || detail.state === "completed" || ["active", "due_soon", "overdue", "extended", "completed"].includes(String(detail.rental?.status || ""));
  const included = includedItems(detail.bookingLink?.included_items);
  const logoUrl = organization?.logo_display_url || null;
  const ownerContact = organization?.settings?.phone || organization?.settings?.business_phone || organization?.owner_phone || null;
  const executedDownloads = detail.executedAgreementDownloads || null;
  // Payments can be made from this page as soon as the agreement is signed: before handover, on rent,
  // and after the return if anything is still owed.
  const canPayHere = rental?.id && (detail.state === "active" || detail.state === "completed" || (detail.state === "ready" && detail.completion?.agreement));
  const wantsInvites = rental?.id && customer?.id && (detail.state === "active" || (detail.state === "ready" && detail.completion?.agreement));
  // These don't depend on each other: fetch them together (the customer is waiting on a phone).
  const onRent = detail.state === "active";
  const [pendingAmendmentToken, portal, invites, activeAnswers, activeOpenEndedOffer] = await Promise.all([
    rental?.id ? pendingAmendmentFor(String(rental.id)) : Promise.resolve(null),
    canPayHere ? getPortalPayments(String(rental.id), detail.org_payment?.promptpay_qr_url && !(detail.org_payment as any)?.promptpay_qr_payload ? null : detail.org_payment?.promptpay_id, (detail.org_payment as any)?.promptpay_qr_payload) : Promise.resolve({ payments: [], bundle: null } as Awaited<ReturnType<typeof getPortalPayments>>),
    wantsInvites
      ? chatInvites(createSupabaseAdminClient() as any, { organizationId: String(rental.organization_id || organization?.id || ""), customerId: String(customer.id), token }).catch(() => [])
      : Promise.resolve([]),
    onRent ? portalAnswers(rental?.id) : Promise.resolve(null),
    onRent ? openEndedOffer(vehicle, rental) : Promise.resolve(null),
    // Messages to this customer (reminders, receipts) go out in the language they read this page in.
    customer?.id
      ? (createSupabaseAdminClient() as any).from("customers").update({ preferred_locale: locale }).eq("id", customer.id).neq("preferred_locale", locale).then(() => null, () => null)
      : Promise.resolve(null)
  ]);
  const toSign = rental?.id ? await reportsToSign(String(rental.id)).catch(() => []) : [];
  // Before signing, "pay now" shows one QR for what is due at the start.
  // What is due at the start: the first rent and the deposit.
  const firstPaymentAmount = Number(rental?.outstanding_balance || 0) > 0 ? Number(rental.outstanding_balance) : firstRentCharge(rental) + Number(rental?.deposit_amount || 0) + Number(rental?.extras_total || 0);
  // The business's own uploaded QR always wins (Rory, 11 Nov 2026): with the amount filled in when its text was read
  // at upload, else the picture itself (the customer types the amount). With no upload, one made from the PromptPay ID.
  const ownQrText = (detail.org_payment as any)?.promptpay_qr_payload || null;
  const firstPaymentQr =
    detail.state === "ready" && !detail.completion?.agreement && String(rental?.currency || "THB") === "THB" && (ownQrText || (detail.org_payment?.promptpay_id && !detail.org_payment?.promptpay_qr_url))
      ? await paymentQrSvg({ payload: ownQrText, promptPayId: detail.org_payment?.promptpay_qr_url ? null : detail.org_payment?.promptpay_id }, firstPaymentAmount)
      : null;

  // Until it is signed, one short line says how long the customer has (Rory, 8 Nov 2026): the vehicle's hold while it
  // runs, otherwise how long the link works. On the business's clock, in the reader's language.
  const linkDeadline = (() => {
    if (handedOver || detail.completion?.agreement || detail.bookingLink?.contract_signed_at) return null;
    const ahead = (iso: unknown) => Boolean(iso) && new Date(String(iso)).getTime() > Date.now();
    const link = detail.bookingLink as { hold_until?: string | null; hold_released_at?: string | null; expires_at?: string | null };
    if (!link.hold_released_at && ahead(link.hold_until)) return t("holdLine", { time: customerDateTime(String(link.hold_until), locale) });
    if (ahead(link.expires_at)) return t("linkValidLine", { time: customerDateTime(String(link.expires_at), locale) });
    return null;
  })();

  const bookingSummary = (
    <>
          {linkDeadline ? (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--warning)]">
              <Clock aria-hidden="true" size={15} />
              {linkDeadline}
            </p>
          ) : null}
          {/* One white surface: the vehicle, then the facts as tinted tiles (no grey card nested inside the white one). */}
          <div className="mt-4 flex items-start gap-3">
            <span className="shrink-0">
              <VehicleArt colour={vehicle.color} kind={kindFromCategory(vehicle.vehicle_categories)} model={vehicle.model} photoUrl={vehiclePhoto} size="sm" />
            </span>
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold">{vehicleTitle(vehicle)}</h2>
              <p className="mt-1 text-sm font-bold text-[var(--muted)]"><bdi>{vehicle.registration_number || t("platePending")}</bdi>{vehicle.color ? <> · <bdi>{vehicle.color}</bdi></> : null}</p>
              {/* What's included sits with the vehicle it comes with, not floating under the details. */}
              {included.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {included.map((item) => (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-light)] px-3 py-1 text-xs font-bold text-[var(--primary)]" key={item}>
                      <ShieldCheck size={14} />
                      {includedItemKey(item) && t.has(includedItemKey(item) as never) ? t(includedItemKey(item) as never) : item}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          {/* The booking in five facts, every tile the same (Rory, 11 Nov 2026): what it is, what it costs, the deposit,
              when rent is due, and the handover. One short value each; the detail is in the agreement and Payments. */}
          <BookingFacts facts={bookingFacts(rental, bookingData, delivery, handedOver, t, locale)} mapLabel={t("viewOnMap")} />
    </>
  );

  return (
    <PublicShell brand={<PublicBrand detail={t("rentalBooking")} logoUrl={logoUrl} name={String(organization?.name || businessName)} />} width="narrow">
      <BrandStyle colour={organization?.contract_accent_colour} />
      {/* A flex column, so the confirmation ("You're all set") can move itself to the top once the booking is signed. */}
      <div className="flex flex-col gap-5">
        {pendingAmendmentToken ? (
          <a
            className="pressable -order-2 flex items-center justify-between gap-3 rounded-2xl border border-[var(--info-line)] bg-[var(--primary-light)] p-4 shadow-sm"
            href={`/amend/${pendingAmendmentToken}`}
          >
            <span>
              <span className="block text-sm font-semibold text-[var(--primary)]">{t("changeNeedsSignature")}</span>
            </span>
            <span className="shrink-0 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">{t("review")}</span>
          </a>
        ) : null}
        {toSign.map((report) => (
          <a
            className="pressable -order-2 flex items-center justify-between gap-3 rounded-2xl border border-[var(--info-line)] bg-[var(--primary-light)] p-4 shadow-sm"
            href={`/book/${token}/report/${report.id}`}
            key={report.id}
          >
            <span>
              <span className="block text-sm font-semibold text-[var(--primary)]">{t(`reportToSign_${report.type}`)}</span>
              <span className="block text-xs text-[var(--foreground-secondary)]">{t("reportSeeAndSign")}</span>
            </span>
            <span className="shrink-0 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">{t("review")}</span>
          </a>
        ))}
        {/* The business is in the header row above; this card is the booking itself. */}
        <header className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm [&>h1+div]:mt-0">
          <h1 className="sr-only">{t("rentalBooking")}</h1>
          {/* On rent, the page leads with the rental itself; what was booked is one tap away. */}
          {detail.state === "active" ? (
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-[var(--primary)]">{t("yourBookingDetails")}</summary>
              {bookingSummary}
            </details>
          ) : (
            bookingSummary
          )}
        </header>

        {invites.length > 0 && detail.state !== "completed" ? (
          <section className="rounded-2xl border border-[var(--info-line)] bg-[var(--primary-light)] p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--foreground)]">
              {t("updatesTitle")}
              <InfoTip label={t("updatesTitle")} text={t("updatesBody", { business: businessName })} />
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {invites.map((invite) => (
                <a className="pressable inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--primary)] px-4 text-sm font-semibold text-white" href={invite.url} key={invite.provider} rel="noreferrer" target="_blank">
                  {t("updatesOn", { app: invite.label })}
                </a>
              ))}
            </div>
          </section>
        ) : null}

        {detail.state === "active" ? (
          <ActiveRentalPortal
            answers={activeAnswers as Awaited<ReturnType<typeof portalAnswers>>}
            bookingData={bookingData}
            deliveryPhotoUrls={detail.deliveryPhotoUrls || []}
            reports={detail.inspectionReports || []}
            receipts={detail.receipts || []}
            organizationName={businessName}
            endNoticeDays={bookingRules(organization?.settings).endNoticeDays}
            extensionRates={rentalRateCard(vehicle, rental)}
            openEndedOffer={activeOpenEndedOffer as Awaited<ReturnType<typeof openEndedOffer>>}
            orgPayment={detail.org_payment}
            ownerContact={ownerContact}
            paymentBundle={portal.bundle}
            payments={portal.payments}
            rental={rental}
            signedContractUrl={executedDownloads?.originalAgreementUrl || detail.signedContractUrl}
            certificateUrl={executedDownloads?.executionCertificateUrl || null}
            token={token}
            vehicle={vehiclePhoto ? { ...vehicle, photo_url: vehiclePhoto } : vehicle}
          />
        ) : detail.state === "completed" ? (
          <>
          {portal.payments.length > 0 ? (
            <PortalPayments bundle={portal.bundle} orgPayment={detail.org_payment} organizationName={businessName} payments={portal.payments} token={token} />
          ) : null}
          <section className="rounded-2xl border border-[var(--border)] bg-white p-5 text-center shadow-sm">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success-light)] text-[var(--success)]">
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
              const rawReason = String(rental.deposit_deduction_reason || "").split(" — ")[0].trim().toLowerCase();
              const reasonKey = `reason_${rawReason.replace(/\s+/g, "_")}`;
              const reason = rawReason && t.has(reasonKey as never) ? t(reasonKey as never) : rawReason;
              const currency = rental.currency || "THB";
              return (
                <div className="mx-auto mt-4 max-w-sm rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] p-3 text-left text-sm text-[var(--foreground-secondary)]">
                  <p className="font-semibold text-[var(--foreground)]">{t("yourDeposit", { amount: money(held, currency) })}</p>
                  {returned > 0 ? <p className="mt-1">{t("depositReturned", { amount: money(returned, currency) })}</p> : null}
                  {kept > 0 ? <p className="mt-1">{t("depositKept", { amount: money(kept, currency) })}{reason ? ` (${reason})` : ""}</p> : null}
                  {left > 0 ? <p className="mt-1">{t("depositStillToSettle", { amount: money(left, currency) })}</p> : null}
                </div>
              );
            })()}
            {contact ? (
              <a className="pressable mt-5 inline-flex rounded-full border border-[var(--primary)] bg-white px-5 py-3 text-sm font-semibold text-[var(--primary)]" href={contact}>
                {t("contactNamed", { business: businessName })}
              </a>
            ) : null}
            {(detail.inspectionReports || []).length + (detail.receipts || []).length > 0 ? (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {(detail.inspectionReports || []).map((report: any) => (
                  <a className="pressable inline-flex rounded-full border border-[var(--primary)] bg-white px-5 py-3 text-sm font-semibold text-[var(--primary)]" href={report.url} key={report.id} rel="noreferrer" target="_blank">
                    {t(report.kind === "return" ? (report.swap ? "reportCollection" : "reportReturn") : report.swap ? "reportHandoverSwap" : "reportHandover")}
                  </a>
                ))}
                {(detail.receipts || []).map((receipt) => (
                  <a className="pressable inline-flex rounded-full border border-[var(--primary)] bg-white px-5 py-3 text-sm font-semibold text-[var(--primary)]" href={receipt.url} key={receipt.id} rel="noreferrer" target="_blank">
                    {t("receiptNumbered", { number: receipt.number })}
                  </a>
                ))}
              </div>
            ) : null}
            {executedDownloads?.originalAgreementUrl || executedDownloads?.executionCertificateUrl ? (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {executedDownloads.originalAgreementUrl ? (
                  <a className="pressable inline-flex rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white" href={executedDownloads.originalAgreementUrl} rel="noreferrer" target="_blank">
                    {t("downloadAgreement")}
                  </a>
                ) : null}
                {executedDownloads.executionCertificateUrl ? (
                  <a className="pressable inline-flex rounded-full border border-[var(--primary)] bg-white px-5 py-3 text-sm font-semibold text-[var(--primary)]" href={executedDownloads.executionCertificateUrl} rel="noreferrer" target="_blank">
                    {t("proofOfSigning")}
                  </a>
                ) : null}
              </div>
            ) : null}
          </section>
          </>
        ) : handedOver && (() => {
            const link = detail.bookingLink as { rental_id?: string | null; vehicle_id?: string | null; contract_id?: string | null };
            return !link?.rental_id || !link?.vehicle_id || !link?.contract_id;
          })() ? (
          // A rental already under way whose link has no agreement to sign (it was recorded by the business): nothing to
          // fill in here, so no form that could only fail (final pre-release test, 8 Nov 2026).
          <section className="rounded-2xl border border-[var(--border)] bg-white p-5 text-center shadow-sm">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success-light)] text-[var(--success)]">
              <ShieldCheck size={28} />
            </span>
            <h2 className="mt-4 text-2xl font-semibold text-[var(--foreground)]">{t("underwayTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t("underwayBody", { business: businessName })}</p>
            {contact ? (
              <a className="pressable mt-5 inline-flex rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white" href={contact}>
                {t("contactNamed", { business: businessName })}
              </a>
            ) : null}
          </section>
        ) : (
          // "contents": these join the page's own column, so the signed confirmation (order -1) rises above the booking card.
          <div className="contents">
          {detail.state === "ready" ? (
            <PortalPayments bundle={portal.bundle} orgPayment={detail.org_payment} organizationName={businessName} payments={portal.payments} token={token} />
          ) : null}
          <BookingCompletionForm
            detail={{
              token,
              organizationName: businessName,
              businessCountry: businessCountry(),
              vehicleWithCustomer: ["active", "due_soon", "overdue", "extended"].includes(String(rental?.status || "")),
              customer,
              completion: detail.completion,
              partnerOffers: detail.partnerOffers,
              documentStatus: detail.documentStatus,
              bookingData,
              // The form shows the agreement's rendered snapshot when there is one; the template copy is then never
              // used, so it isn't sent (it is ~80 KB on a customer's phone).
              contractHtml: (detail.rentalDocumentAgreement as { agreement?: { renderedHtmlSnapshot?: string } | null } | null)?.agreement?.renderedHtmlSnapshot ? "" : detail.contractHtml,
              orgPayment: detail.org_payment,
              promptPayQrSvg: firstPaymentQr,
              bookingReference: String(detail.bookingLink?.reference || detail.bookingLink?.reference_number || detail.bookingLink?.id || token).slice(0, 18),
              rentalRate: Number(rental?.rental_rate || 0),
              firstRent: firstRentCharge(rental),
              extrasTotal: Number(rental?.extras_total || 0),
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
    </PublicShell>
  );
}

type BookingFact = { key: string; icon: typeof Clock; label: string; value: string; detail?: string; mapUrl?: string; wide?: boolean };

/** 11 -> "11th". */
function ordinalDay(day: number) {
  const tens = day % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : day % 10 === 1 ? "st" : day % 10 === 2 ? "nd" : day % 10 === 3 ? "rd" : "th";
  return `${day}${suffix}`;
}

/**
 * The booking as five short facts (Rory, 11 Nov 2026: the tiles were different sizes and full of text nobody reads):
 * the rental period, the price, the deposit, when rent is due, and the handover. One value each, at most one line under it.
 */
function bookingFacts(rental: any, bookingData: Record<string, unknown>, delivery: { location: string; time: string; arrangeLater: boolean }, handedOver: boolean, t: T, locale: string): BookingFact[] {
  const say = t as unknown as (key: string, values?: Record<string, string | number>) => string;
  const currency = String(rental?.currency || "THB");
  const period = String(rental?.pricing_model || "monthly").toLowerCase().replace(/_/g, " ").trim();
  const start = String(rental?.start_date || "").slice(0, 10);
  const end = rental?.is_indefinite || !rental?.end_date ? "" : String(rental.end_date).slice(0, 10);
  const dayMs = 86_400_000;
  const days = start && end ? Math.round((new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / dayMs) : 0;
  const startText = formatSummaryDate(start, t, locale);

  const periodValue = period === "monthly" ? say("f_monthly") : period === "weekly" ? say("f_weekly") : days > 0 ? say("f_days", { days }) : say("f_fixed");
  const periodDetail = end ? say("dateRange", { start: startText, end: formatSummaryDate(end, t, locale) }) : say("f_from", { date: startText });

  // Rent falls due on the day of the handover (else the start), then the same day each month or week.
  const firstDue = String(toWallTime(bookingData.delivery_datetime || rental?.delivery_datetime || rental?.start_date || "")).slice(0, 10) || start;
  const validDue = /^\d{4}-\d{2}-\d{2}$/.test(firstDue);
  const second = validDue ? new Date(`${firstDue}T00:00:00Z`) : null;
  if (second) {
    if (period === "weekly") second.setUTCDate(second.getUTCDate() + 7);
    else second.setUTCMonth(second.getUTCMonth() + 1);
  }
  const onePayment = period === "custom" || period === "daily" || !validDue || Boolean(end && second && second.toISOString().slice(0, 10) >= end);
  const dueValue = onePayment
    ? formatSummaryDate(firstDue, t, locale)
    : period === "weekly"
      ? say("f_dueWeekly", { weekday: new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(`${firstDue}T00:00:00Z`)) })
      : say("f_dueMonthly", { day: ordinalDay(Number(firstDue.slice(8, 10))) });

  const facts: BookingFact[] = [
    { key: "period", icon: CalendarDays, label: say("rentalPeriod"), value: periodValue, detail: periodDetail },
    { key: "price", icon: CreditCard, label: say("f_price"), value: rateLabel(rental, t).split("\n")[0] },
    { key: "deposit", icon: ShieldCheck, label: say("f_deposit"), value: Number(rental?.deposit_amount || 0) > 0 ? money(rental.deposit_amount, currency) : say("noDeposit") },
    { key: "due", icon: CalendarClock, label: say("f_paymentDue"), value: dueValue }
  ];

  // Once the customer has the vehicle, where and when it was to be handed over is old news.
  if (!handedOver) {
    const lines = delivery.location.split("\n").map((line) => line.trim()).filter(Boolean);
    const mapUrl = lines.find((line) => line.startsWith("https://www.google.com/maps"));
    const how = String(lines[0] || "").replace(/:$/, "");
    const place = lines.slice(1).filter((line) => !line.startsWith("https://")).join(", ");
    const when = delivery.arrangeLater ? "" : delivery.time.replace(/\n/g, ", ");
    const open = say("toBeConfirmed");
    // "Place to be confirmed · To be confirmed" says one thing twice.
    const detail = place === say("placeToBeConfirmed") && when === open ? open : [place, when].filter(Boolean).join(" · ");
    facts.push({ key: "handover", icon: MapPin, label: say("handover"), value: how, detail: detail || undefined, mapUrl, wide: true });
  }
  return facts;
}

/** Five tiles, all one shape: an icon badge centred on the label and value beside it. */
function BookingFacts({ facts, mapLabel }: { facts: BookingFact[]; mapLabel: string }) {
  return (
    <dl className="mt-4 grid gap-2.5 sm:grid-cols-2">
      {facts.map(({ key, icon: Icon, label, value, detail, mapUrl, wide }) => (
        <div className={`flex min-h-[88px] items-center gap-3.5 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${wide ? "sm:col-span-2" : ""}`} key={key}>
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
            <Icon size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <dt className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">{label}</dt>
            <dd className="m-0 text-[17px] font-bold leading-tight text-[var(--foreground)] [overflow-wrap:anywhere]">{value}</dd>
            {detail ? <dd className="m-0 mt-0.5 text-[14px] font-medium leading-snug text-[var(--foreground-secondary)] [overflow-wrap:anywhere]">{detail}</dd> : null}
          </div>
          {mapUrl ? (
            <a className="pressable inline-flex min-h-11 shrink-0 items-center rounded-full border border-[var(--border)] bg-white px-3.5 text-[14px] font-bold text-[var(--primary)]" href={mapUrl} rel="noreferrer" target="_blank">
              {mapLabel}
            </a>
          ) : null}
        </div>
      ))}
    </dl>
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

/**
 * What the business has answered to this customer's questions, problems and
 * requests in the last two weeks. Answers also go out by chat, but a customer
 * who has no chat connected would otherwise never see them.
 */
async function portalAnswers(rentalId: string | undefined) {
  if (!rentalId) return [];
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const { data } = await (createSupabaseAdminClient() as any)
    .from("customer_portal_actions")
    .select("id, action_type, content, resolved_at")
    .eq("rental_id", rentalId)
    .neq("status", "pending")
    .gte("resolved_at", since)
    .order("resolved_at", { ascending: false })
    .limit(10);
  return ((data || []) as any[])
    .map((row) => {
      const content = row.content || {};
      const declined = content.outcome === "declined";
      const reply = String(content.reply || (declined ? content.operator_note : "") || "").trim();
      return { id: String(row.id), type: String(row.action_type), declined, asked: String(content.description || content.question || content.message || content.note || "").trim(), reply, at: String(row.resolved_at || "") };
    })
    .filter((row) => row.reply)
    .slice(0, 4);
}
