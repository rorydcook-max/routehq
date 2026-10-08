import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { useLocale } from "next-intl";
import { createCustomer } from "@/app/actions/customers";
import { AppShell } from "@/components/app-shell";
import { PendingButton } from "@/components/pending-button";
import { Fold } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { commonCountries, countryLabel, customerLanguages, phoneCodeOptions } from "@/lib/customer-options";
import { getDefaultOrganization } from "@/lib/organization";

// The wording for this page is in locales/<language>/common.json under "customerPage".
type Say = (key: string, values?: Record<string, string | number>) => string;

const inputClass = "mt-1 w-full";
const labelClass = "font-semibold text-[var(--foreground-secondary)]";
const contactMethods = ["whatsapp", "messenger", "line", "telegram", "sms", "email", "phone"];

function CountryDatalist({ id }: { id: string }) {
  const locale = useLocale();
  return (
    <datalist id={id}>
      {commonCountries.map((country) => (
        <option key={`${id}-${country.code}`} value={country.name}>
          {country.flag} {countryLabel(country.code, country.country, locale)}
        </option>
      ))}
    </datalist>
  );
}

function PhoneFields({ codeName, inputName, codeLabel, required = false }: { codeName: string; inputName: string; codeLabel: string; required?: boolean }) {
  return (
    <div className="grid grid-cols-[132px_1fr] gap-2">
      <select aria-label={codeLabel} className={inputClass} defaultValue="+66" name={codeName}>
        {phoneCodeOptions.map((option) => (
          <option key={`${codeName}-${option.code}`} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
      <input className={inputClass} inputMode="tel" name={inputName} placeholder="812345678" required={required} type="tel" />
    </div>
  );
}

export default async function NewCustomerPage() {
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const say = (await getTranslations("customerPage")) as unknown as Say;

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-2xl">
        <div className="page-hero mb-4">
          <Link className="font-bold text-[var(--primary)]" href="/customers">
            {say("backToList")}
          </Link>
          <h1 className="page-title mt-2">{say("new_title")}</h1>
          <p className="page-subtitle page-subtitle-keep mt-1">{say("new_subtitle")}</p>
        </div>

        {/* Name and phone are all a booking needs. Everything else is one tap away, and the customer fills most of it in on their booking link anyway. */}
        <form action={createCustomer} className="space-y-3">
          <input name="organizationId" type="hidden" value={organization.id} />
          <CountryDatalist id="nationality-options" />
          <CountryDatalist id="licence-country-options" />

          <div className="card p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className={labelClass}>{say("f_name")}</span>
                <input autoComplete="off" className={inputClass} name="fullName" required />
              </label>
              <label className="block">
                <span className={labelClass}>{say("f_phone")}</span>
                <PhoneFields codeLabel={say("new_countryCode")} codeName="phoneCountryCode" inputName="phone" required />
              </label>
              <label className="block">
                <span className={labelClass}>{say("f_nationality")}</span>
                <input className={inputClass} list="nationality-options" name="nationality" placeholder="Thai" required />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelClass}>{say("f_language")}</span>
                <select className={inputClass} defaultValue="en" name="preferredLocale">
                  {customerLanguages.map((language) => (
                    <option key={language.code} value={language.code}>
                      {language.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <Fold summary={say("new_chatSummary")} title={say("new_chatTitle")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>{say("ch_whatsapp")}</span>
                <input className={inputClass} name="whatsappNumber" placeholder="+66812345678" type="tel" />
                <span className="mt-1 block font-medium text-[var(--muted)]">{say("new_whatsappHint")}</span>
              </label>
              <label className="block">
                <span className={labelClass}>{say("ch_line")}</span>
                <input className={inputClass} name="lineId" placeholder="@lineid" />
              </label>
              <label className="block">
                <span className={labelClass}>{say("ch_messenger")}</span>
                <input className={inputClass} name="messengerId" placeholder="m.me/username" />
              </label>
              <label className="block">
                <span className={labelClass}>{say("ch_telegram")}</span>
                <input className={inputClass} name="telegramUsername" placeholder="@username" />
              </label>
              <label className="block">
                <span className={labelClass}>{say("ch_instagram")}</span>
                <input className={inputClass} name="instagramHandle" placeholder="@username" />
              </label>
              <label className="block">
                <span className={labelClass}>{say("f_email")}</span>
                <input className={inputClass} name="email" type="email" />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelClass}>{say("ch_preferred")}</span>
                <select className={inputClass} defaultValue="whatsapp" name="preferredContactMethod">
                  {contactMethods.map((method) => (
                    <option key={method} value={method}>
                      {say(`m_${method}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Fold>

          <Fold summary={say("new_docsSummary")} title={say("new_docsTitle")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>{say("f_passportNo")}</span>
                <input className={inputClass} name="passportNumber" />
              </label>
              <label className="block">
                <span className={labelClass}>{say("f_passportExpiry")}</span>
                <input className={inputClass} name="passportExpiry" type="date" />
              </label>
              <label className="block">
                <span className={labelClass}>{say("f_licenceNo")}</span>
                <input className={inputClass} name="driverLicenseNumber" />
              </label>
              <label className="block">
                <span className={labelClass}>{say("f_licenceExpiry")}</span>
                <input className={inputClass} name="driverLicenseExpiry" type="date" />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelClass}>{say("f_licenceCountry")}</span>
                <input className={inputClass} list="licence-country-options" name="driverLicenseCountry" placeholder="Thailand" />
              </label>
              <label className="block">
                <span className={labelClass}>{say("new_photoPassport")}</span>
                <input accept="image/*,application/pdf" className="mt-1 w-full" name="passportFile" type="file" />
              </label>
              <label className="block">
                <span className={labelClass}>{say("new_photoLicence")}</span>
                <input accept="image/*,application/pdf" className="mt-1 w-full" name="driverLicenseFile" type="file" />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelClass}>{say("doc_selfie")}</span>
                <input accept="image/*" className="mt-1 w-full" name="selfieFile" type="file" />
              </label>
            </div>
          </Fold>

          <Fold summary={say("new_emSummary")} title={say("new_emTitle")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>{say("new_emName")}</span>
                <input className={inputClass} name="emergencyContactName" />
              </label>
              <label className="block">
                <span className={labelClass}>{say("new_emPhone")}</span>
                <PhoneFields codeLabel={say("new_countryCode")} codeName="emergencyPhoneCountryCode" inputName="emergencyContactPhone" />
              </label>
            </div>
          </Fold>

          <Fold summary={say("new_notesSummary")} title={say("n_title")}>
            <textarea aria-label={say("n_title")} className="min-h-28 w-full" name="notes" />
          </Fold>

          <div className="sticky-actions sticky z-10 -mx-1 flex gap-2 bg-[var(--background)] px-1 py-3 sm:justify-end [&>*:last-child]:flex-1 sm:[&>*:last-child]:flex-none">
            <Link className="secondary-action pressable justify-center" href="/customers">
              {say("new_cancel")}
            </Link>
            <PendingButton className="primary-action justify-center" pendingLabel={say("saving")} type="submit">
              {say("new_save")}
            </PendingButton>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
