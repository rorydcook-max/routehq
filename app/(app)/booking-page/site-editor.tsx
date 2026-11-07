"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Check, LayoutTemplate, Plus, RotateCcw, Upload, X } from "lucide-react";
import { uploadSiteImage } from "@/app/actions/sites";
import { SiteArt } from "@/components/site/site-art";
import { LIMITS, SECTION_IDS, SOCIAL_KEYS, type SectionId, type SiteConfig, type SiteSocial } from "@/lib/sites/config";
import { FONT_PAIRINGS, fontPairing, fontPreviewHref, fontStack } from "@/lib/sites/fonts";
import { ART_IDS, type ImageRef } from "@/lib/sites/images";
import { sitePalette, siteVars, type Palette } from "@/lib/sites/palettes";
import { TEMPLATE_IDS, TEMPLATE_TAGS, TEMPLATES, templateDef, type TemplateId, type TemplateTag } from "@/lib/sites/templates";
import { PalettePicker } from "./palette-picker";
import type { SiteDraft } from "./use-site-draft";

type Say = (key: string, values?: Record<string, string | number>) => string;
export type EditorVehicle = { id: string; name: string; photoUrl: string | null };
export type EditorPart = { id: string; title: string; summary?: string; body: ReactNode };

/** Each template's gallery picture, taken from its example at /rent/demo/<id> by scripts/site-template-previews.mjs. */
const templatePicture = (id: TemplateId) => `/site/templates/${id}.webp`;
const TAG_LABEL: Record<"all" | TemplateTag, string> = { all: "tag_all", car: "tag_car", "two-wheel": "tag_twoWheel", premium: "tag_premium", island: "tag_island" };
const SOCIAL_LABELS: Record<keyof SiteSocial, string> = { facebook: "Facebook", instagram: "Instagram", line: "LINE", tiktok: "TikTok", whatsapp: "WhatsApp" };
const DEFAULT_HOURS = Array.from({ length: 7 }, (_, index) => (index < 6 ? { open: "09:00", close: "18:00" } : null));

/** Colours and fonts for a small sample (palette swatches, art thumbnails) without the whole site around it. */
function sampleVars(draft: SiteConfig, palette: Palette) {
  const template = templateDef(draft.template);
  return siteVars(palette, template, fontPairing(draft.font, template.font)) as CSSProperties;
}

/**
 * The website editor's parts (Booking page tool, Rory 7 Nov 2026): Look (template, colours, fonts), Images and
 * Sections. Text is edited by clicking it in the preview. `renderPart` draws each part (the tool folds them).
 */
export function SiteEditorParts({ site, brandColour, vehicles, renderPart }: { site: SiteDraft; brandColour: string; vehicles: EditorVehicle[]; renderPart: (part: EditorPart) => ReactNode }) {
  const say = useTranslations("siteEditor") as unknown as Say;
  const { draft, update } = site;
  const [gallery, setGallery] = useState(false);
  const template = templateDef(draft.template);
  const current = sitePalette(draft, template, brandColour);
  const font = fontPairing(draft.font, template.font);
  const paletteName = say(`pal_${draft.palette}`);

  const look = (
    <div className="space-y-6">
      <div>
        <p className="font-semibold text-[var(--foreground)]">{say("template")}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3 rounded-2xl bg-[var(--panel-secondary)] p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" className="h-16 w-24 shrink-0 rounded-xl object-cover object-top" height={64} src={templatePicture(draft.template)} width={96} />
          <span className="min-w-0 flex-1 text-[17px] font-bold text-[var(--foreground)]">{say(`t_${draft.template}`)}</span>
          <button className="secondary-action pressable shrink-0 max-sm:w-full" onClick={() => setGallery(true)} type="button">
            <LayoutTemplate size={17} />
            {say("chooseTemplate")}
          </button>
        </div>
      </div>

      <PalettePicker brandColour={brandColour} site={site} />

      <fieldset>
        <legend className="font-semibold text-[var(--foreground)]">{say("fonts")}</legend>
        {/* Each pairing's name in its own fonts: tiny files with just those letters. */}
        {FONT_PAIRINGS.map((pairing) => (
          <link href={fontPreviewHref(pairing)} key={pairing.id} rel="stylesheet" />
        ))}
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1" role="radiogroup">
          {/* The template's own pairing is listed once, as "Template default" (not again further down). */}
          {[null, ...FONT_PAIRINGS.map((pairing) => pairing.id).filter((id) => id !== template.font)].map((id) => {
            const pairing = fontPairing(id, template.font);
            const on = id === null ? draft.font === null || draft.font === template.font : draft.font === id;
            return (
              <button aria-checked={on} className={`flex min-h-14 items-center justify-between gap-2 rounded-xl px-3 py-2 text-start ${on ? "bg-[var(--primary-light)] ring-2 ring-[var(--primary)]" : "bg-[var(--panel-secondary)]"}`} key={id || "auto"} onClick={() => update({ font: id })} role="radio" type="button">
                <span className="min-w-0">
                  <span className="block truncate text-[19px] leading-tight text-[var(--foreground)]" style={{ fontFamily: fontStack(pairing.display), fontWeight: pairing.displayWeight }}>
                    {pairing.name}
                  </span>
                  {id === null ? <span className="block text-[13px] font-semibold text-[var(--muted)]">{say("fontAuto")}</span> : null}
                </span>
                {on ? <Check className="shrink-0 text-[var(--primary)]" size={18} /> : null}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );

  const images = (
    <div className="space-y-6">
      <ImagePicker label={say("img_hero")} site={site} slot="hero" vehicles={vehicles} vars={sampleVars(draft, current)} />
      <ImagePicker label={say("img_about")} site={site} slot="about" vehicles={vehicles} vars={sampleVars(draft, current)} />
    </div>
  );

  const shown = draft.sections.filter((section) => section.on).length;
  return (
    <>
      {renderPart({ id: "look", title: say("look"), summary: `${say(`t_${draft.template}`)}, ${paletteName}, ${font.name}`, body: look })}
      {renderPart({ id: "images", title: say("images"), body: images })}
      {renderPart({ id: "sections", title: say("sections"), summary: say("sectionsOn", { count: shown }), body: <SectionList site={site} vehicles={vehicles} /> })}
      {gallery ? <TemplateGallery current={draft.template} onClose={() => setGallery(false)} onPick={(id) => update({ template: id })} /> : null}
    </>
  );
}

/** Choose template: a large picture of each, filtered by the kind of business, with the one in use marked. */
function TemplateGallery({ current, onPick, onClose }: { current: TemplateId; onPick: (id: TemplateId) => void; onClose: () => void }) {
  const say = useTranslations("siteEditor") as unknown as Say;
  const closeRef = useRef<HTMLButtonElement>(null);
  const [filter, setFilter] = useState<"all" | TemplateTag>("all");
  const shown = TEMPLATE_IDS.filter((id) => filter === "all" || TEMPLATES[id].tags.includes(filter));
  useEffect(() => {
    closeRef.current?.focus();
    const key = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  return (
    <div aria-labelledby="template-gallery-title" aria-modal="true" className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(10,20,25,0.55)] sm:items-center sm:p-6" onClick={onClose} role="dialog">
      <div className="flex max-h-[92dvh] w-full max-w-[1180px] flex-col overflow-hidden rounded-t-[28px] bg-[var(--panel)] shadow-2xl sm:rounded-[28px]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-[20px] font-bold text-[var(--foreground)]" id="template-gallery-title">
            {say("chooseTemplate")}
          </h2>
          <button aria-label={say("close")} className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--panel-secondary)] text-[var(--foreground)]" onClick={onClose} ref={closeRef} type="button">
            <X size={20} />
          </button>
        </div>
        <div aria-label={say("filter")} className="flex shrink-0 gap-2 overflow-x-auto border-b border-[var(--border)] px-5 py-3" role="group">
          {(["all", ...TEMPLATE_TAGS] as const).map((value) => (
            <button
              aria-pressed={filter === value}
              className={`min-h-10 shrink-0 rounded-full px-4 text-[15px] font-bold ${filter === value ? "bg-[var(--foreground)] text-[var(--panel)]" : "bg-[var(--panel-secondary)] text-[var(--foreground-secondary)]"}`}
              key={value}
              onClick={() => setFilter(value)}
              type="button"
            >
              {say(TAG_LABEL[value])}
            </button>
          ))}
        </div>
        <ul className="grid gap-x-5 gap-y-7 overflow-y-auto p-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((id) => {
            const on = current === id;
            return (
              <li className={`flex flex-col rounded-[22px] p-2.5 ${on ? "bg-[var(--primary-light)] ring-2 ring-[var(--primary)]" : "bg-[var(--panel-secondary)]"}`} key={id}>
                <div className="relative overflow-hidden rounded-2xl bg-[var(--panel-tertiary)] shadow-[var(--shadow-card)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={say("previewOf", { name: say(`t_${id}`) })} className="block aspect-[16/10] w-full object-cover object-top" height={500} loading="lazy" src={templatePicture(id)} width={800} />
                  {on ? (
                    <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-[var(--primary)] px-2.5 py-1 text-[13px] font-bold text-white">
                      <Check size={14} strokeWidth={3} />
                      {say("current")}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col px-1.5 pb-1">
                  <p className="mt-3 text-[19px] font-bold text-[var(--foreground)]">{say(`t_${id}`)}</p>
                  <p className="text-[15px] font-semibold text-[var(--foreground-secondary)]">{say(`td_${id}`)}</p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <button
                      className={`${on ? "secondary-action" : "primary-action"} pressable flex-1`}
                      disabled={on}
                      onClick={() => {
                        onPick(id);
                        onClose();
                      }}
                      type="button"
                    >
                      {on ? say("current") : say("useTemplate")}
                    </button>
                    <a className="secondary-action pressable" href={`/rent/demo/${id}`} rel="noopener" target="_blank">
                      {say("example")}
                    </a>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** One image slot: the template's own, an upload, a vehicle photo or built-in art. */
function ImagePicker({ site, slot, label, vehicles, vars }: { site: SiteDraft; slot: "hero" | "about"; label: string; vehicles: EditorVehicle[]; vars: CSSProperties }) {
  const say = useTranslations("siteEditor") as unknown as Say;
  const ref = site.draft.images[slot];
  const [tab, setTab] = useState<"vehicles" | "library">(ref?.kind === "art" ? "library" : "vehicles");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  const set = (next: ImageRef | null) => site.update((current) => ({ ...current, images: { ...current.images, [slot]: next } }));
  const withPhotos = vehicles.filter((vehicle) => vehicle.photoUrl);

  const preview =
    ref?.kind === "upload" && site.uploads[ref.path] ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt="" className="h-full w-full object-cover" src={site.uploads[ref.path]} />
    ) : ref?.kind === "vehicle" && vehicles.find((vehicle) => vehicle.id === ref.vehicleId)?.photoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt="" className="h-full w-full object-cover" src={vehicles.find((vehicle) => vehicle.id === ref.vehicleId)?.photoUrl as string} />
    ) : ref?.kind === "art" ? (
      <SiteArt className="h-full w-full" id={ref.id} />
    ) : (
      <span className="flex h-full items-center justify-center text-[13px] font-bold text-[var(--muted)]">{say("img_default")}</span>
    );

  function upload() {
    const chosen = file.current?.files?.[0];
    if (!chosen) return;
    setError(null);
    const form = new FormData();
    form.set("photo", chosen);
    start(async () => {
      const result = await uploadSiteImage(form).catch(() => ({ ok: false as const, error: say("failed") }));
      if (!result.ok) return setError(result.error || say("failed"));
      site.addUpload(result.path, result.url);
      set({ kind: "upload", path: result.path });
      if (file.current) file.current.value = "";
    });
  }

  const tile = (on: boolean) => `relative aspect-[4/3] overflow-hidden rounded-xl ${on ? "ring-[3px] ring-[var(--primary)]" : "ring-1 ring-[var(--border)]"}`;
  return (
    <div>
      <p className="font-semibold text-[var(--foreground)]">{label}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <div className="h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-[var(--panel-tertiary)]" style={vars}>
          {preview}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="secondary-action pressable cursor-pointer">
            <Upload size={17} />
            {pending ? say("uploading") : say("upload")}
            <input accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={pending} onChange={upload} ref={file} type="file" />
          </label>
          {ref ? (
            <button className="secondary-action pressable" onClick={() => set(null)} type="button">
              <RotateCcw size={17} />
              {say("img_useDefault")}
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className="mt-2 font-bold text-[var(--danger)]">{error}</p> : null}
      <div className="mt-3 inline-flex rounded-full bg-[var(--panel-secondary)] p-1" role="tablist">
        {(["vehicles", "library"] as const).map((value) => (
          <button aria-selected={tab === value} className={`min-h-9 rounded-full px-4 text-sm font-bold ${tab === value ? "bg-[var(--panel)] text-[var(--foreground)] shadow-[var(--shadow-card)]" : "text-[var(--foreground-secondary)]"}`} key={value} onClick={() => setTab(value)} role="tab" type="button">
            {say(value === "vehicles" ? "img_vehicles" : "img_library")}
          </button>
        ))}
      </div>
      {tab === "vehicles" ? (
        withPhotos.length ? (
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {withPhotos.map((vehicle) => {
              const on = ref?.kind === "vehicle" && ref.vehicleId === vehicle.id;
              return (
                <button aria-label={vehicle.name} aria-pressed={on} className={tile(on)} key={vehicle.id} onClick={() => set({ kind: "vehicle", vehicleId: vehicle.id })} title={vehicle.name} type="button">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" src={vehicle.photoUrl as string} />
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 font-semibold text-[var(--muted)]">{say("img_noVehiclePhotos")}</p>
        )
      ) : (
        <div className="mt-2 grid grid-cols-3 gap-2" style={vars}>
          {ART_IDS.map((id) => {
            const on = ref?.kind === "art" && ref.id === id;
            return (
              <button aria-label={say(`art_${id}`)} aria-pressed={on} className={tile(on)} key={id} onClick={() => set({ kind: "art", id })} title={say(`art_${id}`)} type="button">
                <SiteArt className="absolute inset-0 h-full w-full" id={id} />
              </button>
            );
          })}
        </div>
      )}
      {/* TODO(phase 2): a Stock tab (Unsplash) once RoveHQ has an Unsplash access key: lib/sites/images.ts. */}
    </div>
  );
}

/** Sections: on or off, in order, and what each one says beyond its clickable text. */
function SectionList({ site, vehicles }: { site: SiteDraft; vehicles: EditorVehicle[] }) {
  const say = useTranslations("siteEditor") as unknown as Say;
  const { draft, update } = site;
  const [open, setOpen] = useState<SectionId | null>(null);
  const move = (index: number, by: number) =>
    update((current) => {
      const sections = [...current.sections];
      const [item] = sections.splice(index, 1);
      sections.splice(index + by, 0, item);
      return { ...current, sections };
    });
  const toggle = (id: SectionId) => update((current) => ({ ...current, sections: current.sections.map((section) => (section.id === id ? { ...section, on: !section.on } : section)) }));

  return (
    <ul className="space-y-2">
      <li className="flex min-h-12 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3">
        <span className="h-5 w-5 shrink-0" />
        <span className="flex-1 font-semibold text-[var(--foreground)]">{say("s_hero")}</span>
      </li>
      {draft.sections.map((section, index) => {
        const isOpen = open === section.id;
        return (
          <li className="rounded-xl border border-[var(--border)] bg-white" key={section.id}>
            <div className="flex min-h-12 items-center gap-2 px-3 py-1.5">
              <input
                aria-label={say("show", { section: say(`s_${section.id}`) })}
                checked={section.on}
                className="h-5 w-5 shrink-0"
                disabled={section.id === "booking"}
                onChange={() => toggle(section.id)}
                type="checkbox"
              />
              <span className={`min-w-0 flex-1 font-semibold ${section.on ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}>{say(`s_${section.id}`)}</span>
              <button className="min-h-10 rounded-full px-3 text-sm font-bold text-[var(--primary)]" onClick={() => setOpen(isOpen ? null : section.id)} type="button">
                {isOpen ? say("done") : say("edit")}
              </button>
              <span className="flex shrink-0">
                <button aria-label={say("up")} className="flex h-10 w-9 items-center justify-center rounded-lg text-[var(--foreground-secondary)] disabled:opacity-30" disabled={index === 0} onClick={() => move(index, -1)} type="button">
                  <ArrowUp size={17} />
                </button>
                <button aria-label={say("down")} className="flex h-10 w-9 items-center justify-center rounded-lg text-[var(--foreground-secondary)] disabled:opacity-30" disabled={index === SECTION_IDS.length - 1} onClick={() => move(index, 1)} type="button">
                  <ArrowDown size={17} />
                </button>
              </span>
            </div>
            {isOpen ? (
              <div className="border-t border-[var(--border)] p-3">
                <SectionFields id={section.id} site={site} vehicles={vehicles} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function SectionFields({ id, site, vehicles }: { id: SectionId; site: SiteDraft; vehicles: EditorVehicle[] }) {
  const say = useTranslations("siteEditor") as unknown as Say;
  const { draft, update } = site;
  const field = "mt-1 w-full";
  const label = "block font-semibold text-[var(--foreground-secondary)]";

  if (id === "about") {
    return (
      <div className="space-y-2">
        <p className={label}>{say("highlights")}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {Array.from({ length: LIMITS.highlights }, (_, index) => (
            <input
              aria-label={`${say("highlights")} ${index + 1}`}
              className="w-full"
              key={index}
              maxLength={LIMITS.highlight}
              onChange={(event) => {
                const highlights = [...draft.highlights];
                while (highlights.length <= index) highlights.push("");
                highlights[index] = event.target.value;
                // Kept as typed while editing; empty ones are dropped when saved.
                update((current) => ({ ...current, highlights }));
              }}
              value={draft.highlights[index] || ""}
            />
          ))}
        </div>
      </div>
    );
  }
  if (id === "booking") {
    return (
      <div className="space-y-3">
        <label className={label}>
          {say("cancellation")}
          <textarea className={`${field} min-h-20 py-2`} maxLength={LIMITS.note} onChange={(event) => update((current) => ({ ...current, policyNotes: { ...current.policyNotes, cancellation: event.target.value } }))} value={draft.policyNotes.cancellation} />
        </label>
        <label className={label}>
          {say("requirements")}
          <textarea className={`${field} min-h-20 py-2`} maxLength={LIMITS.note} onChange={(event) => update((current) => ({ ...current, policyNotes: { ...current.policyNotes, requirements: event.target.value } }))} value={draft.policyNotes.requirements} />
        </label>
      </div>
    );
  }
  if (id === "fleet") {
    const chosen = draft.featured;
    return (
      <div>
        <p className={label}>{say("featured")}</p>
        <div className="mt-2 grid gap-1.5">
          {vehicles.map((vehicle) => {
            const on = chosen.includes(vehicle.id);
            return (
              <label className="flex min-h-11 items-center gap-3 rounded-lg px-2 font-semibold text-[var(--foreground)]" key={vehicle.id}>
                <input
                  checked={on}
                  className="h-5 w-5"
                  disabled={!on && chosen.length >= LIMITS.featured}
                  onChange={() => update((current) => ({ ...current, featured: on ? current.featured.filter((item) => item !== vehicle.id) : [...current.featured, vehicle.id] }))}
                  type="checkbox"
                />
                <span className="min-w-0 flex-1 truncate">{vehicle.name}</span>
                {on ? <span className="text-sm font-bold text-[var(--primary)]">{chosen.indexOf(vehicle.id) + 1}</span> : null}
              </label>
            );
          })}
        </div>
      </div>
    );
  }
  if (id === "reviews") {
    return (
      <label className={label}>
        {say("googleReviews")}
        <input className={field} inputMode="url" maxLength={LIMITS.url} onChange={(event) => update((current) => ({ ...current, reviewsUrl: event.target.value }))} placeholder="https://g.page/r/..." value={draft.reviewsUrl} />
      </label>
    );
  }
  if (id === "faqs") {
    return (
      <div className="space-y-3">
        {draft.faqs.map((faq, index) => (
          <div className="space-y-2 rounded-xl bg-[var(--panel-secondary)] p-3" key={index}>
            <input aria-label={say("question")} className="w-full" maxLength={LIMITS.faqQ} onChange={(event) => update((current) => ({ ...current, faqs: current.faqs.map((item, i) => (i === index ? { ...item, q: event.target.value } : item)) }))} placeholder={say("question")} value={faq.q} />
            <textarea aria-label={say("answer")} className="min-h-20 w-full py-2" maxLength={LIMITS.faqA} onChange={(event) => update((current) => ({ ...current, faqs: current.faqs.map((item, i) => (i === index ? { ...item, a: event.target.value } : item)) }))} placeholder={say("answer")} value={faq.a} />
            <button className="text-sm font-bold text-[var(--danger)]" onClick={() => update((current) => ({ ...current, faqs: current.faqs.filter((_, i) => i !== index) }))} type="button">
              {say("remove")}
            </button>
          </div>
        ))}
        {draft.faqs.length < LIMITS.faqs ? <FaqAdd onAdd={(faq) => update((current) => ({ ...current, faqs: [...current.faqs, faq] }))} /> : null}
      </div>
    );
  }
  // Contact: hours, social links and the map.
  const dayName = (index: number) => new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + index)));
  const hours = draft.hours;
  const setDay = (index: number, value: { open: string; close: string } | null) => update((current) => ({ ...current, hours: (current.hours || DEFAULT_HOURS).map((day, i) => (i === index ? value : day)) }));
  return (
    <div className="space-y-5">
      <div>
        <p className={label}>{say("hours")}</p>
        {hours ? (
          <div className="mt-2 space-y-2">
            {hours.map((day, index) => (
              <div className="flex flex-wrap items-center gap-2" key={index}>
                <span className="w-12 font-semibold text-[var(--foreground)]">{dayName(index)}</span>
                <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--foreground-secondary)]">
                  <input checked={!!day} className="h-5 w-5" onChange={(event) => setDay(index, event.target.checked ? { open: "09:00", close: "18:00" } : null)} type="checkbox" />
                  {say("open")}
                </label>
                {day ? (
                  <>
                    <input aria-label={`${dayName(index)} ${say("from")}`} className="w-[7.5rem]" onChange={(event) => setDay(index, { ...day, open: event.target.value })} type="time" value={day.open} />
                    <span className="text-[var(--muted)]">–</span>
                    <input aria-label={`${dayName(index)} ${say("until")}`} className="w-[7.5rem]" onChange={(event) => setDay(index, { ...day, close: event.target.value })} type="time" value={day.close} />
                  </>
                ) : (
                  <span className="text-sm text-[var(--muted)]">{say("closed")}</span>
                )}
              </div>
            ))}
            <button className="text-sm font-bold text-[var(--danger)]" onClick={() => update({ hours: null })} type="button">
              {say("hoursClear")}
            </button>
          </div>
        ) : (
          <button className="secondary-action pressable mt-2" onClick={() => update({ hours: DEFAULT_HOURS })} type="button">
            <Plus size={17} />
            {say("hoursSet")}
          </button>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {SOCIAL_KEYS.map((key) => (
          <label className="block" key={key}>
            <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{SOCIAL_LABELS[key]}</span>
            <input className={field} maxLength={LIMITS.social} onChange={(event) => update((current) => ({ ...current, social: { ...current.social, [key]: event.target.value } }))} value={draft.social[key]} />
          </label>
        ))}
      </div>
      <label className={label}>
        {say("mapQuery")}
        <input className={field} maxLength={LIMITS.map} onChange={(event) => update({ mapQuery: event.target.value })} value={draft.mapQuery} />
      </label>
    </div>
  );
}

/** A new question: added once both parts are filled in (the draft keeps only complete ones). */
function FaqAdd({ onAdd }: { onAdd: (faq: { q: string; a: string }) => void }) {
  const say = useTranslations("siteEditor") as unknown as Say;
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  return (
    <div className="space-y-2 rounded-xl border border-dashed border-[var(--border)] p-3">
      <input aria-label={say("question")} className="w-full" maxLength={LIMITS.faqQ} onChange={(event) => setQ(event.target.value)} placeholder={say("question")} value={q} />
      <textarea aria-label={say("answer")} className="min-h-20 w-full py-2" maxLength={LIMITS.faqA} onChange={(event) => setA(event.target.value)} placeholder={say("answer")} value={a} />
      <button
        className="secondary-action pressable"
        disabled={!q.trim() || !a.trim()}
        onClick={() => {
          onAdd({ q: q.trim(), a: a.trim() });
          setQ("");
          setA("");
        }}
        type="button"
      >
        <Plus size={17} />
        {say("addQuestion")}
      </button>
    </div>
  );
}

/** Publish: makes the draft live. Shown under the parts while there are unpublished changes. */
export function PublishBar({ site }: { site: SiteDraft }) {
  const say = useTranslations("siteEditor") as unknown as Say;
  const [confirmRevert, setConfirmRevert] = useState(false);
  const busy = site.publishing === "publishing";
  if (!site.unpublished && site.publishing !== "published" && site.publishing !== "failed") {
    return (
      <p className="flex items-center gap-2 px-1 font-semibold text-[var(--foreground-secondary)]">
        <Check className="text-[var(--success)]" size={18} />
        {site.save === "saving" ? say("saving") : say("live")}
      </p>
    );
  }
  return (
    <div className="sticky bottom-24 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-3 shadow-[var(--shadow-card)] lg:bottom-4">
      {site.unpublished ? (
        <>
          <button className="primary-action pressable" disabled={busy || site.save === "saving"} onClick={() => site.publish()} type="button">
            {busy ? say("publishing") : say("publish")}
          </button>
          <span className="font-semibold text-[var(--warning)]">{say("unpublished")}</span>
          {confirmRevert ? (
            <span className="ms-auto flex items-center gap-2">
              <button
                className="secondary-action pressable"
                onClick={() => {
                  setConfirmRevert(false);
                  void site.revert();
                }}
                type="button"
              >
                {say("revertConfirm")}
              </button>
              <button className="min-h-10 px-2 font-bold text-[var(--foreground-secondary)]" onClick={() => setConfirmRevert(false)} type="button">
                {say("cancel")}
              </button>
            </span>
          ) : (
            <button className="ms-auto inline-flex min-h-10 items-center gap-1.5 px-2 font-bold text-[var(--foreground-secondary)]" onClick={() => setConfirmRevert(true)} type="button">
              <RotateCcw size={16} />
              {say("revert")}
            </button>
          )}
        </>
      ) : null}
      {!site.unpublished && site.publishing === "published" ? <span className="font-bold text-[var(--success)]">{say("published")}</span> : null}
      {site.publishing === "failed" || site.save === "failed" ? <span className="font-bold text-[var(--danger)]">{say("failed")}</span> : null}
      {site.unpublished && site.save === "saving" ? <span className="text-sm font-semibold text-[var(--muted)]">{say("saving")}</span> : null}
    </div>
  );
}
