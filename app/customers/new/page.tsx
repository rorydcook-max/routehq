import Link from "next/link";
import { createCustomer } from "@/app/actions/customers";
import { AppShell } from "@/components/app-shell";
import { PendingButton } from "@/components/pending-button";
import { Fold } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { commonCountries, customerLanguages, phoneCodeOptions } from "@/lib/customer-options";
import { getDefaultOrganization } from "@/lib/organization";

const inputClass =
  "mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus-ring)]";

const contactMethodOptions = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "messenger", label: "Messenger" },
  { value: "line", label: "LINE" },
  { value: "telegram", label: "Telegram" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone call" }
];

function CountryDatalist({ id }: { id: string }) {
  return (
    <datalist id={id}>
      {commonCountries.map((country) => (
        <option key={`${id}-${country.code}`} value={country.name}>
          {country.flag} {country.country}
        </option>
      ))}
    </datalist>
  );
}

function PhoneFields({
  codeName,
  inputName,
  required = false
}: {
  codeName: string;
  inputName: string;
  required?: boolean;
}) {
  return (
    <div className="grid grid-cols-[132px_1fr] gap-2">
      <select aria-label="Country code" className={inputClass} defaultValue="+66" name={codeName}>
        {phoneCodeOptions.map((option) => (
          <option key={`${codeName}-${option.code}`} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
      <input className={inputClass} name={inputName} placeholder="812345678" required={required} type="tel" />
    </div>
  );
}

export default async function NewCustomerPage() {
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-2xl">
        <div className="page-hero mb-5">
          <Link className="text-sm font-bold text-[var(--primary)]" href="/customers">
            Back to customers
          </Link>
          <h1 className="page-title mt-2">Add customer</h1>
          <p className="page-subtitle mt-2">A name and phone number are enough. Add the rest now or later.</p>
        </div>

        {/* Name and phone are all a booking needs. Everything else is one tap away, and the customer fills most of it in on their booking link anyway. */}
        <form action={createCustomer} className="space-y-3">
          <input name="organizationId" type="hidden" value={organization.id} />
          <CountryDatalist id="nationality-options" />
          <CountryDatalist id="licence-country-options" />

          <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-sm)]">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Full name</span>
                <input autoComplete="off" className={inputClass} name="fullName" required />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Phone number</span>
                <PhoneFields codeName="phoneCountryCode" inputName="phone" required />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Nationality</span>
                <input className={inputClass} list="nationality-options" name="nationality" placeholder="Thai" required />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Language for their messages and agreement</span>
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

          <Fold summary="WhatsApp, LINE, Messenger, Telegram, Instagram, email" title="Chat apps and email">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">WhatsApp number</span>
                <input className={inputClass} name="whatsappNumber" placeholder="+66812345678" type="tel" />
                <span className="mt-1 block text-xs text-[var(--muted)]">Leave empty if it is the same as their phone.</span>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">LINE ID</span>
                <input className={inputClass} name="lineId" placeholder="@lineusername" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Facebook Messenger</span>
                <input className={inputClass} name="messengerId" placeholder="Profile link or username" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Telegram</span>
                <input className={inputClass} name="telegramUsername" placeholder="@username" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Instagram</span>
                <input className={inputClass} name="instagramHandle" placeholder="@username" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Email</span>
                <input className={inputClass} name="email" type="email" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">They prefer to be contacted by</span>
                <select className={inputClass} defaultValue="whatsapp" name="preferredContactMethod">
                  {contactMethodOptions.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Fold>

          <Fold summary="Optional - customers add these on their booking link" title="Passport and driving licence">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Passport number</span>
                <input className={inputClass} name="passportNumber" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Passport expiry date</span>
                <input className={inputClass} name="passportExpiry" type="date" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Driving licence number</span>
                <input className={inputClass} name="driverLicenseNumber" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Driving licence expiry date</span>
                <input className={inputClass} name="driverLicenseExpiry" type="date" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Country that issued the licence</span>
                <input className={inputClass} list="licence-country-options" name="driverLicenseCountry" placeholder="Thailand" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Photo of passport</span>
                <input accept="image/*,application/pdf" className={inputClass} name="passportFile" type="file" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Photo of driving licence</span>
                <input accept="image/*,application/pdf" className={inputClass} name="driverLicenseFile" type="file" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Photo of the customer</span>
                <input accept="image/*" className={inputClass} name="selfieFile" type="file" />
              </label>
            </div>
          </Fold>

          <Fold summary="Someone to call if you cannot reach them" title="Emergency contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Name</span>
                <input className={inputClass} name="emergencyContactName" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Phone</span>
                <PhoneFields codeName="emergencyPhoneCountryCode" inputName="emergencyContactPhone" />
              </label>
            </div>
          </Fold>

          <Fold summary="Only you and your team see these" title="Notes">
            <textarea aria-label="Notes" className={`${inputClass} min-h-28`} name="notes" />
          </Fold>

          <div className="sticky-actions sticky z-10 -mx-1 flex flex-col-reverse gap-2 bg-[var(--background)] px-1 py-3 sm:flex-row sm:justify-end">
            <Link className="secondary-action pressable justify-center" href="/customers">
              Cancel
            </Link>
            <PendingButton className="primary-action justify-center" pendingLabel="Saving..." type="submit">
              Save customer
            </PendingButton>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
