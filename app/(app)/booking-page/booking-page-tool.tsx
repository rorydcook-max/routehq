"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Copy, ExternalLink, Monitor, Smartphone } from "lucide-react";
import { savePublicBookingSettings } from "@/app/actions/online-booking";
import { BookingAddressPanel } from "@/app/(app)/booking-page/booking-address-panel";
import { PublishBar, SiteEditorParts, type EditorVehicle } from "@/app/(app)/booking-page/site-editor";
import { useSiteDraft } from "@/app/(app)/booking-page/use-site-draft";
import { LogoUploadSection } from "@/app/(app)/settings/logo-upload-section";
import { SwitchField } from "@/components/switch-field";
import { Fold } from "@/components/ui";
import type { SiteConfig } from "@/lib/sites/config";

type Say = ((key: string, values?: Record<string, string | number>) => string) & {
  rich: (key: string, values: Record<string, unknown>) => ReactNode;
};

type Device = "mobile" | "desktop";

/**
 * The Booking page tool (Rory, 7 Nov 2026): the website editor on the left and the real site on the right, shown as
 * a phone or a computer. On phones the two are tabs. The preview is the owner's draft (?draft=1&edit=1): every change
 * reaches it at once, text is edited by clicking it there, and Publish makes the draft live.
 */
export function BookingPageTool({
  slug,
  link: shareLink,
  booking,
  vehicles,
  draft,
  published,
  uploads,
  editorVehicles,
  colour,
  businessName,
  logoUrl,
  address
}: {
  slug: string;
  link: string;
  booking: { enabled: boolean; offer: string; deposit: number; holdHours: number };
  vehicles: { priced: number; total: number };
  draft: SiteConfig;
  published: SiteConfig;
  uploads: Record<string, string>;
  editorVehicles: EditorVehicle[];
  colour: string;
  businessName: string;
  logoUrl: string | null;
  address: React.ComponentProps<typeof BookingAddressPanel>;
}) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [device, setDevice] = useState<Device>("mobile");
  const [version, setVersion] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const site = useSiteDraft({ draft, published, uploads, frame });
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  // Page on/off, address, logo and brand colour change what the server draws: reload the preview (it asks for the draft again).
  const reload = () => {
    setVersion((value) => value + 1);
    router.refresh();
  };

  // Their own address (subdomain or domain) when they have one; otherwise this app's /rent page.
  const link = shareLink && !shareLink.includes("/rent/") ? shareLink : `${origin}/rent/${slug}`;
  const src = `/rent/${slug}?draft=1&edit=1${version ? `&v=${version}` : ""}`;
  const snippet = `<div data-routehq-booking="${slug}"></div>\n<script src="${origin}/embed.js" async></script>`;

  function copy(text: string, what: "link" | "code") {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(what);
        setTimeout(() => setCopied(null), 1500);
      })
      .catch(() => null);
  }

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <div aria-label={say("bt_preview")} className="inline-flex rounded-full bg-[var(--panel-secondary)] p-1" role="radiogroup">
        {(["mobile", "desktop"] as const).map((value) => {
          const Icon = value === "mobile" ? Smartphone : Monitor;
          const on = device === value;
          return (
            <button
              aria-checked={on}
              className={`pressable inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-bold ${on ? "bg-[var(--panel)] text-[var(--foreground)] shadow-[var(--shadow-card)]" : "text-[var(--foreground-secondary)]"}`}
              key={value}
              onClick={() => setDevice(value)}
              role="radio"
              type="button"
            >
              <Icon size={16} />
              {say(value === "mobile" ? "bt_mobile" : "bt_desktop")}
            </button>
          );
        })}
      </div>
      <span className="ms-auto flex flex-wrap gap-2">
        {/* Phones: icons only, so the toolbar stays one row. */}
        <button aria-label={say("pb_copy")} className="secondary-action pressable !min-h-10 max-sm:!px-3" onClick={() => copy(link, "link")} type="button">
          <Copy size={16} />
          <span className={copied === "link" ? "" : "hidden sm:inline"}>{copied === "link" ? say("copied") : say("pb_copy")}</span>
        </button>
        <a aria-label={say("bt_open")} className="secondary-action pressable !min-h-10 max-sm:!px-3" href={link || `/rent/${slug}`} rel="noreferrer" target="_blank">
          <ExternalLink size={16} />
          <span className="hidden sm:inline">{say("bt_open")}</span>
        </a>
      </span>
    </div>
  );

  return (
    <div>
      {/* Phones: the editor and the preview are two tabs. */}
      <div className="mb-3 inline-flex rounded-full bg-[var(--panel-secondary)] p-1 lg:hidden" role="tablist">
        {(["edit", "preview"] as const).map((value) => (
          <button
            aria-selected={tab === value}
            className={`pressable min-h-10 rounded-full px-5 font-bold ${tab === value ? "bg-[var(--primary)] text-white" : "text-[var(--foreground-secondary)]"}`}
            key={value}
            onClick={() => setTab(value)}
            role="tab"
            type="button"
          >
            {say(value === "edit" ? "bt_edit" : "bt_preview")}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(340px,440px)_minmax(0,1fr)]">
        <div className={`space-y-3 ${tab === "edit" ? "" : "hidden lg:block"}`}>
          <Fold
            id="page"
            open
            summary={say.rich(booking.enabled ? "st_bookOn" : "st_bookOff", {
              b: (chunks: ReactNode) => <span className={booking.enabled ? "font-bold text-[var(--success)]" : "font-bold text-[var(--muted)]"}>{chunks}</span>
            })}
            title={say("bt_page")}
          >
            <PagePart booking={booking} onSaved={reload} vehicles={vehicles} />
          </Fold>
          <Fold id="address" summary={link.replace(/^https?:\/\//, "")} title={say("bt_address")}>
            <BookingAddressPanel {...address} onSaved={reload} />
          </Fold>
          <SiteEditorParts
            brandColour={colour}
            renderPart={(part) => (
              <Fold id={part.id} key={part.id} open={part.id === "look"} summary={part.summary} title={part.title}>
                {part.body}
              </Fold>
            )}
            site={site}
            vehicles={editorVehicles}
          />
          <PublishBar site={site} />
          <Fold id="brand" title={say("bt_brand")}>
            <div className="space-y-4">
              <LogoUploadSection logoUrl={logoUrl} onDone={reload} orgName={businessName} />
              {/* Part of the website draft (published with it): a wordmark logo already says the name. */}
              <SwitchField checked={site.draft.showName} label={say("bt_showName")} onChange={(event) => site.update({ showName: event.target.checked })} />
              {/* The app's brand colour stays in Settings › Business (app, agreements, receipts); the website has its own palette under Look. */}
            </div>
          </Fold>
          <Fold id="website" title={say("pb_embedTitle")}>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-[var(--border)] bg-white p-3 font-mono text-[13px] text-[var(--foreground)]">{snippet}</pre>
            <button className="secondary-action pressable mt-2.5" onClick={() => copy(snippet, "code")} type="button">
              <Copy size={17} />
              {copied === "code" ? say("copied") : say("pb_embedCopy")}
            </button>
          </Fold>
        </div>

        <section
          aria-label={say("bt_preview")}
          className={`card flex flex-col gap-3 p-3 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] ${tab === "preview" ? "" : "hidden lg:flex"}`}
        >
          {toolbar}
          <div className="h-[calc(100dvh-260px)] min-h-[460px] lg:h-auto lg:min-h-0 lg:flex-1">
            <Preview device={device} frameRef={frame} src={src} title={say("bt_preview")} />
          </div>
        </section>
      </div>
    </div>
  );
}

/** On or off, and what customers can book. Saved as soon as it changes. */
function PagePart({ booking, vehicles, onSaved }: { booking: { enabled: boolean; offer: string; deposit: number; holdHours: number }; vehicles: { priced: number; total: number }; onSaved: () => void }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const [on, setOn] = useState(booking.enabled);
  const [offer, setOffer] = useState(booking.offer || "both_monthly");
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  function save(next: { enabled: boolean; offer: string }) {
    const before = { on, offer };
    setFailed(false);
    setOn(next.enabled);
    setOffer(next.offer);
    start(async () => {
      const result = await savePublicBookingSettings({ enabled: next.enabled, offer: next.offer, holdHours: booking.holdHours, deposit: booking.deposit }).catch(() => ({ ok: false as const }));
      if (!result.ok) {
        setFailed(true);
        setOn(before.on);
        setOffer(before.offer);
        return;
      }
      onSaved();
    });
  }

  return (
    <div className="space-y-4">
      <SwitchField checked={on} disabled={pending} label={say("pb_title")} onChange={(event) => save({ enabled: event.target.checked, offer })} />
      {on ? (
        <>
          <label className="block">
            <span className="font-semibold text-[var(--foreground)]">{say("pb_offer")}</span>
            <select className="mt-1 block w-full" disabled={pending} onChange={(event) => save({ enabled: on, offer: event.target.value })} value={offer}>
              {[offer === "both_dates" ? "both_dates" : "both_monthly", "monthly", "dates"].map((value) => (
                <option key={value} value={value}>
                  {say(`pb_offer_${value}`)}
                </option>
              ))}
            </select>
          </label>
          {vehicles.priced < vehicles.total ? <p className="font-bold text-[var(--warning)]">{say("pb_shown", { priced: vehicles.priced, total: vehicles.total })}</p> : null}
        </>
      ) : null}
      {failed ? <p className="font-bold text-[var(--danger)]">{say("saveFailed")}</p> : null}
    </div>
  );
}

/**
 * The real booking page in a frame. Mobile: 390px wide in a phone outline, made smaller if the panel is narrower.
 * Desktop: 1280px wide, scaled down to fit the panel.
 */
function Preview({ src, device, title, frameRef }: { src: string; device: Device; title: string; frameRef: RefObject<HTMLIFrameElement | null> }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => setLoading(true), [src]);

  const mobile = device === "mobile";
  const deviceWidth = mobile ? 390 : 1280;
  const frame = mobile ? 8 : 1;
  const scale = size.w ? Math.min(1, (size.w - frame * 2) / deviceWidth) : 1;
  const outerHeight = mobile ? Math.min(size.h, 844 * scale + frame * 2) : size.h;
  const innerHeight = Math.max(0, outerHeight - frame * 2);

  return (
    <div className="relative h-full w-full overflow-hidden" ref={box}>
      {size.w ? (
        <div
          className={`relative mx-auto overflow-hidden bg-white ${mobile ? "rounded-[30px] border-[8px] border-[#1f2329]" : "rounded-xl border border-[var(--border)]"}`}
          style={{ width: deviceWidth * scale + frame * 2, height: outerHeight }}
        >
          <iframe
            className="block border-0"
            onLoad={() => setLoading(false)}
            ref={frameRef}
            src={src}
            style={{ width: deviceWidth, height: innerHeight / scale, transform: `scale(${scale})`, transformOrigin: "0 0" }}
            title={title}
          />
          {loading ? <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-[var(--panel-secondary)]" /> : null}
        </div>
      ) : null}
    </div>
  );
}
