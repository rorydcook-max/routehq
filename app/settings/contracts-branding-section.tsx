import { updateContractBrandingSettings } from "@/app/actions/settings";
import { LogoUploadSection } from "@/app/settings/logo-upload-section";
import { SignatureUploadSection } from "@/app/settings/signature-upload-section";
import { BusinessLogoImage } from "@/components/business-logo-image";
import { PendingButton } from "@/components/pending-button";
import { Card, SectionHeader } from "@/components/ui";
import { supportedLocaleOptions } from "@/lib/i18n/locales";

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(18,184,200,0.16)]";

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
  const accentColour = organization.contract_accent_colour || "#0f766e";
  const tradingName = organization.trading_name || organization.name;
  const legalName = organization.legal_name || tradingName;
  const footerText = organization.contract_footer_text || "Issued by the rental business named in this agreement.";
  const poweredByRouteHq = organization.powered_by_routehq_enabled ?? true;

  return (
    <Card>
      <SectionHeader eyebrow="Contracts" title="Contracts & Branding" />
      <p className="mt-2 text-xs leading-5 text-[#667085]">
        Configure the rental business identity that will appear on future rental documents. RouteHQ is not the contracting party.
      </p>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <form action={updateContractBrandingSettings} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Trading name</span>
                <input className={inputClass} defaultValue={organization.trading_name || organization.name} name="trading_name" />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Legal contracting name</span>
                <input className={inputClass} defaultValue={organization.legal_name || ""} name="legal_name" />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Registration or tax number</span>
                <input className={inputClass} defaultValue={organization.registration_or_tax_number || ""} name="registration_or_tax_number" />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Business phone</span>
                <input className={inputClass} defaultValue={organization.business_phone || ""} name="business_phone" type="tel" />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Business email</span>
                <input className={inputClass} defaultValue={organization.business_email || ""} name="business_email" type="email" />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">WhatsApp</span>
                <input className={inputClass} defaultValue={organization.whatsapp || ""} name="whatsapp" />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">LINE ID</span>
                <input className={inputClass} defaultValue={organization.line_id || ""} name="line_id" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Business address</span>
                <textarea className={`${inputClass} min-h-20 py-2`} defaultValue={organization.business_address || ""} name="business_address" />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Contract accent colour</span>
                <input className={`${inputClass} h-10`} defaultValue={accentColour} name="contract_accent_colour" type="color" />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Default contract locale</span>
                <select className={inputClass} defaultValue={organization.default_contract_locale || organization.default_locale || "en"} name="default_contract_locale">
                  {supportedLocaleOptions.map((locale) => (
                    <option key={locale.code} value={locale.code}>
                      {locale.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Contract footer text</span>
                <input className={inputClass} defaultValue={organization.contract_footer_text || ""} name="contract_footer_text" />
              </label>
              <label className="checkbox-label sub-surface min-h-10 font-semibold text-[var(--foreground)]" style={{ display: "flex", alignItems: "center", padding: "8px 12px" }}>
                <input defaultChecked={poweredByRouteHq} name="powered_by_routehq_enabled" type="checkbox" value="true" />
                <span>Show Powered by RouteHQ footer attribution</span>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Authorised signatory full name</span>
                <input className={inputClass} defaultValue={organization.authorised_signatory_name || ""} name="authorised_signatory_name" />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Signatory job title</span>
                <input className={inputClass} defaultValue={organization.authorised_signatory_title || ""} name="authorised_signatory_title" />
              </label>
            </div>

            <PendingButton className="primary-action" pendingLabel="Saving..." type="submit">
              Save contracts and branding settings
            </PendingButton>
          </form>

          <div className="space-y-3">
            <LogoUploadSection logoUrl={logoDisplayUrl} orgName={tradingName} />
            <SignatureUploadSection
              authorisedSignatoryName={organization.authorised_signatory_name}
              authorisedSignatoryTitle={organization.authorised_signatory_title}
              orgName={tradingName}
              signatureUrl={signatureDisplayUrl}
            />
            {organization.signature_authorised_at ? (
              <p className="text-[11px] text-[#667085]">Signature authorisation recorded on {new Date(organization.signature_authorised_at).toLocaleDateString("en-GB")}.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-[#dfe4ea] bg-white p-4">
          <div className="flex items-start justify-between gap-4 border-b border-[#edf2f7] pb-4">
            <BusinessLogoImage alt={`${tradingName} logo`} className="h-16 w-28 rounded-lg border border-[#dfe4ea] bg-white object-contain p-2" src={logoDisplayUrl} />
            <div className="text-right">
              <p className="text-[11px] font-black uppercase tracking-[0.08em]" style={{ color: accentColour }}>
                Rental agreement preview
              </p>
              <p className="mt-1 text-lg font-black text-[#10252b]">{tradingName}</p>
              <p className="text-xs text-[#667085]">{legalName}</p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border-l-4 bg-[#f8fafc] p-3" style={{ borderColor: accentColour }}>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#667085]">Agreement between</p>
            <p className="mt-2 text-base font-black text-[#10252b]">{legalName}</p>
            <p className="text-sm text-[#667085]">and</p>
            <p className="text-base font-black text-[#10252b]">Sample Customer Name</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[#edf2f7] p-3">
              <p className="text-[11px] font-bold uppercase text-[#667085]">Customer</p>
              <p className="mt-1 text-sm font-bold text-[#10252b]">Alex Morgan</p>
              <p className="text-xs text-[#667085]">Passport verified</p>
            </div>
            <div className="rounded-lg border border-[#edf2f7] p-3">
              <p className="text-[11px] font-bold uppercase text-[#667085]">Vehicle</p>
              <p className="mt-1 text-sm font-bold text-[#10252b]">Toyota Yaris Ativ</p>
              <p className="text-xs text-[#667085]">กข 1234 Bangkok</p>
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between gap-3 border-t border-[#edf2f7] pt-4">
            <div>
              <p className="text-xs font-bold text-[#10252b]">{organization.authorised_signatory_name || "Authorised signatory"}</p>
              <p className="text-[11px] text-[#667085]">{organization.authorised_signatory_title || "Business representative"}</p>
            </div>
            <BusinessLogoImage alt="Authorised signature" className="h-14 w-36 rounded-lg border border-[#dfe4ea] bg-white object-contain p-2" src={signatureDisplayUrl} fallback={<div className="h-14 w-36 rounded-lg border border-dashed border-[#cbd5e1] bg-white p-2 text-center text-[11px] text-[#667085]">Signature</div>} />
          </div>

          <div className="mt-4 border-t border-[#edf2f7] pt-3 text-center text-[11px] text-[#667085]">
            <p>{footerText}</p>
            {poweredByRouteHq ? <p className="mt-1 font-semibold">Powered by RouteHQ</p> : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
