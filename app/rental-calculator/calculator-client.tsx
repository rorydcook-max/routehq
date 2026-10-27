"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { fetchVehicleMakesForCategory, fetchVehicleModels, fetchVehicleTrims } from "@/lib/vehicle-catalog-db";
import type { VehicleMake, VehicleModel, VehicleTrim } from "@/lib/vehicle-catalog-db";
import { Card, Fold } from "@/components/ui";
import { longDate, numberLocale } from "@/lib/i18n/dates";
import { buildAssumptions, evaluate, flatResaleCurve, yearlyLossPct } from "@/lib/vehicle-investment";
import type { Assumptions, Outcome, RentStyle, Research, Verdict } from "@/lib/vehicle-investment";

type Say = (key: string, values?: Record<string, string | number>) => string;

export type FleetVehicle = { id: string; make: string; model: string; plate: string; utilization: number; monthlyRate: number };

export type SavedCalc = {
  id: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_trim: string | null;
  purchase_price: number | null;
  recommendation: string | null;
  results: Record<string, any> | null;
  created_at: string;
};

type Source = { url: string; title: string };
type Subject = { category: string; make: string; model: string; year: number; trim: string };
type Listing = Research & {
  title?: string;
  make: string;
  model: string;
  year?: number;
  trim?: string;
  price: number;
  mileage_km?: number | null;
  location?: string;
  source?: string;
  url?: string | null;
  why?: string;
};

const CATEGORIES = ["car", "scooter", "motorcycle", "van", "atv", "ebike"];
const OTHER = "__other";
// The global field style (44px, regular weight).
const inputCls = "mt-1 w-full";
const labelCls = "block text-sm font-medium text-[var(--foreground-secondary)]";

const VERDICT_TONE: Record<Verdict, string> = {
  strong: "bg-[var(--success)] text-white",
  good: "bg-[var(--success)] text-white",
  thin: "bg-[var(--warning)] text-white",
  no: "bg-[var(--danger)] text-white"
};

function Num({ label, value, onChange, hint, suffix, prefix }: { label: string; value: number; onChange: (value: number) => void; hint?: string; suffix?: string; prefix?: string }) {
  return (
    <label className={labelCls}>
      {label}
      <span className="relative block">
        {/* Money shows its sign in front, as amounts are written everywhere else. */}
        {prefix ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 pt-1 font-semibold text-[var(--foreground-secondary)]">{prefix}</span> : null}
        <input
          className={inputCls + (suffix ? " pr-12" : "") + (prefix ? " !pl-8" : "")}
          inputMode="decimal"
          min={0}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
          type="number"
          value={Number.isFinite(value) && value !== 0 ? value : ""}
          placeholder="0"
        />
        {suffix ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 pt-1 text-sm text-[var(--foreground-muted)]">{suffix}</span> : null}
      </span>
      {hint ? <span className="mt-1 block text-xs font-normal text-[var(--foreground-muted)]">{hint}</span> : null}
    </label>
  );
}


/** One titled block of the result: the owner's question, then its answer. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 border-t border-[var(--border)] pt-4">
      <h3 className="text-[15px] font-bold text-[var(--foreground)]">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-[var(--surface-muted,#f6f7f9)] p-3">
      <dt className="text-[var(--foreground-muted)]">{label}</dt>
      <dd className="mt-1 text-lg font-bold">{value}</dd>
      {hint ? <dd className="mt-0.5 text-xs text-[var(--foreground-muted)]">{hint}</dd> : null}
    </div>
  );
}

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[var(--foreground-secondary)]">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

/** Where the price asked sits between the cheapest and dearest adverts; the tick is the typical price. */
function RangeBar({ low, high, typical, price }: { low: number; high: number; typical: number; price: number }) {
  const span = Math.max(1, high - low);
  const at = (value: number) => Math.round(Math.min(1, Math.max(0, (value - low) / span)) * 100);
  return (
    <div className="relative mt-3 h-2 rounded-full bg-[var(--panel-tertiary)]">
      <span aria-hidden className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 bg-[var(--foreground-muted)]" style={{ left: `${at(typical)}%` }} />
      <span aria-hidden className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--primary)] shadow" style={{ left: `${at(price)}%` }} />
    </div>
  );
}

/** Five dots, filled up to the count: reliability at a glance. */
function Dots({ count }: { count: number }) {
  return (
    <span aria-label={`${count} / 5`} className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <span className={`h-2.5 w-2.5 rounded-full ${n <= count ? (count >= 4 ? "bg-[var(--success)]" : count >= 3 ? "bg-[var(--warning)]" : "bg-[var(--danger)]") : "bg-[var(--panel-tertiary)]"}`} key={n} />
      ))}
    </span>
  );
}

/** What the look-up is doing, so a minute of waiting does not look like nothing is happening. */
function ResearchProgress({ elapsed, say }: { elapsed: number; say: Say }) {
  const steps = [
    { key: "step_rent", from: 0 },
    { key: "step_adverts", from: 15 },
    { key: "step_costs", from: 30 },
    { key: "step_sums", from: 50 }
  ];
  // Moves quickly at first and slows near the end, never claiming to be finished.
  const pct = Math.min(95, Math.round(100 * (1 - Math.exp(-elapsed / 35))));
  return (
    <div aria-live="polite" id="calc-progress" className="mt-4 scroll-mt-24 rounded-xl border border-[var(--border)] bg-[var(--surface-muted,#f6f7f9)] p-4">
      <div className="h-2 w-full overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-[var(--primary)] transition-all duration-1000 ease-out" style={{ width: `${Math.max(6, pct)}%` }} />
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {steps.map((step, index) => {
          const next = steps[index + 1];
          const done = next ? elapsed >= next.from : false;
          const now = elapsed >= step.from && !done;
          return (
            <li className={`flex items-center gap-2 ${done ? "text-[var(--success)]" : now ? "font-semibold text-[var(--foreground)]" : "text-[var(--foreground-muted)]"}`} key={step.key}>
              <span aria-hidden className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${done ? "border-[var(--success)] bg-[var(--success)] text-[10px] text-white" : now ? "animate-pulse border-[var(--primary)] bg-[var(--primary)]/20" : "border-[var(--border-strong)]"}`}>
                {done ? "✓" : ""}
              </span>
              {say(step.key)}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-[var(--foreground-muted)]">{say("workingHint")}</p>
    </div>
  );
}

/** The most that can be paid for it and still earn the target yearly return. What it sells for later does not change with the price paid. */
function priceForReturn(a: Assumptions, targetPct: number) {
  if (a.financed) return null;
  const at = (price: number) => evaluate({ ...a, price, resalePct: a.resalePct.map((value) => (value * a.price) / price) }).expected.returnPct;
  let low = a.price * 0.3;
  let high = a.price;
  if (at(low) < targetPct) return null;
  for (let step = 0; step < 24; step++) {
    const mid = (low + high) / 2;
    if (at(mid) >= targetPct) low = mid;
    else high = mid;
  }
  return Math.floor(low / 1000) * 1000;
}

export function CalculatorClient({
  currency,
  defaultStyle,
  defaultCategory,
  fleetVehicles,
  initialSavedCalcs
}: {
  currency: string;
  defaultStyle: RentStyle;
  defaultCategory: string;
  fleetVehicles: FleetVehicle[];
  initialSavedCalcs: SavedCalc[];
}) {
  const t = useTranslations("calc");
  const say = t as unknown as Say;
  const locale = useLocale();
  const money = useMemo(() => {
    const format = new Intl.NumberFormat(numberLocale(locale), { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 });
    return (value: number) => format.format(Math.round(value));
  }, [locale, currency]);
  // Worked-out figures are estimates, so they are shown rounded rather than to the last unit.
  const about = (value: number) => {
    const size = Math.abs(value);
    const step = size >= 100000 ? 1000 : size >= 10000 ? 100 : 10;
    return money(Math.round(value / step) * step);
  };
  const thisYear = new Date().getFullYear();

  // ── What they are thinking of buying ──
  const [category, setCategory] = useState(defaultCategory);
  const [makes, setMakes] = useState<VehicleMake[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [trims, setTrims] = useState<VehicleTrim[]>([]);
  const [makeId, setMakeId] = useState("");
  const [modelId, setModelId] = useState("");
  const [makeText, setMakeText] = useState("");
  const [modelText, setModelText] = useState("");
  const [year, setYear] = useState(thisYear);
  const [trim, setTrim] = useState("");
  /** Tapped "Work it out" before filling enough in: the hint under the button turns red instead of the button just not working. */
  const [triedEarly, setTriedEarly] = useState(false);
  const [price, setPrice] = useState(0);
  const [mileage, setMileage] = useState(0);
  const [style, setStyle] = useState<RentStyle>(defaultStyle);
  const [financed, setFinanced] = useState(false);
  const [downPayment, setDownPayment] = useState(0);
  const [monthlyPayment, setMonthlyPayment] = useState(0);
  const [loanMonths, setLoanMonths] = useState(48);

  // ── What came back ──
  const [busy, setBusy] = useState(false);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [assumptions, setAssumptions] = useState<Assumptions | null>(null);
  const [research, setResearch] = useState<Research | null>(null);
  const [researchKey, setResearchKey] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [place, setPlace] = useState("");
  const [platform, setPlatform] = useState<{ businesses: number; scope: string } | null>(null);
  const [saved, setSaved] = useState<SavedCalc[]>(initialSavedCalcs);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [searching, setSearching] = useState(false);
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [searchFailed, setSearchFailed] = useState<false | "failed" | "offline">(false);
  const [lookedUp, setLookedUp] = useState<{ how: string; checkedAt: string } | null>(null);
  // Seconds since the look-up started, for the progress shown while it runs.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    let live = true;
    setMakes([]);
    setMakeId("");
    setModelId("");
    fetchVehicleMakesForCategory(category)
      .then((rows) => live && setMakes(rows))
      .catch(() => live && setMakes([]));
    return () => {
      live = false;
    };
  }, [category]);

  useEffect(() => {
    let live = true;
    setModels([]);
    setModelId("");
    if (makeId && makeId !== OTHER) {
      fetchVehicleModels(makeId, category)
        .then((rows) => live && setModels(rows))
        .catch(() => live && setModels([]));
    }
    return () => {
      live = false;
    };
  }, [makeId, category]);

  useEffect(() => {
    let live = true;
    setTrims([]);
    setTrim("");
    if (modelId && modelId !== OTHER) {
      fetchVehicleTrims(modelId)
        .then((rows) => live && setTrims(rows))
        .catch(() => live && setTrims([]));
    }
    return () => {
      live = false;
    };
  }, [modelId]);

  const makeName = makeId === OTHER ? makeText.trim() : makes.find((m) => m.id === makeId)?.name || "";
  const modelName = makeId === OTHER || modelId === OTHER ? modelText.trim() : models.find((m) => m.id === modelId)?.name || "";
  const years = Array.from({ length: 17 }, (_, index) => thisYear + 1 - index);
  const trimChoices = trims.filter((item) => year >= item.year_from && year <= (item.year_to ?? thisYear + 1));
  const ready = Boolean(makeName && modelName && price > 0) && (!financed || (monthlyPayment > 0 && loanMonths > 0));

  const outcome: Outcome | null = useMemo(() => (assumptions ? evaluate(assumptions) : null), [assumptions]);

  function compose(found: Research | null, foundAtPrice: number, forSubject: Subject, atPrice: number) {
    // What it sells for later is a fact about the vehicle, not the deal: a lower price paid means it keeps a larger share.
    const adjusted =
      found?.resale_pct_by_year && foundAtPrice > 0 && atPrice > 0
        ? { ...found, resale_pct_by_year: found.resale_pct_by_year.map((value) => (Number(value) * foundAtPrice) / atPrice) }
        : found;
    return buildAssumptions({
      category: forSubject.category,
      price: atPrice,
      ageNow: Math.max(0, thisYear - forSubject.year),
      style,
      financed,
      downPayment,
      monthlyPayment,
      loanMonths,
      research: adjusted
    });
  }

  async function workItOut() {
    if (!ready || busy) return;
    const next: Subject = { category, make: makeName, model: modelName, year, trim };
    const key = [category, makeName, modelName, year, trim, mileage].join("|");
    setSaveState("idle");
    setListings(null);
    if (key === researchKey.split("@")[0]) {
      setSubject(next);
      setAssumptions(withOwnRate(compose(research, Number(researchKey.split("@")[1]) || price, next, price), next));
      return;
    }
    setBusy(true);
    // On a phone the progress sits below the button, out of sight: bring it into view.
    window.setTimeout(() => document.getElementById("calc-progress")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    let found: Research | null = null;
    let pages: Source[] = [];
    let where = "";
    let foundAt = price;
    try {
      const response = await fetch("/api/calculator/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...next, price, mileage, locale })
      });
      const reply = await response.json();
      found = reply.research || null;
      pages = reply.sources || [];
      where = reply.place || "";
      foundAt = Number(reply.atPrice) || price;
      setPlatform(reply.platform || null);
      setLookedUp(reply.how ? { how: String(reply.how), checkedAt: String(reply.checkedAt || "") } : null);
    } catch {
      found = null;
    }
    setResearch(found);
    setSources(pages);
    setPlace(where);
    setResearchKey(`${key}@${foundAt}`);
    setSubject(next);
    setAssumptions(withOwnRate(compose(found, foundAt, next, price), next));
    setBusy(false);
    requestAnimationFrame(() => document.getElementById("calc-result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  /** The operator's own price for this model beats anything found online: it is what their customers really pay. */
  function ownVehicle(forSubject: Subject) {
    return fleetVehicles.find((v) => v.monthlyRate > 0 && v.make.toLowerCase() === forSubject.make.toLowerCase() && v.model.toLowerCase() === forSubject.model.toLowerCase());
  }
  function withOwnRate(figures: Assumptions, forSubject: Subject): Assumptions {
    const mine = style === "monthly" ? ownVehicle(forSubject) : undefined;
    return mine ? { ...figures, rentMonthly: mine.monthlyRate, rentLow: Math.round(mine.monthlyRate * 0.9), rentHigh: Math.round(mine.monthlyRate * 1.1) } : figures;
  }
  /** Changing the rent moves the slow-year and good-year rents with it. */
  function setRent(value: number) {
    setAssumptions((current) => {
      if (!current) return current;
      const ratio = current.rentMonthly > 0 ? value / current.rentMonthly : 1;
      return { ...current, rentMonthly: value, rentLow: Math.round((current.rentLow || current.rentMonthly * 0.85) * ratio), rentHigh: Math.round((current.rentHigh || current.rentMonthly * 1.15) * ratio) };
    });
    setSaveState("idle");
  }

  function change(patch: Partial<Assumptions>) {
    setAssumptions((current) => (current ? { ...current, ...patch } : current));
    setSaveState("idle");
  }

  async function save() {
    if (!assumptions || !outcome || !subject) return;
    setSaveState("saving");
    const best = outcome.expected.best;
    const results = { perYear: Math.round(best.perYear), bestYear: best.year, profit: Math.round(best.profit), returnPct: Math.round(outcome.expected.returnPct * 10) / 10, value: Math.round(best.value) };
    const row = {
      vehicle_make: subject.make,
      vehicle_model: subject.model,
      vehicle_year: subject.year,
      vehicle_trim: subject.trim || null,
      purchase_price: assumptions.price,
      inputs: { category: subject.category, style, assumptions },
      ai_estimates: research || {},
      results,
      recommendation: outcome.verdict,
      confidence_score: research?.confidence === "high" ? 85 : research?.confidence === "medium" ? 65 : research ? 40 : 25
    };
    try {
      const response = await fetch("/api/calculator/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(row) });
      if (!response.ok) throw new Error();
      setSaved((list) => [{ ...row, id: `new-${Date.now()}`, created_at: new Date().toISOString() }, ...list]);
      setSaveState("saved");
    } catch {
      setSaveState("idle");
    }
  }

  async function findOthers() {
    if (!assumptions || !subject || searching) return;
    setSearching(true);
    setSearchFailed(false);
    setListings(null);
    try {
      const response = await fetch("/api/calculator/alternatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget: assumptions.price, category: subject.category, style, locale, considering: `${subject.year} ${subject.make} ${subject.model}`, reference: research })
      });
      const reply = await response.json();
      setListings(Array.isArray(reply.listings) ? reply.listings : []);
      setSearchFailed(reply.offline || reply.unavailable ? "offline" : reply.failed ? "failed" : false);
    } catch {
      setListings([]);
      setSearchFailed("failed");
    }
    setSearching(false);
  }

  const ranked = useMemo(() => {
    if (!listings || !subject) return [];
    return listings
      .map((listing) => {
        const listingYear = Number(listing.year) || thisYear;
        const figures = buildAssumptions({
          category: subject.category,
          price: Number(listing.price),
          ageNow: Math.max(0, thisYear - listingYear),
          style,
          financed: false,
          downPayment: 0,
          monthlyPayment: 0,
          loanMonths: 0,
          research: listing
        });
        return { listing, figures, result: evaluate(figures) };
      })
      .sort((a, b) => b.result.expected.best.perYear - a.result.expected.best.perYear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, subject, style]);

  function lookAt(item: (typeof ranked)[number]) {
    const { listing, figures } = item;
    const next: Subject = { category: subject?.category || category, make: listing.make, model: listing.model, year: Number(listing.year) || thisYear, trim: listing.trim || "" };
    setMakeId(OTHER);
    setMakeText(listing.make);
    setModelText(listing.model);
    setYear(next.year);
    setPrice(Number(listing.price));
    setMileage(Number(listing.mileage_km) || 0);
    setFinanced(false);
    setPlatform(null);
    setResearch(listing);
    setSources(listing.url ? [{ url: listing.url, title: listing.title || listing.source || "" }] : []);
    setResearchKey(`${[next.category, next.make, next.model, next.year, "", Number(listing.mileage_km) || 0].join("|")}@${listing.price}`);
    setSubject(next);
    setAssumptions(figures);
    setSaveState("idle");
    requestAnimationFrame(() => document.getElementById("calc-result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const own = subject ? ownVehicle(subject) : undefined;
  const best = outcome?.expected.best;
  // "Only at a better price" for one of two reasons: the return is too low, or it is fine in a normal year but loses in a slow one.
  const slowYearOnly = Boolean(outcome && outcome.verdict === "thin" && outcome.expected.returnPct >= 10);
  const target = assumptions && outcome && !slowYearOnly && (outcome.verdict === "thin" || outcome.verdict === "no") ? priceForReturn(assumptions, 10) : null;
  const comparable = saved.filter((row) => typeof row.results?.perYear === "number").sort((a, b) => b.results!.perYear - a.results!.perYear);
  const subjectName = subject ? [subject.year, subject.make, subject.model].join(" ") : "";
  // Figures the result reads off: whether the web was really checked, where the price sits, running costs, what it's worth later.
  const liveData = Boolean(research) && sources.length > 0;
  const market = (() => {
    const low = Number(research?.market_price_low) || 0;
    const high = Number(research?.market_price_high) || 0;
    if (!(low > 0 && high >= low) || !assumptions) return null;
    const typical = Number(research?.market_price_typical) > 0 ? Number(research?.market_price_typical) : (low + high) / 2;
    const gap = assumptions.price - typical;
    const verdict = gap < -typical * 0.04 ? "below" : gap > typical * 0.04 ? "above" : "fair";
    return { low, high, typical, gap: Math.abs(gap), verdict };
  })();
  const runningYear = assumptions ? assumptions.insurance + assumptions.tax + assumptions.compulsory + assumptions.maintenance + assumptions.otherMonthly * 12 : 0;
  const worthAfter = outcome && best ? [1, 3, best.year].filter((year, index, all) => all.indexOf(year) === index && year <= outcome.expected.rows.length).map((year) => outcome.expected.rows[year - 1]) : [];

  return (
    // The form column (768px, left-aligned with the page gutter), as on every form.
    <div className="page-form space-y-4">
      <Card className="p-4">
        {/* Both pill groups on this card share one size and weight. */}
        <div className="chip-row flex flex-wrap gap-2">
          {CATEGORIES.map((code) => (
            <button
              className={`pressable min-h-11 shrink-0 whitespace-nowrap rounded-full border px-4 font-bold ${category === code ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-strong)] bg-white text-[var(--foreground)]"}`}
              key={code}
              onClick={() => setCategory(code)}
              type="button"
            >
              {say(`kind_${code}`)}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className={labelCls}>
            {t("make")}
            <select className={inputCls} onChange={(event) => setMakeId(event.target.value)} value={makeId}>
              <option value="">{t("choose")}</option>
              {makes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
              <option value={OTHER}>{t("notListed")}</option>
            </select>
          </label>
          {makeId === OTHER ? (
            <label className={labelCls}>
              {t("make")}
              <input className={inputCls} onChange={(event) => setMakeText(event.target.value)} value={makeText} />
            </label>
          ) : (
            <label className={labelCls}>
              {t("model")}
              <select className={inputCls} disabled={!makeId} onChange={(event) => setModelId(event.target.value)} value={modelId}>
                <option value="">{t("choose")}</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
                <option value={OTHER}>{t("notListed")}</option>
              </select>
            </label>
          )}
          {makeId === OTHER || modelId === OTHER ? (
            <label className={labelCls + " col-span-2"}>
              {t("model")}
              <input className={inputCls} onChange={(event) => setModelText(event.target.value)} value={modelText} />
            </label>
          ) : null}
          <label className={labelCls}>
            {t("year")}
            <select className={inputCls} onChange={(event) => setYear(Number(event.target.value))} value={year}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y === thisYear + 1 || y === thisYear ? `${y} · ${t("new")}` : y}
                </option>
              ))}
            </select>
          </label>
          {trimChoices.length > 0 ? (
            <label className={labelCls}>
              {t("version")}
              <select className={inputCls} onChange={(event) => setTrim(event.target.value)} value={trim}>
                <option value="">{t("any")}</option>
                {trimChoices.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {/* No empty half-row beside Year: the price moves up next to it when there is no version to choose. */}
          <Num label={t("price")} onChange={setPrice} prefix={currency === "THB" ? "฿" : currency} value={price} />
          <Num label={t("mileage")} onChange={setMileage} suffix="km" value={mileage} />
        </div>

        <p className={labelCls + " mt-4"}>{t("howRent")}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {(["monthly", "daily", "mix"] as RentStyle[]).map((option) => (
            <button
              className={`pressable min-h-11 whitespace-nowrap rounded-full border px-4 font-bold ${style === option ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-strong)] bg-white text-[var(--foreground)]"}`}
              key={option}
              onClick={() => setStyle(option)}
              type="button"
            >
              {say(`style_${option}`)}
            </button>
          ))}
        </div>

        <label className="mt-4 flex items-center gap-3 text-sm font-medium text-[var(--foreground)]">
          <input checked={financed} className="h-5 w-5" onChange={(event) => setFinanced(event.target.checked)} type="checkbox" />
          {t("onLoan")}
        </label>
        {financed ? (
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Num label={t("down")} onChange={setDownPayment} value={downPayment} />
            <Num label={t("perMonth")} onChange={setMonthlyPayment} value={monthlyPayment} />
            <Num label={t("months")} onChange={setLoanMonths} value={loanMonths} />
          </div>
        ) : null}

        {/* Always tappable: a pale disabled button gave no hint of what was missing. */}
        <button className="btn-primary mt-5 min-h-11 w-full justify-center" disabled={busy} onClick={() => (ready ? workItOut() : setTriedEarly(true))} type="button">
          {busy ? t("working") : t("workItOut")}
        </button>
        {!ready && !busy ? <p className={`mt-2 text-center text-sm font-semibold ${triedEarly ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>{t("needMore")}</p> : null}
        {busy ? <ResearchProgress elapsed={elapsed} say={say} /> : null}
      </Card>

      {assumptions && outcome && best && subject ? (
        <>
          <Card className="p-4">
            <div id="calc-result" className="scroll-mt-4" />
            {/* The verdict first, then where the figures came from: an owner should never have to guess whether a number was checked. */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--foreground-secondary)]">
                  {subjectName} · {money(assumptions.price)}
                </p>
                <p className={`mt-1 text-2xl font-bold sm:text-3xl ${best.perYear >= 0 ? "text-[var(--foreground)]" : "text-[var(--danger)]"}`}>
                  {best.perYear >= 0 ? say("makes", { amount: about(best.perYear) }) : say("loses", { amount: about(-best.perYear) })}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${VERDICT_TONE[outcome.verdict]}`}>{say(`verdict_${outcome.verdict}`)}</span>
            </div>
            <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-medium ${liveData ? "bg-[var(--success-light)] text-[var(--success)]" : "bg-[var(--warning-light)] text-[var(--warning)]"}`}>
              {liveData
                ? lookedUp?.how === "saved"
                  ? say("b_dataSaved", { date: longDate(lookedUp.checkedAt.slice(0, 10), locale), count: sources.length })
                  : say("b_dataLive", { count: sources.length })
                : research
                  ? t("b_dataKnowledge")
                  : t("b_dataUsual")}
            </p>
            {Number(research?.market_price_low) > 0 && assumptions.price > 0 && assumptions.price < Number(research?.market_price_low) * 0.5 ? (
              <p className="mt-3 rounded-xl border border-[var(--warning-line)] bg-[var(--warning-light)] px-3 py-2 font-semibold text-[var(--warning)]">
                {say("priceLooksLow", { vehicle: subjectName, low: money(Number(research?.market_price_low)) })}
              </p>
            ) : null}
            {target || slowYearOnly ? (
              <p className="mt-3 rounded-xl border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-3 text-sm font-medium">
                {slowYearOnly ? t("slowYear") : say("payNoMore", { amount: money(target || 0) })}
              </p>
            ) : null}

            {/* 1. Is the price fair? */}
            <Section title={t("b_priceTitle")}>
              {market ? (
                <>
                  <p className={`font-bold ${market.verdict === "above" ? "text-[var(--warning)]" : market.verdict === "below" ? "text-[var(--success)]" : "text-[var(--foreground)]"}`}>
                    {market.verdict === "below" ? say("b_priceBelow", { amount: about(market.gap) }) : market.verdict === "above" ? say("b_priceAbove", { amount: about(market.gap) }) : t("b_priceFair")}
                  </p>
                  <RangeBar high={market.high} low={market.low} price={assumptions.price} typical={market.typical} />
                  <p className="mt-2 text-xs text-[var(--foreground-muted)]">{say("b_priceRange", { low: money(market.low), typical: money(market.typical), high: money(market.high) })}</p>
                </>
              ) : (
                <p className="text-sm text-[var(--foreground-secondary)]">{t("b_priceUnknown")}</p>
              )}
            </Section>

            {/* 2. How it rents */}
            <Section title={t("b_rentsTitle")}>
              {research?.demand ? (
                <p className="text-sm">
                  <span className={`mr-2 rounded-full px-2.5 py-0.5 text-xs font-bold ${research.demand === "high" ? "bg-[var(--success-light)] text-[var(--success)]" : research.demand === "low" ? "bg-[var(--danger-light)] text-[var(--danger)]" : "bg-[var(--panel-tertiary)] text-[var(--foreground)]"}`}>
                    {t.has(`b_demand_${research.demand}`) ? say(`b_demand_${research.demand}`) : String(research.demand)}
                  </span>
                  <span className="text-[var(--foreground-secondary)]">{research.demand_note || ""}</span>
                </p>
              ) : null}
              <div className="mt-3 rounded-xl border border-[var(--border)] p-3">
                <Num
                  hint={
                    platform
                      ? say(platform.scope === "area" ? "platformArea" : "platformCountry", { count: platform.businesses, model: subject.model })
                      : own && style === "monthly" && own.monthlyRate === assumptions.rentMonthly
                        ? say("rentFromOwn", { model: subject.model })
                        : research
                          ? sources.length === 0 && research.confidence === "low"
                            ? t("rentFromKnowledge")
                            : t("rentFromWeb")
                          : t("rentFromUsual")
                  }
                  label={style === "daily" ? t("rentYoursDaily") : style === "mix" ? t("rentYoursMix") : t("rentYours")}
                  onChange={setRent}
                  suffix={currency === "THB" ? "฿" : currency}
                  value={assumptions.rentMonthly}
                />
              </div>
              <p className="mt-2 text-sm text-[var(--foreground-secondary)]">{say("b_occupancy", { pct: assumptions.occupancy, amount: about((assumptions.rentMonthly * assumptions.occupancy) / 100) })}</p>
              {research?.rates && Object.keys(research.rates).length ? (
                <div className="mt-3 rounded-xl bg-[var(--surface-muted,#f6f7f9)] p-3">
                  <p className="text-sm font-bold">{say("ratesTitle", { place: place || "-" })}</p>
                  <dl className="mt-2 space-y-1.5 text-sm">
                    {(["day", "week", "month"] as const).map((period) => {
                      const range = research.rates?.[period];
                      if (!range) return null;
                      return (
                        <div className="flex items-baseline justify-between gap-3" key={period}>
                          <dt className="text-[var(--foreground-secondary)]">{t(`per_${period}`)}</dt>
                          <dd className="text-right">
                            <span className="font-bold">{money(range.low)} – {money(range.high)}</span>
                            <span className="block text-xs text-[var(--foreground-muted)]">{say("ratesAverage", { amount: money(range.average) })}</span>
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                  <p className="mt-2 text-xs text-[var(--foreground-muted)]">
                    {say("ratesFrom", {
                      count: Object.values(research.rates).reduce((sum, range) => sum + (range?.count || 0), 0),
                      dropped: Object.values(research.rates).reduce((sum, range) => sum + (range?.dropped || 0), 0)
                    })}
                  </p>
                </div>
              ) : null}
              {own && own.monthlyRate !== assumptions.rentMonthly ? (
                <p className="mt-2 text-sm text-[var(--foreground-secondary)]">
                  {say("ownRate", { model: subject.model, amount: money(own.monthlyRate) })}{" "}
                  {style === "monthly" ? (
                    <button className="font-semibold text-[var(--primary)] underline" onClick={() => setRent(own.monthlyRate)} type="button">
                      {t("useIt")}
                    </button>
                  ) : null}
                </p>
              ) : null}
            </Section>

            {/* 3. What it would make */}
            <Section title={t("b_earnTitle")}>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Stat hint={t("b_perMonthHint")} label={financed ? t("monthlyAfterLoan") : t("b_perMonth")} value={about(outcome.expected.firstYearMonthly)} />
                <Stat hint={say("b_perYearHint", { years: best.year })} label={t("b_perYear")} value={about(best.perYear)} />
                <Stat label={say("b_total", { years: best.year })} value={about(best.profit)} />
                <Stat label={t("moneyBack")} value={outcome.expected.paybackMonths ? say("monthsCount", { months: outcome.expected.paybackMonths }) : t("notFromRent")} />
                <Stat
                  hint={say("b_returnHint", { amount: Math.round(assumptions.financed ? outcome.expected.cashReturnPct : outcome.expected.returnPct) })}
                  label={assumptions.financed ? t("returnOnCash") : t("b_return")}
                  value={say("pctYear", { pct: (assumptions.financed ? outcome.expected.cashReturnPct : outcome.expected.returnPct).toFixed(1) })}
                />
                <Stat label={t("b_range")} value={`${about(outcome.cautious.best.perYear)} – ${about(outcome.upside.best.perYear)}`} />
              </dl>
            </Section>

            {/* 4. Running costs */}
            <Section title={t("b_costsTitle")}>
              <dl className="space-y-1.5 text-sm">
                <CostRow label={t("b_costInsurance")} value={money(assumptions.insurance)} />
                <CostRow label={t("b_costTax")} value={money(assumptions.tax + assumptions.compulsory)} />
                <CostRow label={say("b_costService", { pct: assumptions.maintenanceGrowthPct })} value={money(assumptions.maintenance)} />
                {assumptions.otherMonthly > 0 ? <CostRow label={t("other")} value={money(assumptions.otherMonthly * 12)} /> : null}
              </dl>
              <p className="mt-2 font-bold">{say("b_costTotal", { year: about(runningYear), month: about(runningYear / 12) })}</p>
            </Section>

            {/* 5. Reliability and known issues */}
            {research && (research.reliability || research.parts || research.known_issues?.length) ? (
              <Section title={t("b_reliabilityTitle")}>
                {research.reliability ? (
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <Dots count={Math.round(Number(research.reliability))} />
                    <span className="font-semibold">{say(`b_rel_${Math.min(5, Math.max(1, Math.round(Number(research.reliability))))}`)}</span>
                    {research.parts && t.has(`b_parts_${research.parts}`) ? <span className="rounded-full bg-[var(--panel-tertiary)] px-2.5 py-0.5 text-xs font-bold">{say(`b_parts_${research.parts}`)}</span> : null}
                  </p>
                ) : null}
                {research.reliability_note ? <p className="mt-1 text-sm text-[var(--foreground-secondary)]">{research.reliability_note}</p> : null}
                {research.known_issues?.length ? (
                  <ul className="mt-3 space-y-2">
                    {research.known_issues.slice(0, 4).map((item, index) => (
                      <li className="flex items-start gap-2 text-sm" key={index}>
                        <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${item.severity === "serious" ? "bg-[var(--danger-light)] text-[var(--danger)]" : item.severity === "watch" ? "bg-[var(--warning-light)] text-[var(--warning)]" : "bg-[var(--panel-tertiary)] text-[var(--foreground-secondary)]"}`}>
                          {t.has(`b_sev_${item.severity || "minor"}`) ? say(`b_sev_${item.severity || "minor"}`) : String(item.severity || "")}
                        </span>
                        <span>
                          {item.issue}
                          {Number(item.typical_cost) > 0 ? <span className="text-[var(--foreground-muted)]"> · {say("b_issueCost", { amount: money(Number(item.typical_cost)) })}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-[var(--foreground-secondary)]">{t("b_issuesNone")}</p>
                )}
              </Section>
            ) : null}

            {/* 6. Value and other options */}
            {research && (research.value_note || research.alternatives?.length) ? (
              <Section title={t("b_valueTitle")}>
                {research.value_note ? <p className="text-sm text-[var(--foreground-secondary)]">{research.value_note}</p> : null}
                {research.alternatives?.length ? (
                  <>
                    <p className="mt-2 text-sm font-semibold">{t("b_altIntro")}</p>
                    <ul className="mt-1 space-y-2">
                      {research.alternatives.slice(0, 3).map((alt, index) => (
                        <li className="rounded-xl bg-[var(--surface-muted,#f6f7f9)] p-3 text-sm" key={index}>
                          <p className="font-bold">{alt.name}</p>
                          {Number(alt.typical_price) > 0 || Number(alt.rent_month) > 0 ? (
                            <p className="text-xs text-[var(--foreground-muted)]">{say("b_altLine", { price: money(Number(alt.typical_price) || 0), rent: money(Number(alt.rent_month) || 0) })}</p>
                          ) : null}
                          {alt.why ? <p className="mt-1 text-[var(--foreground-secondary)]">{alt.why}</p> : null}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-[var(--foreground-secondary)]">{t("b_altNone")}</p>
                )}
              </Section>
            ) : null}

            {/* 7. When to sell */}
            <Section title={t("b_sellTitle")}>
              <p className="font-bold">{say(best.year === 1 ? "sellAfterOne" : "sellAfter", { years: best.year, value: about(best.value), profit: about(best.profit) })}</p>
              <p className="mt-1 text-sm text-[var(--foreground-secondary)]">{t("b_sellWhy")}</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                {worthAfter.map((row) => (
                  <Stat key={row.year} label={say("b_worthAfter", { years: row.year })} value={about(row.value)} />
                ))}
              </dl>
              <p className="mt-2 text-xs text-[var(--foreground-muted)]">{say("b_lossPerYear", { pct: yearlyLossPct(assumptions.resalePct, best.year) })}</p>
            </Section>

            {research?.notes?.length ? (
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-[var(--foreground-secondary)]">
                {research.notes.slice(0, 4).map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            ) : null}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button className="btn-secondary justify-center py-3" disabled={saveState !== "idle"} onClick={save} type="button">
                {saveState === "saved" ? t("savedDone") : saveState === "saving" ? t("saving") : t("save")}
              </button>
              <button className="btn-secondary justify-center py-3" disabled={searching} onClick={findOthers} type="button">
                {searching ? t("searching") : t("findOthers")}
              </button>
            </div>
            {searching ? <p className="mt-2 text-center text-sm text-[var(--foreground-muted)]">{t("searchingHint")}</p> : null}
          </Card>

          {listings ? (
            <Card className="p-4">
              <h2 className="text-base font-bold">{say("othersTitle", { amount: money(assumptions.price) })}</h2>
              {ranked.length > 0 ? <p className="mt-1 text-xs text-[var(--foreground-muted)]">{t("othersNote")}</p> : null}
              {ranked.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--foreground-secondary)]">{searchFailed === "offline" ? t("othersOffline") : searchFailed ? t("othersFailed") : t("othersNone")}</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {ranked.map((item, index) => {
                    const { listing, result } = item;
                    const gap = result.expected.best.perYear - best.perYear;
                    const search = `https://www.google.com/search?q=${encodeURIComponent([listing.title || `${listing.year || ""} ${listing.make} ${listing.model}`, listing.source || ""].join(" "))}`;
                    return (
                      <li className="rounded-xl border border-[var(--border)] p-3" key={index}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-semibold">
                            {[listing.year, listing.make, listing.model, listing.trim].filter(Boolean).join(" ")}
                          </p>
                          <p className="shrink-0 font-bold">{money(Number(listing.price))}</p>
                        </div>
                        <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                          {[listing.mileage_km ? `${Number(listing.mileage_km).toLocaleString(numberLocale(locale))} km` : "", listing.location, listing.source].filter(Boolean).join(" · ")}
                        </p>
                        <p className="mt-2 text-sm">
                          {say("otherLine", { amount: about(result.expected.best.perYear), years: result.expected.best.year, pct: result.expected.returnPct.toFixed(1) })}
                        </p>
                        <p className={`text-sm font-semibold ${gap >= 0 ? "text-[var(--success)]" : "text-[var(--foreground-muted)]"}`}>
                          {say(gap >= 0 ? "otherMore" : "otherLess", { amount: about(Math.abs(gap)), model: subject.model })}
                        </p>
                        {listing.why ? <p className="mt-1 text-sm text-[var(--foreground-secondary)]">{listing.why}</p> : null}
                        <div className="mt-3 flex gap-4 text-sm font-semibold text-[var(--primary)]">
                          <a href={listing.url || search} rel="noopener noreferrer" target="_blank">
                            {listing.url ? say("openOn", { site: listing.source || new URL(listing.url).hostname.replace(/^www\./, "") }) : t("searchAdvert")}
                          </a>
                          <button onClick={() => lookAt(item)} type="button">
                            {t("fullFigures")}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          ) : null}

          <Fold title={t("yearByYear")} summary={say("yearSummary", { years: outcome.expected.rows.length })}>
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="text-xs text-[var(--foreground-muted)]">
                  <th className="py-2 text-left font-medium">{t("colSell")}</th>
                  <th className="py-2 font-medium">{t("colEarned")}</th>
                  <th className="py-2 font-medium">{t("colWorth")}</th>
                  <th className="py-2 font-medium">{t("colProfit")}</th>
                </tr>
              </thead>
              <tbody>
                {outcome.expected.rows.map((row) => (
                  <tr className={`border-t border-[var(--border)] ${row.year === best.year ? "bg-[var(--success)]/10 font-bold" : ""}`} key={row.year}>
                    <td className="py-2 text-left">{say("yearN", { n: row.year })}</td>
                    <td className="py-2">{about(row.operating)}</td>
                    <td className="py-2">{about(row.value)}</td>
                    <td className={`py-2 ${row.profit < 0 ? "text-[var(--danger)]" : ""}`}>{about(row.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-[var(--foreground-muted)]">{t("yearNote")}</p>
          </Fold>

          <Fold title={t("figures")} summary={research ? (liveData ? say("figuresFrom", { place: place || "-" }) : t("figuresRough")) : t("figuresUsual")}>
            <div className="grid grid-cols-2 gap-3">
              <Num hint={t("rentHint")} label={t("rent")} onChange={setRent} value={assumptions.rentMonthly} />
              <Num hint={t("occupancyHint")} label={t("occupancy")} onChange={(value) => change({ occupancy: Math.min(100, value) })} suffix="%" value={assumptions.occupancy} />
              <Num label={t("insurance")} onChange={(value) => change({ insurance: value })} value={assumptions.insurance} />
              <Num label={t("taxes")} onChange={(value) => change({ tax: value, compulsory: 0 })} value={assumptions.tax + assumptions.compulsory} />
              <Num label={t("maintenance")} onChange={(value) => change({ maintenance: value })} value={assumptions.maintenance} />
              <Num label={t("maintenanceGrowth")} onChange={(value) => change({ maintenanceGrowthPct: value })} suffix="%" value={assumptions.maintenanceGrowthPct} />
              <Num hint={t("otherHint")} label={t("other")} onChange={(value) => change({ otherMonthly: value })} value={assumptions.otherMonthly} />
              <Num hint={say("lossHint", { years: best.year, value: about(best.value) })} label={t("loss")} onChange={(value) => change({ resalePct: flatResaleCurve(value) })} suffix="%" value={yearlyLossPct(assumptions.resalePct, best.year)} />
              <Num hint={t("maxAgeHint")} label={t("maxAge")} onChange={(value) => change({ maxRentalAge: Math.max(assumptions.ageNow + 1, value) })} value={assumptions.maxRentalAge} />
            </div>
            {sources.length ? (
              <div className="mt-4">
                <p className="text-xs font-semibold text-[var(--foreground-muted)]">{t("sources")}</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {sources.slice(0, 8).map((source) => (
                    <li className="truncate" key={source.url}>
                      <a className="text-[var(--primary)] underline" href={source.url} rel="noopener noreferrer" target="_blank">
                        {source.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="mt-4 text-xs text-[var(--foreground-muted)]">{research ? say(`confidence_${research.confidence === "high" || research.confidence === "medium" ? research.confidence : "low"}`) : t("noResearch")}</p>
          </Fold>
        </>
      ) : null}

      {comparable.length > 0 ? (
        <Card className="p-4">
          <h2 className="text-base font-bold">{t("compare")}</h2>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {comparable.map((row, index) => (
              <li className="flex items-center justify-between gap-3 py-3" key={row.id}>
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {index === 0 && comparable.length > 1 ? "★ " : ""}
                    {[row.vehicle_year, row.vehicle_make, row.vehicle_model].filter(Boolean).join(" ")}
                  </p>
                  <p className="text-xs text-[var(--foreground-muted)]">
                    {money(Number(row.purchase_price || 0))} · {say("compareLine", { years: row.results!.bestYear, pct: row.results!.returnPct })}
                  </p>
                </div>
                <p className={`shrink-0 text-right font-bold ${row.results!.perYear < 0 ? "text-[var(--danger)]" : ""}`}>
                  {say("perYear", { amount: about(row.results!.perYear) })}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {assumptions ? <p className="px-1 text-center text-xs text-[var(--foreground-muted)]">{t("caveat")}</p> : null}
    </div>
  );
}
