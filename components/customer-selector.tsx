"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Search, UserRound, X } from "lucide-react";
import { createInlineCustomer } from "@/app/actions/customers";
import { commonCountries, flagForNationality, phoneCodeOptions } from "@/lib/customer-options";

type SelectorCustomer = {
  id: string;
  full_name: string;
  phone: string | null;
  nationality: string | null;
  document_status?: string | null;
};

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

const contactMethodOptions = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "messenger", label: "Messenger" },
  { value: "line", label: "LINE" },
  { value: "telegram", label: "Telegram" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "phone", label: "" }
];

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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [localCustomers, setLocalCustomers] = useState(customers);
  const [selectedId, setSelectedId] = useState(defaultCustomerId);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

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
        const formData = new FormData(form);
        formData.set("organizationId", organizationId);
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
        setError(createError instanceof Error ? createError.message : say("sel_failed"));
      }
    });
  }

  return (
    <div className="relative">
      <input name={name} type="hidden" value={selectedId} />
      <button
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-white px-3 py-3 text-left text-sm text-[var(--foreground)]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-lg">
            {selectedCustomer ? flagForNationality(selectedCustomer.nationality) : <UserRound className="text-[var(--primary)]" size={18} />}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-bold">{selectedCustomer?.full_name || say("sel_select")}</span>
            <span className="block truncate text-xs text-[var(--muted)]">{selectedCustomer?.phone || say("search")}</span>
          </span>
        </span>
        <Search className="text-[var(--muted)]" size={18} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-[#10252b]/30 sm:absolute sm:inset-auto sm:top-full sm:z-30 sm:mt-2 sm:w-full sm:bg-transparent">
          <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-hidden rounded-t-2xl border border-[var(--border)] bg-white shadow-2xl sm:relative sm:max-h-[420px] sm:rounded-lg">
            <div className="flex items-center justify-between border-b border-[var(--border)] p-3">
              <p className="font-semibold text-[var(--foreground)]">{say("sel_select")}</p>
              <button className="rounded-full p-2 text-[var(--muted)]" onClick={() => setOpen(false)} type="button">
                <X size={18} />
              </button>
            </div>
            <div className="p-3">
              <input className={inputClass} onChange={(event) => setSearch(event.target.value)} placeholder={say("search")} value={search} />
            </div>
            <div className="max-h-64 overflow-y-auto px-3 pb-3">
              <button className="mb-2 flex min-h-11 w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[#fbfaf8] px-3 py-2 text-left text-sm font-bold text-[var(--primary)]" onClick={() => setCreating((value) => !value)} type="button">
                <Plus size={16} />
                {say("sel_create")}
              </button>

              {creating ? (
                <form ref={formRef} className="mt-3 space-y-3 rounded-lg border border-[var(--border)] bg-[#fbfaf8] p-3">
                  <input name="organizationId" type="hidden" value={organizationId} />
                  <input className={inputClass} name="fullName" placeholder={say("sel_fullName")} required />
                  <div className="grid grid-cols-[124px_1fr] gap-2">
                    <select aria-label={say("sel_countryCode")} className={inputClass} defaultValue="+66" name="phoneCountryCode">
                      {phoneCodeOptions.map((option) => (
                        <option key={`selector-${option.code}`} value={option.code}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input className={inputClass} name="phone" placeholder={say("sel_phone")} required type="tel" />
                  </div>
                  <select className={inputClass} defaultValue="Thai" name="nationality" required>
                    {commonCountries.map((country) => (
                      <option key={country.code} value={country.name}>
                        {country.flag} {country.name}
                      </option>
                    ))}
                  </select>
                  <div className="rounded-lg border border-[var(--border)] bg-white p-3">
                    <p className="text-xs font-bold uppercase text-[var(--primary)]">{say("sel_channels")}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{say("sel_channelsHint")}</p>
                    <div className="mt-3 grid gap-2">
                      <input className={inputClass} name="email" placeholder={say("sel_email")} type="email" />
                      <input className={inputClass} name="whatsappNumber" placeholder={say("sel_whatsapp")} type="tel" />
                      <input className={inputClass} name="messengerId" placeholder={say("sel_messenger")} />
                      <input className={inputClass} name="lineId" placeholder="@lineusername" />
                      <input className={inputClass} name="telegramUsername" placeholder="@telegramusername" />
                      <input className={`${inputClass} opacity-85`} name="instagramHandle" placeholder="@instagramhandle" />
                      <select className={inputClass} defaultValue="whatsapp" name="preferredContactMethod">
                        {contactMethodOptions.map((method) => (
                          <option key={`selector-contact-${method.value}`} value={method.value}>
                            {method.label || say("sel_phoneCall")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {error ? <p className="rounded-lg bg-[#ffe4e6] px-3 py-2 text-sm font-semibold text-[#be123c]">{error}</p> : null}
                  <button className="inline-flex w-full justify-center rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-bold text-white disabled:opacity-70" disabled={isPending} onClick={handleCreateCustomer} type="button">
                    {isPending ? say("sel_creating") : say("sel_createSelect")}
                  </button>
                </form>
              ) : null}
              {creating ? null : (
                <>
              {filteredCustomers.map((customer) => (
                <button
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-[#fbfaf8]"
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
