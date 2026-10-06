import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { loadPublicAmendment } from "@/lib/public-amendment";
import { AmendmentSignForm } from "./amendment-sign-form";
import { getTranslations } from "next-intl/server";
import { CustomerLanguagePicker } from "@/components/customer-language-picker";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("customer");
  return { title: t("amendTitle"), robots: { index: false, follow: false } };
}

function contactHref(phone: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith("0") ? `66${digits.slice(1)}` : digits}`;
}

function Message({ tone, title, children }: { tone: "red" | "green"; title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#fbfaf8] px-4 py-8 text-[var(--foreground)]">
      <div className="mx-auto mb-3 flex max-w-xl justify-end">
        <CustomerLanguagePicker />
      </div>
      <section className="mx-auto max-w-xl rounded-2xl border border-[var(--border)] bg-white p-6 text-center shadow-sm">
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${tone === "red" ? "bg-[#ffe4e6] text-[#be123c]" : "bg-[#f0fdf4] text-[#16a34a]"}`}>
          {tone === "red" ? <AlertTriangle /> : <CheckCircle2 />}
        </div>
        <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
        <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{children}</div>
      </section>
    </main>
  );
}

export default async function AmendmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const amendment = await loadPublicAmendment(token);
  const t = await getTranslations("customer");

  if (amendment.state === "not_found") {
    return <Message title={t("amendNotFoundTitle")} tone="red">{t("amendNotFoundMessage")}</Message>;
  }
  const contact = contactHref(amendment.contactPhone);
  const contactLink = contact ? (
    <a className="pressable mt-5 inline-flex rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white" href={contact}>
      {t("contactNamed", { business: amendment.businessName })}
    </a>
  ) : null;

  if (amendment.state === "cancelled") {
    return (
      <Message title={t("amendWithdrawnTitle")} tone="red">
        <p>{t("amendWithdrawnMessage", { business: amendment.businessName })}</p>
        {contactLink}
      </Message>
    );
  }
  if (amendment.state === "expired") {
    return (
      <Message title={t("amendExpiredTitle")} tone="red">
        <p>{t("amendExpiredMessage", { business: amendment.businessName })}</p>
        {contactLink}
      </Message>
    );
  }
  if (amendment.state === "signed") {
    return (
      <Message title={t("amendSignedTitle")} tone="green">
        <p>
          {amendment.signerName ? t("amendThanksNamed", { name: amendment.signerName, business: amendment.businessName }) : t("amendThanks", { business: amendment.businessName })}
        </p>
        {/* Say what is now agreed, so nobody has to open the PDF to check. */}
        {amendment.rows.length ? (
          <div className="mt-4 space-y-2 text-left">
            {amendment.rows.map((row) => (
              <div className="rounded-xl border border-[var(--border)] bg-[#fbfaf8] p-3" key={row.label}>
                <p className="text-xs font-semibold uppercase text-[var(--muted)]">{({ Vehicle: t("rowVehicle"), "Return date": t("rowReturnDate"), "Charge for the extension": t("rowExtensionCharge"), "Rental rate": t("rowRentalRate"), "Security deposit": t("rowDeposit") } as Record<string, string>)[row.label] || row.label}</p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]"><bdi>{row.after}</bdi></p>
              </div>
            ))}
          </div>
        ) : null}
        {amendment.pdfUrl ? (
          <a className="pressable mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white" href={amendment.pdfUrl} rel="noreferrer" target="_blank">
            <FileText size={16} /> {t("amendDownload")}
          </a>
        ) : null}
      </Message>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbfaf8] px-4 py-5 text-[var(--foreground)]">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex justify-end">
          <CustomerLanguagePicker />
        </div>
        <header className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-[var(--primary)]">{amendment.businessName}</p>
          <h1 className="mt-1 text-2xl font-semibold">{t("amendChangesTitle")}</h1>
          <p className="mt-1 text-sm font-bold text-[var(--muted)]">{amendment.vehicleLabel}</p>
          <div className="mt-4 space-y-2">
            {amendment.rows.map((row) => (
              <div className="rounded-xl border border-[var(--border)] bg-[#fbfaf8] p-3" key={row.label}>
                <p className="text-xs font-semibold uppercase text-[var(--muted)]">{({ Vehicle: t("rowVehicle"), "Return date": t("rowReturnDate"), "Charge for the extension": t("rowExtensionCharge"), "Rental rate": t("rowRentalRate"), "Security deposit": t("rowDeposit") } as Record<string, string>)[row.label] || row.label}</p>
                <p className="mt-1 text-sm">
                  {row.before !== "-" ? <span className="text-[var(--muted)] line-through">{row.before}</span> : null}
                  {row.before !== "-" ? <span className="mx-2 text-[var(--muted)]">→</span> : null}
                  <span className="font-semibold text-[var(--primary)]">{row.after}</span>
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{t("amendRestUnchanged")}</p>
        </header>

        <section className="rounded-2xl border border-[var(--border)] bg-white p-3 shadow-sm">
          <iframe className="h-[420px] w-full rounded-xl border border-[var(--border)] bg-white" sandbox="" srcDoc={amendment.html} title={t("amendTitle")} />
          <p className="mt-2 px-1 text-[11px] text-[var(--muted)]">{t("amendFingerprint", { code: amendment.contentHashFragment })}</p>
        </section>

        <AmendmentSignForm contentHash={amendment.contentHash} renterName={amendment.renterName} token={amendment.token} />
      </div>
    </main>
  );
}
