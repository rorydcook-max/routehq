"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { fetchVehicleMakesForCategory, fetchVehicleModels, fetchVehicleTrims } from "@/lib/vehicle-catalog-db";
import type { VehicleMake, VehicleModel, VehicleTrim } from "@/lib/vehicle-catalog-db";
import { Card, Fold } from "@/components/ui";
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
const inputCls =
  "mt-1 w-full rounded-xl border border-[var(--border-strong)] bg-white px-3 py-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";
const labelCls = "block text-sm font-medium text-[var(--foreground-secondary)]";

const VERDICT_TONE: Record<Verdict, string> = {
  strong: "bg-[var(--success)] text-white",
  good: "bg-[var(--success)] text-white",
  thin: "bg-[var(--warning)] text-white",
  no: "bg-[var(--danger)] text-white"
};

function Num({ label, value, onChange, hint, suffix }: { label: string; value: number; onChange: (value: number) => void; hint?: string; suffix?: string }) {
  return (
    <label className={labelCls}>
      {label}
      <span className="relative block">
        <input
          className={inputCls + (suffix ? " pr-12" : "")}
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
    const format = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 });
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
  const [saved, setSaved] = useState<SavedCalc[]>(initialSavedCalcs);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [searching, setSearching] = useState(false);
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [searchFailed, setSearchFailed] = useState(false);

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
      setAssumptions(compose(research, Number(researchKey.split("@")[1]) || price, next, price));
      return;
    }
    setBusy(true);
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
    } catch {
      found = null;
    }
    setResearch(found);
    setSources(pages);
    setPlace(where);
    setResearchKey(`${key}@${foundAt}`);
    setSubject(next);
    setAssumptions(compose(found, foundAt, next, price));
    setBusy(false);
    requestAnimationFrame(() => document.getElementById("calc-result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
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
      setSearchFailed(Boolean(reply.failed || reply.unavailable));
    } catch {
      setListings([]);
      setSearchFailed(true);
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
    setResearch(listing);
    setSources(listing.url ? [{ url: listing.url, title: listing.title || listing.source || "" }] : []);
    setResearchKey(`${[next.category, next.make, next.model, next.year, "", Number(listing.mileage_km) || 0].join("|")}@${listing.price}`);
    setSubject(next);
    setAssumptions(figures);
    setSaveState("idle");
    requestAnimationFrame(() => document.getElementById("calc-result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const own = subject
    ? fleetVehicles.find((v) => v.monthlyRate > 0 && v.make.toLowerCase() === subject.make.toLowerCase() && v.model.toLowerCase() === subject.model.toLowerCase())
    : undefined;
  const best = outcome?.expected.best;
  // "Only at a better price" for one of two reasons: the return is too low, or it is fine in a normal year but loses in a slow one.
  const slowYearOnly = Boolean(outcome && outcome.verdict === "thin" && outcome.expected.returnPct >= 10);
  const target = assumptions && outcome && !slowYearOnly && (outcome.verdict === "thin" || outcome.verdict === "no") ? priceForReturn(assumptions, 10) : null;
  const comparable = saved.filter((row) => typeof row.results?.perYear === "number").sort((a, b) => b.results!.perYear - a.results!.perYear);
  const subjectName = subject ? [subject.year, subject.make, subject.model].join(" ") : "";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="p-4">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {CATEGORIES.map((code) => (
            <button
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${category === code ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-strong)] bg-white text-[var(--foreground-secondary)]"}`}
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
          ) : (
            <span />
          )}
          <Num label={t("price")} onChange={setPrice} suffix={currency} value={price} />
          <Num label={t("mileage")} onChange={setMileage} suffix="km" value={mileage} />
        </div>

        <p className={labelCls + " mt-4"}>{t("howRent")}</p>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {(["monthly", "daily", "mix"] as RentStyle[]).map((option) => (
            <button
              className={`rounded-xl border px-2 py-3 text-sm font-semibold ${style === option ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border-strong)] bg-white text-[var(--foreground-secondary)]"}`}
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

        <button className="btn-primary mt-5 w-full justify-center py-3 text-base disabled:opacity-50" disabled={!ready || busy} onClick={workItOut} type="button">
          {busy ? t("working") : t("workItOut")}
        </button>
        {busy ? <p className="mt-2 text-center text-sm text-[var(--foreground-muted)]">{t("workingHint")}</p> : null}
      </Card>

      {assumptions && outcome && best && subject ? (
        <>
          <Card className="p-4">
            <div id="calc-result" className="scroll-mt-4" />
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-[var(--foreground-secondary)]">
                {subjectName} · {money(assumptions.price)}
              </p>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${VERDICT_TONE[outcome.verdict]}`}>{say(`verdict_${outcome.verdict}`)}</span>
            </div>
            <p className={`mt-3 text-3xl font-bold ${best.perYear >= 0 ? "text-[var(--foreground)]" : "text-[var(--danger)]"}`}>
              {best.perYear >= 0 ? say("makes", { amount: about(best.perYear) }) : say("loses", { amount: about(-best.perYear) })}
            </p>
            <p className="mt-2 text-sm text-[var(--foreground-secondary)]">
              {say(best.year === 1 ? "sellAfterOne" : "sellAfter", { years: best.year, value: about(best.value), profit: about(best.profit) })}
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-[var(--surface-muted,#f6f7f9)] p-3">
                <dt className="text-[var(--foreground-muted)]">{assumptions.financed ? t("returnOnCash") : t("returnOnCost")}</dt>
                <dd className="mt-1 text-lg font-bold">{say("pctYear", { pct: (assumptions.financed ? outcome.expected.cashReturnPct : outcome.expected.returnPct).toFixed(1) })}</dd>
              </div>
              <div className="rounded-xl bg-[var(--surface-muted,#f6f7f9)] p-3">
                <dt className="text-[var(--foreground-muted)]">{t("moneyBack")}</dt>
                <dd className="mt-1 text-lg font-bold">
                  {outcome.expected.paybackMonths ? say("monthsCount", { months: outcome.expected.paybackMonths }) : t("notFromRent")}
                </dd>
              </div>
              <div className="rounded-xl bg-[var(--surface-muted,#f6f7f9)] p-3">
                <dt className="text-[var(--foreground-muted)]">{financed ? t("monthlyAfterLoan") : t("monthlyFirstYear")}</dt>
                <dd className="mt-1 text-lg font-bold">{about(outcome.expected.firstYearMonthly)}</dd>
              </div>
              <div className="rounded-xl bg-[var(--surface-muted,#f6f7f9)] p-3">
                <dt className="text-[var(--foreground-muted)]">{t("range")}</dt>
                <dd className="mt-1 text-lg font-bold">
                  {about(outcome.cautious.best.perYear)} – {about(outcome.upside.best.perYear)}
                </dd>
              </div>
            </dl>

            {target || slowYearOnly ? (
              <p className="mt-4 rounded-xl border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-3 text-sm font-medium">
                {slowYearOnly ? t("slowYear") : say("payNoMore", { amount: money(target || 0) })}
              </p>
            ) : null}
            {research?.market_price_low && research?.market_price_high ? (
              <p className="mt-3 text-sm text-[var(--foreground-secondary)]">
                {say(
                  assumptions.price > research.market_price_high * 1.02 ? "marketAbove" : assumptions.price < research.market_price_low * 0.98 ? "marketBelow" : "marketWithin",
                  { low: money(research.market_price_low), high: money(research.market_price_high) }
                )}
              </p>
            ) : null}
            {own ? (
              <p className="mt-3 text-sm text-[var(--foreground-secondary)]">
                {say("ownRate", { model: subject.model, amount: money(own.monthlyRate) })}{" "}
                {style === "monthly" && own.monthlyRate !== assumptions.rentMonthly ? (
                  <button className="font-semibold text-[var(--primary)] underline" onClick={() => change({ rentMonthly: own.monthlyRate, rentLow: Math.round(own.monthlyRate * 0.9), rentHigh: Math.round(own.monthlyRate * 1.1) })} type="button">
                    {t("useIt")}
                  </button>
                ) : null}
              </p>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-3">
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
                <p className="mt-2 text-sm text-[var(--foreground-secondary)]">{searchFailed ? t("othersFailed") : t("othersNone")}</p>
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
                          {[listing.mileage_km ? `${Number(listing.mileage_km).toLocaleString(locale)} km` : "", listing.location, listing.source].filter(Boolean).join(" · ")}
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

          <Fold title={t("figures")} summary={research ? say("figuresFrom", { place: place || "-" }) : t("figuresUsual")}>
            {research?.notes?.length ? (
              <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-[var(--foreground-secondary)]">
                {research.notes.slice(0, 4).map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <Num hint={t("rentHint")} label={t("rent")} onChange={(value) => change({ rentMonthly: value })} value={assumptions.rentMonthly} />
              <Num hint={t("occupancyHint")} label={t("occupancy")} onChange={(value) => change({ occupancy: Math.min(100, value) })} suffix="%" value={assumptions.occupancy} />
              <Num label={t("insurance")} onChange={(value) => change({ insurance: value })} value={assumptions.insurance} />
              <Num label={t("taxes")} onChange={(value) => change({ tax: value, compulsory: 0 })} value={assumptions.tax + assumptions.compulsory} />
              <Num label={t("maintenance")} onChange={(value) => change({ maintenance: value })} value={assumptions.maintenance} />
              <Num label={t("maintenanceGrowth")} onChange={(value) => change({ maintenanceGrowthPct: value })} suffix="%" value={assumptions.maintenanceGrowthPct} />
              <Num hint={t("otherHint")} label={t("other")} onChange={(value) => change({ otherMonthly: value })} value={assumptions.otherMonthly} />
              <Num hint={t("buyingHint")} label={t("buying")} onChange={(value) => change({ buyingCosts: value })} value={assumptions.buyingCosts} />
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
