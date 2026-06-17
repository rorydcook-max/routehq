"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionHeader } from "@/components/ui";
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
        setCatalogMessage(error instanceof Error ? error.message : "Unable to load vehicle catalog.");
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
        setCatalogMessage(error instanceof Error ? error.message : "Unable to load models.");
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
        setCatalogMessage(error instanceof Error ? error.message : "Unable to load trims.");
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
        throw new Error(payload.error || "Unable to read this document.");
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
      setOcrMessage(`Fields populated from logbook${extracted.confidence ? ` (${Math.round(extracted.confidence * 100)}% confidence)` : ""}.`);
    } catch (error) {
      setOcrStatus("error");
      setOcrMessage(error instanceof Error ? error.message : "Unable to read this document.");
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-[#a7edf4] bg-[var(--primary-light)] p-4">
        <SectionHeader eyebrow="Blue book OCR" title="Scan or upload logbook" />
        <p className="mt-2 text-sm text-[#667085]">
          Upload a car title, logbook, or Thai blue book photo/PDF. OCR will try to populate the form before you save, then decode the VIN if one is found.
        </p>
        <label className="mt-4 block">
          <span className="text-sm font-semibold text-[#344054]">Logbook image or PDF</span>
          <input
            accept="image/*,application/pdf"
            capture="environment"
            className={inputClass}
            name="logbookFile"
            onChange={(event) => handleOcrFileChange(event.target.files?.[0] || null)}
            type="file"
          />
        </label>
        {ocrStatus !== "idle" ? (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${
              ocrStatus === "error"
                ? "bg-[#ffe4e6] text-[#be123c]"
                : ocrStatus === "done"
                  ? "bg-[#dcfce7] text-[#166534]"
                  : "bg-[#e6fffb] text-[#0f766e]"
            }`}
          >
            {ocrStatus === "reading" ? "Reading logbook..." : ocrMessage}
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-[#bfd1ff] bg-[var(--primary-blue-light)] p-4">
        <SectionHeader eyebrow="Catalog fallback" title="Vehicle identity" />
        {catalogStatus === "loading" ? <p className="mt-3 text-sm font-semibold text-[#0f766e]">Loading vehicle catalog...</p> : null}
        {catalogStatus === "error" ? <p className="mt-3 rounded-lg bg-[#ffe4e6] px-3 py-2 text-sm font-semibold text-[#be123c]">{catalogMessage}</p> : null}

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
            <span className="text-sm font-semibold text-[#344054]">Vehicle category</span>
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
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#344054]">Make</span>
            <div className="relative mt-1">
              <button
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border-strong)] bg-white px-3 py-3 text-left text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
                onClick={() => setMakeDropdownOpen((open) => !open)}
                type="button"
              >
                <span className="flex min-w-0 items-center gap-3">
                  {selectedMakeId ? (
                    (() => {
                      const selected = makes.find((item) => item.id === selectedMakeId);
                      return selected?.logo_url ? <img alt="" className="h-7 w-7 shrink-0 rounded bg-white object-contain" src={selected.logo_url} /> : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#dff9f4] text-xs font-bold text-[#0f766e]">{selected?.name.slice(0, 2) || "?"}</span>;
                    })()
                  ) : (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#eef8f6] text-xs font-bold text-[#0f766e]">+</span>
                  )}
                  <span className={make ? "truncate font-semibold" : "truncate text-[#98a2b3]"}>
                    {manualMake ? "Other / custom make" : make || `Select ${selectedCategory?.name || "vehicle"} brand`}
                  </span>
                </span>
                <span className="text-[#667085]">v</span>
              </button>
              {makeDropdownOpen ? (
                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-xl shadow-[#10252b]/10">
                  <div className="border-b border-[#edf2f7] p-3">
                    <input
                      className="w-full rounded-xl border border-[var(--border-strong)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
                      onChange={(event) => setMakeSearch(event.target.value)}
                      placeholder={`Search ${selectedCategory?.name?.toLowerCase() || "vehicle"} brand`}
                      value={makeSearch}
                    />
                  </div>
                  <div className="max-h-72 overflow-y-auto py-1">
                    {searchedMakes.map((item) => (
                      <button
                        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[#eef8f6]"
                        key={item.id}
                        onClick={() => handleMakeSelect(item.id)}
                        type="button"
                      >
                        {item.logo_url ? <img alt="" className="h-7 w-7 shrink-0 rounded bg-white object-contain" src={item.logo_url} /> : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#dff9f4] text-xs font-bold text-[#0f766e]">{item.name.slice(0, 2)}</span>}
                        <span className="font-semibold text-[#10252b]">{item.name}</span>
                        <span className="ml-auto text-xs uppercase text-[#98a2b3]">{item.origin_country || ""}</span>
                      </button>
                    ))}
                    <button
                      className="flex w-full items-center gap-3 border-t border-[#edf2f7] px-3 py-2 text-left text-sm font-semibold text-[#0f766e] hover:bg-[#eef8f6]"
                      onClick={() => handleMakeSelect("__manual__")}
                      type="button"
                    >
                      Other / custom make
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#344054]">Model</span>
            <select className={inputClass} disabled={!selectedMakeId && !manualMake} onChange={(event) => handleModelSelect(event.target.value)} value={manualModel ? "__manual__" : selectedModelId}>
              <option value="">{selectedMakeId ? "Select model" : "Select make first"}</option>
              {models.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
              <option value="__manual__">Other / custom model</option>
            </select>
          </label>
        </div>

        {manualMake || manualModel ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {manualMake ? (
              <label className="block">
                <span className="text-sm font-semibold text-[#344054]">Custom make</span>
                <input className={inputClass} onChange={(event) => setMake(event.target.value)} placeholder="Enter make" value={make} />
              </label>
            ) : null}
            {manualModel ? (
              <label className="block">
                <span className="text-sm font-semibold text-[#344054]">Custom model</span>
                <input className={inputClass} onChange={(event) => setModel(event.target.value)} placeholder="Enter model" value={model} />
              </label>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-[#344054]">Year</span>
            {catalogYears.length > 0 ? (
              <select className={inputClass} onChange={(event) => setYear(event.target.value)} value={year}>
                <option value="">Select year</option>
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
            <span className="text-sm font-semibold text-[#344054]">Trim</span>
            {visibleTrims.length > 0 ? (
              <select
                className={inputClass}
                onChange={(event) => handleTrimSelect(event.target.value)}
                value={manualTrim ? "__manual__" : selectedTrimId}
              >
                <option value="">Select trim</option>
                {visibleTrims.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
                <option value="__manual__">Other / custom trim</option>
              </select>
            ) : (
              <input className={inputClass} onChange={(event) => setTrim(event.target.value)} placeholder="Smart" value={trim} />
            )}
            {manualTrim && visibleTrims.length > 0 ? (
              <input className={inputClass} onChange={(event) => setTrim(event.target.value)} placeholder="Enter custom trim" value={trim} />
            ) : null}
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
        <SectionHeader eyebrow="Vehicle details" title="Registration and specs" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-[#344054]">Registration number</span>
            <input className={`${inputClass} font-mono-data`} name="registrationNumber" onChange={(event) => setRegistrationNumber(event.target.value)} placeholder="BKK-1234" required value={registrationNumber} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#344054]">VIN / frame number</span>
            <input className={`${inputClass} font-mono-data`} name="vin" onChange={(event) => setVin(event.target.value.trim().toUpperCase())} placeholder="VIN or chassis/frame number" value={vin} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#344054]">Colour</span>
            <input className={inputClass} name="color" onChange={(event) => setColor(event.target.value)} placeholder="Pearl White" value={color} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#344054]">Transmission</span>
            <input className={inputClass} name="transmission" onChange={(event) => setTransmission(event.target.value)} placeholder="Automatic" value={transmission} />
          </label>
          {showMotorcycleFields ? (
            <label className="block">
              <span className="text-sm font-semibold text-[#344054]">Fuel type</span>
              <select className={inputClass} name="fuelType" onChange={(event) => setFuelType(event.target.value)} value={fuelType}>
                <option value="">Select fuel type</option>
                <option value="petrol">Petrol</option>
                <option value="electric">Electric</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>
          ) : (
            <input name="fuelType" type="hidden" value={fuelType} />
          )}
          <label className="block">
            <span className="text-sm font-semibold text-[#344054]">Seating capacity</span>
            <input className={`${inputClass} font-mono-data`} min="0" name="seatingCapacity" onChange={(event) => setSeatingCapacity(event.target.value)} placeholder="5" type="number" value={seatingCapacity} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#344054]">Engine CC</span>
            <input className={`${inputClass} font-mono-data`} min="0" name="engineCc" onChange={(event) => setEngineCc(event.target.value)} placeholder="125" type="number" value={engineCc} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#344054]">Drivetrain</span>
            <input className={inputClass} name="drivetrain" onChange={(event) => setDrivetrain(event.target.value)} placeholder="FWD / RWD / 4WD" value={drivetrain} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#344054]">Body class</span>
            <input className={inputClass} name="bodyClass" onChange={(event) => setBodyClass(event.target.value)} placeholder="Sedan/Saloon" value={bodyClass} />
          </label>
        </div>
      </div>
    </>
  );
}
