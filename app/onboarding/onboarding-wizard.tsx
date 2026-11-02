"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Car, CheckCircle2, ChevronRight, FileSpreadsheet, HandHelping, Loader2, PenLine, Sparkles } from "lucide-react";
import { finishOnboarding, saveBusinessProfile } from "@/app/actions/onboarding";
import { setMyLanguage } from "@/app/actions/settings";
import { FleetAssistant } from "@/components/fleet-assistant";
import { SetupRequestPanel } from "@/components/setup-request-panel";
import { supportedLocaleOptions } from "@/lib/i18n/locales";
import { defaultCurrencyForCountry, locationOptions, townsFor } from "@/lib/onboarding-locations";

type Organization = { id: string; name: string; default_locale: string; settings?: Record<string, any> };

const fieldClass = "mt-1 w-full";
const labelClass = "font-semibold text-[var(--foreground-secondary)]";

/**
 * Setup (Rory, 2 Nov 2026): as little as possible between signing up and using RoveHQ.
 * 1. Language, phone, where you are. 2. Your vehicles: tell the assistant, a short form, a list, or later.
 * Setup counts as done once step 1 is saved, so nobody is ever sent back here; vehicles can be added any time.
 */
export function OnboardingWizard({
  organization,
  initialStep,
  vehicles,
  defaultCountry,
  openAssistant = false
}: {
  organization: Organization;
  initialStep: 1 | 2;
  vehicles: string[];
  defaultCountry: string;
  /** Came from "Add who's renting now": the assistant opens straight away. */
  openAssistant?: boolean;
}) {
  const t = useTranslations("onboarding");
  const locale = useLocale();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(initialStep);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(openAssistant);
  const [helpOpen, setHelpOpen] = useState(false);
  const saved = organization.settings?.main_location || {};
  const [phone, setPhone] = useState(String(organization.settings?.business_phone || ""));
  const [country, setCountry] = useState(String(saved.country || defaultCountry || "Thailand"));
  const [town, setTown] = useState(String(saved.town || ""));
  const towns = useMemo(() => townsFor(country), [country]);
  const countries = useMemo(() => [...locationOptions.map((option) => option.country)].sort((a, b) => a.localeCompare(b)), []);
  const languages = useMemo(() => [...supportedLocaleOptions].sort((a, b) => a.label.localeCompare(b.label)), []);
  // Adding vehicles re-draws this page with the new list, so the count is always the real one.
  const vehicleCount = vehicles.length;

  function changeLanguage(code: string) {
    startTransition(async () => {
      await setMyLanguage(code);
      router.refresh();
    });
  }

  function saveStepOne() {
    const place = town.trim();
    if (!place) {
      setError(t("needTown"));
      return;
    }
    setError("");
    const known = towns.find((entry) => entry.town.toLowerCase() === place.toLowerCase());
    startTransition(async () => {
      try {
        const form = new FormData();
        form.set("organizationId", organization.id);
        form.set("businessName", organization.name);
        form.set("businessPhone", phone);
        form.set("language", locale);
        form.set("country", country);
        form.set("region", known?.region || "");
        form.set("town", known?.town || place);
        form.set("location", [known?.town || place, known?.region, country].filter(Boolean).join(", "));
        form.set("currency", defaultCurrencyForCountry(country));
        await saveBusinessProfile(form);
        setStep(2);
        // A reload stays on this step.
        window.history.replaceState(window.history.state, "", "/onboarding?step=2");
        window.scrollTo({ top: 0 });
      } catch {
        setError(t("saveFailed"));
      }
    });
  }

  function done() {
    startTransition(async () => {
      try {
        const form = new FormData();
        form.set("organizationId", organization.id);
        await finishOnboarding(form);
      } catch {
        // Setup was already marked done when step 1 was saved; the dashboard opens either way.
      }
      router.push("/?welcome=1" as Route);
    });
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-5 text-[var(--foreground)]">
      <div className="mx-auto flex max-w-xl flex-col">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-[22px] font-bold">{t("title")}</h1>
          <div aria-label={t("stepOf", { step, total: 2 })} className="flex gap-2">
            {[1, 2].map((entry) => (
              <span className={`h-3 w-3 rounded-full ${entry <= step ? "bg-[var(--primary)]" : "bg-[var(--border-strong)]"}`} key={entry} />
            ))}
          </div>
        </header>

        {step === 1 ? (
          <section className="card p-4 sm:p-7">
            <h2 className="text-[26px] font-bold leading-tight">{t("welcome", { name: organization.name })}</h2>
            <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{t("welcomeBody")}</p>
            <div className="mt-5 grid gap-4">
              <label className="block">
                <span className={labelClass}>{t("language")}</span>
                <select className={fieldClass} disabled={isPending} onChange={(event) => changeLanguage(event.target.value)} value={locale}>
                  {languages.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClass}>{t("phone")}</span>
                <input autoComplete="tel" className={fieldClass} inputMode="tel" maxLength={40} onChange={(event) => setPhone(event.target.value)} placeholder="+66 ..." type="tel" value={phone} />
                <span className="mt-1 block text-[14px] font-medium text-[var(--muted)]">{t("phoneHint")}</span>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>{t("country")}</span>
                  <select className={fieldClass} onChange={(event) => setCountry(event.target.value)} value={country}>
                    {countries.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={labelClass}>{t("town")}</span>
                  <input className={fieldClass} list="setup-towns" onChange={(event) => setTown(event.target.value)} placeholder={towns[0]?.town || ""} value={town} />
                  <datalist id="setup-towns">
                    {towns.map((entry) => (
                      <option key={`${entry.region}-${entry.town}`} value={entry.town}>
                        {entry.region}
                      </option>
                    ))}
                  </datalist>
                </label>
              </div>
            </div>
            {error ? <p className="mt-4 rounded-xl bg-[var(--warning-light)] p-3 font-semibold text-[var(--foreground)]">{error}</p> : null}
            <button className="primary-action pressable mt-5 w-full justify-center" disabled={isPending} onClick={saveStepOne} type="button">
              {isPending ? <Loader2 className="animate-spin" size={18} /> : null}
              {t("continue")}
            </button>
          </section>
        ) : (
          <section className="card p-4 sm:p-7">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
              {vehicleCount ? <CheckCircle2 size={24} /> : <Car size={24} />}
            </span>
            <h2 className="mt-3 text-[26px] font-bold leading-tight">{vehicleCount ? t("vehiclesAdded", { count: vehicleCount }) : t("vehiclesTitle")}</h2>
            <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{vehicleCount ? t("vehiclesAddedBody") : t("vehiclesBody")}</p>
            {vehicles.length ? (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {vehicles.slice(0, 12).map((name, index) => (
                  <li className="rounded-full bg-[var(--panel-secondary)] px-3 py-1 text-[14px] font-semibold text-[var(--foreground)]" key={index}>
                    {name}
                  </li>
                ))}
                {vehicles.length > 12 ? <li className="px-2 py-1 text-[14px] font-semibold text-[var(--muted)]">+{vehicles.length - 12}</li> : null}
              </ul>
            ) : null}

            <div className="mt-5 grid gap-2">
              {/* The quickest way: say it, type it or photograph it, and the assistant fills in the vehicles. */}
              {assistantOpen ? (
                <FleetAssistant currency={defaultCurrencyForCountry(country)} hasVehicles={vehicles.length > 0} onAdded={() => router.refresh()} organizationId={organization.id} />
              ) : (
                <button className="pressable flex items-start gap-3 rounded-xl bg-[var(--primary)] p-4 text-left text-white" onClick={() => setAssistantOpen(true)} type="button">
                  <Sparkles className="mt-0.5 shrink-0" size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-bold">{t("optAssistant")}</span>
                    <span className="block font-medium text-white/90">{t("optAssistantBody")}</span>
                  </span>
                  <ChevronRight className="mt-1 shrink-0" size={20} />
                </button>
              )}
              <Link className="pressable flex items-start gap-3 rounded-xl bg-[var(--panel-secondary)] p-4" href={"/fleet/new?from=onboarding" as Route}>
                <PenLine className="mt-0.5 shrink-0 text-[var(--primary)]" size={24} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-bold text-[var(--foreground)]">{t("optForm")}</span>
                  <span className="block font-medium text-[var(--foreground-secondary)]">{t("optFormBody")}</span>
                </span>
                <ChevronRight className="mt-1 shrink-0 text-[var(--muted)]" size={20} />
              </Link>
              <Link className="pressable flex items-start gap-3 rounded-xl bg-[var(--panel-secondary)] p-4" href={"/fleet/import?from=onboarding" as Route}>
                <FileSpreadsheet className="mt-0.5 shrink-0 text-[var(--primary)]" size={24} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-bold text-[var(--foreground)]">{t("optList")}</span>
                  <span className="block font-medium text-[var(--foreground-secondary)]">{t("optListBody")}</span>
                </span>
                <ChevronRight className="mt-1 shrink-0 text-[var(--muted)]" size={20} />
              </Link>
              {/* Done for them: they send what they have, RoveHQ brings it in. */}
              {helpOpen ? (
                <SetupRequestPanel />
              ) : (
                <button className="pressable flex items-start gap-3 rounded-xl bg-[var(--panel-secondary)] p-4 text-left" onClick={() => setHelpOpen(true)} type="button">
                  <HandHelping className="mt-0.5 shrink-0 text-[var(--primary)]" size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-bold text-[var(--foreground)]">{t("optHelp")}</span>
                    <span className="block font-medium text-[var(--foreground-secondary)]">{t("optHelpBody")}</span>
                  </span>
                  <ChevronRight className="mt-1 shrink-0 text-[var(--muted)]" size={20} />
                </button>
              )}
            </div>

            <button className={`${vehicleCount ? "primary-action" : "secondary-action"} pressable mt-5 w-full justify-center`} disabled={isPending} onClick={done} type="button">
              {isPending ? <Loader2 className="animate-spin" size={18} /> : null}
              {vehicleCount ? t("toDashboard") : t("later")}
            </button>
            {vehicleCount ? null : <p className="mt-2 text-center text-[14px] font-medium text-[var(--muted)]">{t("laterHint")}</p>}
          </section>
        )}
      </div>
    </main>
  );
}
