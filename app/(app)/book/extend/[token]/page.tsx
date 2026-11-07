import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BrandStyle } from "@/components/brand-style";
import { PublicBrand, PublicShell } from "@/components/public-shell";
import { customerDate } from "@/lib/i18n/customer-dates";
import { loadExtensionCheck } from "@/lib/extension-hold";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ExtensionCheckForm } from "./extension-check-form";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("customer");
  return { title: t("holdCheckTitle"), robots: { index: false, follow: false } };
}

function contactHref(phone: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  // The number arrives with the business's country code (lib/extension-hold.ts).
  return `https://wa.me/${digits}`;
}

/** The same date next month (the last day of next month when it is shorter): the usual monthly extension. */
function nextMonth(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, last))).toISOString().slice(0, 10);
}

function Message({ tone, title, children, colour = null, business = null }: { tone: "red" | "green"; title: string; children: React.ReactNode; colour?: string | null; business?: string | null }) {
  return (
    <PublicShell brand={business ? <PublicBrand name={business} /> : undefined} width="narrow">
      <BrandStyle colour={colour} />
      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 text-center shadow-sm">
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${tone === "red" ? "bg-[var(--danger-light)] text-[var(--danger)]" : "bg-[var(--success-light)] text-[var(--success)]"}`}>
          {tone === "red" ? <AlertTriangle /> : <CheckCircle2 />}
        </div>
        <h1 className="mt-4 text-2xl font-semibold [text-wrap:balance]">{title}</h1>
        <div className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--muted)] [text-wrap:balance]">{children}</div>
      </section>
    </PublicShell>
  );
}

/** "Are you extending?": the link in the message a monthly renter gets a week before their rental ends (lib/extension-hold.ts). */
export default async function ExtensionCheckPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const check = await loadExtensionCheck(createSupabaseAdminClient() as any, token);
  const t = await getTranslations("customer");
  const locale = await getLocale();

  if (check.state === "not_found") {
    return <Message title={t("holdCheckNotFoundTitle")} tone="red">{t("holdCheckNotFound")}</Message>;
  }
  const vehicle = check.vehicle || t("holdCheckVehicle");
  const date = check.endDate ? customerDate(check.endDate, locale) : "";
  const contact = contactHref(check.contactPhone);
  const contactLink = contact ? (
    <a className="pressable mt-5 inline-flex rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white" href={contact}>
      {t("contactNamed", { business: check.businessName })}
    </a>
  ) : null;

  if (check.state === "closed") {
    return (
      <Message business={check.businessName} colour={check.brandColour} title={t("holdCheckClosedTitle")} tone="red">
        <p>{t("holdCheckClosed", { business: check.businessName })}</p>
        {contactLink}
      </Message>
    );
  }
  if (check.state === "extended") {
    return (
      <Message business={check.businessName} colour={check.brandColour} title={t("holdCheckExtendedTitle")} tone="green">
        <p>{t("holdCheckExtendedBody", { vehicle, date })}</p>
        {contactLink}
      </Message>
    );
  }
  if (check.state === "answered") {
    return (
      <Message business={check.businessName} colour={check.brandColour} title={check.answer === "extend" ? t("holdCheckExtendTitle") : t("holdCheckReturnTitle")} tone="green">
        <p>{check.answer === "extend" ? t("holdCheckExtendBody", { business: check.businessName }) : t("holdCheckReturnBody", { vehicle, date })}</p>
        {contactLink}
      </Message>
    );
  }

  return (
    <PublicShell brand={<PublicBrand name={check.businessName} />} width="narrow">
      <BrandStyle colour={check.brandColour} />
      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold [text-wrap:balance]">{t("holdCheckTitle")}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t("holdCheckBody", { vehicle, date })}</p>
        <ExtensionCheckForm defaultEnd={nextMonth(check.endDate)} endDate={check.endDate} endLabel={date} token={token} />
      </section>
    </PublicShell>
  );
}
