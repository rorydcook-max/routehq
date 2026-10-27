import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { BarChart3, CalendarDays, Camera, Car, Check, ChevronLeft, FileText, Home, Inbox, ListTodo, Plus, Users } from "lucide-react";
import { numberLocale } from "@/lib/i18n/dates";
import { formatPlanPrice } from "@/lib/plan-currency";
import s from "../site.module.css";

/*
 * Stylised pictures of the app for the website, drawn in HTML and SVG rather than screenshots: crisp at any size,
 * in the visitor's language, and with no real customer's name in them. The names, vehicles and amounts are made up.
 * Each picture is one image to a screen reader (role="img" with a label); what is inside it is hidden from them.
 */

async function kit() {
  const [t, locale] = await Promise.all([getTranslations("site"), getLocale()]);
  const nl = numberLocale(locale);
  const baht = (amount: number) => formatPlanPrice(amount, "THB", nl);
  const number = (value: number) => value.toLocaleString(nl);
  const date = (iso: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(nl, { timeZone: "UTC", ...options }).format(new Date(`${iso}T12:00:00Z`));
  return { t, baht, number, date };
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

export function LaptopFrame({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div aria-label={label} className={`${s.laptop} ${className}`} role="img">
      <div className={s.laptopLid}>
        <div className={s.laptopScreen}>
          <div aria-hidden="true" className={s.laptopScale}>
            {children}
          </div>
        </div>
      </div>
      <div className={s.laptopBase} />
    </div>
  );
}

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-[1.6em] pt-[0.9em] text-[0.85em] font-semibold">
      <span>9:41</span>
      <span className="flex items-center gap-[0.3em]">
        <span className="inline-block h-[0.7em] w-[1.1em] rounded-[0.15em] bg-[#13262b]/80" />
        <span className="inline-block h-[0.7em] w-[1.6em] rounded-[0.2em] border-[0.12em] border-[#13262b]/70" />
      </span>
    </div>
  );
}

/** A car seen from the side: the same simple shape the app draws for a vehicle without a photo. */
export function CarArt({ colour = "#0e5e6f", className = "", flip = false }: { colour?: string; className?: string; flip?: boolean }) {
  return (
    <svg className={className} style={flip ? { transform: "scaleX(-1)" } : undefined} viewBox="0 0 120 52" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 36c0-5 3-8 8-9l16-3 13-11c3-2.5 6-3.5 10-3.5h27c5 0 8.5 1.8 11.5 5l10 10.5 8 1.8c4 1 6.5 4 6.5 8v4.2c0 2-1.2 3-3 3H9c-2 0-3-1-3-3z" fill={colour} />
      <path d="M46 14.5h15v10.5H34.5z" fill="#d8eeea" />
      <path d="M65 14.5h15.5c3 0 5 1 7 3l7.5 7.5H65z" fill="#d8eeea" />
      <circle cx="31" cy="42" fill="#13262b" r="8.5" />
      <circle cx="31" cy="42" fill="#c4d3d0" r="3.5" />
      <circle cx="92" cy="42" fill="#13262b" r="8.5" />
      <circle cx="92" cy="42" fill="#c4d3d0" r="3.5" />
    </svg>
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
      <path d={d} fill="#13262b" />
    </svg>
  );
}

function Pill({ children, solid = false }: { children: ReactNode; solid?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full px-[1em] py-[0.45em] text-[0.95em] font-bold ${
        solid ? "bg-[#0e5e6f] text-white" : "border-[0.12em] border-[#b9d4d0] bg-white text-[#13262b]"
      }`}
    >
      {children}
    </span>
  );
}

function Chip({ dot, children }: { dot?: string; children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-[0.45em] whitespace-nowrap rounded-[1em] bg-white px-[0.9em] py-[0.5em] font-semibold shadow-[0_1px_2px_rgba(19,38,43,0.06)]">
      {dot ? <span className="h-[0.6em] w-[0.6em] rounded-full" style={{ background: dot }} /> : null}
      {children}
    </span>
  );
}

/* ── The dashboard on a laptop ──────────────────────────────────────────── */

export async function DashboardLaptopMock({ className = "" }: { className?: string }) {
  const { t, baht, date } = await kit();
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
    { title: t("mockRowHandover", { vehicle: "Toyota Yaris Ativ" }), sub: "Anna Becker · 10:00", action: t("mockHandOver"), solid: true, colour: "#0e5e6f" },
    { title: t("mockRowCollect", { amount: baht(2400) }), sub: "Kenji Watanabe · Honda Click 160", action: t("mockRecordPayment"), colour: "#f2a541" },
    { title: t("mockRowReturn", { vehicle: "Honda City" }), sub: "Lucas Martin · 16:30", action: t("mockTakeBack"), colour: "#5aa9d6" }
  ];
  const bars = [38, 52, 44, 63, 58, 72, 66, 80, 74, 90];
  return (
    <LaptopFrame className={className} label={t("mockDashboardLabel")}>
      <div className="grid h-full grid-cols-[15em_1fr]">
        <aside className="flex flex-col gap-[0.3em] border-e border-[#dbe9e6] bg-white px-[1em] py-[1.4em]">
          <p className="px-[0.6em] text-[1.15em] font-bold leading-tight">Palm Car Rental</p>
          <p className="px-[0.7em] text-[0.85em] text-[#4b5f63]">Powered by RouteHQ</p>
          <div className="mt-[1em] flex flex-col gap-[0.2em]">
            {nav.map(({ icon: Icon, label, active }) => (
              <span className={`flex items-center gap-[0.7em] rounded-[0.8em] px-[0.7em] py-[0.55em] font-semibold ${active ? "bg-[#d8eeea] text-[#0e5e6f]" : "text-[#2f4448]"}`} key={label}>
                <Icon className="h-[1.2em] w-[1.2em] shrink-0" strokeWidth={2} />
                {label}
              </span>
            ))}
          </div>
        </aside>
        <div className="min-w-0 px-[2em] py-[1.6em]">
          <div className="flex items-start justify-between gap-[1em]">
            <div>
              <p className="font-semibold text-[#4b5f63]">{date("2026-11-12", { weekday: "long", day: "numeric", month: "long" })}</p>
              <p className="mt-[0.1em] text-[2.6em] font-semibold leading-none tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)" }}>
                {t("mockGoodMorning")}
              </p>
            </div>
            <span className="inline-flex items-center gap-[0.4em] whitespace-nowrap rounded-full bg-[#0e5e6f] px-[1.1em] py-[0.6em] font-bold text-white">
              <Plus className="h-[1.1em] w-[1.1em]" strokeWidth={2.5} /> {t("mockNewBooking")}
            </span>
          </div>
          <div className="mt-[1.1em] flex gap-[0.6em] overflow-hidden">
            <Chip dot="#b4472c">{t("mockOverdue", { count: 1 })}</Chip>
            <Chip>{t("mockForToday", { count: 3 })}</Chip>
            <Chip dot="#f2a541">{t("mockGoingOut", { count: 2 })}</Chip>
            <Chip dot="#5aa9d6">{t("mockComingBack", { count: 1 })}</Chip>
          </div>
          <div className="mt-[1.4em] grid grid-cols-[1.65fr_1fr] gap-[1.2em]">
            <div>
              <p className="text-[1.45em] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                {t("mockToday")}
              </p>
              <div className="mt-[0.6em] overflow-hidden rounded-[1.4em] bg-white shadow-[0_1px_2px_rgba(19,38,43,0.06),0_12px_30px_rgba(14,94,111,0.11)]">
                {rows.map((row, index) => (
                  <div className={`flex items-center gap-[0.9em] px-[1.1em] py-[0.95em] ${index ? "border-t border-[#dbe9e6]" : ""}`} key={row.title}>
                    <span className="flex h-[2.6em] w-[3.2em] shrink-0 items-center justify-center rounded-[0.7em] bg-[#f3f8f7]">
                      <CarArt className="w-[2.5em]" colour={row.colour} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{row.title}</span>
                      <span className="block truncate text-[#4b5f63]">{row.sub}</span>
                    </span>
                    <Pill solid={row.solid}>{row.action}</Pill>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-[1em]">
              <div className="rounded-[1.4em] bg-white p-[1.1em] shadow-[0_1px_2px_rgba(19,38,43,0.06),0_12px_30px_rgba(14,94,111,0.11)]">
                <p className="font-semibold text-[#4b5f63]">{t("mockOnRent")}</p>
                <div className="mt-[0.6em] flex items-center gap-[0.9em]">
                  <svg className="h-[4.2em] w-[4.2em] -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" fill="none" r="15" stroke="#e3eeec" strokeWidth="4.5" />
                    <circle cx="18" cy="18" fill="none" r="15" stroke="#0e5e6f" strokeDasharray="73 94.2" strokeLinecap="round" strokeWidth="4.5" />
                  </svg>
                  <span>
                    <span className="block text-[1.7em] font-semibold leading-none" style={{ fontFamily: "var(--font-display)" }}>
                      7/9
                    </span>
                    <span className="text-[#4b5f63]">{t("mockVehiclesOut")}</span>
                  </span>
                </div>
              </div>
              <div className="flex-1 rounded-[1.4em] bg-white p-[1.1em] shadow-[0_1px_2px_rgba(19,38,43,0.06),0_12px_30px_rgba(14,94,111,0.11)]">
                <p className="font-semibold text-[#4b5f63]">{t("mockMonthSoFar")}</p>
                <p className="mt-[0.2em] text-[1.9em] font-semibold leading-none" style={{ fontFamily: "var(--font-display)" }}>
                  {baht(148600)}
                </p>
                <div className="mt-[0.9em] flex h-[3.2em] items-end gap-[0.35em]">
                  {bars.map((height, index) => (
                    <span className="flex-1 rounded-t-[0.3em]" key={index} style={{ height: `${height}%`, background: index === bars.length - 1 ? "#f2a541" : "#0e5e6f", opacity: index === bars.length - 1 ? 1 : 0.25 + index * 0.06 }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LaptopFrame>
  );
}

/* ── Today on a phone ───────────────────────────────────────────────────── */

export async function TodayPhoneMock({ className = "" }: { className?: string }) {
  const { t, baht, date } = await kit();
  const rows = [
    { title: t("mockRowHandover", { vehicle: "Toyota Yaris Ativ" }), sub: "Anna Becker · 10:00", action: t("mockHandOver"), solid: true, bar: "#0e5e6f" },
    { title: t("mockRowCollect", { amount: baht(2400) }), sub: "Kenji Watanabe", action: t("mockRecordPayment"), bar: "#f2a541" },
    { title: t("mockRowReturn", { vehicle: "Honda City" }), sub: "Lucas Martin · 16:30", action: t("mockTakeBack"), bar: "#5aa9d6" }
  ];
  return (
    <PhoneFrame className={className} label={t("mockTodayLabel")}>
      <div className="flex h-full flex-col bg-[linear-gradient(180deg,#e3eeec_0%,#eef5f4_40%)]">
        <StatusBar />
        <div className="px-[1.3em] pt-[1.6em]">
          <p className="font-bold">Palm Car Rental</p>
          <p className="mt-[1.1em] font-semibold text-[#4b5f63]">{date("2026-11-12", { weekday: "long", day: "numeric", month: "long" })}</p>
          <p className="text-[2.2em] font-semibold leading-[1.05] tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)" }}>
            {t("mockGoodMorning")}
          </p>
          <div className="mt-[0.9em] flex gap-[0.5em] overflow-hidden">
            <Chip dot="#b4472c">{t("mockOverdue", { count: 1 })}</Chip>
            <Chip>{t("mockForToday", { count: 3 })}</Chip>
          </div>
          <p className="mt-[1.2em] text-[1.35em] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            {t("mockToday")}
          </p>
        </div>
        <div className="mx-[0.9em] mt-[0.5em] overflow-hidden rounded-[1.4em] bg-white shadow-[0_1px_2px_rgba(19,38,43,0.06),0_12px_30px_rgba(14,94,111,0.11)]">
          {rows.map((row, index) => (
            <div className={`flex gap-[0.7em] px-[0.9em] py-[0.85em] ${index ? "border-t border-[#dbe9e6]" : ""}`} key={row.title}>
              <span className="w-[0.25em] shrink-0 rounded-full" style={{ background: row.bar }} />
              <span className="min-w-0 flex-1">
                <span className="block font-bold leading-tight">{row.title}</span>
                <span className="block truncate text-[#4b5f63]">{row.sub}</span>
                <span className="mt-[0.5em] block">
                  <Pill solid={row.solid}>{row.action}</Pill>
                </span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-around rounded-t-[1.6em] bg-white/90 px-[1em] pb-[1.4em] pt-[0.8em] text-[0.85em] font-semibold text-[#4b5f63]">
          <span className="flex flex-col items-center text-[#0e5e6f]">
            <Home className="h-[1.6em] w-[1.6em]" />
          </span>
          <span className="flex flex-col items-center">
            <ListTodo className="h-[1.6em] w-[1.6em]" />
          </span>
          <span className="flex h-[3em] w-[3em] items-center justify-center rounded-full bg-[#0e5e6f] text-white">
            <Plus className="h-[1.6em] w-[1.6em]" />
          </span>
          <span className="flex flex-col items-center">
            <Inbox className="h-[1.6em] w-[1.6em]" />
          </span>
          <span className="flex flex-col items-center">
            <CalendarDays className="h-[1.6em] w-[1.6em]" />
          </span>
        </div>
      </div>
    </PhoneFrame>
  );
}

/* ── A customer's booking link ──────────────────────────────────────────── */

export async function BookingPhoneMock({ className = "" }: { className?: string }) {
  const { t, baht, date } = await kit();
  const range = `${date("2026-11-12", { day: "numeric", month: "short" })} – ${date("2026-11-19", { day: "numeric", month: "short" })}`;
  return (
    <PhoneFrame className={className} label={t("mockBookingLabel")}>
      <div className="flex h-full flex-col bg-[#f3f8f7]">
        <StatusBar />
        <div className="flex items-center gap-[0.6em] px-[1.2em] pt-[1.4em]">
          <span className="flex h-[2.2em] w-[2.2em] items-center justify-center rounded-[0.6em] bg-[#0e5e6f] font-bold text-white">P</span>
          <span className="font-bold">Palm Car Rental</span>
        </div>
        <div className="mx-[0.9em] mt-[1em] rounded-[1.3em] bg-white p-[1em] shadow-[0_1px_2px_rgba(19,38,43,0.06),0_10px_24px_rgba(14,94,111,0.1)]">
          <p className="font-semibold text-[#4b5f63]">{t("mockYourBooking")}</p>
          <div className="mt-[0.5em] flex items-center gap-[0.8em]">
            <span className="flex h-[3.4em] w-[4.6em] shrink-0 items-center justify-center rounded-[0.8em] bg-[#e3eeec]">
              <CarArt className="w-[3.8em]" colour="#b4472c" />
            </span>
            <span className="min-w-0">
              <span className="block text-[1.15em] font-bold leading-tight">Toyota Yaris Ativ</span>
              <span className="block text-[#4b5f63]">
                {range} · {t("mockDays", { count: 7 })}
              </span>
            </span>
          </div>
          <div className="mt-[0.9em] grid grid-cols-2 gap-[0.5em]">
            <span className="rounded-[0.8em] bg-[#f3f8f7] px-[0.8em] py-[0.55em]">
              <span className="block text-[0.9em] text-[#4b5f63]">{t("mockTotal")}</span>
              <span className="block text-[1.2em] font-bold">{baht(5600)}</span>
            </span>
            <span className="rounded-[0.8em] bg-[#f3f8f7] px-[0.8em] py-[0.55em]">
              <span className="block text-[0.9em] text-[#4b5f63]">{t("mockDeposit")}</span>
              <span className="block text-[1.2em] font-bold">{baht(3000)}</span>
            </span>
          </div>
        </div>
        <div className="mx-[0.9em] mt-[0.7em] overflow-hidden rounded-[1.3em] bg-white shadow-[0_1px_2px_rgba(19,38,43,0.06)]">
          {[t("mockPassport"), t("mockLicence")].map((label, index) => (
            <div className={`flex items-center justify-between gap-[0.6em] px-[1em] py-[0.75em] ${index ? "border-t border-[#dbe9e6]" : ""}`} key={label}>
              <span className="flex items-center gap-[0.6em] font-semibold">
                <span className="flex h-[1.9em] w-[2.6em] items-center justify-center rounded-[0.4em] bg-[#e4eff8] text-[#173e5e]">
                  <Camera className="h-[1.1em] w-[1.1em]" />
                </span>
                {label}
              </span>
              <span className="inline-flex items-center gap-[0.3em] rounded-full bg-[#ddf0e4] px-[0.7em] py-[0.25em] text-[0.9em] font-bold text-[#2b6b47]">
                <Check className="h-[1em] w-[1em]" strokeWidth={3} /> {t("mockRead")}
              </span>
            </div>
          ))}
        </div>
        <div className="mx-[0.9em] mt-[0.7em] rounded-[1.3em] border-[0.12em] border-dashed border-[#b9d4d0] bg-white px-[1em] pb-[0.6em] pt-[0.4em]">
          <svg className="h-[3.4em] w-full" fill="none" viewBox="0 0 120 40">
            <path d="M6 30C14 8 22 6 25 24s10 14 17-6 14-10 16 6 9 16 16-4 12-8 15 6 10 8 22-2" stroke="#13262b" strokeLinecap="round" strokeWidth="2.2" />
          </svg>
          <p className="border-t border-[#dbe9e6] pt-[0.3em] text-[0.9em] text-[#4b5f63]">{t("mockSignHere")}</p>
        </div>
        <div className="mx-[0.9em] mt-auto pb-[1.6em]">
          <span className="flex w-full items-center justify-center rounded-full bg-[#0e5e6f] py-[0.85em] text-[1.05em] font-bold text-white">{t("mockSignConfirm")}</span>
        </div>
      </div>
    </PhoneFrame>
  );
}

/* ── A handover check ───────────────────────────────────────────────────── */

export async function HandoverPhoneMock({ className = "" }: { className?: string }) {
  const { t, number } = await kit();
  const tiles = [
    { colour: "#13262b", flip: false },
    { colour: "#13262b", flip: true },
    { colour: "#4b5f63", flip: false },
    { colour: "#4b5f63", flip: true }
  ];
  return (
    <PhoneFrame className={className} label={t("mockHandoverLabel")}>
      <div className="flex h-full flex-col bg-[#f3f8f7]">
        <StatusBar />
        <div className="flex items-center gap-[0.5em] px-[1em] pt-[1.4em]">
          <span className="flex h-[2.2em] w-[2.2em] items-center justify-center rounded-full bg-white">
            <ChevronLeft className="h-[1.3em] w-[1.3em]" />
          </span>
          <span>
            <span className="block text-[1.3em] font-semibold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
              {t("mockHandoverTitle")}
            </span>
            <span className="block text-[#4b5f63]">Honda City · Lucas Martin</span>
          </span>
        </div>
        <div className="mx-[0.9em] mt-[1em] rounded-[1.3em] bg-white p-[0.9em] shadow-[0_1px_2px_rgba(19,38,43,0.06)]">
          <div className="flex items-center justify-between">
            <span className="font-bold">{t("mockPhotos")}</span>
            <span className="text-[#4b5f63]">{t("mockPhotoCount", { count: 8 })}</span>
          </div>
          <div className="mt-[0.6em] grid grid-cols-2 gap-[0.45em]">
            {tiles.map((tile, index) => (
              <span className="relative flex aspect-[4/3] items-center justify-center rounded-[0.7em] bg-[linear-gradient(160deg,#e3eeec,#cfe0dd)]" key={index}>
                <CarArt className="w-[70%]" colour={index < 2 ? "#e9edec" : "#f5f7f7"} flip={tile.flip} />
                <span className="absolute bottom-[0.35em] end-[0.35em] flex h-[1.5em] w-[1.5em] items-center justify-center rounded-full bg-white/90 text-[#0e5e6f]">
                  <Camera className="h-[0.9em] w-[0.9em]" />
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="mx-[0.9em] mt-[0.7em] overflow-hidden rounded-[1.3em] bg-white shadow-[0_1px_2px_rgba(19,38,43,0.06)]">
          <div className="px-[1em] py-[0.75em]">
            <div className="flex items-center justify-between font-semibold">
              <span>{t("mockFuel")}</span>
              <span>¾</span>
            </div>
            <div className="mt-[0.45em] h-[0.55em] overflow-hidden rounded-full bg-[#e3eeec]">
              <div className="h-full w-3/4 rounded-full bg-[#0e5e6f]" />
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-[#dbe9e6] px-[1em] py-[0.75em] font-semibold">
            <span>{t("mockKm")}</span>
            <span className="tabular-nums">{number(48210)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[#dbe9e6] px-[1em] py-[0.75em] font-semibold">
            <span>{t("mockCustomerSigned")}</span>
            <span className="flex h-[1.5em] w-[1.5em] items-center justify-center rounded-full bg-[#ddf0e4] text-[#2b6b47]">
              <Check className="h-[1em] w-[1em]" strokeWidth={3} />
            </span>
          </div>
        </div>
        <div className="mx-[0.9em] mt-auto pb-[1.6em]">
          <span className="flex w-full items-center justify-center rounded-full bg-[#0e5e6f] py-[0.85em] text-[1.05em] font-bold text-white">{t("mockFinish")}</span>
        </div>
      </div>
    </PhoneFrame>
  );
}

/* ── Getting paid ───────────────────────────────────────────────────────── */

export async function PaymentPhoneMock({ className = "" }: { className?: string }) {
  const { t, baht } = await kit();
  return (
    <PhoneFrame className={className} label={t("mockPaymentLabel")}>
      <div className="flex h-full flex-col bg-[#f3f8f7]">
        <StatusBar />
        <div className="mx-[0.9em] mt-[2em] rounded-[1.4em] bg-white p-[1.1em] text-center shadow-[0_1px_2px_rgba(19,38,43,0.06),0_10px_24px_rgba(14,94,111,0.1)]">
          <p className="font-semibold text-[#4b5f63]">{t("mockScanToPay")}</p>
          <p className="mt-[0.1em] text-[2em] font-semibold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            {baht(5600)}
          </p>
          <div className="mx-auto mt-[0.8em] w-[62%] rounded-[0.8em] border-[0.15em] border-[#dbe9e6] p-[0.5em]">
            <FakeQr className="block w-full" />
          </div>
          <p className="mt-[0.6em] text-[0.95em] font-bold tracking-[0.02em] text-[#173e5e]">PromptPay</p>
        </div>
        <div className="mx-[0.9em] mt-[0.8em] flex items-start gap-[0.7em] rounded-[1.3em] bg-white p-[0.9em] shadow-[0_1px_2px_rgba(19,38,43,0.06),0_14px_30px_rgba(19,38,43,0.12)]">
          <span className="flex h-[2.3em] w-[2.3em] shrink-0 items-center justify-center rounded-full bg-[#ddf0e4] text-[#2b6b47]">
            <Check className="h-[1.3em] w-[1.3em]" strokeWidth={3} />
          </span>
          <span className="min-w-0">
            <span className="block font-bold leading-tight">{t("mockSlipMatched")}</span>
            <span className="block text-[#4b5f63]">{baht(5600)} · Anna Becker</span>
          </span>
        </div>
        <div className="mx-[0.9em] mt-[0.6em] flex items-center justify-between rounded-[1.3em] bg-white px-[0.9em] py-[0.75em] font-semibold shadow-[0_1px_2px_rgba(19,38,43,0.06)]">
          <span>{t("mockDepositHeld")}</span>
          <span>{baht(3000)}</span>
        </div>
        <div className="mx-[0.9em] mt-[0.6em] flex items-center justify-between rounded-[1.3em] bg-white px-[0.9em] py-[0.75em] font-semibold shadow-[0_1px_2px_rgba(19,38,43,0.06)]">
          <span>{t("mockReceiptSent")}</span>
          <span className="flex h-[1.5em] w-[1.5em] items-center justify-center rounded-full bg-[#ddf0e4] text-[#2b6b47]">
            <Check className="h-[1em] w-[1em]" strokeWidth={3} />
          </span>
        </div>
      </div>
    </PhoneFrame>
  );
}

/** The small "paid" card that floats beside the hero picture. */
export async function PaidToast({ className = "" }: { className?: string }) {
  const { t, baht } = await kit();
  return (
    <div aria-hidden="true" className={`${s.floatCard} flex items-center gap-3 px-4 py-3 ${className}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--success-light)] text-[var(--success)]">
        <Check size={18} strokeWidth={3} />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-bold leading-tight text-[var(--foreground)]">{t("mockPaidToast", { amount: baht(5600) })}</span>
        <span className="block text-[14px] leading-tight text-[var(--muted)]">{t("mockSlipMatched")}</span>
      </span>
    </div>
  );
}

/* ── An owner's monthly statement ───────────────────────────────────────── */

export async function StatementPhoneMock({ className = "" }: { className?: string }) {
  const { t, baht, date } = await kit();
  const lines = [
    { label: t("mockRentals"), detail: t("mockRentalCount", { count: 4 }), amount: baht(38400) },
    { label: t("mockCosts"), detail: t("mockCostsDetail"), amount: `−${baht(3200)}` },
    { label: t("mockOperatorShare"), detail: "30%", amount: `−${baht(10560)}` }
  ];
  return (
    <PhoneFrame className={className} label={t("mockStatementLabel")}>
      <div className="flex h-full flex-col bg-[#f3f8f7]">
        <StatusBar />
        <div className="px-[1.2em] pt-[1.6em]">
          <p className="font-semibold text-[#4b5f63]">{date("2026-10-15", { month: "long", year: "numeric" })}</p>
          <p className="text-[1.6em] font-semibold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            {t("mockStatement")}
          </p>
        </div>
        <div className="mx-[0.9em] mt-[0.9em] flex items-center gap-[0.8em] rounded-[1.3em] bg-white p-[0.9em] shadow-[0_1px_2px_rgba(19,38,43,0.06)]">
          <span className="flex h-[3em] w-[4.2em] shrink-0 items-center justify-center rounded-[0.8em] bg-[#e3eeec]">
            <CarArt className="w-[3.4em]" colour="#2f4448" />
          </span>
          <span>
            <span className="block font-bold">Toyota Fortuner</span>
            <span className="block text-[#4b5f63]">Palm Car Rental</span>
          </span>
        </div>
        <div className="mx-[0.9em] mt-[0.7em] overflow-hidden rounded-[1.3em] bg-white shadow-[0_1px_2px_rgba(19,38,43,0.06)]">
          {lines.map((line, index) => (
            <div className={`flex items-center justify-between gap-[0.6em] px-[1em] py-[0.8em] ${index ? "border-t border-[#dbe9e6]" : ""}`} key={line.label}>
              <span className="min-w-0">
                <span className="block font-semibold">{line.label}</span>
                <span className="block text-[0.9em] text-[#4b5f63]">{line.detail}</span>
              </span>
              <span className="font-bold tabular-nums">{line.amount}</span>
            </div>
          ))}
        </div>
        <div className="mx-[0.9em] mt-[0.7em] rounded-[1.3em] bg-[#0e5e6f] p-[1em] text-white">
          <p className="font-semibold opacity-85">{t("mockYourShare")}</p>
          <p className="text-[2em] font-semibold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            {baht(24640)}
          </p>
        </div>
      </div>
    </PhoneFrame>
  );
}
