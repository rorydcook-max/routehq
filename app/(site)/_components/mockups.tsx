import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { BarChart3, CalendarDays, Camera, Car, Check, ChevronLeft, FileText, Home, Inbox, ListTodo, Plus, Users } from "lucide-react";
import { numberLocale } from "@/lib/i18n/dates";
import { formatPlanPrice } from "@/lib/plan-currency";
import { sampleAmount, visitorCurrency } from "@/lib/site-currency";
import s from "../site.module.css";

/*
 * Stylised pictures of the app for the website, drawn in HTML and SVG rather than screenshots: crisp at any size,
 * in the visitor's language, and with no real customer's name in them. The names, vehicles and amounts are made up.
 * Each picture is one image to a screen reader (role="img" with a label); what is inside it is hidden from them.
 */

async function kit() {
  const [t, locale, currency] = await Promise.all([getTranslations("site"), getLocale(), visitorCurrency()]);
  const nl = numberLocale(locale);
  /** An amount set in THB, shown as a round number in the visitor's currency. */
  const local = (thb: number) => sampleAmount(thb, currency);
  const format = (amount: number) => formatPlanPrice(amount, currency, nl);
  const money = (thb: number) => format(local(thb));
  const number = (value: number) => value.toLocaleString(nl);
  const date = (iso: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(nl, { timeZone: "UTC", ...options }).format(new Date(`${iso}T12:00:00Z`));
  /** Thailand's QR payment is PromptPay; elsewhere the pictures say "QR payment" so they read right for any visitor. */
  const qrName = currency === "THB" ? "PromptPay" : t("mockQrPay");
  return { t, money, local, format, number, date, currency, qrName };
}

/** The website's pictures use these amounts, so a page can show the same ones in its own words. */
export async function sampleMoney() {
  const { money } = await kit();
  return money;
}

/** "Toyota Corolla · Lucas Martin": the name only where there is room (not on phones), never an ellipsis. */
function Sub({ main, detail }: { main: string; detail: string }) {
  return (
    <>
      {main}
      <span className={s.hideOnPhone}> · {detail}</span>
    </>
  );
}

/* ── Frames ─────────────────────────────────────────────────────────────── */

export function PhoneFrame({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div aria-label={label} className={`${s.phone} ${className}`} role="img">
      <div className={s.phoneScreen}>
        <div className={s.phoneNotch} />
        <div aria-hidden="true" className={s.phoneScale}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** An app window: a thin bar with the address, then the page. */
export function WindowFrame({ label, address, children, className = "", light = false }: { label: string; address: string; children: ReactNode; className?: string; light?: boolean }) {
  return (
    <div aria-label={label} className={`${s.window} ${light ? `${s.windowLight} ${s.windowRoomy}` : ""} ${className}`} role="img">
      <div aria-hidden="true" className={s.windowScale}>
        <div className="flex items-center gap-[0.8em] border-b border-[#e6eaef] bg-[#f3f6f8] px-[1.2em] py-[0.75em]">
          <span className="flex gap-[0.45em]">
            <span className="h-[0.75em] w-[0.75em] rounded-full bg-[#d4dae2]" />
            <span className="h-[0.75em] w-[0.75em] rounded-full bg-[#d4dae2]" />
            <span className="h-[0.75em] w-[0.75em] rounded-full bg-[#d4dae2]" />
          </span>
          <span className="mx-auto flex min-w-0 items-center gap-[0.5em] rounded-[0.6em] bg-white px-[1.2em] py-[0.3em] text-[0.95em] font-medium text-[#5f6b7a] shadow-[0_0_0_1px_#e6eaef]">
            <svg className="h-[0.9em] w-[0.9em] shrink-0" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
              <rect height="10" rx="2" width="14" x="5" y="11" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            <span className="truncate">{address}</span>
          </span>
          <span className="w-[3.15em]" />
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-[1.6em] pt-[0.9em] text-[0.85em] font-semibold">
      <span>9:41</span>
      <span className="flex items-center gap-[0.3em]">
        <span className="inline-block h-[0.7em] w-[1.1em] rounded-[0.15em] bg-[#0b1a2e]/80" />
        <span className="inline-block h-[0.7em] w-[1.6em] rounded-[0.2em] border-[0.12em] border-[#0b1a2e]/70" />
      </span>
    </div>
  );
}

/* Real vehicles, photographed (public/site/vehicles, credits in CREDITS.md): a card at 16:10 and a thumbnail at 4:3. */
const VEHICLES = {
  yaris: { name: "Toyota Yaris", file: "toyota-yaris" },
  corolla: { name: "Toyota Corolla", file: "toyota-corolla" },
  pajero: { name: "Mitsubishi Pajero Sport", file: "mitsubishi-pajero-sport" },
  vespa: { name: "Vespa VXL 125", file: "vespa-vxl" }
} as const;
type VehicleId = keyof typeof VEHICLES;
const vehicleName = (id: VehicleId) => VEHICLES[id].name;

/** A vehicle photo that fills its box. `thumb` uses the small 4:3 file; `flip` mirrors it (for a second angle). */
function VehiclePhoto({ id, thumb = false, flip = false, className = "" }: { id: VehicleId; thumb?: boolean; flip?: boolean; className?: string }) {
  const v = VEHICLES[id];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a fixed, pre-sized asset inside a drawn mockup
    <img
      alt={v.name}
      className={`block h-full w-full object-cover ${className}`}
      decoding="async"
      height={thumb ? 300 : 750}
      loading="lazy"
      src={`/site/vehicles/${v.file}${thumb ? "-thumb" : ""}.webp`}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      width={thumb ? 400 : 1200}
    />
  );
}

/** A made-up QR code (finder squares and a fixed pattern): it looks like PromptPay's, and scans to nothing. */
function FakeQr({ className = "" }: { className?: string }) {
  const size = 25;
  let seed = 7;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const finder = (x: number, y: number) => {
    const inBox = (ox: number, oy: number) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7;
    for (const [ox, oy] of [[0, 0], [size - 7, 0], [0, size - 7]]) {
      if (inBox(ox, oy)) {
        const dx = x - ox;
        const dy = y - oy;
        const ring = Math.min(dx, dy, 6 - dx, 6 - dy);
        return ring === 0 || ring >= 2 ? 1 : 0;
      }
      if (x >= ox - 1 && x <= ox + 7 && y >= oy - 1 && y <= oy + 7) return 0;
    }
    return -1;
  };
  let d = "";
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const fixed = finder(x, y);
      const on = fixed === -1 ? next() > 0.52 : fixed === 1;
      if (on) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return (
    <svg className={className} shapeRendering="crispEdges" viewBox={`-1 -1 ${size + 2} ${size + 2}`} xmlns="http://www.w3.org/2000/svg">
      <rect fill="#ffffff" height={size + 2} width={size + 2} x="-1" y="-1" />
      <path d={d} fill="#0b1a2e" />
    </svg>
  );
}

function Pill({ children, solid = false }: { children: ReactNode; solid?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full px-[1em] py-[0.45em] text-[0.95em] font-bold ${
        solid ? "bg-[#0b8f8c] text-white" : "border-[0.12em] border-[#c9d2db] bg-white text-[#0b1a2e]"
      }`}
    >
      {children}
    </span>
  );
}

function Chip({ dot, children }: { dot?: string; children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-[0.45em] whitespace-nowrap rounded-[1em] bg-white px-[0.9em] py-[0.5em] font-semibold shadow-[0_1px_2px_rgba(6,22,43,0.06)]">
      {dot ? <span className="h-[0.6em] w-[0.6em] rounded-full" style={{ background: dot }} /> : null}
      {children}
    </span>
  );
}

/* ── The dashboard on a laptop ──────────────────────────────────────────── */

export async function DashboardWindowMock({ className = "" }: { className?: string }) {
  const { t, money, date } = await kit();
  const nav = [
    { icon: Home, label: t("mockNavDashboard"), active: true },
    { icon: ListTodo, label: t("mockNavTodo") },
    { icon: Inbox, label: t("mockNavInbox") },
    { icon: FileText, label: t("mockNavBookings") },
    { icon: CalendarDays, label: t("mockNavCalendar") },
    { icon: Car, label: t("mockNavFleet") },
    { icon: Users, label: t("mockNavCustomers") },
    { icon: BarChart3, label: t("mockNavReports") }
  ];
  const rows = [
    { title: t("mockRowHandover", { vehicle: vehicleName("yaris") }), sub: "Anna Becker · 10:00", action: t("mockHandOver"), solid: true, vehicle: "yaris" as VehicleId },
    { title: t("mockRowCollect", { amount: money(2400) }), sub: `Kenji Watanabe · ${vehicleName("vespa")}`, action: t("mockRecordPayment"), vehicle: "vespa" as VehicleId },
    { title: t("mockRowReturn", { vehicle: vehicleName("corolla") }), sub: "Lucas Martin · 16:30", action: t("mockTakeBack"), vehicle: "corolla" as VehicleId }
  ];
  const bars = [38, 52, 44, 63, 58, 72, 66, 80, 74, 90];
  const week = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"].map((iso) => date(iso, { weekday: "short", day: "numeric" }));
  const out = { bg: "#d9f4f3", fg: "#0b8f8c" };
  const going = { bg: "#d9f4f3", fg: "#0b6e6c" };
  const back = { bg: "#e4eef8", fg: "#1f4f7a" };
  const calendar = [
    { vehicle: vehicleName("yaris"), bars: [{ who: "Anna Becker", from: 4, to: 8, ...going }] },
    { vehicle: vehicleName("corolla"), bars: [{ who: "Lucas Martin", from: 1, to: 5, ...back }, { who: "Mei Lin", from: 6, to: 8, ...out }] },
    { vehicle: vehicleName("vespa"), bars: [{ who: "Kenji Watanabe", from: 2, to: 7, ...out }] },
    { vehicle: vehicleName("pajero"), bars: [{ who: "Sofia Rossi", from: 1, to: 8, ...out }] }
  ];
  return (
    <WindowFrame address="palm.routehq.app" className={className} label={t("mockDashboardLabel")}>
      <div className="grid aspect-[16/9.2] grid-cols-[15em_1fr] bg-[#f3f6f8]">
        <aside className="flex flex-col gap-[0.3em] bg-[#0b2140] px-[1em] py-[1.4em] text-white">
          <p className="px-[0.6em] text-[1.15em] font-bold leading-tight">Palm Car Rental</p>
          <p className="px-[0.7em] text-[0.85em] text-white/60">Powered by RouteHQ</p>
          <div className="mt-[1em] flex flex-col gap-[0.2em]">
            {nav.map(({ icon: Icon, label, active }) => (
              <span className={`flex items-center gap-[0.7em] rounded-[0.8em] px-[0.7em] py-[0.55em] font-semibold ${active ? "bg-[rgba(18,188,184,0.16)] text-[#12bcb8]" : "text-white/70"}`} key={label}>
                <Icon className="h-[1.2em] w-[1.2em] shrink-0" strokeWidth={2} />
                {label}
              </span>
            ))}
          </div>
        </aside>
        <div className="min-w-0 px-[2em] py-[1.6em]">
          <div className="flex items-start justify-between gap-[1em]">
            <div>
              <p className="font-semibold text-[#5f6b7a]">{date("2026-11-12", { weekday: "long", day: "numeric", month: "long" })}</p>
              <p className="mt-[0.1em] text-[2.6em] font-semibold leading-none tracking-[-0.02em]" style={{ fontFamily: "var(--font-site)" }}>
                {t("mockGoodMorning")}
              </p>
            </div>
            <span className="inline-flex items-center gap-[0.4em] whitespace-nowrap rounded-full bg-[#0b8f8c] px-[1.1em] py-[0.6em] font-bold text-white">
              <Plus className="h-[1.1em] w-[1.1em]" strokeWidth={2.5} /> {t("mockNewBooking")}
            </span>
          </div>
          <div className="mt-[1.1em] flex gap-[0.6em] overflow-hidden">
            <Chip dot="#d14343">{t("mockOverdue", { count: 1 })}</Chip>
            <Chip>{t("mockForToday", { count: 3 })}</Chip>
            <Chip dot="#12bcb8">{t("mockGoingOut", { count: 2 })}</Chip>
            <Chip dot="#4a9ad8">{t("mockComingBack", { count: 1 })}</Chip>
          </div>
          <div className="mt-[1.4em] grid grid-cols-[1.65fr_1fr] gap-[1.2em]">
            <div>
              <p className="text-[1.45em] font-semibold" style={{ fontFamily: "var(--font-site)" }}>
                {t("mockToday")}
              </p>
              <div className="mt-[0.6em] overflow-hidden rounded-[1.4em] bg-white shadow-[0_1px_2px_rgba(6,22,43,0.06),0_12px_30px_rgba(6,22,43,0.08)]">
                {rows.map((row, index) => (
                  <div className={`flex items-center gap-[0.9em] px-[1.1em] py-[0.95em] ${index ? "border-t border-[#e6eaef]" : ""}`} key={row.title}>
                    <span className="block h-[2.6em] w-[3.5em] shrink-0 overflow-hidden rounded-[0.7em] bg-[#f3f6f8]">
                      <VehiclePhoto id={row.vehicle} thumb />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{row.title}</span>
                      <span className="block truncate text-[#5f6b7a]">{row.sub}</span>
                    </span>
                    <Pill solid={row.solid}>{row.action}</Pill>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-[1em]">
              <div className="rounded-[1.4em] bg-white p-[1.1em] shadow-[0_1px_2px_rgba(6,22,43,0.06),0_12px_30px_rgba(6,22,43,0.08)]">
                <p className="font-semibold text-[#5f6b7a]">{t("mockOnRent")}</p>
                <div className="mt-[0.6em] flex items-center gap-[0.9em]">
                  <svg className="h-[4.2em] w-[4.2em] -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" fill="none" r="15" stroke="#e6eaef" strokeWidth="4.5" />
                    <circle cx="18" cy="18" fill="none" r="15" stroke="#0b8f8c" strokeDasharray="73 94.2" strokeLinecap="round" strokeWidth="4.5" />
                  </svg>
                  <span>
                    <span className="block text-[1.7em] font-semibold leading-none" style={{ fontFamily: "var(--font-site)" }}>
                      7/9
                    </span>
                    <span className="text-[#5f6b7a]">{t("mockVehiclesOut")}</span>
                  </span>
                </div>
              </div>
              <div className="flex-1 rounded-[1.4em] bg-white p-[1.1em] shadow-[0_1px_2px_rgba(6,22,43,0.06),0_12px_30px_rgba(6,22,43,0.08)]">
                <p className="font-semibold text-[#5f6b7a]">{t("mockMonthSoFar")}</p>
                <p className="mt-[0.2em] text-[1.9em] font-semibold leading-none" style={{ fontFamily: "var(--font-site)" }}>
                  {money(148600)}
                </p>
                <div className="mt-[0.9em] flex h-[3.2em] items-end gap-[0.35em]">
                  {bars.map((height, index) => (
                    <span className="flex-1 rounded-t-[0.3em]" key={index} style={{ height: `${height}%`, background: index === bars.length - 1 ? "#12bcb8" : "#0b8f8c", opacity: index === bars.length - 1 ? 1 : 0.25 + index * 0.06 }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-[1.2em] rounded-[1.4em] bg-white px-[1.1em] pb-[1em] pt-[0.9em] shadow-[0_1px_2px_rgba(6,22,43,0.06),0_12px_30px_rgba(6,22,43,0.08)]">
            <div className="grid grid-cols-[12.5em_repeat(7,1fr)] items-center gap-y-[0.45em]">
              <span className="font-semibold text-[#5f6b7a]">{t("mockNavCalendar")}</span>
              {week.map((day, index) => (
                <span className={`text-center text-[0.9em] font-semibold ${index === 3 ? "text-[#0b8f8c]" : "text-[#5f6b7a]"}`} key={day}>
                  {day}
                </span>
              ))}
              {calendar.map((row) => (
                <div className="contents" key={row.vehicle}>
                  <span className="truncate pe-[0.6em] font-semibold">{row.vehicle}</span>
                  <span className="relative col-span-7 grid h-[2em] grid-cols-7 rounded-[0.6em] bg-[#f3f6f8]">
                    {row.bars.map((bar) => (
                      <span
                        className="m-[0.2em] flex items-center truncate rounded-[0.45em] px-[0.6em] text-[0.85em] font-semibold"
                        key={bar.who}
                        style={{ gridColumn: `${bar.from} / ${bar.to}`, background: bar.bg, color: bar.fg }}
                      >
                        {bar.who}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}

/* ── Today on a phone ───────────────────────────────────────────────────── */

export async function TodayPhoneMock({ className = "" }: { className?: string }) {
  const { t, money, date } = await kit();
  const rows = [
    { title: t("mockRowHandover", { vehicle: vehicleName("yaris") }), sub: "Anna Becker · 10:00", action: t("mockHandOver"), solid: true, bar: "#0b8f8c" },
    { title: t("mockRowCollect", { amount: money(2400) }), sub: "Kenji Watanabe", action: t("mockRecordPayment"), bar: "#12bcb8" },
    { title: t("mockRowReturn", { vehicle: vehicleName("corolla") }), sub: "Lucas Martin · 16:30", action: t("mockTakeBack"), bar: "#4a9ad8" }
  ];
  return (
    <PhoneFrame className={className} label={t("mockTodayLabel")}>
      <div className="flex h-full flex-col bg-[linear-gradient(180deg,#e6eaef_0%,#f3f6f8_40%)]">
        <StatusBar />
        <div className="px-[1.3em] pt-[1.6em]">
          <p className="font-bold">Palm Car Rental</p>
          <p className="mt-[1.1em] font-semibold text-[#5f6b7a]">{date("2026-11-12", { weekday: "long", day: "numeric", month: "long" })}</p>
          <p className="text-[2.2em] font-semibold leading-[1.05] tracking-[-0.02em]" style={{ fontFamily: "var(--font-site)" }}>
            {t("mockGoodMorning")}
          </p>
          <div className="mt-[0.9em] flex gap-[0.5em] overflow-hidden">
            <Chip dot="#d14343">{t("mockOverdue", { count: 1 })}</Chip>
            <Chip>{t("mockForToday", { count: 3 })}</Chip>
          </div>
          <p className="mt-[1.2em] text-[1.35em] font-semibold" style={{ fontFamily: "var(--font-site)" }}>
            {t("mockToday")}
          </p>
        </div>
        <div className="mx-[0.9em] mt-[0.5em] overflow-hidden rounded-[1.4em] bg-white shadow-[0_1px_2px_rgba(6,22,43,0.06),0_12px_30px_rgba(6,22,43,0.08)]">
          {rows.map((row, index) => (
            <div className={`flex gap-[0.7em] px-[0.9em] py-[0.85em] ${index ? "border-t border-[#e6eaef]" : ""}`} key={row.title}>
              <span className="w-[0.25em] shrink-0 rounded-full" style={{ background: row.bar }} />
              <span className="min-w-0 flex-1">
                <span className="block font-bold leading-tight">{row.title}</span>
                <span className="block truncate text-[#5f6b7a]">{row.sub}</span>
                <span className="mt-[0.5em] block">
                  <Pill solid={row.solid}>{row.action}</Pill>
                </span>
              </span>
            </div>
          ))}
        </div>
        <TabBar />
      </div>
    </PhoneFrame>
  );
}

/** The app's tab bar at the foot of a phone screen. */
function TabBar({ active = 0 }: { active?: number }) {
  const tabs = [Home, ListTodo, null, Inbox, CalendarDays];
  return (
    <div className="mt-auto flex items-center justify-around rounded-t-[1.6em] bg-white/90 px-[1em] pb-[1.4em] pt-[0.8em] text-[0.85em] font-semibold text-[#5f6b7a]">
      {tabs.map((Icon, index) =>
        Icon ? (
          <span className={`flex flex-col items-center ${index === active ? "text-[#0b8f8c]" : ""}`} key={index}>
            <Icon className="h-[1.6em] w-[1.6em]" />
          </span>
        ) : (
          <span className="flex h-[3em] w-[3em] items-center justify-center rounded-full bg-[#0b8f8c] text-white" key={index}>
            <Plus className="h-[1.6em] w-[1.6em]" />
          </span>
        )
      )}
    </div>
  );
}

/* ── A customer's booking link ──────────────────────────────────────────── */

export async function BookingPhoneMock({ className = "" }: { className?: string }) {
  const { t, money, date } = await kit();
  const range = `${date("2026-11-12", { day: "numeric", month: "short" })} – ${date("2026-11-19", { day: "numeric", month: "short" })}`;
  return (
    <PhoneFrame className={className} label={t("mockBookingLabel")}>
      <div className="flex h-full flex-col bg-[#f3f6f8]">
        <StatusBar />
        <div className="flex items-center gap-[0.6em] px-[1.2em] pt-[1.4em]">
          <span className="flex h-[2.2em] w-[2.2em] items-center justify-center rounded-[0.6em] bg-[#0b8f8c] font-bold text-white">P</span>
          <span className="font-bold">Palm Car Rental</span>
        </div>
        <div className="mx-[0.9em] mt-[1em] rounded-[1.3em] bg-white p-[1em] shadow-[0_1px_2px_rgba(6,22,43,0.06),0_10px_24px_rgba(6,22,43,0.08)]">
          <p className="font-semibold text-[#5f6b7a]">{t("mockYourBooking")}</p>
          <div className="mt-[0.5em] flex items-center gap-[0.8em]">
            <span className="block h-[3.4em] w-[4.6em] shrink-0 overflow-hidden rounded-[0.8em] bg-[#e6eaef]">
              <VehiclePhoto id="yaris" thumb />
            </span>
            <span className="min-w-0">
              <span className="block text-[1.15em] font-bold leading-tight">{vehicleName("yaris")}</span>
              <span className="block text-[#5f6b7a]">
                {range} · {t("mockDays", { count: 7 })}
              </span>
            </span>
          </div>
          <div className="mt-[0.9em] grid grid-cols-2 gap-[0.5em]">
            <span className="rounded-[0.8em] bg-[#f3f6f8] px-[0.8em] py-[0.55em]">
              <span className="block text-[0.9em] text-[#5f6b7a]">{t("mockTotal")}</span>
              <span className="block text-[1.2em] font-bold">{money(5600)}</span>
            </span>
            <span className="rounded-[0.8em] bg-[#f3f6f8] px-[0.8em] py-[0.55em]">
              <span className="block text-[0.9em] text-[#5f6b7a]">{t("mockDeposit")}</span>
              <span className="block text-[1.2em] font-bold">{money(3000)}</span>
            </span>
          </div>
        </div>
        <div className="mx-[0.9em] mt-[0.7em] overflow-hidden rounded-[1.3em] bg-white shadow-[0_1px_2px_rgba(6,22,43,0.06)]">
          {[t("mockPassport"), t("mockLicence")].map((label, index) => (
            <div className={`flex items-center justify-between gap-[0.6em] px-[1em] py-[0.75em] ${index ? "border-t border-[#e6eaef]" : ""}`} key={label}>
              <span className="flex items-center gap-[0.6em] font-semibold">
                <span className="flex h-[1.9em] w-[2.6em] items-center justify-center rounded-[0.4em] bg-[#e4eef8] text-[#1f4f7a]">
                  <Camera className="h-[1.1em] w-[1.1em]" />
                </span>
                {label}
              </span>
              <span className="inline-flex items-center gap-[0.3em] rounded-full bg-[#dcf3e6] px-[0.7em] py-[0.25em] text-[0.9em] font-bold text-[#1f7a4d]">
                <Check className="h-[1em] w-[1em]" strokeWidth={3} /> {t("mockRead")}
              </span>
            </div>
          ))}
        </div>
        <div className="mx-[0.9em] mt-[0.7em] flex items-center justify-between gap-[0.6em] rounded-[1.3em] bg-white px-[1em] py-[0.75em] shadow-[0_1px_2px_rgba(6,22,43,0.06)]">
          <span className="font-semibold">{t("mockHandoverTitle")}</span>
          <span className="text-[#5f6b7a]">{date("2026-11-12", { weekday: "short", day: "numeric", month: "short" })} · 10:00</span>
        </div>
        <div className="mx-[0.9em] mt-[0.7em] rounded-[1.3em] border-[0.12em] border-dashed border-[#c9d2db] bg-white px-[1em] pb-[0.6em] pt-[0.6em]">
          <svg className="h-[4.6em] w-full" fill="none" viewBox="0 0 120 40">
            <path d="M6 30C14 8 22 6 25 24s10 14 17-6 14-10 16 6 9 16 16-4 12-8 15 6 10 8 22-2" stroke="#0b1a2e" strokeLinecap="round" strokeWidth="2.2" />
          </svg>
          <p className="border-t border-[#e6eaef] pt-[0.3em] text-[0.9em] text-[#5f6b7a]">{t("mockSignHere")}</p>
        </div>
        <div className="mx-[0.9em] mt-auto pb-[1.6em]">
          <span className="flex w-full items-center justify-center rounded-full bg-[#0b8f8c] py-[0.85em] text-[1.05em] font-bold text-white">{t("mockSignConfirm")}</span>
        </div>
      </div>
    </PhoneFrame>
  );
}

/* ── A handover check ───────────────────────────────────────────────────── */

export async function HandoverPhoneMock({ className = "" }: { className?: string }) {
  const { t, number } = await kit();
  const tiles = [
    { flip: false, zoom: "" },
    { flip: true, zoom: "" },
    { flip: false, zoom: "origin-[22%_72%] scale-[2.4]" },
    { flip: false, zoom: "origin-[80%_72%] scale-[2.4]" }
  ];
  return (
    <PhoneFrame className={className} label={t("mockHandoverLabel")}>
      <div className="flex h-full flex-col bg-[#f3f6f8]">
        <StatusBar />
        <div className="flex items-center gap-[0.5em] px-[1em] pt-[1.4em]">
          <span className="flex h-[2.2em] w-[2.2em] items-center justify-center rounded-full bg-white">
            <ChevronLeft className="h-[1.3em] w-[1.3em]" />
          </span>
          <span>
            <span className="block text-[1.3em] font-semibold leading-tight" style={{ fontFamily: "var(--font-site)" }}>
              {t("mockHandoverTitle")}
            </span>
            <span className="block text-[#5f6b7a]">{vehicleName("corolla")} · Lucas Martin</span>
          </span>
        </div>
        <div className="mx-[0.9em] mt-[1em] rounded-[1.3em] bg-white p-[0.9em] shadow-[0_1px_2px_rgba(6,22,43,0.06)]">
          <div className="flex items-center justify-between">
            <span className="font-bold">{t("mockPhotos")}</span>
            <span className="text-[#5f6b7a]">{t("mockPhotoCount", { count: 8 })}</span>
          </div>
          <div className="mt-[0.6em] grid grid-cols-2 gap-[0.45em]">
            {tiles.map((tile, index) => (
              <span className="relative block aspect-[4/3] overflow-hidden rounded-[0.7em] bg-[#e6eaef]" key={index}>
                <VehiclePhoto className={tile.zoom} flip={tile.flip} id="corolla" thumb />
                <span className="absolute bottom-[0.35em] end-[0.35em] flex h-[1.5em] w-[1.5em] items-center justify-center rounded-full bg-white/90 text-[#0b8f8c]">
                  <Camera className="h-[0.9em] w-[0.9em]" />
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="mx-[0.9em] mt-[0.7em] overflow-hidden rounded-[1.3em] bg-white shadow-[0_1px_2px_rgba(6,22,43,0.06)]">
          <div className="px-[1em] py-[0.75em]">
            <div className="flex items-center justify-between font-semibold">
              <span>{t("mockFuel")}</span>
              <span>¾</span>
            </div>
            <div className="mt-[0.45em] h-[0.55em] overflow-hidden rounded-full bg-[#e6eaef]">
              <div className="h-full w-3/4 rounded-full bg-[#0b8f8c]" />
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-[#e6eaef] px-[1em] py-[0.75em] font-semibold">
            <span>{t("mockKm")}</span>
            <span className="tabular-nums">{number(48210)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[#e6eaef] px-[1em] py-[0.75em] font-semibold">
            <span>{t("mockCustomerSigned")}</span>
            <span className="flex h-[1.5em] w-[1.5em] items-center justify-center rounded-full bg-[#dcf3e6] text-[#1f7a4d]">
              <Check className="h-[1em] w-[1em]" strokeWidth={3} />
            </span>
          </div>
        </div>
        <div className="mx-[0.9em] mt-auto pb-[1.6em]">
          <span className="flex w-full items-center justify-center rounded-full bg-[#0b8f8c] py-[0.85em] text-[1.05em] font-bold text-white">{t("mockFinish")}</span>
        </div>
      </div>
    </PhoneFrame>
  );
}

/* ── Getting paid ───────────────────────────────────────────────────────── */

export async function PaymentPhoneMock({ className = "" }: { className?: string }) {
  const { t, money, qrName } = await kit();
  return (
    <PhoneFrame className={className} label={t("mockPaymentLabel")}>
      <div className="flex h-full flex-col bg-[#f3f6f8]">
        <StatusBar />
        <div className="mx-[0.9em] mt-[2em] rounded-[1.4em] bg-white p-[1.1em] text-center shadow-[0_1px_2px_rgba(6,22,43,0.06),0_10px_24px_rgba(6,22,43,0.08)]">
          <p className="font-semibold text-[#5f6b7a]">{t("mockScanToPay")}</p>
          <p className="mt-[0.1em] text-[2em] font-semibold leading-tight" style={{ fontFamily: "var(--font-site)" }}>
            {money(5600)}
          </p>
          <div className="mx-auto mt-[0.8em] w-[62%] rounded-[0.8em] border-[0.15em] border-[#e6eaef] p-[0.5em]">
            <FakeQr className="block w-full" />
          </div>
          <p className="mt-[0.6em] text-[0.95em] font-bold tracking-[0.02em] text-[#1f4f7a]">{qrName}</p>
        </div>
        <div className="mx-[0.9em] mt-[0.8em] flex items-start gap-[0.7em] rounded-[1.3em] bg-white p-[0.9em] shadow-[0_1px_2px_rgba(6,22,43,0.06),0_14px_30px_rgba(6,22,43,0.12)]">
          <span className="flex h-[2.3em] w-[2.3em] shrink-0 items-center justify-center rounded-full bg-[#dcf3e6] text-[#1f7a4d]">
            <Check className="h-[1.3em] w-[1.3em]" strokeWidth={3} />
          </span>
          <span className="min-w-0">
            <span className="block font-bold leading-tight">{t("mockSlipMatched")}</span>
            <span className="block text-[#5f6b7a]">{money(5600)} · Anna Becker</span>
          </span>
        </div>
        <div className="mx-[0.9em] mt-[0.6em] flex items-center justify-between rounded-[1.3em] bg-white px-[0.9em] py-[0.75em] font-semibold shadow-[0_1px_2px_rgba(6,22,43,0.06)]">
          <span>{t("mockDepositHeld")}</span>
          <span>{money(3000)}</span>
        </div>
        <div className="mx-[0.9em] mt-[0.6em] flex items-center justify-between rounded-[1.3em] bg-white px-[0.9em] py-[0.75em] font-semibold shadow-[0_1px_2px_rgba(6,22,43,0.06)]">
          <span>{t("mockReceiptSent")}</span>
          <span className="flex h-[1.5em] w-[1.5em] items-center justify-center rounded-full bg-[#dcf3e6] text-[#1f7a4d]">
            <Check className="h-[1em] w-[1em]" strokeWidth={3} />
          </span>
        </div>
        <TabBar />
      </div>
    </PhoneFrame>
  );
}

/* ── An owner's monthly statement ───────────────────────────────────────── */

export async function StatementPhoneMock({ className = "" }: { className?: string }) {
  const { t, local, format, date } = await kit();
  // Rounded in the visitor's currency first, so the statement still adds up.
  const rentals = local(38400);
  const costs = local(3200);
  const share = Math.round((rentals - costs) * 0.3);
  const yours = Number((rentals - costs - share).toFixed(2));
  const lines = [
    { label: t("mockRentals"), detail: t("mockRentalCount", { count: 4 }), amount: format(rentals) },
    { label: t("mockCosts"), detail: t("mockCostsDetail"), amount: `−${format(costs)}` },
    { label: t("mockOperatorShare"), detail: "30%", amount: `−${format(share)}` }
  ];
  const money = (_thb?: number) => format(yours);
  const months = ["2026-05-15", "2026-06-15", "2026-07-15", "2026-08-15", "2026-09-15", "2026-10-15"].map((iso, index) => ({
    iso,
    label: date(iso, { month: "short" }),
    height: [2.2, 1.6, 2.9, 3.4, 2.6, 3.8][index]
  }));
  return (
    <PhoneFrame className={className} label={t("mockStatementLabel")}>
      <div className="flex h-full flex-col bg-[#f3f6f8]">
        <StatusBar />
        <div className="px-[1.2em] pt-[1.6em]">
          <p className="font-semibold text-[#5f6b7a]">{date("2026-10-15", { month: "long", year: "numeric" })}</p>
          <p className="text-[1.6em] font-semibold leading-tight" style={{ fontFamily: "var(--font-site)" }}>
            {t("mockStatement")}
          </p>
        </div>
        <div className="mx-[0.9em] mt-[0.9em] flex items-center gap-[0.8em] rounded-[1.3em] bg-white p-[0.9em] shadow-[0_1px_2px_rgba(6,22,43,0.06)]">
          <span className="flex h-[3em] w-[4.2em] shrink-0 items-center justify-center rounded-[0.8em] bg-[#e6eaef]">
            <VehiclePhoto id="pajero" thumb />
          </span>
          <span>
            <span className="block font-bold">{vehicleName("pajero")}</span>
            <span className="block text-[#5f6b7a]">Palm Car Rental</span>
          </span>
        </div>
        <div className="mx-[0.9em] mt-[0.7em] overflow-hidden rounded-[1.3em] bg-white shadow-[0_1px_2px_rgba(6,22,43,0.06)]">
          {lines.map((line, index) => (
            <div className={`flex items-center justify-between gap-[0.6em] px-[1em] py-[0.8em] ${index ? "border-t border-[#e6eaef]" : ""}`} key={line.label}>
              <span className="min-w-0">
                <span className="block font-semibold">{line.label}</span>
                <span className="block text-[0.9em] text-[#5f6b7a]">{line.detail}</span>
              </span>
              <span className="font-bold tabular-nums">{line.amount}</span>
            </div>
          ))}
        </div>
        <div className="mx-[0.9em] mt-[0.7em] rounded-[1.3em] bg-[#0b8f8c] p-[1em] text-white">
          <p className="font-semibold opacity-85">{t("mockYourShare")}</p>
          <p className="text-[2em] font-semibold leading-tight" style={{ fontFamily: "var(--font-site)" }}>
            {money(24640)}
          </p>
        </div>
        <div className="mx-[0.9em] mt-[0.7em] rounded-[1.3em] bg-white p-[1em] shadow-[0_1px_2px_rgba(6,22,43,0.06)]">
          <p className="font-semibold text-[#5f6b7a]">{t("mockLastMonths")}</p>
          <div className="mt-[0.7em] flex h-[4.6em] items-end gap-[0.5em]">
            {months.map((month, index) => (
              <span className="flex min-w-0 flex-1 flex-col items-center gap-[0.3em]" key={month.iso}>
                <span className="w-full rounded-[0.35em]" style={{ height: `${month.height}em`, background: index === months.length - 1 ? "#0b8f8c" : "#cfe6e5" }} />
                <span className="text-[0.75em] font-semibold text-[#5f6b7a]">{month.label}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="mx-[0.9em] mt-[0.7em] flex items-center gap-[0.6em] rounded-[1.3em] bg-white px-[1em] py-[0.8em] font-semibold shadow-[0_1px_2px_rgba(6,22,43,0.06)]">
          <span className="flex h-[1.5em] w-[1.5em] shrink-0 items-center justify-center rounded-full bg-[#dcf3e6] text-[#1f7a4d]">
            <Check className="h-[0.95em] w-[0.95em]" strokeWidth={3} />
          </span>
          {t("mockTaxRenewed")}
        </div>
      </div>
    </PhoneFrame>
  );
}

/* ── Detail cards that sit beside a phone in the feature panels ─────────── */

function CardHead({ icon, title, sub }: { icon: ReactNode; title: string; sub?: ReactNode }) {
  return (
    <div className="flex items-center gap-[0.8em] border-b border-[var(--line)] px-[1.3em] py-[1em]">
      <span className="flex h-[2.4em] w-[2.4em] shrink-0 items-center justify-center rounded-[0.7em] bg-[#e4eef8] text-[#1f4f7a]">{icon}</span>
      <span className="min-w-0">
        <span className="block font-bold leading-tight">{title}</span>
        {sub ? <span className="block text-[0.92em] text-[var(--muted)]">{sub}</span> : null}
      </span>
    </div>
  );
}

/** What RouteHQ read from a passport photo. */
export async function PassportCard({ className = "" }: { className?: string }) {
  const { t, date } = await kit();
  const rows = [
    [t("mockFieldName"), "BECKER, ANNA MARIE"],
    [t("mockFieldNationality"), "DEU"],
    [t("mockFieldNumber"), "C4F9•••72"],
    [t("mockFieldExpiry"), date("2031-03-08", { day: "numeric", month: "short", year: "numeric" })]
  ];
  return (
    <div aria-hidden="true" className={`${s.card} ${className}`}>
      <CardHead icon={<Camera className="h-[1.2em] w-[1.2em]" />} sub="passport.jpg" title={t("mockPassportCard")} />
      <dl className="px-[1.3em] py-[0.4em]">
        {rows.map(([label, value]) => (
          <div className="flex items-baseline justify-between gap-[1em] border-b border-dashed border-[var(--line)] py-[0.7em] last:border-0" key={label}>
            <dt className="text-[var(--muted)]">{label}</dt>
            <dd className="font-semibold tracking-[0.01em]">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center gap-[0.5em] rounded-b-[1.1em] bg-[#dcf3e6] px-[1.3em] py-[0.75em] font-semibold text-[#1f7a4d]">
        <Check className="h-[1.1em] w-[1.1em]" strokeWidth={3} /> {t("mockAddedToBooking")}
      </div>
    </div>
  );
}

/** Handover and return photos side by side. */
export async function ReturnCard({ className = "" }: { className?: string }) {
  const { t, money } = await kit();
  return (
    <div aria-hidden="true" className={`${s.card} ${className}`}>
      <CardHead icon={<Camera className="h-[1.2em] w-[1.2em]" />} sub={<Sub detail="Lucas Martin" main={vehicleName("corolla")} />} title={t("mockCompareTitle")} />
      <div className="grid grid-cols-2 gap-[0.6em] p-[1em]">
        {[t("mockCompareOut"), t("mockCompareBack")].map((label, index) => (
          <div key={label}>
            <div className="aspect-[4/3] overflow-hidden rounded-[0.7em] bg-[#e6eaef]">
              <VehiclePhoto id="corolla" thumb />
            </div>
            <p className="mt-[0.4em] text-[0.9em] font-semibold text-[var(--muted)]">{label}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-[1em] border-t border-[var(--line)] px-[1.3em] py-[0.8em] font-semibold">
        <span className="flex items-center gap-[0.5em]">
          <span className="flex h-[1.5em] w-[1.5em] items-center justify-center rounded-full bg-[#dcf3e6] text-[#1f7a4d]">
            <Check className="h-[0.95em] w-[0.95em]" strokeWidth={3} />
          </span>
          {t("mockNoNewDamage")}
        </span>
      </div>
      <div className="flex items-center justify-between gap-[1em] border-t border-[var(--line)] px-[1.3em] py-[0.8em] font-semibold">
        <span>{t("mockDepositReturned")}</span>
        <span className="tabular-nums">{money(3000)}</span>
      </div>
    </div>
  );
}

/** A booking's money, all on record. */
export async function LedgerCard({ className = "" }: { className?: string }) {
  const { t, money, qrName } = await kit();
  const rows = [
    { label: t("mockRental"), sub: t("mockDays", { count: 7 }), amount: money(5600), done: true },
    { label: t("mockDepositHeld"), sub: qrName, amount: money(3000), done: true },
    { label: t("mockReceiptSent"), sub: "LINE", amount: "", done: true }
  ];
  return (
    <div aria-hidden="true" className={`${s.card} ${className}`}>
      <CardHead icon={<FileText className="h-[1.2em] w-[1.2em]" />} sub={<Sub detail="Anna Becker" main={vehicleName("yaris")} />} title={t("mockLedgerTitle")} />
      <div className="px-[1.3em] py-[0.3em]">
        {rows.map((row) => (
          <div className="flex items-center justify-between gap-[1em] border-b border-[var(--line)] py-[0.75em] last:border-0" key={row.label}>
            <span className="flex min-w-0 items-center gap-[0.6em]">
              <span className="flex h-[1.5em] w-[1.5em] shrink-0 items-center justify-center rounded-full bg-[#dcf3e6] text-[#1f7a4d]">
                <Check className="h-[0.95em] w-[0.95em]" strokeWidth={3} />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold leading-tight">{row.label}</span>
                <span className="block text-[0.9em] text-[var(--muted)]">{row.sub}</span>
              </span>
            </span>
            <span className="font-bold tabular-nums">{row.amount}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-b-[1.1em] bg-[var(--ink)] px-[1.3em] py-[0.9em] text-white">
        <span className="font-semibold">{t("mockBalance")}</span>
        <span className="font-bold">{t("mockPaidUp")}</span>
      </div>
    </div>
  );
}

/* ── A business's own booking page ──────────────────────────────────────── */

export async function ShopPageMock({ className = "" }: { className?: string }) {
  const { t, money } = await kit();
  const vehicles = [
    { id: "vespa" as VehicleId, price: money(450) },
    { id: "yaris" as VehicleId, price: money(1100) },
    { id: "corolla" as VehicleId, price: money(1300) },
    { id: "pajero" as VehicleId, price: money(2200) }
  ];
  return (
    <WindowFrame address="palm.routehq.app/book" className={className} label={t("mockShopLabel")} light>
      <div className="bg-[#f3f6f8] px-[2.4em] pb-[2.4em] pt-[2em] text-[1.3em]">
        <div className="flex items-center justify-between gap-[1em]">
          <span className="flex items-center gap-[0.8em]">
            <span className="flex h-[3em] w-[3em] items-center justify-center rounded-[0.8em] bg-[#0b8f8c] text-[1.2em] font-bold text-white">P</span>
            <span>
              <span className="block text-[1.5em] font-bold leading-tight">Palm Car Rental</span>
              <span className="block text-[#5f6b7a]">{t("mockShopTagline")}</span>
            </span>
          </span>
          <span className="rounded-full border border-[#e6eaef] bg-white px-[1em] py-[0.4em] font-semibold text-[#5f6b7a]">EN</span>
        </div>
        <div className="mt-[1.6em] grid grid-cols-2 gap-[1em]">
          {vehicles.map((vehicle) => (
            <div className="overflow-hidden rounded-[1.2em] bg-white shadow-[0_1px_2px_rgba(6,22,43,0.06),0_12px_30px_rgba(6,22,43,0.06)]" key={vehicle.id}>
              <div className="aspect-[16/10] overflow-hidden bg-[#e6eaef]">
                <VehiclePhoto id={vehicle.id} />
              </div>
              <div className="flex flex-wrap items-end justify-between gap-x-[0.8em] gap-y-[0.3em] p-[1em]">
                <span>
                  <span className="block whitespace-nowrap text-[1.15em] font-bold">{vehicleName(vehicle.id)}</span>
                  <span className="mt-[0.2em] inline-flex items-center gap-[0.4em] text-[#1f7a4d]">
                    <span className="h-[0.55em] w-[0.55em] rounded-full bg-[#1f7a4d]" /> {t("mockAvailable")}
                  </span>
                </span>
                <span className="shrink-0 text-end">
                  <span className="block text-[1.25em] font-bold">{t("mockPerDay", { amount: vehicle.price })}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </WindowFrame>
  );
}
