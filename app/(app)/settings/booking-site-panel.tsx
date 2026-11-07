"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ExternalLink, ImagePlus, Plus, Trash2 } from "lucide-react";
import { saveBookingHero, saveBookingSite } from "@/app/actions/booking-site";
import { TemplateThumb } from "@/components/booking-site/template-thumb";
import { bookingSiteToStored, LIMITS, SOCIAL_KEYS, type BookingSite, type BookingTemplate, type SiteSection, type SiteSocial, type Switchable } from "@/lib/booking-site";

type Say = (key: string, values?: Record<string, string | number>) => string;

// The page as it is first, then the others in alphabetical order (by their English names).
const TEMPLATE_ORDER: BookingTemplate[] = ["standard", "compact", "monthly", "photo", "scooter"];
const SOCIAL_LABELS: Record<keyof SiteSocial, string> = { facebook: "Facebook", instagram: "Instagram", line: "LINE", tiktok: "TikTok", whatsapp: "WhatsApp" };
const SOCIAL_PLACEHOLDERS: Record<keyof SiteSocial, string> = { facebook: "facebook.com/yourpage", instagram: "@yourbusiness", line: "@yourbusiness", tiktok: "@yourbusiness", whatsapp: "+66 81 234 5678" };
const DEFAULT_HOURS = Array.from({ length: 7 }, (_, index) => (index < 6 ? { open: "09:00", close: "18:00" } : null));

const field = "mt-1 w-full";

/**
 * Settings > Booking page > Page design (Rory, 7 Nov 2026): the template, the big photo and headline, and the
 * sections around the vehicles (on or off, in order, with what each says). Saved in settings.booking_site.
 */
export function BookingSitePanel({
  initial,
  heroUrl,
  fallbackPhotoUrl,
  slug,
  colour,
  businessName,
  contacts
}: {
  initial: BookingSite;
  heroUrl: string | null;
  /** The first vehicle photo, used when no big photo has been uploaded. */
  fallbackPhotoUrl: string | null;
  slug: string;
  colour: string;
  businessName: string;
  /** The Business tab's contact details: what the social links fall back to. */
  contacts: Partial<SiteSocial>;
}) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const [site, setSite] = useState<BookingSite>(initial);
  const [photo, setPhoto] = useState<string | null>(heroUrl);
  const [editing, setEditing] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [photoPending, startPhoto] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<BookingSite>) => {
    setStatus("idle");
    setSite((current) => ({ ...current, ...patch }));
  };
  const isOn = (id: Switchable) => !site.off.includes(id);
  const toggle = (id: Switchable) => update({ off: isOn(id) ? [...site.off, id] : site.off.filter((item) => item !== id) });
  const move = (index: number, by: number) => {
    const order = [...site.order];
    const [item] = order.splice(index, 1);
    order.splice(index + by, 0, item);
    update({ order });
  };

  function save() {
    startTransition(async () => {
      const result = await saveBookingSite(bookingSiteToStored(site)).catch(() => ({ ok: false as const, error: "" }));
      setStatus(result.ok ? "saved" : "failed");
    });
  }

  function upload(remove = false) {
    setPhotoError(null);
    const form = new FormData();
    if (remove) form.set("remove", "true");
    else {
      const file = fileRef.current?.files?.[0];
      if (!file) return;
      form.set("photo", file);
    }
    startPhoto(async () => {
      const result = await saveBookingHero(form).catch(() => ({ ok: false as const, error: say("saveFailed") }));
      if (!result.ok) {
        setPhotoError(result.error || say("saveFailed"));
        return;
      }
      if (remove) setPhoto(null);
      else {
        const file = fileRef.current?.files?.[0];
        if (file) setPhoto(URL.createObjectURL(file));
      }
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  /** What each section says, opened under its row. */
  const editor = (id: SiteSection | "hero") => {
    switch (id) {
      case "hero":
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-[var(--panel-tertiary)]">
                {photo || fallbackPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" className="h-full w-full object-cover" src={(photo || fallbackPhotoUrl) as string} />
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="secondary-action pressable cursor-pointer">
                  <ImagePlus size={17} />
                  {photoPending ? say("saving") : photo ? say("bs_photoChange") : say("bs_photoUpload")}
                  <input accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={photoPending} onChange={() => upload(false)} ref={fileRef} type="file" />
                </label>
                {photo ? (
                  <button className="secondary-action pressable" disabled={photoPending} onClick={() => upload(true)} type="button">
                    <Trash2 size={17} />
                    {say("bs_photoRemove")}
                  </button>
                ) : null}
              </div>
            </div>
            <p className="text-sm text-[var(--muted)]">{say("bs_photoHint")}</p>
            {photoError ? <p className="font-bold text-[var(--danger)]">{photoError}</p> : null}
            <label className="block">
              <span className="font-semibold text-[var(--foreground-secondary)]">{say("bs_headline")}</span>
              <input className={field} maxLength={LIMITS.headline} onChange={(event) => update({ headline: event.target.value })} placeholder={businessName} value={site.headline} />
            </label>
            <label className="block">
              <span className="font-semibold text-[var(--foreground-secondary)]">{say("bs_subline")}</span>
              <input className={field} maxLength={LIMITS.subline} onChange={(event) => update({ subline: event.target.value })} placeholder={say("bs_sublinePh")} value={site.subline} />
            </label>
          </div>
        );
      case "about":
        return (
          <textarea className={`${field} min-h-28 py-2`} maxLength={LIMITS.about} onChange={(event) => update({ about: event.target.value })} placeholder={say("bs_aboutPh")} value={site.about} />
        );
      case "why":
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: LIMITS.why }, (_, index) => (
              <input
                aria-label={`${say("bs_s_why")} ${index + 1}`}
                className="w-full"
                key={index}
                maxLength={LIMITS.whyText}
                onChange={(event) => {
                  const why = [...site.why];
                  while (why.length <= index) why.push("");
                  why[index] = event.target.value;
                  update({ why });
                }}
                placeholder={say("bs_whyPh")}
                value={site.why[index] || ""}
              />
            ))}
          </div>
        );
      case "faqs":
        return (
          <div className="space-y-3">
            {site.faqs.map((faq, index) => (
              <div className="space-y-2 rounded-xl bg-[var(--panel-secondary)] p-3" key={index}>
                <input aria-label={say("bs_faqQ")} className="w-full" maxLength={LIMITS.faqQ} onChange={(event) => update({ faqs: site.faqs.map((item, i) => (i === index ? { ...item, q: event.target.value } : item)) })} placeholder={say("bs_faqQ")} value={faq.q} />
                <textarea aria-label={say("bs_faqA")} className="min-h-20 w-full py-2" maxLength={LIMITS.faqA} onChange={(event) => update({ faqs: site.faqs.map((item, i) => (i === index ? { ...item, a: event.target.value } : item)) })} placeholder={say("bs_faqA")} value={faq.a} />
                <button className="text-sm font-bold text-[var(--danger)]" onClick={() => update({ faqs: site.faqs.filter((_, i) => i !== index) })} type="button">
                  {say("bs_remove")}
                </button>
              </div>
            ))}
            {site.faqs.length < LIMITS.faqs ? (
              <button className="secondary-action pressable" onClick={() => update({ faqs: [...site.faqs, { q: "", a: "" }] })} type="button">
                <Plus size={17} />
                {say("bs_faqAdd")}
              </button>
            ) : null}
          </div>
        );
      case "reviews":
        return (
          <label className="block">
            <span className="font-semibold text-[var(--foreground-secondary)]">{say("bs_reviewsUrl")}</span>
            <input className={field} inputMode="url" maxLength={LIMITS.url} onChange={(event) => update({ reviewsUrl: event.target.value })} placeholder="https://g.page/r/..." value={site.reviewsUrl} />
            <span className="mt-1 block text-sm text-[var(--muted)]">{say("bs_reviewsHint")}</span>
          </label>
        );
      case "map":
        return (
          <label className="block">
            <span className="font-semibold text-[var(--foreground-secondary)]">{say("bs_mapQuery")}</span>
            <input className={field} maxLength={LIMITS.map} onChange={(event) => update({ mapQuery: event.target.value })} value={site.mapQuery} />
            <span className="mt-1 block text-sm text-[var(--muted)]">{say("bs_mapHint")}</span>
          </label>
        );
      case "hours": {
        const dayName = (index: number) => new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + index)));
        if (!site.hours) {
          return (
            <button className="secondary-action pressable" onClick={() => update({ hours: DEFAULT_HOURS })} type="button">
              <Plus size={17} />
              {say("bs_hoursSet")}
            </button>
          );
        }
        const hours = site.hours;
        const setDay = (index: number, value: { open: string; close: string } | null) => update({ hours: hours.map((day, i) => (i === index ? value : day)) });
        return (
          <div className="space-y-2">
            {hours.map((day, index) => (
              <div className="flex flex-wrap items-center gap-2" key={index}>
                <span className="w-12 font-semibold text-[var(--foreground)]">{dayName(index)}</span>
                <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--foreground-secondary)]">
                  <input checked={!!day} className="h-5 w-5" onChange={(event) => setDay(index, event.target.checked ? { open: "09:00", close: "18:00" } : null)} type="checkbox" />
                  {say("bs_open")}
                </label>
                {day ? (
                  <>
                    <input aria-label={`${dayName(index)} ${say("bs_from")}`} className="w-[7.5rem]" onChange={(event) => setDay(index, { ...day, open: event.target.value })} type="time" value={day.open} />
                    <span className="text-[var(--muted)]">–</span>
                    <input aria-label={`${dayName(index)} ${say("bs_until")}`} className="w-[7.5rem]" onChange={(event) => setDay(index, { ...day, close: event.target.value })} type="time" value={day.close} />
                  </>
                ) : (
                  <span className="text-sm text-[var(--muted)]">{say("bs_closed")}</span>
                )}
              </div>
            ))}
            <button className="text-sm font-bold text-[var(--danger)]" onClick={() => update({ hours: null })} type="button">
              {say("bs_hoursClear")}
            </button>
          </div>
        );
      }
      case "social":
        return (
          <div className="space-y-2">
            <p className="text-sm text-[var(--muted)]">{say("bs_socialHint")}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SOCIAL_KEYS.map((key) => (
                <label className="block" key={key}>
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{SOCIAL_LABELS[key]}</span>
                  <input className={field} maxLength={LIMITS.social} onChange={(event) => update({ social: { ...site.social, [key]: event.target.value } })} placeholder={contacts[key] || SOCIAL_PLACEHOLDERS[key]} value={site.social[key]} />
                </label>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const row = (id: SiteSection | "hero", index: number | null) => {
    const switchable = id !== "vehicles";
    const on = id === "vehicles" ? true : isOn(id as Switchable);
    const open = editing === id;
    return (
      <li className="rounded-xl border border-[var(--border)] bg-white" key={id}>
        <div className="flex min-h-12 items-center gap-2 px-3 py-1.5">
          {switchable ? (
            <input aria-label={say("bs_show", { section: say(`bs_s_${id}`) })} checked={on} className="h-5 w-5 shrink-0" onChange={() => toggle(id as Switchable)} type="checkbox" />
          ) : (
            <span className="h-5 w-5 shrink-0" />
          )}
          <span className={`min-w-0 flex-1 font-semibold ${on ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}>
            {say(`bs_s_${id}`)}
            {id === "vehicles" ? <span className="ms-2 text-sm font-medium text-[var(--muted)]">{say("bs_alwaysOn")}</span> : null}
          </span>
          {id !== "vehicles" ? (
            <button className="min-h-10 rounded-full px-3 text-sm font-bold text-[var(--primary)]" onClick={() => setEditing(open ? null : id)} type="button">
              {open ? say("bs_done") : say("bs_edit")}
            </button>
          ) : null}
          {index !== null ? (
            <span className="flex shrink-0">
              <button aria-label={say("bs_up")} className="flex h-10 w-9 items-center justify-center rounded-lg text-[var(--foreground-secondary)] disabled:opacity-30" disabled={index === 0} onClick={() => move(index, -1)} type="button">
                <ArrowUp size={17} />
              </button>
              <button aria-label={say("bs_down")} className="flex h-10 w-9 items-center justify-center rounded-lg text-[var(--foreground-secondary)] disabled:opacity-30" disabled={index === site.order.length - 1} onClick={() => move(index, 1)} type="button">
                <ArrowDown size={17} />
              </button>
            </span>
          ) : null}
        </div>
        {open ? <div className="border-t border-[var(--border)] p-3">{editor(id)}</div> : null}
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-[var(--foreground)]">{say("bs_title")}</h3>
        <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">{say("bs_body")}</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label={say("bs_title")}>
        {TEMPLATE_ORDER.map((template) => {
          const chosen = site.template === template;
          return (
            <div className={`flex flex-col rounded-2xl border-2 p-2 ${chosen ? "border-[var(--primary)] bg-[var(--primary-light)]" : "border-[var(--border)] bg-white"}`} key={template}>
              <button aria-checked={chosen} className="text-start" onClick={() => update({ template })} role="radio" type="button">
                <TemplateThumb colour={colour} template={template} />
                <span className="mt-2 block font-bold leading-tight text-[var(--foreground)]">{say(`bs_t_${template}`)}</span>
                <span className="mt-0.5 block text-sm leading-5 text-[var(--foreground-secondary)]">{say(`bs_td_${template}`)}</span>
              </button>
              <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                {initial.template === template ? <span className="whitespace-nowrap text-sm font-bold text-[var(--primary)]">{say("bs_current")}</span> : <span />}
                <a className="inline-flex min-h-10 items-center gap-1 rounded-full px-2 text-sm font-bold text-[var(--primary)]" href={`/rent/${slug}?template=${template}`} rel="noreferrer" target="_blank">
                  <ExternalLink size={15} />
                  {say("bs_preview")}
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {site.template === "standard" ? (
        <p className="text-sm font-medium text-[var(--muted)]">{say("bs_standardNote")}</p>
      ) : (
        <div>
          <h3 className="font-bold text-[var(--foreground)]">{say("bs_sections")}</h3>
          <p className="mt-0.5 text-sm font-medium text-[var(--muted)]">{say("bs_sectionsHint")}</p>
          <ul className="mt-2 space-y-2">
            {row("hero", null)}
            {site.order.map((id, index) => row(id, index))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button className="primary-action pressable" disabled={isPending} onClick={save} type="button">
          {isPending ? say("saving") : say("bs_save")}
        </button>
        {status === "saved" ? <span className="font-bold text-[var(--success)]">{say("saved")}</span> : null}
        {status === "failed" ? <span className="font-bold text-[var(--danger)]">{say("saveFailed")}</span> : null}
      </div>
    </div>
  );
}
