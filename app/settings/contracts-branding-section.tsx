import { toWallTime } from "@/lib/business-time";
import { useLocale, useTranslations } from "next-intl";
import { updateContractBrandingSettings } from "@/app/actions/settings";
import { longDate } from "@/lib/i18n/dates";
import { LogoUploadSection } from "@/app/settings/logo-upload-section";
import { SignatureUploadSection } from "@/app/settings/signature-upload-section";
import { PendingButton } from "@/components/pending-button";
import { Fold, Pane } from "@/components/ui";
import { customerLocaleOptions } from "@/lib/i18n/locales";
import { BrandColourField } from "@/app/settings/brand-colour-field";

// Fields take the global 44px height and regular weight; only the radius/border are set here.
const inputClass =
  "mt-1 w-full rounded-xl border border-[var(--border-strong)] bg-white px-3 text-[15px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus-ring)]";

/** The business details form. The brand card on the right joins it with form="…" so one action saves both. */
const FORM_ID = "business-details";

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

/**
 * The Business tab. Left: the business details (everyday contact details, then the rarely touched
 * agreement details folded away) and where you operate. Right: the brand (logo, colour, "Powered by"),
 * the signature, and the rental agreement. Each card that has a form ends with its own Save.
 */
export function ContractsBrandingSection({
  logoDisplayUrl,
  organization,
  signatureDisplayUrl,
  whiteLabel = false,
  footer,
  aside,
  locations
}: {
  /** A line under the details (currency and time zone). */
  footer?: React.ReactNode;
  /** The rental agreement card, under the signature on the right. */
  aside?: React.ReactNode;
  /** Where you operate, under the business details on the left. */
  locations?: React.ReactNode;
  logoDisplayUrl: string | null;
  organization: ContractsBrandingOrganization;
  signatureDisplayUrl: string | null;
  /** Their plan lets their logo replace Lokalfleet's inside the app (everything is on during the trial). */
  whiteLabel?: boolean;
}) {
  const say = useTranslations("settingsPage") as unknown as (key: string, values?: Record<string, string>) => string;
  const locale = useLocale();
  const labelClass = "font-semibold text-[var(--foreground-secondary)]";
  const accentColour = organization.contract_accent_colour || "#0e5e6f";
  const tradingName = organization.trading_name || organization.name;
  const poweredByRouteHq = organization.powered_by_routehq_enabled ?? true;

  return (
    <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="grid gap-3">
        <Pane summary={say("b_body")} title={say("b_title")}>
          <form action={updateContractBrandingSettings} className="space-y-4" id={FORM_ID}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
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
                <textarea className={`${inputClass} min-h-20 resize-none py-2`} defaultValue={organization.business_address || ""} name="business_address" rows={2} />
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
                    {customerLocaleOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className={labelClass}>{say("b_footer")}</span>
                  <input className={inputClass} defaultValue={organization.contract_footer_text || ""} name="contract_footer_text" />
                </label>
              </div>
            </Fold>

            <PendingButton className="primary-action w-full sm:w-auto" pendingLabel={say("saving")} savedLabel={say("saved")} type="submit">
              {say("save")}
            </PendingButton>
          </form>
          {footer ? <div className="mt-4 border-t border-[var(--border)] pt-3">{footer}</div> : null}
        </Pane>
        {locations}
      </div>

      <div className="grid gap-3">
        {/* Their brand in one place: logo, colour and "Powered by", on every page a customer sees and,
            on a white-label plan, in the app itself. The logo saves as soon as it is chosen; the colour
            and the "Powered by" choice belong to the business details form and save with it. */}
        <section className="card p-4">
          <h2 className="card-title">{say("b_brandTitle")}</h2>
          <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{whiteLabel ? say("b_brandBodyApp") : say("b_brandBody")}</p>
          <div className="mt-3 space-y-4">
            <LogoUploadSection logoUrl={logoDisplayUrl} orgName={tradingName} />
            <BrandColourField customLabel={say("b_colourCustom")} form={FORM_ID} hint={say("b_colourHint")} initial={accentColour} key={accentColour} label={say("b_colour")} previewLabel={say("b_colourPreview")} />
            <label className={`flex cursor-pointer items-start gap-3 font-medium text-[var(--foreground)] ${whiteLabel ? "" : "opacity-60"}`}>
              <input className="mt-0.5 h-5 w-5 shrink-0" defaultChecked={poweredByRouteHq || !whiteLabel} disabled={!whiteLabel} form={FORM_ID} name="powered_by_routehq_enabled" type="checkbox" value="true" />
              <span>
                {say("b_powered")}
                {!whiteLabel ? <span className="block text-sm text-[var(--muted)]">{say("b_poweredPlan")}</span> : null}
              </span>
            </label>
          </div>
          <button className="primary-action pressable mt-4 w-full sm:w-auto" form={FORM_ID} type="submit">
            {say("save")}
          </button>
        </section>

        <section className="card p-4">
          <SignatureUploadSection
            authorisedSignatoryName={organization.authorised_signatory_name}
            authorisedSignatoryTitle={organization.authorised_signatory_title}
            orgName={tradingName}
            signatureUrl={signatureDisplayUrl}
          />
          {organization.signature_authorised_at ? (
            <p className="mt-3 text-sm font-medium text-[var(--muted)]">{say("b_sigRecorded", { date: longDate(toWallTime(organization.signature_authorised_at).slice(0, 10), locale) })}</p>
          ) : null}
        </section>
        {aside}
      </div>
    </div>
  );
}
