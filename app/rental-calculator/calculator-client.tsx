"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchVehicleMakesForCategory, fetchVehicleModels, fetchVehicleTrims } from "@/lib/vehicle-catalog-db";
import type { VehicleMake, VehicleModel, VehicleTrim } from "@/lib/vehicle-catalog-db";
import { useLocale, useTranslations } from "next-intl";
import { Badge, Card, SectionHeader } from "@/components/ui";

type Say = (key: string, values?: Record<string, string | number>) => string;

// ── Types ────────────────────────────────────────────────────────────────────

type VehicleSelection = {
  make: string;
  model: string;
  year: string;
  trim: string;
};

type AiEstimates = {
  insurance_annual: number;
  porbor_annual: number;
  tax_annual: number;
  maintenance_annual: number;
  depreciation_annual: number;
  reliability_score: number;
};

type CalcResults = {
  monthlyRevenue: number;
  monthlyExpenses: number;
  monthlyNetProfit: number;
  paybackMonths: number;
  score: number;
  recommendation: "strong_buy" | "buy" | "marginal" | "dont_buy";
  confidence: number;
  rationale: { key: string; values: Record<string, string | number> };
  chartData: Array<{ month: number; profit: number }>;
};

export type FleetVehicle = {
  id: string;
  make: string;
  model: string;
  plate: string;
  utilization: number;
  profit: number;
  monthlyRate: number;
};

export type SavedCalc = {
  id: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_trim: string | null;
  purchase_price: number | null;
  recommendation: string | null;
  confidence_score: number | null;
  results: Record<string, unknown> | null;
  created_at: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(v);

const inputCls =
  "mt-1 w-full rounded-xl border border-[var(--border-strong)] bg-white px-3 py-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

function normalizeMatch(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function yearsFromTrims(trims: VehicleTrim[]) {
  const thisYear = new Date().getFullYear();
  const years = new Set<number>();
  trims.forEach((t) => {
    const end = Math.min(t.year_to ?? thisYear + 1, thisYear + 1);
    for (let y = end; y >= t.year_from; y--) years.add(y);
  });
  return Array.from(years).sort((a, b) => b - a);
}

function trimCoversYear(t: VehicleTrim, year: string) {
  const y = Number(year);
  if (!y) return true;
  return y >= t.year_from && y <= (t.year_to ?? new Date().getFullYear() + 1);
}

function computeResults(
  vehicle: VehicleSelection,
  purchasePrice: number,
  financed: boolean,
  downPayment: number,
  monthlyPayment: number,
  estimatedRate: number,
  utilization: number,
  ai: AiEstimates
): CalcResults | null {
  if (!purchasePrice || purchasePrice <= 0) return null;

  const monthlyRevenue = estimatedRate * (utilization / 100);
  const monthlyFixed = (ai.insurance_annual + ai.porbor_annual + ai.tax_annual + ai.maintenance_annual) / 12;
  const monthlyDepreciation = ai.depreciation_annual / 12;
  const monthlyFinance = financed ? monthlyPayment : 0;
  const monthlyExpenses = monthlyFixed + monthlyDepreciation + monthlyFinance;
  const monthlyNetProfit = monthlyRevenue - monthlyExpenses;

  const effectivePrice = financed ? Math.max(0, purchasePrice - downPayment) : purchasePrice;
  const paybackMonths = monthlyNetProfit > 0 ? effectivePrice / monthlyNetProfit : Infinity;

  const score = (monthlyNetProfit / (purchasePrice / 36)) * 100;

  let recommendation: CalcResults["recommendation"];
  let baseConfidence: number;

  if (score > 15 && paybackMonths < 24) {
    recommendation = "strong_buy";
    baseConfidence = 80 + Math.min(20, (score - 15) * 1.5);
  } else if (score > 8 && paybackMonths < 36) {
    recommendation = "buy";
    baseConfidence = 60 + Math.min(19, (score - 8) * 2);
  } else if (score > 0 && paybackMonths < 48) {
    recommendation = "marginal";
    baseConfidence = 40 + Math.min(19, score * 2);
  } else {
    recommendation = "dont_buy";
    baseConfidence = 20 + Math.min(19, Math.max(0, score + 5));
  }

  const reliabilityAdjust = ((ai.reliability_score - 50) / 50) * 10;
  const confidence = Math.round(Math.min(100, Math.max(10, baseConfidence + reliabilityAdjust)));

  const rationale = buildRationale(recommendation, score, paybackMonths, ai.reliability_score, vehicle);

  const chartData = Array.from({ length: 37 }, (_, i) => ({
    month: i,
    profit: Math.round(monthlyNetProfit * i)
  }));

  return { monthlyRevenue, monthlyExpenses, monthlyNetProfit, paybackMonths, score, recommendation, confidence, rationale, chartData };
}

function buildRationale(
  rec: CalcResults["recommendation"],
  score: number,
  paybackMonths: number,
  reliability: number,
  vehicle: VehicleSelection
) {
  const years = (paybackMonths / 12).toFixed(1);
  const rel = reliability >= 80 ? "very" : reliability >= 60 ? "ok" : "low";
  const values: Record<string, string | number> = { years };
  if (rec === "strong_buy" || rec === "buy") return { key: `why_buy_${rel}`, values };
  if (rec === "marginal") return { key: "why_marginal", values };
  return { key: score <= 0 ? "why_loses" : "why_slow", values };
}

// ── Vehicle Selector (uses same catalog functions as vehicle-identity-fields) ─

function VehicleSelectorMini({
  value,
  onChange
}: {
  value: VehicleSelection;
  onChange: (v: VehicleSelection) => void;
}) {
  const [makes, setMakes] = useState<VehicleMake[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [trims, setTrims] = useState<VehicleTrim[]>([]);
  const [makeSearch, setMakeSearch] = useState("");
  const [makeOpen, setMakeOpen] = useState(false);
  const [selectedMakeId, setSelectedMakeId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [loadingMakes, setLoadingMakes] = useState(true);
  const t = useTranslations("calc") as unknown as Say;

  const filteredMakes = makeSearch
    ? makes.filter((m) => normalizeMatch(m.name).includes(normalizeMatch(makeSearch)))
    : makes;

  const catalogYears = yearsFromTrims(trims);
  const visibleTrims = trims.filter((t) => trimCoversYear(t, value.year));

  useEffect(() => {
    setLoadingMakes(true);
    fetchVehicleMakesForCategory("car")
      .then(setMakes)
      .catch(() => {})
      .finally(() => setLoadingMakes(false));
  }, []);

  useEffect(() => {
    if (!selectedMakeId) { setModels([]); return; }
    fetchVehicleModels(selectedMakeId, "car")
      .then(setModels)
      .catch(() => {});
  }, [selectedMakeId]);

  useEffect(() => {
    if (!selectedModelId) { setTrims([]); return; }
    fetchVehicleTrims(selectedModelId)
      .then(setTrims)
      .catch(() => {});
  }, [selectedModelId]);

  function selectMake(m: VehicleMake) {
    setSelectedMakeId(m.id);
    setSelectedModelId("");
    setModels([]);
    setTrims([]);
    setMakeOpen(false);
    setMakeSearch("");
    onChange({ make: m.name, model: "", year: "", trim: "" });
  }

  function selectModel(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    const m = models.find((x) => x.id === id);
    setSelectedModelId(id);
    setTrims([]);
    onChange({ ...value, model: m?.name ?? "", year: "", trim: "" });
  }

  function selectYear(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) {
    onChange({ ...value, year: e.target.value, trim: "" });
  }

  function selectTrim(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    const t = visibleTrims.find((x) => x.id === id);
    onChange({ ...value, trim: t?.name ?? "" });
  }

  return (
    <div className="space-y-4">
      {/* Make */}
      <div className="relative">
        <label className="block">
          <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{t("make")}</span>
          <button
            className="mt-1 flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border-strong)] bg-white px-3 py-3 text-left text-base outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
            onClick={() => setMakeOpen((o) => !o)}
            type="button"
          >
            <span className={value.make ? "font-semibold text-[var(--foreground)]" : "text-[var(--muted)]"}>
              {loadingMakes ? t("loading") : value.make || t("pickMake")}
            </span>
            <span className="text-[var(--muted)]">▾</span>
          </button>
        </label>
        {makeOpen && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-xl">
            <div className="border-b p-3">
              <input
                autoFocus
                className="w-full rounded-xl border border-[var(--border-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                onChange={(e) => setMakeSearch(e.target.value)}
                placeholder={t("searchMake")}
                value={makeSearch}
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {filteredMakes.map((m) => (
                <button
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--panel-secondary)]"
                  key={m.id}
                  onClick={() => selectMake(m)}
                  type="button"
                >
                  {m.name}
                  <span className="ml-auto text-xs uppercase text-[var(--muted)]">{m.origin_country || ""}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Model */}
      <label className="block">
        <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{t("model")}</span>
        <select
          className={inputCls}
          disabled={!selectedMakeId}
          onChange={selectModel}
          value={selectedModelId}
        >
          <option value="">{selectedMakeId ? t("pickModel") : t("makeFirst")}</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </label>

      {/* Year */}
      <label className="block">
        <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{t("year")}</span>
        {catalogYears.length > 0 ? (
          <select className={inputCls} onChange={selectYear} value={value.year}>
            <option value="">{t("pickYear")}</option>
            {catalogYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        ) : (
          <input
            className={inputCls}
            min="1990"
            max={new Date().getFullYear() + 1}
            onChange={selectYear}
            placeholder={String(new Date().getFullYear() - 2)}
            type="number"
            value={value.year}
          />
        )}
      </label>

      {/* Trim */}
      <label className="block">
        <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{t("trim")}</span>
        {visibleTrims.length > 0 ? (
          <select
            className={inputCls}
            onChange={selectTrim}
            value={visibleTrims.find((t) => t.name === value.trim)?.id ?? ""}
          >
            <option value="">{t("pickTrim")}</option>
            {visibleTrims.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        ) : (
          <input
            className={inputCls}
            onChange={(e) => onChange({ ...value, trim: e.target.value })}
            placeholder="Smart, E85, GLS"
            value={value.trim}
          />
        )}
      </label>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function CalculatorClient({
  organizationId,
  fleetAvgUtilization,
  measuredUtilization = null,
  fleetVehicles,
  initialSavedCalcs
}: {
  organizationId: string;
  fleetAvgUtilization: number;
  /** The fleet's real 12-month average, or null without history. */
  measuredUtilization?: number | null;
  fleetVehicles: FleetVehicle[];
  initialSavedCalcs: SavedCalc[];
}) {
  // Vehicle identity
  const [vehicle, setVehicle] = useState<VehicleSelection>({ make: "", model: "", year: "", trim: "" });

  // Purchase details
  const [purchasePrice, setPurchasePrice] = useState("");
  const [financed, setFinanced] = useState(false);
  const [downPayment, setDownPayment] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const loanTermMonths = "60";

  // Rental assumptions
  const [estimatedRate, setEstimatedRate] = useState("");
  const estimatedRateRef = useRef("");
  estimatedRateRef.current = estimatedRate;
  const [utilization, setUtilization] = useState(String(fleetAvgUtilization));
  const intendedUse = "mixed";

  // AI estimates
  const [aiEstimates, setAiEstimates] = useState<AiEstimates>({
    insurance_annual: 35000,
    porbor_annual: 1800,
    tax_annual: 3500,
    maintenance_annual: 24000,
    depreciation_annual: 60000,
    reliability_score: 72
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLoaded, setAiLoaded] = useState(false);
  const [aiError, setAiError] = useState("");

  // Results
  const [results, setResults] = useState<CalcResults | null>(null);

  // Saved calculations
  const [savedCalcs, setSavedCalcs] = useState<SavedCalc[]>(initialSavedCalcs);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useTranslations("calc") as unknown as Say;
  const locale = useLocale();

  // ── AI estimation ──────────────────────────────────────────────────────────
  const prevAiKey = useRef("");
  useEffect(() => {
    const { make, model, year, trim } = vehicle;
    if (!make || !model || !year) return;
    const key = [make, model, year, trim].join("|");
    if (key === prevAiKey.current) return;
    prevAiKey.current = key;

    setAiLoading(true);
    setAiError("");
    setAiLoaded(false);

    fetch("/api/calculator/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ make, model, year, trim })
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setAiError(data.error);
        } else {
          setAiEstimates({
            insurance_annual: data.insurance_annual,
            porbor_annual: data.porbor_annual,
            tax_annual: data.tax_annual,
            maintenance_annual: data.maintenance_annual,
            depreciation_annual: data.depreciation_annual,
            reliability_score: data.reliability_score
          });
          setAiLoaded(true);

          // Suggest a rate from your own similar vehicles, only if the rate is
          // still empty *now* (the reply can arrive after you've typed one), and
          // only from vehicles that have a rate (a missing rate isn't ฿0).
          if (!estimatedRateRef.current) {
            const priced = fleetVehicles.filter((v) => v.monthlyRate > 0 && v.make.toLowerCase() === make.toLowerCase());
            const sameModel = priced.filter((v) => v.model.toLowerCase() === model.toLowerCase());
            const similar = sameModel.length ? sameModel : priced;
            if (similar.length > 0) {
              const avgRate = Math.round(similar.reduce((s, v) => s + v.monthlyRate, 0) / similar.length);
              if (avgRate > 0) setEstimatedRate(String(avgRate));
            }
          }
        }
      })
      .catch(() => setAiError(t("estFailed")))
      .finally(() => setAiLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.make, vehicle.model, vehicle.year, vehicle.trim]);

  // ── Debounced calculation ─────────────────────────────────────────────────
  const recalculate = useCallback(() => {
    const price = Number(purchasePrice);
    const rate = Number(estimatedRate);
    const util = Number(utilization);
    const down = Number(downPayment);
    const mPayment = Number(monthlyPayment);

    const r = computeResults(
      vehicle,
      price,
      financed,
      down,
      mPayment,
      rate,
      util,
      aiEstimates
    );
    setResults(r);
  }, [vehicle, purchasePrice, financed, downPayment, monthlyPayment, estimatedRate, utilization, aiEstimates]);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(recalculate, 500);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [recalculate]);

  // ── Save calculation ──────────────────────────────────────────────────────
  async function handleSave() {
    if (!results) return;
    setSaving(true);
    setSaveMsg("");

    try {
      const resp = await fetch("/api/calculator/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_make: vehicle.make || null,
          vehicle_model: vehicle.model || null,
          vehicle_year: vehicle.year ? Number(vehicle.year) : null,
          vehicle_trim: vehicle.trim || null,
          purchase_price: Number(purchasePrice) || null,
          inputs: { purchasePrice, financed, downPayment, monthlyPayment, loanTermMonths, estimatedRate, utilization, intendedUse },
          ai_estimates: aiEstimates,
          results: { ...results, chartData: undefined },
          recommendation: results.recommendation,
          confidence_score: results.confidence
        })
      });

      if (resp.ok) {
        setSaveMsg("saved");
        // Refresh the saved list (add a placeholder entry)
        const newEntry: SavedCalc = {
          id: crypto.randomUUID(),
          vehicle_make: vehicle.make || null,
          vehicle_model: vehicle.model || null,
          vehicle_year: vehicle.year ? Number(vehicle.year) : null,
          vehicle_trim: vehicle.trim || null,
          purchase_price: Number(purchasePrice) || null,
          recommendation: results.recommendation,
          confidence_score: results.confidence,
          results: { monthlyNetProfit: results.monthlyNetProfit, paybackMonths: results.paybackMonths },
          created_at: new Date().toISOString()
        };
        setSavedCalcs((prev) => [newEntry, ...prev].slice(0, 5));
      } else {
        setSaveMsg("failed");
      }
    } catch {
      setSaveMsg("failed");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(""), 3000);
    }
  }

  // ── Load saved calculation ────────────────────────────────────────────────
  function loadSaved(calc: SavedCalc) {
    if (calc.vehicle_make) setVehicle({ make: calc.vehicle_make, model: calc.vehicle_model ?? "", year: calc.vehicle_year ? String(calc.vehicle_year) : "", trim: calc.vehicle_trim ?? "" });
    if (calc.purchase_price) setPurchasePrice(String(calc.purchase_price));
    setSaveMsg("");
  }

  // ── Fleet comparison ──────────────────────────────────────────────────────
  const similarVehicles = vehicle.make
    ? fleetVehicles.filter((v) => v.make.toLowerCase() === vehicle.make.toLowerCase())
    : [];

  // ── Recommendation display helpers ────────────────────────────────────────
  const recLabel: Record<CalcResults["recommendation"], string> = {
    strong_buy: t("rec_buy"),
    buy: t("rec_buy"),
    marginal: t("rec_marginal"),
    dont_buy: t("rec_no")
  };
  const recColor: Record<CalcResults["recommendation"], string> = {
    strong_buy: "text-[var(--success)] bg-[var(--success-light)] border-[var(--success-line)]",
    buy: "text-[var(--success)] bg-[var(--success-light)] border-[var(--success-line)]",
    marginal: "text-[var(--warning)] bg-[var(--warning-light)] border-[var(--warning-line)]",
    dont_buy: "text-[var(--danger)] bg-[var(--danger-light)] border-[var(--danger-line)]"
  };

  const vehicleIdentified = Boolean(vehicle.make && vehicle.model && vehicle.year);

  // ── Sensitivity table rows ─────────────────────────────────────────────────
  const sensitivityRows = [40, 60, 80, 100].map((util) => {
    const rev = Number(estimatedRate) * (util / 100);
    const fixed = (aiEstimates.insurance_annual + aiEstimates.porbor_annual + aiEstimates.tax_annual + aiEstimates.maintenance_annual) / 12;
    const dep = aiEstimates.depreciation_annual / 12;
    const fin = financed ? Number(monthlyPayment) : 0;
    const exp = fixed + dep + fin;
    const profit = rev - exp;
    const price = Number(purchasePrice);
    const effectivePrice = financed ? Math.max(0, price - Number(downPayment)) : price;
    const payback = profit > 0 ? Math.round(effectivePrice / profit) : null;
    return { util, rev, profit, payback };
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Two-column layout: inputs left, results right */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* ── LEFT: Inputs ────────────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Vehicle identity */}
          <Card>
            <SectionHeader title={t("s_vehicle")} />
            <div className="mt-4">
              <VehicleSelectorMini value={vehicle} onChange={setVehicle} />
            </div>
          </Card>

          {/* Purchase details */}
          <Card>
            <SectionHeader title={t("s_buy")} />
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{t("price")}</span>
                <input
                  className={inputCls}
                  min="0"
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="520,000"
                  type="number"
                  value={purchasePrice}
                />
              </label>

              {/* Finance toggle */}
              <label className="flex cursor-pointer items-center gap-3">
                <div
                  className={`relative h-6 w-11 rounded-full transition-colors ${financed ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}
                  onClick={() => setFinanced((f) => !f)}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${financed ? "translate-x-5" : "translate-x-0.5"}`}
                  />
                </div>
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{t("loan")}</span>
              </label>

              {financed && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{t("down")}</span>
                    <input className={inputCls} min="0" onChange={(e) => setDownPayment(e.target.value)} placeholder="100,000" step="0.01" type="number" value={downPayment} />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{t("instalment")}</span>
                    <input className={inputCls} min="0" onChange={(e) => setMonthlyPayment(e.target.value)} placeholder="8,500" step="0.01" type="number" value={monthlyPayment} />
                  </label>
                </div>
              )}
            </div>
          </Card>

          {/* Rental assumptions */}
          <Card>
            <SectionHeader title={t("s_earn")} />
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{t("rate")}</span>
                <input className={inputCls} min="0" onChange={(e) => setEstimatedRate(e.target.value)} placeholder="25,000" step="0.01" type="number" value={estimatedRate} />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">
                  {t("util")}
                  <span className="mt-0.5 block text-sm font-normal text-[var(--muted)]">
                    {measuredUtilization === null
                      ? t("utilNone")
                      : measuredUtilization < 20
                        ? t("utilThin", { percent: measuredUtilization })
                        : t("utilAvg", { percent: measuredUtilization })}
                  </span>
                </span>
                <input
                  className={inputCls}
                  max="100"
                  min="0"
                  onChange={(e) => setUtilization(e.target.value)}
                  placeholder={String(fleetAvgUtilization)}
                  type="number"
                  value={utilization}
                />
              </label>
            </div>
          </Card>

          {/* AI estimates panel */}
          <Card>
            <SectionHeader title={t("s_costs")} />
            {/* One line with the total. The five figures behind it are estimated for the model and can be opened and changed. */}
            <p className="mt-2 text-[17px] font-bold text-[var(--foreground)]">
              {aiLoading ? t("estimating") : t("costsYear", { amount: fmt(aiEstimates.insurance_annual + aiEstimates.porbor_annual + aiEstimates.tax_annual + aiEstimates.maintenance_annual + aiEstimates.depreciation_annual) })}
            </p>
            <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">
              {vehicleIdentified && aiLoaded ? t("costsFor") : t("costsTypical")}
            </p>
            {aiError && (
              <p className="mt-3 rounded-lg bg-[var(--danger-light)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">{aiError}</p>
            )}

            <details className="mt-2">
              <summary className="cursor-pointer py-1 font-semibold text-[var(--primary)]">{t("costsChange")}</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {(
                [
                  { key: "insurance_annual", label: t("c_ins") },
                  { key: "porbor_annual", label: t("c_porbor") },
                  { key: "tax_annual", label: t("c_tax") },
                  { key: "maintenance_annual", label: t("c_maint") },
                  { key: "depreciation_annual", label: t("c_dep") }
                ] as Array<{ key: keyof AiEstimates; label: string }>
              ).map(({ key, label }) => (
                <label className="block" key={key}>
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">
                    {label}
                  </span>
                  <input
                    className={inputCls}
                    min="0"
                    onChange={(e) =>
                      setAiEstimates((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                    }
                    type="number"
                    value={aiEstimates[key]}
                  />
                </label>
              ))}
            </div>
            </details>
          </Card>
        </div>

        {/* ── RIGHT: Results ───────────────────────────────────────────────── */}
        <div className="space-y-5">
          {!results ? (
            <Card>
              <div className="flex min-h-48 items-center justify-center text-center">
                <div>
                  <p className="text-lg font-bold text-[var(--foreground)]">{t("emptyTitle")}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{t("emptyBody")}</p>
                </div>
              </div>
            </Card>
          ) : (
            <>
              {/* Recommendation card */}
              <Card>
                <div className={`rounded-2xl border-2 p-5 text-center ${recColor[results.recommendation]}`}>
                  <p className="text-3xl font-semibold tracking-tight">{recLabel[results.recommendation]}</p>
                  {vehicle.make && vehicle.model && (
                    <p className="mt-1 text-sm font-semibold opacity-80">{vehicle.make} {vehicle.model} {vehicle.year}</p>
                  )}
                  <p className="mt-3 text-sm font-medium opacity-90">{t(results.rationale.key, results.rationale.values)}</p>
                </div>
              </Card>

              {/* Detailed breakdown */}
              <Card>
                <SectionHeader title={t("s_month")} />
                <div className="mt-4 space-y-3">
                  {[
                    { label: t("in"), value: results.monthlyRevenue, positive: true },
                    { label: t("out"), value: results.monthlyExpenses, positive: false },
                    { label: t("profit"), value: results.monthlyNetProfit, positive: results.monthlyNetProfit >= 0 }
                  ].map(({ label, value, positive }) => (
                    <div className="flex items-center justify-between" key={label}>
                      <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{label}</span>
                      <span className={`font-mono-data font-bold ${positive ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                        {fmt(value)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-[var(--border)] pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{t("payback")}</span>
                      <span className="font-mono-data font-bold text-[var(--foreground)]">
                        {isFinite(results.paybackMonths)
                          ? t("paybackValue", { months: Math.round(results.paybackMonths), years: (results.paybackMonths / 12).toFixed(1) })
                          : t("never")}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* 36-month chart */}
              <Card>
                <SectionHeader title={t("s_chart")} />
                <div className="mt-4">
                  <ResponsiveContainer height={220} width="100%">
                    <LineChart data={results.chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#dce3eb" />
                      <XAxis
                        dataKey="month"
                        label={{ value: t("monthAxis"), position: "insideBottom", offset: -2, fontSize: 11 }}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        tickFormatter={(v: number) => `฿${(v / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(v: unknown) => [fmt(Number(v)), t("profit")]}
                        labelFormatter={(l: unknown) => `${t("monthAxis")} ${l}`}
                      />
                      <ReferenceLine
                        label={{ value: t("breakEven"), position: "insideTopRight", fontSize: 11, fill: "var(--danger)" }}
                        stroke="#a04b36"
                        strokeDasharray="4 4"
                        y={0}
                      />
                      <Line dataKey="profit" dot={false} stroke="#24456b" strokeWidth={2} type="monotone" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Sensitivity table */}
              <Card>
                <SectionHeader title={t("s_sens")} />
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[360px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted)]">
                        <th className="py-2 pr-3">{t("th_time")}</th>
                        <th className="px-3 py-2">{t("th_in")}</th>
                        <th className="px-3 py-2">{t("th_profit")}</th>
                        <th className="px-3 py-2">{t("payback")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sensitivityRows.map(({ util, rev, profit, payback }) => (
                        <tr className="border-b border-[var(--border)] last:border-0" key={util}>
                          <td className="font-mono-data py-3 pr-3 font-semibold">{util}%</td>
                          <td className="font-mono-data px-3 py-3 text-[var(--success)]">{fmt(rev)}</td>
                          <td className={`font-mono-data px-3 py-3 font-semibold ${profit >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                            {fmt(profit)}
                          </td>
                          <td className="font-mono-data px-3 py-3 text-[var(--muted)]">
                            {payback !== null ? t("months", { count: payback }) : t("neverShort")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Fleet comparison */}
              {similarVehicles.length > 0 && (
                <Card>
                  <SectionHeader title={t("s_similar")} />
                  <div className="mt-4 space-y-3">
                    {similarVehicles.map((v) => {
                      const approxMonthlyProfit = v.profit / 36;
                      return (
                        <div className="rounded-xl border border-[var(--border)] p-3" key={v.id}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-[var(--foreground)]">{v.make} {v.model}</p>
                            <span className="font-mono-data text-xs text-[var(--muted)]">{v.plate}</span>
                          </div>
                          <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
                            {t("similarLine", { percent: v.utilization, profit: fmt(approxMonthlyProfit) })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Save button */}
              <div className="flex items-center gap-3">
                <button
                  className="pressable inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white shadow disabled:opacity-50"
                  disabled={saving}
                  onClick={handleSave}
                  type="button"
                >
                  {saving ? t("saving") : t("save")}
                </button>
                {saveMsg && (
                  <span className={`text-sm font-semibold ${saveMsg === "failed" ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>
                    {saveMsg === "failed" ? t("saveFailed") : t("saved")}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Saved calculations panel ──────────────────────────────────────── */}
      {savedCalcs.length > 0 && (
        <Card>
          <SectionHeader title={t("s_saved")} />
          <div className="mt-4 space-y-3">
            {savedCalcs.map((calc) => {
              const monthlyProfit = (calc.results as any)?.monthlyNetProfit ?? null;
              const payback = (calc.results as any)?.paybackMonths ?? null;
              const recBadgeTone = calc.recommendation === "strong_buy" || calc.recommendation === "buy"
                ? "green"
                : calc.recommendation === "marginal"
                  ? "amber"
                  : "red";
              const recBadgeLabel = calc.recommendation === "strong_buy" || calc.recommendation === "buy"
                ? t("rec_buy")
                : calc.recommendation === "marginal"
                  ? t("rec_marginal")
                  : t("rec_no");

              return (
                <div
                  className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-[var(--border)] p-4 hover:border-[var(--primary)] hover:bg-[var(--primary-light)] transition-colors"
                  key={calc.id}
                  onClick={() => loadSaved(calc)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && loadSaved(calc)}
                >
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">
                      {[calc.vehicle_make, calc.vehicle_model, calc.vehicle_year].filter(Boolean).join(" ") || t("unknown")}
                      {calc.vehicle_trim && <span className="ml-2 text-xs text-[var(--muted)]">{calc.vehicle_trim}</span>}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
                      {calc.purchase_price && <span>{fmt(Number(calc.purchase_price))}</span>}
                      {monthlyProfit !== null && (
                        <span className={Number(monthlyProfit) >= 0 ? "text-[var(--success)] font-semibold" : "text-[var(--danger)] font-semibold"}>
                          {t("perMonth", { amount: fmt(Number(monthlyProfit)) })}
                        </span>
                      )}
                      {payback !== null && isFinite(Number(payback)) && (
                        <span>{t("payback")} {t("months", { count: Math.round(Number(payback)) })}</span>
                      )}
                      <span>{new Date(calc.created_at).toLocaleDateString(locale === "en" ? "en-GB" : locale, { day: "numeric", month: "short", year: "numeric" })}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {calc.recommendation && <Badge tone={recBadgeTone as "green" | "amber" | "red"}>{recBadgeLabel}</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
