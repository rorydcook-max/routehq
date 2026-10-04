import type { ReactNode } from "react";
import { AlertTriangle, CalendarDays, Clock, CreditCard, MapPin, ReceiptText, ShieldCheck } from "lucide-react";
import { VehicleKindIcon } from "@/components/vehicle-kind-icon";
import { kindFromCategory } from "@/lib/vehicle-groups";
import { ActiveRentalPortal } from "./active-rental-portal";
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
import { promptPayQrSvg } from "@/lib/promptpay";
import { PortalPayments } from "./portal-payments";

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

function rateLabel(rental: any) {
  const currency = String(rental?.currency || "THB");
  const rate = money(rental?.rental_rate, currency);
  const period = String(rental?.pricing_model || "monthly").toLowerCase().replace(/_/g, " ").trim();
  if (period === "daily") return `${rate} / day`;
  if (period === "weekly") return `${rate} / week`;
  if (period === "custom") return `${rate} (custom rate)`;
  return `${rate} / month`;
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

function deliveryText(rental: any, bookingData: Record<string, unknown>) {
  const method = normalizedDeliveryMethod(rental?.delivery_method || bookingData.delivery_method);
  const rawLocation = String(bookingData.delivery_location || rental?.delivery_location || "").trim();
  const locationWasMapsUrl = isMapsUrl(rawLocation);
  const location = locationWasMapsUrl ? formatDeliveryLocation(rawLocation) : rawLocation;
  const dateTime = toWallTime(bookingData.delivery_datetime || rental?.delivery_datetime || "");
  const methodLabel = method === "tbd" ? "Handover to be arranged" : method === "collection" ? "You collect the vehicle" : "We deliver to you";
  const mapsUrl = deliveryMapsUrl(bookingData, rawLocation);
  const displayLocation = locationWasMapsUrl ? location : formatDeliveryAddress(location);

  return {
    location: location ? `${methodLabel}:\n${displayLocation}${mapsUrl ? `\n${mapsUrl}` : ""}` : method === "tbd" ? methodLabel : `${methodLabel}\nPlace to be confirmed`,
    time: formatDeliveryDateTime(dateTime)
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

function formatDeliveryDateTime(value: string) {
  if (!value) return "To be confirmed";
  const normalized = value.replace(" ", "T");
  const [datePart, timePart = ""] = normalized.split("T");
  const time = timePart.slice(0, 5);
  return time ? `${formatSummaryDate(datePart)}\n${time}` : formatSummaryDate(datePart);
}

function paymentDueText(rental: any, bookingData: Record<string, unknown>) {
  const deliveryDateTime = toWallTime(bookingData.delivery_datetime || rental?.delivery_datetime || rental?.start_date || "");
  const firstDueDate = formatSummaryDate(deliveryDateTime);
  const period = String(rental?.pricing_model || "monthly").toLowerCase();
  const endDate = rental?.is_indefinite ? "" : formatSummaryDate(rental?.end_date);
  const frequencyLabel = period === "daily" ? "day" : period === "weekly" ? "week" : period === "custom" ? "custom billing period" : "month";

  if (period === "custom") {
    return endDate && endDate !== "TBD"
      ? `${firstDueDate}\nThen as agreed until ${endDate}`
      : `${firstDueDate}\nThen as agreed`;
  }

  // A rental that fits in one billing period has one payment - don't describe a repeating schedule.
  const firstIso = String(deliveryDateTime || "").slice(0, 10);
  const endIso = String(rental?.end_date || "").slice(0, 10);
  if (endIso && /^\d{4}-\d{2}-\d{2}$/.test(firstIso)) {
    const next = new Date(`${firstIso}T00:00:00Z`);
    if (period === "daily") next.setUTCDate(next.getUTCDate() + 1);
    else if (period === "weekly") next.setUTCDate(next.getUTCDate() + 7);
    else next.setUTCMonth(next.getUTCMonth() + 1);
    if (next.toISOString().slice(0, 10) >= endIso) return `${firstDueDate} (one payment)`;
  }

  return endDate && endDate !== "TBD"
    ? `${firstDueDate}\nThen on the same day each ${frequencyLabel} until ${endDate}`
    : `${firstDueDate}\nThen on the same day each ${frequencyLabel}`;
}

/** "2026-10-01" -> "1 Oct 2026" for customers; the calendar date is kept as written. */
function formatSummaryDate(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "TBD";
  const date = raw.split("T")[0] || raw;
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return date;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`;
}

function ErrorState({ title, message, contact, rebookHref }: { title: string; message: string; contact?: string | null; rebookHref?: string | null }) {
  return (
    <main className="min-h-screen bg-[#fbfaf8] px-4 py-8">
      <section className="mx-auto max-w-xl rounded-2xl border border-[var(--border)] bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#ffe4e6] text-[#be123c]">
          <AlertTriangle />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-[var(--foreground)]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{message}</p>
        {rebookHref ? (
          <a className="pressable mt-5 inline-flex rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white" href={rebookHref}>
            Choose other dates
          </a>
        ) : null}
        {contact ? (
          <a className={`pressable mt-5 inline-flex rounded-xl px-5 py-3 text-sm font-semibold ${rebookHref ? "ml-2 border border-[var(--border)] bg-white text-[var(--foreground)]" : "bg-[var(--primary)] text-white"}`} href={contact}>
            Contact operator
          </a>
        ) : null}
      </section>
    </main>
  );
}

export default async function PublicBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const detail = await getPublicBookingDetail(token);

  if (detail.state === "not_found") {
    return <ErrorState message="Please check the link or contact the rental operator for a new booking link." title="Booking link not found" />;
  }

  const organization = detail.organization || {};
  const customer = detail.customer || {};
  const contact = contactHref(organization?.settings?.phone || organization?.settings?.business_phone || customer?.phone);

  if (detail.state === "expired") {
    return <ErrorState contact={contact} message={`This booking link has expired. Please contact ${organization?.name || "the rental operator"} for a new link.`} title="This booking link has expired" />;
  }

  if (detail.state === "taken") {
    const onlineBooking = organization?.settings?.public_booking?.enabled === true && organization?.slug;
    return (
      <ErrorState
        contact={contact}
        message={`Your booking wasn't completed in time and someone else has since booked this vehicle for those dates. ${onlineBooking ? "You can choose other dates or another vehicle" : `Please contact ${organization?.name || "the rental business"} to choose other dates or another vehicle`}.`}
        rebookHref={onlineBooking ? `/rent/${organization.slug}` : null}
        title="These dates have been taken"
      />
    );
  }

  if (detail.state === "cancelled") {
    return <ErrorState contact={contact} message={`This booking has been cancelled. Please contact ${organization?.name || "the rental operator"} if you have questions.`} title="This booking has been cancelled" />;
  }

  if (!detail.completion || !detail.documentStatus || !detail.bookingLink) {
    return <ErrorState contact={contact} message="This booking link is missing required booking details. Please contact the rental operator for a new link." title="Booking link incomplete" />;
  }

  const vehicle = detail.vehicle || {};
  const rental = detail.rental || {};
  const bookingData = (detail.bookingLink?.booking_data || {}) as Record<string, unknown>;
  const delivery = deliveryText(rental, bookingData);
  const included = includedItems(detail.bookingLink?.included_items);
  const logoUrl = organization?.logo_display_url || null;
  const ownerContact = organization?.settings?.phone || organization?.settings?.business_phone || organization?.owner_phone || null;
  const executedDownloads = detail.executedAgreementDownloads || null;
  const pendingAmendmentToken = rental?.id ? await pendingAmendmentFor(String(rental.id)) : null;
  // Payments can be made from this page as soon as the agreement is signed, before and after handover.
  const canPayHere = rental?.id && (detail.state === "active" || (detail.state === "ready" && detail.completion?.agreement));
  const portal = canPayHere ? await getPortalPayments(String(rental.id), detail.org_payment?.promptpay_id) : { payments: [], bundle: null };
  // Before signing, "pay now" shows one QR for what is due at the start.
  // What is due at the start: the first rent and the deposit.
  const firstPaymentAmount = Number(rental?.outstanding_balance || 0) > 0 ? Number(rental.outstanding_balance) : Number(rental?.rental_rate || 0) + Number(rental?.deposit_amount || 0);
  const firstPaymentQr =
    detail.state === "ready" && !detail.completion?.agreement && detail.org_payment?.promptpay_id && String(rental?.currency || "THB") === "THB"
      ? await promptPayQrSvg(detail.org_payment.promptpay_id, firstPaymentAmount)
      : null;

  return (
    <main className="min-h-screen bg-[#fbfaf8] px-4 py-5 text-[var(--foreground)]">
      <div className="mx-auto max-w-3xl space-y-5">
        {pendingAmendmentToken ? (
          <a
            className="pressable flex items-center justify-between gap-3 rounded-2xl border border-[#bfe0db] bg-[var(--primary-light)] p-4 shadow-sm"
            href={`/amend/${pendingAmendmentToken}`}
          >
            <span>
              <span className="block text-sm font-semibold text-[var(--primary)]">A change to your rental needs your signature</span>
              <span className="block text-xs text-[var(--foreground-secondary)]">Review the new dates or price and sign in one step.</span>
            </span>
            <span className="shrink-0 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">Review</span>
          </a>
        ) : null}
        <header className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <BusinessLogoImage
              alt={`${organization.name} logo`}
              className="max-h-[60px] max-w-[160px] object-contain"
              fallback={<span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary)] text-lg font-semibold text-white">{String(organization?.name || "F").slice(0, 1)}</span>}
              src={logoUrl}
            />
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--primary)]">Rental booking</p>
              {logoUrl ? null : <h1 className="text-xl font-semibold">{organization?.name || "Rental operator"}</h1>}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[#fbfaf8] p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
                <VehicleKindIcon boxed={false} kind={kindFromCategory(vehicle.vehicle_categories)} size={28} />
              </span>
              <div>
                <h2 className="text-2xl font-semibold">{vehicleTitle(vehicle)}</h2>
                <p className="mt-1 text-sm font-bold text-[var(--muted)]">{vehicle.registration_number || "Plate pending"} {vehicle.color ? `- ${vehicle.color}` : ""}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Info icon={CalendarDays} label="Rental period" value={rental.is_indefinite ? `Open ended from ${formatSummaryDate(rental.start_date)}` : `${formatSummaryDate(rental.start_date)} to ${formatSummaryDate(rental.end_date)}`} />
              <Info icon={CreditCard} label="Rate and deposit" value={`${rateLabel(rental)}\n${Number(rental.deposit_amount || 0) > 0 ? `Deposit: ${money(rental.deposit_amount, rental.currency || "THB")}` : "No deposit"}`} />
              <Info className="sm:row-span-2" icon={MapPin} label="Handover" value={delivery.location} />
              <Info icon={ReceiptText} label="First payment due" value={paymentDueText(rental, bookingData)} />
              <Info icon={Clock} label="Handover time" value={delivery.time} />
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
        </header>

        {detail.state === "active" ? (
          <ActiveRentalPortal
            bookingData={bookingData}
            deliveryPhotoUrls={detail.deliveryPhotoUrls || []}
            organizationName={organization?.name || "Rental operator"}
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
          <section className="rounded-2xl border border-[var(--border)] bg-white p-5 text-center shadow-sm">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f0fdf4] text-[#16a34a]">
              <ShieldCheck size={28} />
            </span>
            <h2 className="mt-4 text-2xl font-semibold text-[var(--foreground)]">Rental completed</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Thank you for renting with {organization?.name || "us"}. We would really appreciate a quick review of your experience.
            </p>
            {contact ? (
              <a className="pressable mt-5 inline-flex rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white" href={contact}>
                Contact operator
              </a>
            ) : null}
            {executedDownloads?.originalAgreementUrl || executedDownloads?.executionCertificateUrl ? (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {executedDownloads.originalAgreementUrl ? (
                  <a className="pressable inline-flex rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white" href={executedDownloads.originalAgreementUrl} rel="noreferrer" target="_blank">
                    Download original agreement
                  </a>
                ) : null}
                {executedDownloads.executionCertificateUrl ? (
                  <a className="pressable inline-flex rounded-xl border border-[var(--primary)] bg-white px-5 py-3 text-sm font-semibold text-[var(--primary)]" href={executedDownloads.executionCertificateUrl} rel="noreferrer" target="_blank">
                    Download execution certificate
                  </a>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : (
          <>
          {detail.state === "ready" ? (
            <PortalPayments bundle={portal.bundle} orgPayment={detail.org_payment} organizationName={organization?.name || "Rental operator"} payments={portal.payments} token={token} />
          ) : null}
          <BookingCompletionForm
            detail={{
              token,
              organizationName: organization?.name || "Rental operator",
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
          </>
        )}
      </div>
    </main>
  );
}

function Info({ className = "", icon: Icon, label, value }: { className?: string; icon: typeof Clock; label: string; value: string }) {
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
              View on map →
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
