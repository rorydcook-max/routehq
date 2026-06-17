import Link from "next/link";
import { createCustomer } from "@/app/actions/customers";
import { AppShell } from "@/components/app-shell";
import { PendingButton } from "@/components/pending-button";
import { Card, SectionHeader } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { commonCountries, countryCodes, customerLanguages } from "@/lib/customer-options";
import { getDefaultOrganization } from "@/lib/organization";

const inputClass =
  "mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(18,184,200,0.16)]";

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
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <select className={inputClass} defaultValue="+66" name={codeName}>
        {countryCodes.map((code) => (
          <option key={`${codeName}-${code}`} value={code}>
            {code}
          </option>
        ))}
      </select>
      <input className={inputClass} name={inputName} placeholder="812345678" required={required} type="tel" />
    </div>
  );
}

function ContactChannelsSection() {
  return (
    <div className="form-section bg-[var(--primary-light)]">
      <SectionHeader eyebrow="Contact channels" title="Messaging and preferred contact" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-[#344054]">WhatsApp number</span>
          <input className={inputClass} name="whatsappNumber" placeholder="+66812345678 or your number with country code" type="tel" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-[#344054]">Facebook Messenger</span>
          <input className={inputClass} name="messengerId" placeholder="messenger.com/username or full profile URL" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-[#344054]">LINE ID</span>
          <input className={inputClass} name="lineId" placeholder="@lineusername" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-[#344054]">Telegram</span>
          <input className={inputClass} name="telegramUsername" placeholder="@telegramusername" />
        </label>
        <label className="block opacity-85">
          <span className="text-sm font-semibold text-[#344054]">Instagram</span>
          <input className={inputClass} name="instagramHandle" placeholder="@instagramhandle" />
          <span className="mt-1 block text-xs text-[var(--muted)]">Optional</span>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-[#344054]">Preferred contact method</span>
          <select className={inputClass} defaultValue="whatsapp" name="preferredContactMethod">
            {contactMethodOptions.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

export default async function NewCustomerPage() {
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-3xl">
        <div className="page-hero mb-5">
          <Link className="text-sm font-bold text-[var(--primary)]" href="/customers">
            Back to customers
          </Link>
          <h1 className="page-title mt-2">Add customer</h1>
          <p className="page-subtitle mt-2">Create a customer manually, including documents and emergency contact details.</p>
        </div>

        <Card>
          <form action={createCustomer} className="space-y-5">
            <input name="organizationId" type="hidden" value={organization.id} />
            <CountryDatalist id="nationality-options" />
            <CountryDatalist id="licence-country-options" />

            <div className="form-section bg-[var(--primary-blue-light)]">
              <SectionHeader eyebrow="Personal details" title="Customer identity" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Full name</span>
                  <input className={inputClass} name="fullName" required />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Phone number</span>
                  <PhoneFields codeName="phoneCountryCode" inputName="phone" required />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Email</span>
                  <input className={inputClass} name="email" type="email" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Nationality</span>
                  <input className={inputClass} list="nationality-options" name="nationality" placeholder="Thai" required />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Preferred language</span>
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

            <ContactChannelsSection />

            <div className="form-section bg-[#f3eefe]">
              <SectionHeader eyebrow="ID & documents" title="Identity records" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Passport number</span>
                  <input className={inputClass} name="passportNumber" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Passport expiry date</span>
                  <input className={inputClass} name="passportExpiry" type="date" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Driving licence number</span>
                  <input className={inputClass} name="driverLicenseNumber" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Driving licence expiry date</span>
                  <input className={inputClass} name="driverLicenseExpiry" type="date" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-sm font-semibold text-[#344054]">Driving licence country of issue</span>
                  <input className={inputClass} list="licence-country-options" name="driverLicenseCountry" placeholder="Thailand" />
                </label>
              </div>
            </div>

            <div className="form-section bg-[var(--warning-light)]">
              <SectionHeader eyebrow="Emergency contact" title="Backup contact" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Emergency contact name</span>
                  <input className={inputClass} name="emergencyContactName" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Emergency contact phone</span>
                  <PhoneFields codeName="emergencyPhoneCountryCode" inputName="emergencyContactPhone" />
                </label>
              </div>
            </div>

            <div className="form-section bg-[var(--success-light)]">
              <SectionHeader eyebrow="Document uploads" title="Required files" />
              <div className="mt-4 grid gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Passport upload</span>
                  <input accept="image/*,application/pdf" className={inputClass} name="passportFile" type="file" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Driving licence upload</span>
                  <input accept="image/*,application/pdf" className={inputClass} name="driverLicenseFile" type="file" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Customer selfie/photo upload</span>
                  <input accept="image/*" className={inputClass} name="selfieFile" type="file" />
                </label>
              </div>
            </div>

            <div className="form-section bg-[var(--panel-secondary)]">
              <SectionHeader eyebrow="Notes" title="Internal notes" />
              <label className="mt-4 block">
                <span className="text-sm font-semibold text-[#344054]">Notes</span>
                <textarea className={`${inputClass} min-h-32`} name="notes" />
              </label>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link className="secondary-action pressable" href="/customers">
                Cancel
              </Link>
              <PendingButton className="primary-action" pendingLabel="Creating..." type="submit">
                Create customer
              </PendingButton>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
