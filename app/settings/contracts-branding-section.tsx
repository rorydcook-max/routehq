import { toWallTime } from "@/lib/business-time";
import { useLocale, useTranslations } from "next-intl";
import { updateContractBrandingSettings } from "@/app/actions/settings";
import { longDate } from "@/lib/i18n/dates";
import { LogoUploadSection } from "@/app/settings/logo-upload-section";
import { SignatureUploadSection } from "@/app/settings/signature-upload-section";
import { BusinessLogoImage } from "@/components/business-logo-image";
import { PendingButton } from "@/components/pending-button";
import { Card, Fold, SectionHeader } from "@/components/ui";
import { supportedLocaleOptions } from "@/lib/i18n/locales";

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus-ring)]";

export type ContractsBrandingOrganization = {
  id: string;
  name: string;
  default_locale: string;
  logo_url: string | null;
  owner_signature_url: string | null;
  trading_name: string | null;
  legal_name: string | null;
  registration_or_tax_number: string | null;
  business_address: string | null;
  business_phone: string | null;
  business_email: string | null;
  whatsapp: string | null;
  line_id: string | null;
  contract_accent_colour: string | null;
  authorised_signatory_name: string | null;
  authorised_signatory_title: string | null;
  default_contract_locale: string | null;
  default_contract_template_id: string | null;
  contract_footer_text: string | null;
  powered_by_routehq_enabled: boolean | null;
  signature_authorised_at: string | null;
};

export function ContractsBrandingSection({
  logoDisplayUrl,
  organization,
  signatureDisplayUrl
}: {
  logoDisplayUrl: string | null;
  organization: ContractsBrandingOrganization;
  signatureDisplayUrl: string | null;
}) {
  const say = useTranslations("settingsPage") as unknown as (key: string, values?: Record<string, string>) => string;
  const locale = useLocale();
  const labelClass = "font-semibold text-[var(--foreground-secondary)]";
  const accentColour = organization.contract_accent_colour || "#24456b";
  const tradingName = organization.trading_name || organization.name;
  const legalName = organization.legal_name || tradingName;
  const footerText = organization.contract_footer_text || "Issued by the rental business named in this agreement.";
  const poweredByRouteHq = organization.powered_by_routehq_enabled ?? true;

  return (
    <Card>
      <SectionHeader title={say("b_title")} />
      <p className="mt-2 font-medium text-[var(--foreground-secondary)]">{say("b_body")}</p>

      <form action={updateContractBrandingSettings} className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>{say("b_name")}</span>
              <input className={inputClass} defaultValue={organization.trading_name || organization.name} name="trading_name" />
            </label>
            <label className="block">
              <span className={labelClass}>{say("b_phone")}</span>
              <input className={inputClass} defaultValue={organization.business_phone || ""} name="business_phone" type="tel" />
            </label>
            <label className="block">
              <span className={labelClass}>{say("b_whatsapp")}</span>
              <input className={inputClass} defaultValue={organization.whatsapp || ""} name="whatsapp" />
            </label>
            <label className="block">
              <span className={labelClass}>{say("b_line")}</span>
              <input className={inputClass} defaultValue={organization.line_id || ""} name="line_id" />
            </label>
            <label className="block">
              <span className={labelClass}>{say("b_email")}</span>
              <input className={inputClass} defaultValue={organization.business_email || ""} name="business_email" type="email" />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelClass}>{say("b_address")}</span>
              <textarea className={`${inputClass} min-h-20 py-2`} defaultValue={organization.business_address || ""} name="business_address" />
            </label>
        </div>

        {/* Set once, rarely touched: kept one tap away so the everyday details stay a short screen. */}
        <Fold summary={say("b_moreSummary")} title={say("b_moreTitle")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>{say("b_legal")}</span>
              <input className={inputClass} defaultValue={organization.legal_name || ""} name="legal_name" />
            </label>
            <label className="block">
              <span className={labelClass}>{say("b_tax")}</span>
              <input className={inputClass} defaultValue={organization.registration_or_tax_number || ""} name="registration_or_tax_number" />
            </label>
            <label className="block">
              <span className={labelClass}>{say("b_signer")}</span>
              <input className={inputClass} defaultValue={organization.authorised_signatory_name || ""} name="authorised_signatory_name" />
            </label>
            <label className="block">
              <span className={labelClass}>{say("b_signerTitle")}</span>
              <input className={inputClass} defaultValue={organization.authorised_signatory_title || ""} name="authorised_signatory_title" />
            </label>
            <label className="block">
              <span className={labelClass}>{say("b_language")}</span>
              <select className={inputClass} defaultValue={organization.default_contract_locale || organization.default_locale || "en"} name="default_contract_locale">
                {supportedLocaleOptions.map((locale) => (
                  <option key={locale.code} value={locale.code}>
                    {locale.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>{say("b_colour")}</span>
              <input className={`${inputClass} h-10`} defaultValue={accentColour} name="contract_accent_colour" type="color" />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelClass}>{say("b_footer")}</span>
              <input className={inputClass} defaultValue={organization.contract_footer_text || ""} name="contract_footer_text" />
            </label>
            <label className="checkbox-label sub-surface min-h-10 font-semibold text-[var(--foreground)] sm:col-span-2" style={{ display: "flex", alignItems: "center", padding: "8px 12px" }}>
              <input defaultChecked={poweredByRouteHq} name="powered_by_routehq_enabled" type="checkbox" value="true" />
              <span>{say("b_powered")}</span>
            </label>
          </div>
        </Fold>

        <PendingButton className="primary-action w-full sm:w-auto" pendingLabel={say("saving")} savedLabel={say("saved")} type="submit">
          {say("save")}
        </PendingButton>
      </form>

      <div className="mt-4 space-y-3">
        <LogoUploadSection logoUrl={logoDisplayUrl} orgName={tradingName} />
        <SignatureUploadSection
          authorisedSignatoryName={organization.authorised_signatory_name}
          authorisedSignatoryTitle={organization.authorised_signatory_title}
          orgName={tradingName}
          signatureUrl={signatureDisplayUrl}
        />
        {organization.signature_authorised_at ? (
          <p className="font-medium text-[var(--muted)]">{say("b_sigRecorded", { date: longDate(toWallTime(organization.signature_authorised_at).slice(0, 10), locale) })}</p>
        ) : null}
      </div>

      <div className="mt-4">
        <Fold summary={say("b_prevSummary")} title={say("b_prevTitle")}>
        <div className="rounded-lg border border-[var(--border)] bg-white p-4">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
            <BusinessLogoImage alt={`${tradingName} logo`} className="h-16 w-28 rounded-lg border border-[var(--border)] bg-white object-contain p-2" src={logoDisplayUrl} />
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: accentColour }}>
                {say("b_prevHead")}
              </p>
              <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">{tradingName}</p>
              <p className="text-xs text-[var(--muted)]">{legalName}</p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border-l-4 bg-[var(--panel-secondary)] p-3" style={{ borderColor: accentColour }}>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{say("b_between")}</p>
            <p className="mt-2 text-base font-semibold text-[var(--foreground)]">{legalName}</p>
            <p className="text-sm text-[var(--muted)]">{say("b_and")}</p>
            <p className="text-base font-semibold text-[var(--foreground)]">Alex Morgan</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[var(--border)] p-3">
              <p className="text-[11px] font-bold uppercase text-[var(--muted)]">{say("b_customer")}</p>
              <p className="mt-1 text-sm font-bold text-[var(--foreground)]">Alex Morgan</p>
              <p className="text-xs text-[var(--muted)]">{say("b_passport")}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-3">
              <p className="text-[11px] font-bold uppercase text-[var(--muted)]">{say("b_vehicle")}</p>
              <p className="mt-1 text-sm font-bold text-[var(--foreground)]">Toyota Yaris Ativ</p>
              <p className="text-xs text-[var(--muted)]">กข 1234 Bangkok</p>
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between gap-3 border-t border-[var(--border)] pt-4">
            <div>
              <p className="text-xs font-bold text-[var(--foreground)]">{organization.authorised_signatory_name || say("b_signerDefault")}</p>
              <p className="text-[11px] text-[var(--muted)]">{organization.authorised_signatory_title || say("b_signerTitleDefault")}</p>
            </div>
            <BusinessLogoImage alt="Authorised signature" className="h-14 w-36 rounded-lg border border-[var(--border)] bg-white object-contain p-2" src={signatureDisplayUrl} fallback={<div className="h-14 w-36 rounded-lg border border-dashed border-[var(--border)] bg-white p-2 text-center text-[11px] text-[var(--muted)]">{say("b_signature")}</div>} />
          </div>

          <div className="mt-4 border-t border-[var(--border)] pt-3 text-center text-[11px] text-[var(--muted)]">
            <p>{footerText}</p>
            {poweredByRouteHq ? <p className="mt-1 font-semibold">Powered by RouteHQ</p> : null}
          </div>
        </div>
        </Fold>
      </div>
    </Card>
  );
}
