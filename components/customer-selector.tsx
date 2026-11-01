"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { shownError } from "@/lib/error-text";
import { useTranslations, useLocale } from "next-intl";
import { Plus, Search, UserRound, X } from "lucide-react";
import { createInlineCustomer } from "@/app/actions/customers";
import { allCountries, countriesSorted, flagForNationality } from "@/lib/customer-options";
import { initialsOf } from "@/components/glance";
import { PhoneField } from "@/components/phone-field";
import { ContactChoice } from "@/components/contact-choice";

type SelectorCustomer = {
  id: string;
  full_name: string;
  phone: string | null;
  nationality: string | null;
  document_status?: string | null;
};

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

export function CustomerSelector({
  customers,
  organizationId,
  name = "customerId",
  defaultCustomerId = "",
  onSelect
}: {
  customers: SelectorCustomer[];
  organizationId: string;
  name?: string;
  defaultCustomerId?: string;
  onSelect?: (customer: SelectorCustomer) => void;
}) {
  const say = useTranslations("customers") as unknown as (key: string) => string;
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [localCustomers, setLocalCustomers] = useState(customers);
  const [selectedId, setSelectedId] = useState(defaultCustomerId);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLDivElement>(null);
  const [contact, setContact] = useState("whatsapp");
  const nationalityOptions = useMemo(() => countriesSorted(locale), [locale]);
  const [nationality, setNationality] = useState("Thai");
  const [nationalityTouched, setNationalityTouched] = useState(false);

  const selectedCustomer = localCustomers.find((customer) => customer.id === selectedId);
  const filteredCustomers = useMemo(() => {
    const needle = search.toLowerCase().trim();
    return localCustomers.filter((customer) => !needle || customer.full_name.toLowerCase().includes(needle) || customer.phone?.toLowerCase().includes(needle));
  }, [localCustomers, search]);

  function handleCreateCustomer() {
    setError("");
    const form = formRef.current;
    if (!form) {
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input[name], select[name], textarea[name]").forEach((field) => {
          if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio") && !field.checked) return;
          formData.set(field.name, field.value);
        });
        formData.set("organizationId", organizationId);
        if (formData.get("preferredContactMethod") === "whatsapp" && !String(formData.get("whatsappNumber") || "").trim()) {
          formData.set("whatsappNumber", `${String(formData.get("phoneCountryCode") || "")}${String(formData.get("phone") || "").replace(/^0/, "")}`);
        }
        const result = await createInlineCustomer(formData);
        const fullName = result.full_name || String(formData.get("fullName") || "");
        const phone = result.phone || null;
        const nationality = result.nationality || String(formData.get("nationality") || "");
        const newCustomer = { id: result.id, full_name: fullName, phone, nationality, document_status: result.document_status || "no_documents" };
        setLocalCustomers((current) => [...current, newCustomer]);
        setSelectedId(result.id);
        onSelect?.(newCustomer);
        setOpen(false);
        setCreating(false);
      } catch (createError) {
        setError(shownError(createError, say("sel_failed")));
      }
    });
  }

  return (
    <div className="relative">
      <input name={name} type="hidden" value={selectedId} />
      <button
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-white px-3 py-3 text-left text-[var(--foreground)]"
        onClick={() => setOpen(true)}
        type="button"
      >
        {/* Chosen: initials (as everywhere else), name, and phone or nationality, with "Change". Not chosen: a prompt and a search icon. */}
        <span className="flex min-w-0 items-center gap-3">
          <span className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-[15px] text-[var(--primary)]">
            {selectedCustomer ? initialsOf(selectedCustomer.full_name) : <UserRound className="text-[var(--primary)]" size={18} />}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-bold">{selectedCustomer?.full_name || say("sel_select")}</span>
            {selectedCustomer ? (
              selectedCustomer.phone || selectedCustomer.nationality ? (
                <span className="block truncate text-sm text-[var(--muted)]">
                  {[selectedCustomer.phone, selectedCustomer.nationality ? `${flagForNationality(selectedCustomer.nationality)} ${selectedCustomer.nationality}` : null].filter(Boolean).join(" · ")}
                </span>
              ) : null
            ) : (
              <span className="block truncate text-sm text-[var(--muted)]">{say("search")}</span>
            )}
          </span>
        </span>
        {selectedCustomer ? <span className="shrink-0 font-semibold text-[var(--primary)]">{say("sel_change")}</span> : <Search className="text-[var(--muted)]" size={18} />}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-[var(--foreground)]/30 sm:absolute sm:inset-auto sm:top-full sm:z-30 sm:mt-2 sm:w-full sm:bg-transparent">
          <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-hidden rounded-t-2xl border border-[var(--border)] bg-white shadow-2xl sm:relative sm:max-h-[420px] sm:rounded-lg">
            <div className="flex items-center justify-between border-b border-[var(--border)] p-3">
              <p className="font-semibold text-[var(--foreground)]">{say("sel_select")}</p>
              <button aria-label={say("closeLabel")} className="rounded-full p-2 text-[var(--muted)]" onClick={() => setOpen(false)} type="button">
                <X size={18} />
              </button>
            </div>
            <div className="p-3">
              <input className={inputClass} onChange={(event) => setSearch(event.target.value)} placeholder={say("search")} value={search} />
            </div>
            <div className="max-h-64 overflow-y-auto px-3 pb-3">
              <button className="mb-2 flex min-h-11 w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] px-3 py-2 text-left text-sm font-bold text-[var(--primary)]" onClick={() => setCreating((value) => !value)} type="button">
                <Plus size={16} />
                {say("sel_create")}
              </button>

              {creating ? (
                <div
            className="mt-3 space-y-3 rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] p-3"
            onKeyDown={(event) => {
              // Enter saves the customer; it must not submit the booking form around this box.
              if (event.key === "Enter" && (event.target as HTMLElement).tagName !== "TEXTAREA") {
                event.preventDefault();
                handleCreateCustomer();
              }
            }}
            ref={formRef}
          >
                  <input name="organizationId" type="hidden" value={organizationId} />
                  <input className={inputClass} name="fullName" placeholder={say("sel_fullName")} required />
                  {/* Type or paste the whole number; the country code is found from it. */}
                  <PhoneField
                    inputClass={inputClass}
                    onCountryFound={(code) => {
                      if (nationalityTouched) return;
                      const found = allCountries.find((country) => country.code === code);
                      if (found) setNationality(found.name);
                    }}
                    required
                  />
                  <select
                    aria-label={say("sel_nationality")}
                    className={inputClass}
                    name="nationality"
                    onChange={(event) => {
                      setNationality(event.target.value);
                      setNationalityTouched(true);
                    }}
                    required
                    value={nationality}
                  >
                    {nationalityOptions.map((country) => (
                      <option key={country.code} value={country.name}>
                        {country.flag} {country.label}
                      </option>
                    ))}
                  </select>
                  <ContactChoice contact={contact} inputClass={inputClass} say={say} setContact={setContact} />
                  {error ? <p className="rounded-lg bg-[var(--danger-light)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
                  <button className="inline-flex w-full justify-center rounded-full bg-[var(--primary)] px-3 py-2 text-sm font-bold text-white disabled:opacity-70" disabled={isPending} onClick={handleCreateCustomer} type="button">
                    {isPending ? say("sel_creating") : say("sel_createSelect")}
                  </button>
                </div>
              ) : null}
              {creating ? null : (
                <>
              {filteredCustomers.map((customer) => (
                <button
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-[var(--panel-secondary)]"
                  key={customer.id}
                  onClick={() => {
                    setSelectedId(customer.id);
                    onSelect?.(customer);
                    setOpen(false);
                  }}
                  type="button"
                >
                  <span className="text-xl">{flagForNationality(customer.nationality)}</span>
                  <span>
                    <span className="block font-bold text-[var(--foreground)]">{customer.full_name}</span>
                    <span className="text-xs text-[var(--muted)]">{customer.phone || say("noPhone")}</span>
                  </span>
                </button>
              ))}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
