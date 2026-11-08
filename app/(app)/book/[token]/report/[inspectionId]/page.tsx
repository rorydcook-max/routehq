import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, FileText, Fuel, Gauge, Video } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BrandStyle } from "@/components/brand-style";
import { PublicBrand, PublicShell } from "@/components/public-shell";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dateFormat } from "@/lib/i18n/dates";
import { niceMoney } from "@/lib/nice-money";
import { distanceUnitFor } from "@/lib/regional";
import { waitingForSignature } from "@/lib/inspection-signature";
import { ReportSignForm } from "./report-sign-form";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("customer");
  return { title: t("reportTitle_delivery"), robots: { index: false, follow: false } };
}

/**
 * A handover or return report the customer wasn't there to sign (lib/inspection-signature.ts): what was recorded
 * (odometer, fuel, photos, damage, and the deposit at a return), then their signature. Opened from the link they were
 * sent, or from their booking page. The booking link's token is the key; the report must be on that booking.
 */
async function loadReport(token: string, inspectionId: string) {
  if (!token || !/^[0-9a-f-]{36}$/i.test(inspectionId)) return null;
  const admin = createSupabaseAdminClient() as any;
  const { data: link } = await admin
    .from("booking_links")
    .select("organization_id, rental_id, organizations!booking_links_organization_id_fkey(name, contract_accent_colour, timezone, country_code, settings)")
    .eq("token", token)
    .is("deleted_at", null)
    .maybeSingle();
  if (!link?.rental_id) return null;
  const { data: inspection } = await admin
    .from("inspections")
    .select("*, vehicles!inspections_vehicle_id_fkey(make, model, registration_number), customers!inspections_customer_id_fkey(full_name)")
    .eq("id", inspectionId)
    .eq("organization_id", link.organization_id)
    .eq("rental_id", link.rental_id)
    .in("type", ["delivery", "return"])
    .is("deleted_at", null)
    .maybeSingle();
  if (!inspection) return null;
  const photos = await Promise.all(
    (Array.isArray(inspection.photos) ? inspection.photos : [])
      .filter((photo: any) => typeof photo?.url === "string" && photo.url)
      .map(async (photo: any) => {
        if (/^https?:\/\//.test(photo.url)) return photo.url as string;
        const { data } = await admin.storage.from("documents").createSignedUrl(photo.url, 60 * 60);
        return (data?.signedUrl as string) || "";
      })
  );
  // Signed: the stored PDF, to keep.
  let pdfUrl: string | null = null;
  if (!waitingForSignature(inspection)) {
    const { data: document } = await admin
      .from("rental_documents")
      .select("current_version_id")
      .eq("organization_id", link.organization_id)
      .eq("source_event_type", "inspection")
      .eq("source_event_id", inspectionId)
      .maybeSingle();
    if (document?.current_version_id) {
      const { data: version } = await admin.from("rental_document_versions").select("final_pdf_storage_path, pdf_storage_path").eq("id", document.current_version_id).maybeSingle();
      const path = version?.final_pdf_storage_path || version?.pdf_storage_path;
      if (path) pdfUrl = (await admin.storage.from("documents").createSignedUrl(path, 60 * 60)).data?.signedUrl || null;
    }
  }
  const { data: rental } = await admin.from("rentals").select("currency").eq("id", link.rental_id).maybeSingle();
  return { link, inspection, photos: photos.filter(Boolean) as string[], pdfUrl, currency: String(rental?.currency || "USD") };
}

export default async function ReportSignPage({ params }: { params: Promise<{ token: string; inspectionId: string }> }) {
  const { token, inspectionId } = await params;
  const [t, ti, locale, loaded] = await Promise.all([getTranslations("customer"), getTranslations("inspection"), getLocale(), loadReport(token, inspectionId).catch(() => null)]);

  if (!loaded) {
    return (
      <PublicShell width="narrow">
        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--danger-light)] text-[var(--danger)]">
            <AlertTriangle />
          </div>
          <h1 className="mt-4 text-2xl font-semibold">{t("reportNotFoundTitle")}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{t("reportNotFoundMessage")}</p>
        </section>
      </PublicShell>
    );
  }

  const { link, inspection, photos, pdfUrl, currency } = loaded;
  const organization = link.organizations || {};
  const kind = (inspection.type || inspection.inspection_type) === "return" ? "return" : "delivery";
  const vehicle = inspection.vehicles || {};
  const vehicleLabel = [vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const when = (value: string | null | undefined) =>
    value ? dateFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: organization.timezone || "UTC" }).format(new Date(value)) : "";
  const areaName = (location: string) => {
    const key = `area${location.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("")}`;
    return ti.has(key as never) ? ti(key as never) : location.replace(/_/g, " ");
  };
  const severityKeys: Record<string, string> = { scratch: "damageScratch", dent: "damageDent", crack: "damageCrack", missing: "damageMissingPart", other: "damageOther" };
  const severityName = (severity: string) => (severityKeys[severity] && ti.has(severityKeys[severity] as never) ? ti(severityKeys[severity] as never) : severity);
  const damage = (Array.isArray(inspection.damage_items) ? inspection.damage_items : []) as any[];
  const settlement = kind === "return" ? (inspection.pending_report?.depositSettlement as { available?: number; deductions?: Array<{ amount: number }>; refunded?: number } | null) : null;
  const deducted = (settlement?.deductions || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const signed = !waitingForSignature(inspection);

  return (
    <PublicShell brand={<PublicBrand name={String(organization.name || "")} />} width="narrow">
      <BrandStyle colour={organization.contract_accent_colour} />
      <div className="space-y-5">
        <header className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold">{t(`reportTitle_${kind}`)}</h1>
          <p className="mt-1 text-sm font-bold text-[var(--muted)]">
            <bdi>{vehicleLabel}</bdi>
            {vehicle.registration_number ? <> · <bdi>{vehicle.registration_number}</bdi></> : null}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">{when(inspection.submitted_at || inspection.inspected_at)}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[var(--panel-secondary)] p-3">
              <Gauge className="text-[var(--primary)]" size={18} />
              <p className="mt-1 text-xs font-semibold uppercase text-[var(--muted)]">{t("reportOdometer")}</p>
              <p className="font-mono-data font-semibold">{Number(inspection.odometer_reading ?? inspection.mileage ?? 0).toLocaleString(locale)} {distanceUnitFor(organization)}</p>
            </div>
            <div className="rounded-2xl bg-[var(--panel-secondary)] p-3">
              <Fuel className="text-[var(--primary)]" size={18} />
              <p className="mt-1 text-xs font-semibold uppercase text-[var(--muted)]">{t("reportFuel")}</p>
              <p className="font-mono-data font-semibold">{inspection.fuel_level_label || `${Number(inspection.fuel_level || 0)}%`}</p>
            </div>
          </div>
          {inspection.video_url ? (
            <a className="pressable mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)] underline" href={`/book/${token}/report/${inspection.id}/video`} rel="noreferrer" target="_blank">
              <Video aria-hidden="true" size={16} /> {t("reportVideo")}
            </a>
          ) : null}
        </header>

        {photos.length ? (
          <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
            <h2 className="card-title">{t("reportPhotos")}</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {photos.map((url) => (
                <a className="block overflow-hidden rounded-xl bg-[var(--panel-secondary)]" href={url} key={url} rel="noreferrer" target="_blank">
                  <img alt="" className="h-32 w-full object-cover" loading="lazy" src={url} />
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <h2 className="card-title">{t("reportDamage")}</h2>
          {damage.length ? (
            <ul className="mt-3 space-y-2">
              {damage.map((item, index) => (
                <li className="rounded-xl bg-[var(--panel-secondary)] p-3 text-sm" key={item.id || index}>
                  <p className="font-semibold">
                    {areaName(String(item.location || ""))}
                    {item.severity ? ` · ${severityName(String(item.severity))}` : ""}
                  </p>
                  {item.description ? <p className="mt-1 text-[var(--foreground-secondary)]">{item.description}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-[var(--muted)]">{t("reportNoDamage")}</p>
          )}
          {inspection.notes ? <p className="mt-3 rounded-xl bg-[var(--panel-secondary)] p-3 text-sm">{inspection.notes}</p> : null}
        </section>

        {settlement && Number(settlement.available || 0) > 0 ? (
          <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
            <h2 className="card-title">{t("reportDeposit")}</h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-[var(--muted)]">{t("reportDepositHeld")}</dt><dd className="font-mono-data font-semibold">{niceMoney(Number(settlement.available || 0), currency)}</dd></div>
              {deducted > 0 ? <div className="flex justify-between gap-3"><dt className="text-[var(--muted)]">{t("reportDeducted")}</dt><dd className="font-mono-data font-semibold text-[var(--danger)]">-{niceMoney(deducted, currency)}</dd></div> : null}
              <div className="flex justify-between gap-3"><dt className="text-[var(--muted)]">{t("reportRefunded")}</dt><dd className="font-mono-data font-semibold">{niceMoney(Number(settlement.refunded || 0), currency)}</dd></div>
            </dl>
          </section>
        ) : null}

        {signed ? (
          <section className="rounded-2xl border border-[var(--success-line)] bg-[var(--success-light)] p-5 text-center shadow-sm">
            <CheckCircle2 className="mx-auto text-[var(--success)]" />
            <h2 className="mt-2 text-lg font-semibold text-[var(--success)]">{t("reportSignedTitle")}</h2>
            <p className="mt-1 text-sm text-[var(--foreground-secondary)]">{t("reportSignedOn", { name: inspection.customer_signed_name || inspection.customers?.full_name || "", date: when(inspection.customer_signed_at) })}</p>
            {pdfUrl ? (
              <a className="pressable mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white" href={pdfUrl} rel="noreferrer" target="_blank">
                <FileText size={16} /> {t("reportDownload")}
              </a>
            ) : null}
          </section>
        ) : (
          <ReportSignForm inspectionId={inspection.id} renterName={String(inspection.customers?.full_name || "")} token={token} />
        )}
      </div>
    </PublicShell>
  );
}
