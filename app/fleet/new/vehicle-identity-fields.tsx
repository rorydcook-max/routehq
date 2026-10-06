"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Fold } from "@/components/ui";
import {
  fetchVehicleMakesForCategory,
  fetchVehicleModels,
  fetchVehicleTrims,
  type VehicleMake,
  type VehicleModel,
  type VehicleTrim
} from "@/lib/vehicle-catalog-db";

type Category = {
  id: string;
  code: string;
  name: string;
};

type VinDecodeResult = {
  BodyClass?: string;
  DisplacementCC?: string;
  ErrorCode?: string;
  ErrorText?: string;
  Make?: string;
  Model?: string;
  ModelYear?: string;
  Seats?: string;
  TransmissionStyle?: string;
  Trim?: string;
};

function normalizeMatch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function yearsForTrims(trims: VehicleTrim[]) {
  const thisYear = new Date().getFullYear();
  const years = new Set<number>();

  trims.forEach((trim) => {
    const endYear = Math.min(trim.year_to || thisYear + 1, thisYear + 1);
    for (let year = endYear; year >= trim.year_from; year -= 1) {
      years.add(year);
    }
  });

  return Array.from(years).sort((left, right) => right - left);
}

function trimCoversYear(trim: VehicleTrim, yearValue: string) {
  const parsedYear = Number(yearValue);
  if (!parsedYear) {
    return true;
  }

  return parsedYear >= trim.year_from && parsedYear <= (trim.year_to || new Date().getFullYear() + 1);
}

function trimQualityScore(trim: VehicleTrim) {
  return [
    trim.name.length,
    trim.engine_cc ? 8 : 0,
    trim.transmission ? 8 : 0,
    trim.fuel_type ? 4 : 0,
    trim.seating_capacity ? 4 : 0,
    trim.drivetrain ? 8 : 0
  ].reduce((total, score) => total + score, 0);
}

function trimVariantCode(name: string) {
  const cleaned = name
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-zA-Z0-9. ]/g, " ")
    .trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const codeToken = tokens.find((token) => /[a-zA-Z]/.test(token) && !/^\d+(\.\d+)?L?$/i.test(token));
  return codeToken ? normalizeMatch(codeToken) : "";
}

function isShortLegacyTrim(trim: VehicleTrim) {
  const tokenCount = trim.name.replace(/\([^)]*\)/g, " ").split(/\s+/).filter(Boolean).length;
  return tokenCount <= 3 && !trim.transmission && !trim.drivetrain;
}

function dedupeTrimsForPicker(trims: VehicleTrim[]) {
  const withoutBundledRows = trims.filter((trim) => !trim.name.includes(" / "));
  const bestByName = new Map<string, VehicleTrim>();

  withoutBundledRows.forEach((trim) => {
    const key = normalizeMatch(trim.name);
    const existing = bestByName.get(key);
    if (!existing || trimQualityScore(trim) > trimQualityScore(existing)) {
      bestByName.set(key, trim);
    }
  });

  const exactDeduped = Array.from(bestByName.values());
  return exactDeduped.filter((trim) => {
    if (!isShortLegacyTrim(trim)) return true;
    const code = trimVariantCode(trim.name);
    if (!code) return true;
    return !exactDeduped.some((candidate) => {
      if (candidate.id === trim.id || isShortLegacyTrim(candidate)) return false;
      return trimVariantCode(candidate.name) === code && trimCoversYear(candidate, String(trim.year_from));
    });
  });
}

export function VehicleIdentityFields({
  categories,
  initialMakes,
  inputClass
}: {
  categories: Category[];
  initialMakes: VehicleMake[];
  inputClass: string;
}) {
  const t = useTranslations("vehicleForm");
  const say = t as unknown as (key: string) => string;
  const labelClass = "font-semibold text-[var(--foreground-secondary)]";
  const categoryLabel = (category: Category) => (t.has(`cat_${category.code}` as never) ? say(`cat_${category.code}`) : category.name);
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [trim, setTrim] = useState("");
  const [vin, setVin] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [color, setColor] = useState("");
  const [transmission, setTransmission] = useState("");
  const [seatingCapacity, setSeatingCapacity] = useState("");
  const [engineCc, setEngineCc] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [drivetrain, setDrivetrain] = useState("");
  const [bodyClass, setBodyClass] = useState("");
  const [taxExpiryDate, setTaxExpiryDate] = useState("");
  const [porborExpiryDate, setPorborExpiryDate] = useState("");
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState("");
  const [ocrStatus, setOcrStatus] = useState<"idle" | "reading" | "done" | "error">("idle");
  const [ocrMessage, setOcrMessage] = useState("");
  const [catalogStatus, setCatalogStatus] = useState<"loading" | "ready" | "error">(initialMakes.length > 0 ? "ready" : "loading");
  const [catalogMessage, setCatalogMessage] = useState("");
  const [makes, setMakes] = useState<VehicleMake[]>(initialMakes);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [trims, setTrims] = useState<VehicleTrim[]>([]);
  const [selectedMakeId, setSelectedMakeId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [selectedTrimId, setSelectedTrimId] = useState("");
  const [manualMake, setManualMake] = useState(false);
  const [manualModel, setManualModel] = useState(false);
  const [manualTrim, setManualTrim] = useState(false);
  const [makeDropdownOpen, setMakeDropdownOpen] = useState(false);
  const [makeSearch, setMakeSearch] = useState("");
  const [needMake, setNeedMake] = useState(false);

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const categoryCode = selectedCategory?.code || categories[0]?.code || "car";
  const categoryName = selectedCategory?.name?.toLowerCase() || "";
  const showMotorcycleFields =
    categoryCode === "motorcycle" ||
    categoryCode === "scooter" ||
    categoryName.includes("motorcycle") ||
    categoryName.includes("scooter");
  const catalogYears = useMemo(() => yearsForTrims(trims), [trims]);
  const visibleTrims = useMemo(() => dedupeTrimsForPicker(trims.filter((item) => trimCoversYear(item, year))), [trims, year]);
  const searchedMakes = useMemo(() => {
    const needle = normalizeMatch(makeSearch);
    return needle ? makes.filter((item) => normalizeMatch(item.name).includes(needle)) : makes;
  }, [makeSearch, makes]);

  useEffect(() => {
    let mounted = true;
    setCatalogStatus(initialMakes.length > 0 && makes.length > 0 ? "ready" : "loading");

    fetchVehicleMakesForCategory(categoryCode)
      .then((nextMakes) => {
        if (!mounted) {
          return;
        }
        setMakes(nextMakes);
        setCatalogStatus("ready");
        setCatalogMessage("");
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }
        setCatalogStatus("error");
        setCatalogMessage(say("catFailed"));
      });

    return () => {
      mounted = false;
    };
  }, [categoryCode]);

  useEffect(() => {
    if (!selectedMakeId) {
      setModels([]);
      setSelectedModelId("");
      setTrims([]);
      setSelectedTrimId("");
      return;
    }

    let mounted = true;
    fetchVehicleModels(selectedMakeId, categoryCode)
      .then((nextModels) => {
        if (!mounted) {
          return;
        }
        setModels(nextModels);
        setSelectedModelId("");
        setTrims([]);
        setSelectedTrimId("");
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }
        setCatalogStatus("error");
        setCatalogMessage(say("catFailed"));
      });

    return () => {
      mounted = false;
    };
  }, [categoryCode, selectedMakeId]);

  useEffect(() => {
    if (!selectedModelId) {
      setTrims([]);
      setSelectedTrimId("");
      return;
    }

    let mounted = true;
    fetchVehicleTrims(selectedModelId)
      .then((nextTrims) => {
        if (!mounted) {
          return;
        }
        setTrims(nextTrims);
        setSelectedTrimId("");
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }
        setCatalogStatus("error");
        setCatalogMessage(say("catFailed"));
      });

    return () => {
      mounted = false;
    };
  }, [selectedModelId]);

  function applyTrim(nextTrim: VehicleTrim) {
    setSelectedTrimId(nextTrim.id);
    setTrim(nextTrim.name);
    setEngineCc(nextTrim.engine_cc ? String(nextTrim.engine_cc) : engineCc);
    setTransmission(nextTrim.transmission || transmission);
    setFuelType(nextTrim.fuel_type || fuelType);
    setSeatingCapacity(nextTrim.seating_capacity ? String(nextTrim.seating_capacity) : seatingCapacity);
    setDrivetrain(nextTrim.drivetrain || drivetrain);
  }

  function handleCategoryChange(value: string) {
    setCategoryId(value);
    setSelectedMakeId("");
    setSelectedModelId("");
    setSelectedTrimId("");
    setMake("");
    setModel("");
    setYear("");
    setTrim("");
    setManualMake(false);
    setManualModel(false);
    setManualTrim(false);
    setMakeDropdownOpen(false);
    setMakeSearch("");
    setMakes([]);
    setModels([]);
    setTrims([]);
  }

  function handleMakeSelect(value: string) {
    setSelectedMakeId("");
    setSelectedModelId("");
    setSelectedTrimId("");
    setModel("");
    setYear("");
    setTrim("");
    setModels([]);
    setTrims([]);
    setManualModel(false);
    setManualTrim(false);
    setMakeDropdownOpen(false);

    if (value === "__manual__") {
      setManualMake(true);
      setMake("");
      setMakeSearch("");
      return;
    }

    setManualMake(false);
    const nextMake = makes.find((item) => item.id === value);
    if (nextMake) {
      setSelectedMakeId(nextMake.id);
      setMake(nextMake.name);
      setMakeSearch("");
    } else {
      setMake("");
      setMakeSearch("");
    }
  }

  function handleModelSelect(value: string) {
    setSelectedModelId("");
    setSelectedTrimId("");
    setYear("");
    setTrim("");
    setTrims([]);
    setManualTrim(false);

    if (value === "__manual__") {
      setManualModel(true);
      setModel("");
      return;
    }

    setManualModel(false);
    const nextModel = models.find((item) => item.id === value);
    if (nextModel) {
      setSelectedModelId(nextModel.id);
      setModel(nextModel.name);
      setBodyClass(nextModel.body_type || bodyClass);
    } else {
      setModel("");
    }
  }

  function handleTrimSelect(value: string) {
    if (value === "__manual__") {
      setManualTrim(true);
      setSelectedTrimId("");
      setTrim("");
      return;
    }

    setManualTrim(false);
    const nextTrim = visibleTrims.find((item) => item.id === value);
    if (nextTrim) {
      applyTrim(nextTrim);
    } else {
      setSelectedTrimId("");
      setTrim("");
    }
  }

  async function syncCatalogSelection(result: VinDecodeResult) {
    const nextMakes = makes.length ? makes : await fetchVehicleMakesForCategory(categoryCode);
    if (!makes.length) {
      setMakes(nextMakes);
    }

    const matchedMake = nextMakes.find((item) => normalizeMatch(item.name) === normalizeMatch(result.Make || ""));
    if (!matchedMake) {
      setManualMake(Boolean(result.Make));
      setManualModel(Boolean(result.Model));
      setManualTrim(Boolean(result.Trim));
      return false;
    }

    setSelectedMakeId(matchedMake.id);
    setManualMake(false);
    const nextModels = await fetchVehicleModels(matchedMake.id, categoryCode);
    setModels(nextModels);

    const matchedModel = nextModels.find((item) => normalizeMatch(item.name) === normalizeMatch(result.Model || ""));
    if (!matchedModel) {
      setManualModel(Boolean(result.Model));
      setManualTrim(Boolean(result.Trim));
      return true;
    }

    setSelectedModelId(matchedModel.id);
    setManualModel(false);
    setBodyClass(result.BodyClass || matchedModel.body_type || bodyClass);
    const nextTrims = await fetchVehicleTrims(matchedModel.id);
    setTrims(nextTrims);

    const matchedTrim = nextTrims.find((item) => {
      const nameMatches = result.Trim ? normalizeMatch(item.name).includes(normalizeMatch(result.Trim)) : true;
      return nameMatches && trimCoversYear(item, result.ModelYear || "");
    });

    if (matchedTrim) {
      setManualTrim(false);
      applyTrim(matchedTrim);
    } else if (result.Trim) {
      setManualTrim(true);
    }

    return true;
  }

  async function handleOcrFileChange(file: File | null) {
    setOcrMessage("");

    if (!file) {
      setOcrStatus("idle");
      return;
    }

    setOcrStatus("reading");
    const ocrFormData = new FormData();
    ocrFormData.append("file", file);

    try {
      const response = await fetch("/api/ocr/vehicle-logbook", {
        method: "POST",
        body: ocrFormData
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error("unreadable");
      }

      const extracted = payload.extracted || {};
      const nextVin = extracted.vin ? String(extracted.vin).trim().toUpperCase() : vin;
      setRegistrationNumber(extracted.registration_number || registrationNumber);
      setVin(nextVin);
      setMake(extracted.make || make);
      setModel(extracted.model || model);
      setYear(extracted.year ? String(extracted.year) : year);
      setTrim(extracted.trim || trim);
      setColor(extracted.color || color);
      setTransmission(extracted.transmission || transmission);
      setSeatingCapacity(extracted.seating_capacity ? String(extracted.seating_capacity) : seatingCapacity);
      setEngineCc(extracted.engine_cc ? String(extracted.engine_cc) : engineCc);
      const nextTaxExpiryDate = extracted.tax_expiry_date || taxExpiryDate;
      const nextPorborExpiryDate = extracted.porbor_expiry_date || porborExpiryDate;
      const nextInsuranceExpiryDate = extracted.insurance_expiry_date || insuranceExpiryDate;
      setTaxExpiryDate(nextTaxExpiryDate);
      setPorborExpiryDate(nextPorborExpiryDate);
      setInsuranceExpiryDate(nextInsuranceExpiryDate);
      window.dispatchEvent(
        new CustomEvent("vehicle-logbook-ocr", {
          detail: {
            taxExpiryDate: nextTaxExpiryDate,
            porborExpiryDate: nextPorborExpiryDate,
            insuranceExpiryDate: nextInsuranceExpiryDate
          }
        })
      );

      if (extracted.make || extracted.model || extracted.trim || extracted.year) {
        await syncCatalogSelection({
          Make: extracted.make,
          Model: extracted.model,
          ModelYear: extracted.year ? String(extracted.year) : undefined,
          Trim: extracted.trim,
          BodyClass: extracted.body_class || extracted.bodyClass
        });
      }

      setOcrStatus("done");
      setOcrMessage(say("bookDone"));
    } catch (error) {
      setOcrStatus("error");
      setOcrMessage(say("bookFailed"));
    }
  }

  return (
    <>
      <div className="card p-4">
        <h2 className="text-[17px] font-bold text-[var(--foreground)]">{say("bookTitle")}</h2>
        <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{say("bookBody")}</p>
        <label className="mt-3 block">
          <span className={labelClass}>{say("bookLabel")}</span>
          <input
            accept="image/*,application/pdf"
            capture="environment"
            className="mt-1 w-full"
            name="logbookFile"
            onChange={(event) => handleOcrFileChange(event.target.files?.[0] || null)}
            type="file"
          />
        </label>
        {ocrStatus !== "idle" ? (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${
              ocrStatus === "error"
                ? "bg-[var(--danger-light)] text-[var(--danger)]"
                : ocrStatus === "done"
                  ? "bg-[var(--success-light)] text-[var(--success)]"
                  : "bg-[var(--primary-light)] text-[var(--primary)]"
            }`}
          >
            {ocrStatus === "reading" ? say("bookReading") : ocrMessage}
          </p>
        ) : null}
      </div>

      {/* overflow visible: the make list drops below the card and must not be cut off. */}
      <div className="card p-4" style={{ overflow: "visible" }}>
        <h2 className="text-[17px] font-bold text-[var(--foreground)]">{say("identTitle")}</h2>
        {catalogStatus === "loading" ? <p className="mt-3 text-sm font-semibold text-[var(--primary)]">{say("catLoading")}</p> : null}
        {catalogStatus === "error" ? <p className="mt-3 rounded-lg bg-[var(--danger-light)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">{catalogMessage}</p> : null}

        {needMake && !(make && model) ? <p className="mt-3 rounded-xl bg-[var(--danger-light)] px-4 py-3 font-bold text-[var(--danger)]">{say("needMake")}</p> : null}

        <input name="make" type="hidden" value={make} />
        <input name="model" type="hidden" value={model} />
        <input name="year" type="hidden" value={year} />
        <input name="trim" type="hidden" value={trim} />
        <input name="categoryCode" type="hidden" value={categoryCode} />
        <input name="catalogMakeId" type="hidden" value={selectedMakeId} />
        <input name="catalogModelId" type="hidden" value={selectedModelId} />
        <input name="catalogTrimId" type="hidden" value={selectedTrimId} />
        <input name="catalogMakeIsCustom" type="hidden" value={manualMake ? "true" : "false"} />
        <input name="catalogModelIsCustom" type="hidden" value={manualModel ? "true" : "false"} />
        <input name="catalogTrimIsCustom" type="hidden" value={manualTrim || (Boolean(trim) && !selectedTrimId) ? "true" : "false"} />

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>{say("category")}</span>
            <select
              className={inputClass}
              name="categoryId"
              onChange={(event) => handleCategoryChange(event.target.value)}
              onInput={(event) => handleCategoryChange(event.currentTarget.value)}
              required
              value={categoryId}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {categoryLabel(category)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>{say("make")}</span>
            <div className="relative mt-1">
              {/* Lets the browser stop the form and point here when no make or model was chosen. */}
              <input aria-hidden="true" className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0" onChange={() => undefined}
                onInvalid={(event) => {
                  event.preventDefault();
                  setNeedMake(true);
                  event.currentTarget.parentElement?.scrollIntoView({ block: "center", behavior: "smooth" });
                }}
                required
                tabIndex={-1}
                value={make && model ? "ok" : ""}
              />
              <button
                className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-[var(--border-strong)] bg-white px-3 py-2 text-left text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                onClick={() => setMakeDropdownOpen((open) => !open)}
                type="button"
              >
                <span className="flex min-w-0 items-center gap-3">
                  {selectedMakeId ? (
                    (() => {
                      const selected = makes.find((item) => item.id === selectedMakeId);
                      return selected?.logo_url ? <img alt="" className="h-7 w-7 shrink-0 rounded bg-white object-contain" src={selected.logo_url} /> : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[var(--primary-light)] text-xs font-bold text-[var(--primary)]">{selected?.name.slice(0, 2) || "?"}</span>;
                    })()
                  ) : (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[var(--panel-secondary)] text-xs font-bold text-[var(--primary)]">+</span>
                  )}
                  <span className={make ? "truncate font-semibold" : "truncate text-[var(--muted)]"}>
                    {manualMake ? say("makeOther") : make || say("makeSelect")}
                  </span>
                </span>
                <ChevronDown className="shrink-0 text-[var(--muted)]" size={18} />
              </button>
              {makeDropdownOpen ? (
                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-xl shadow-[var(--foreground)]/10">
                  <div className="border-b border-[var(--border)] p-3">
                    <input
                      autoFocus
                      className="w-full"
                      onChange={(event) => setMakeSearch(event.target.value)}
                      placeholder={say("makeSearch")}
                      value={makeSearch}
                    />
                  </div>
                  <div className="max-h-72 overflow-y-auto py-1">
                    {searchedMakes.map((item) => (
                      <button
                        className="flex min-h-[44px] w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--panel-secondary)]"
                        key={item.id}
                        onClick={() => handleMakeSelect(item.id)}
                        type="button"
                      >
                        {item.logo_url ? <img alt="" className="h-7 w-7 shrink-0 rounded bg-white object-contain" src={item.logo_url} /> : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[var(--primary-light)] text-xs font-bold text-[var(--primary)]">{item.name.slice(0, 2)}</span>}
                        <span className="font-semibold text-[var(--foreground)]">{item.name}</span>
                      </button>
                    ))}
                    <button
                      className="flex min-h-[44px] w-full items-center gap-3 border-t border-[var(--border)] px-3 py-2 text-left font-bold text-[var(--primary)] hover:bg-[var(--panel-secondary)]"
                      onClick={() => handleMakeSelect("__manual__")}
                      type="button"
                    >
                      {say("makeOther")}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </label>
          <label className="block">
            <span className={labelClass}>{say("model")}</span>
            <select className={inputClass} disabled={!selectedMakeId && !manualMake} onChange={(event) => handleModelSelect(event.target.value)} value={manualModel ? "__manual__" : selectedModelId}>
              <option value="">{selectedMakeId ? say("modelSelect") : say("modelFirst")}</option>
              {models.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
              <option value="__manual__">{say("modelOther")}</option>
            </select>
          </label>
        </div>

        {manualMake || manualModel ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {manualMake ? (
              <label className="block">
                <span className={labelClass}>{say("makeCustom")}</span>
                <input className={inputClass} onChange={(event) => setMake(event.target.value)} value={make} />
              </label>
            ) : null}
            {manualModel ? (
              <label className="block">
                <span className={labelClass}>{say("modelCustom")}</span>
                <input className={inputClass} onChange={(event) => setModel(event.target.value)} value={model} />
              </label>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>{say("year")}</span>
            {catalogYears.length > 0 ? (
              <select className={inputClass} onChange={(event) => setYear(event.target.value)} value={year}>
                <option value="">{say("yearSelect")}</option>
                {catalogYears.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            ) : (
              <input className={inputClass} min="1900" onChange={(event) => setYear(event.target.value)} placeholder="2024" type="number" value={year} />
            )}
          </label>
          <label className="block">
            <span className={labelClass}>{say("trim")}</span>
            {visibleTrims.length > 0 ? (
              <select
                className={inputClass}
                onChange={(event) => handleTrimSelect(event.target.value)}
                value={manualTrim ? "__manual__" : selectedTrimId}
              >
                <option value="">{say("trimSelect")}</option>
                {visibleTrims.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
                <option value="__manual__">{say("trimOther")}</option>
              </select>
            ) : (
              <input className={inputClass} onChange={(event) => setTrim(event.target.value)} value={trim} />
            )}
            {manualTrim && visibleTrims.length > 0 ? (
              <input className={inputClass} onChange={(event) => setTrim(event.target.value)} placeholder={say("trimCustom")} value={trim} />
            ) : null}
          </label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>{say("plate")}</span>
            <input className={`${inputClass} font-mono-data`} name="registrationNumber" onChange={(event) => setRegistrationNumber(event.target.value)} required value={registrationNumber} />
          </label>
          <label className="block">
            <span className={labelClass}>{say("colour")}</span>
            <input className={inputClass} name="color" onChange={(event) => setColor(event.target.value)} value={color} />
          </label>
        </div>
        {/* Nice to have, never needed to rent the vehicle out. Opens by itself when the blue book filled it in, so it gets checked. */}
      </div>
          <Fold open={ocrStatus === "done"} summary={say("moreSummary")} title={say("moreTitle")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>{say("vin")}</span>
            <input className={`${inputClass} font-mono-data`} name="vin" onChange={(event) => setVin(event.target.value.trim().toUpperCase())} value={vin} />
          </label>
          <label className="block">
            <span className={labelClass}>{say("transmission")}</span>
            <input className={inputClass} name="transmission" onChange={(event) => setTransmission(event.target.value)} value={transmission} />
          </label>
          {showMotorcycleFields ? (
            <label className="block">
              <span className={labelClass}>{say("fuel")}</span>
              <select className={inputClass} name="fuelType" onChange={(event) => setFuelType(event.target.value)} value={fuelType}>
                <option value="">{say("choose")}</option>
                <option value="petrol">{say("fuel_petrol")}</option>
                <option value="electric">{say("fuel_electric")}</option>
                <option value="hybrid">{say("fuel_hybrid")}</option>
              </select>
            </label>
          ) : (
            <input name="fuelType" type="hidden" value={fuelType} />
          )}
          <label className="block">
            <span className={labelClass}>{say("seats")}</span>
            <input className={`${inputClass} font-mono-data`} min="0" name="seatingCapacity" onChange={(event) => setSeatingCapacity(event.target.value)} placeholder="5" type="number" value={seatingCapacity} />
          </label>
          <label className="block">
            <span className={labelClass}>{say("engine")}</span>
            <input className={`${inputClass} font-mono-data`} min="0" name="engineCc" onChange={(event) => setEngineCc(event.target.value)} placeholder="125" type="number" value={engineCc} />
          </label>
          <label className="block">
            <span className={labelClass}>{say("drivetrain")}</span>
            <input className={inputClass} name="drivetrain" onChange={(event) => setDrivetrain(event.target.value)} value={drivetrain} />
          </label>
          <label className="block">
            <span className={labelClass}>{say("body")}</span>
            <input className={inputClass} name="bodyClass" onChange={(event) => setBodyClass(event.target.value)} value={bodyClass} />
          </label>
        </div>
          </Fold>
    </>
  );
}
