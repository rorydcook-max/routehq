"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { shownError } from "@/lib/error-text";
import { unwrap } from "@/lib/action-result";
import { useTranslations, useLocale } from "next-intl";
import { ChevronLeft, Plus, Search, UserRound, X } from "lucide-react";
import { createInlineCustomer } from "@/app/actions/customers";
import { allCountries, countriesSorted, flagForNationality } from "@/lib/customer-options";
import { initialsOf } from "@/components/glance";
import { PhoneField } from "@/components/phone-field";
import { ContactChoice } from "@/components/contact-choice";
import { businessCountry } from "@/lib/business-units";

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
  // The business's own country to start (it was always "Thai"); the phone number's country replaces it when found.
  const homeCountry = businessCountry();
  const [nationality, setNationality] = useState(() => allCountries.find((country) => country.code === homeCountry)?.name || "");
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
        // No phone typed: leave WhatsApp empty rather than save the country code alone as a "number".
        if (formData.get("preferredContactMethod") === "whatsapp" && !String(formData.get("whatsappNumber") || "").trim() && String(formData.get("phone") || "").trim()) {
          formData.set("whatsappNumber", `${String(formData.get("phoneCountryCode") || "")}${String(formData.get("phone") || "").replace(/^0/, "")}`);
        }
        // Said here, before saving: a name and any one way to reach them (a phone isn't needed when there's Messenger, LINE...).
        const reachable = ["phone", "whatsappNumber", "messengerId", "lineId", "telegramUsername", "email"].some((key) => String(formData.get(key) || "").trim());
        if (!String(formData.get("fullName") || "").trim() || !reachable) {
          setError(say("sel_needContact"));
          return;
        }
        const result = await unwrap(createInlineCustomer(formData));
        const fullName = result.full_name || String(formData.get("fullName") || "");
        const phone = result.phone || null;
        const nationality = result.nationality || String(formData.get("nationality") || "");
        const newCustomer = { id: result.id, full_name: fullName, phone, nationality, document_status: result.document_status || "no_documents" };
        setLocalCustomers((current) => [...current, newCustomer]);
        setSelectedId(result.id);
        onSelect?.(newCustomer);
        setOpen(false);
        setCreating(false);
        setSearch("");
      } catch (createError) {
        setError(shownError(createError, say("sel_failed")));
      }
    });
  }

  return (
    <div className="relative">
      <input name={name} type="hidden" value={selectedId} />
      {/* Nobody chosen yet: a search field with the matches right under it, and "Add a new customer" (Rory, 1 Nov 2026:
          no "Choose customer" button to open first). Chosen: their card, with Change. */}
      {!selectedCustomer ? (
        <div className="space-y-2">
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
            <input
              aria-label={say("search")}
              className={`${inputClass} !pl-10`}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              placeholder={say("search")}
              type="search"
              value={search}
            />
          </div>
          {search.trim() ? (
            <div className="max-h-72 overflow-y-auto">
              {filteredCustomers.slice(0, 12).map((customer) => (
                <button
                  className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[var(--panel-secondary)]"
                  key={customer.id}
                  onClick={() => {
                    setSelectedId(customer.id);
                    onSelect?.(customer);
                    setSearch("");
                  }}
                  type="button"
                >
                  <span className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-[15px] text-[var(--primary)]">{initialsOf(customer.full_name)}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-[var(--foreground)]">{customer.full_name}</span>
                    <span className="block truncate text-sm text-[var(--muted)]">
                      {[customer.phone, customer.nationality ? `${flagForNationality(customer.nationality)} ${customer.nationality}` : null].filter(Boolean).join(" · ") || say("noPhone")}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          <button
            className="inline-flex min-h-11 items-center gap-2 font-bold text-[var(--primary)]"
            onClick={() => {
              setCreating(true);
              setOpen(true);
            }}
            type="button"
          >
            <Plus size={18} />
            {say("sel_create")}
          </button>
        </div>
      ) : (
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
      )}

      {open ? (
        <div className="fixed inset-0 z-50 bg-[var(--foreground)]/30 sm:absolute sm:inset-auto sm:top-full sm:z-30 sm:mt-2 sm:w-full sm:bg-transparent">
          {/* One scrolling area filling the sheet (Rory, 1 Nov 2026: the add-customer form was squeezed into a small box
              at the bottom of the screen). dvh, so the sheet shrinks above the phone keyboard rather than under it. */}
          <div className={`absolute bottom-0 left-0 right-0 flex flex-col overflow-hidden rounded-t-2xl border border-[var(--border)] bg-white shadow-2xl sm:relative sm:rounded-lg ${creating ? "h-[92dvh] sm:h-auto sm:max-h-[640px]" : "max-h-[80dvh] sm:max-h-[420px]"}`}>
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] p-3">
              <p className="font-semibold text-[var(--foreground)]">{creating ? say("sel_create") : say("sel_select")}</p>
              <button aria-label={say("closeLabel")} className="rounded-full p-2 text-[var(--muted)]" onClick={() => setOpen(false)} type="button">
                <X size={18} />
              </button>
            </div>
            {creating ? null : (
              <div className="shrink-0 p-3">
                <input className={inputClass} onChange={(event) => setSearch(event.target.value)} placeholder={say("search")} value={search} />
              </div>
            )}
            <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(12px,env(safe-area-inset-bottom))] ${creating ? "pt-3" : ""}`}>
              {creating ? (
                <button className="mb-1 flex min-h-11 items-center gap-1 text-sm font-bold text-[var(--primary)]" onClick={() => setCreating(false)} type="button">
                  <ChevronLeft size={16} />
                  {say("sel_select")}
                </button>
              ) : (
                <button className="mb-2 flex min-h-11 w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] px-3 py-2 text-left text-sm font-bold text-[var(--primary)]" onClick={() => setCreating(true)} type="button">
                  <Plus size={16} />
                  {say("sel_create")}
                </button>
              )}

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
                  {/* A name typed in the search that found nobody carries over. */}
                  <input className={inputClass} defaultValue={/\d/.test(search) ? "" : search.trim()} name="fullName" placeholder={say("sel_fullName")} required />
                  {/* Type or paste the whole number; the country code is found from it. */}
                  <PhoneField
                    defaultCountry={homeCountry || undefined}
                    inputClass={inputClass}
                    onCountryFound={(code) => {
                      if (nationalityTouched) return;
                      const found = allCountries.find((country) => country.code === code);
                      if (found) setNationality(found.name);
                    }}
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
