"use client";

import { ArrowRight, CheckCircle2, FileSpreadsheet, Loader2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const inputClass =
  "mt-1 w-full rounded-lg border border-[#d6e5e2] bg-white px-3 py-3 text-base text-[#10252b] outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15";

const fieldOptions = [
  "__ignore__",
  "registration_number",
  "make",
  "model",
  "trim",
  "year",
  "color",
  "transmission",
  "engine_cc",
  "fuel_type",
  "seating_capacity",
  "drivetrain",
  "body_type",
  "vin",
  "purchase_date",
  "purchase_price",
  "purchase_mileage",
  "current_mileage",
  "estimated_value",
  "daily_rate",
  "weekly_rate",
  "monthly_rate",
  "tax_expiry_date",
  "tax_cost",
  "insurance_expiry_date",
  "insurance_cost",
  "insurance_sum_insured",
  "porbor_expiry_date",
  "porbor_cost",
  "next_service_date",
  "finance_lender",
  "finance_monthly_payment",
  "finance_outstanding",
  "finance_end_date",
  "gps_tracker_url",
  "notes",
  "vehicle",
  "vehicle_name",
  "description",
  "full_name",
  "phone",
  "email",
  "nationality",
  "passport_number",
  "driving_licence_number",
  "emergency_contact_name",
  "emergency_contact_phone",
  "vehicle_registration",
  "customer_name",
  "start_date",
  "end_date",
  "deposit_amount",
  "mileage_at_start",
  "mileage_at_end",
  "next_payment_date",
  "date",
  "type",
  "amount"
];

type ColumnMapping = {
  source_column: string;
  routehq_field: string;
  original_routehq_field?: string;
  confidence?: number;
  sample_values?: string[];
};

type SheetMapping = {
  sheet_name: string;
  primary_data_type: string;
  confidence?: number;
  column_mappings: ColumnMapping[];
  unmapped_columns?: string[];
};

type Analysis = {
  detected_data_types?: string[];
  import_summary?: string;
  sheets?: SheetMapping[];
};

type Result = {
  imported: {
    customers: number;
    rentals: number;
    transactions: number;
    vehicles: number;
  };
  skipped: string[];
};

function confidenceTone(confidence = 0) {
  if (confidence >= 0.85) return "bg-[#16a34a]";
  if (confidence >= 0.65) return "bg-[#b7791f]";
  return "bg-[#be123c]";
}

function summaryCounts(analysis: Analysis | null) {
  const detected = analysis?.detected_data_types || [];
  return {
    rentals: detected.includes("rentals") ? "Detected" : "Not detected",
    transactions: detected.includes("transactions") ? "Detected" : "Not detected",
    vehicles: detected.includes("vehicles") ? "Detected" : "Not detected"
  };
}

export function ImportWizard({ defaultImportType = "mixed" }: { defaultImportType?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [importType, setImportType] = useState(defaultImportType);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [mappings, setMappings] = useState<SheetMapping[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [status, setStatus] = useState<"idle" | "analyzing" | "review" | "importing" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const counts = useMemo(() => summaryCounts(analysis), [analysis]);

  async function analyzeFile() {
    if (!file && !sheetUrl.trim()) {
      setError("Choose a spreadsheet file or paste a public Google Sheets link first.");
      setStatus("error");
      return;
    }

    setError("");
    setStatus("analyzing");
    const formData = new FormData();
    if (file) {
      formData.append("file", file);
    }
    formData.append("sheetUrl", sheetUrl.trim());
    formData.append("importType", importType);

    const response = await fetch("/api/import/analyze", {
      method: "POST",
      body: formData
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error || "Import analysis failed.");
      setStatus("error");
      return;
    }

    const nextAnalysis = payload.analysis as Analysis;
    setAnalysis(nextAnalysis);
    setMappings(
      (nextAnalysis.sheets || []).map((sheet) => ({
        ...sheet,
        column_mappings: sheet.column_mappings.map((mapping) => ({
          ...mapping,
          original_routehq_field: mapping.original_routehq_field || mapping.routehq_field
        }))
      }))
    );
    setStatus("review");
  }

  async function executeImport() {
    if (!file && !sheetUrl.trim()) {
      return;
    }

    setStatus("importing");
    setError("");
    const formData = new FormData();
    if (file) {
      formData.append("file", file);
    }
    formData.append("sheetUrl", sheetUrl.trim());
    formData.append("mapping", JSON.stringify(mappings));

    const response = await fetch("/api/import/execute", {
      method: "POST",
      body: formData
    });
    const payload = await response.json();

    if (!response.ok) {
      if (payload.imported || payload.skipped) {
        setResult({
          imported: payload.imported || { customers: 0, rentals: 0, transactions: 0, vehicles: 0 },
          skipped: payload.skipped || []
        });
      }
      setError(payload.error || "Import failed.");
      setStatus("error");
      return;
    }

    setResult(payload);
    setStatus("done");
  }

  function updateMapping(sheetIndex: number, columnIndex: number, routehqField: string) {
    setMappings((current) =>
      current.map((sheet, nextSheetIndex) =>
        nextSheetIndex === sheetIndex
          ? {
              ...sheet,
              column_mappings: sheet.column_mappings.map((mapping, nextColumnIndex) =>
                nextColumnIndex === columnIndex ? { ...mapping, routehq_field: routehqField } : mapping
              )
            }
          : sheet
      )
    );
  }

  function toggleColumnImport(sheetIndex: number, columnIndex: number, shouldImport: boolean) {
    setMappings((current) =>
      current.map((sheet, nextSheetIndex) =>
        nextSheetIndex === sheetIndex
          ? {
              ...sheet,
              column_mappings: sheet.column_mappings.map((mapping, nextColumnIndex) =>
                nextColumnIndex === columnIndex
                  ? {
                      ...mapping,
                      routehq_field: shouldImport ? mapping.original_routehq_field || mapping.routehq_field || "notes" : "__ignore__"
                    }
                  : mapping
              )
            }
          : sheet
      )
    );
  }

  function reset() {
    setAnalysis(null);
    setMappings([]);
    setResult(null);
    setStatus("idle");
    setError("");
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[#bfdbfe] bg-[#f8fbff] p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#dbeafe] text-[#2563eb]">
            <FileSpreadsheet size={22} />
          </span>
          <div>
            <p className="text-xs font-extrabold uppercase text-[#0f766e]">Step 1</p>
            <h2 className="text-xl font-extrabold text-[#10252b]">Upload spreadsheet</h2>
            <p className="mt-1 text-sm text-[#667085]">CSV works now. Excel files use the `xlsx` package once installed.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-[#344054]">Spreadsheet file</span>
            <input
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className={inputClass}
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                reset();
              }}
              type="file"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#344054]">What type of data is this?</span>
            <select className={inputClass} onChange={(event) => setImportType(event.target.value)} value={importType}>
              <option value="vehicles">Vehicles</option>
              <option value="customers">Customers</option>
              <option value="rentals">Rentals</option>
              <option value="transactions">Transactions</option>
              <option value="mixed">Mixed (let AI decide)</option>
            </select>
          </label>
        </div>

        <div className="mt-4 rounded-lg border border-[#d6e5e2] bg-white p-3">
          <label className="block">
            <span className="flex items-center gap-2 text-sm font-semibold text-[#344054]">
              Google Sheets link
              <span className="group relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#e6fffb] text-xs font-black text-[#0f766e]">
                ?
                <span className="pointer-events-none absolute bottom-7 left-1/2 z-20 hidden w-64 -translate-x-1/2 rounded-lg border border-[#d6e5e2] bg-white p-3 text-left text-xs font-semibold text-[#475467] shadow-xl group-hover:block">
                  The Google Sheet must be public or set to anyone with the link can view. RouteHQ imports all visible worksheets/tabs from the workbook.
                </span>
              </span>
            </span>
            <input
              className={inputClass}
              onChange={(event) => {
                setSheetUrl(event.target.value);
                setFile(null);
                reset();
              }}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              type="url"
              value={sheetUrl}
            />
          </label>
          <p className="mt-2 text-xs font-semibold text-[#667085]">
            Use either a file upload or a public Google Sheets share link. Google Sheets imports read every worksheet/tab.
          </p>
        </div>

        <button
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-3 text-sm font-bold text-white sm:w-auto"
          disabled={status === "analyzing" || (!file && !sheetUrl.trim())}
          onClick={analyzeFile}
          type="button"
        >
          {status === "analyzing" ? <Loader2 className="animate-spin" size={18} /> : null}
          {status === "analyzing" ? "Analyzing..." : "Upload and map columns"}
        </button>
        {error ? <p className="mt-3 rounded-lg bg-[#ffe4e6] px-3 py-2 text-sm font-semibold text-[#be123c]">{error}</p> : null}
        {status === "error" && result?.skipped?.length ? (
          <div className="mt-3 rounded-lg border border-[#fed7aa] bg-[#fff7ed] p-3">
            <p className="font-bold text-[#92400e]">Import details</p>
            <ul className="mt-2 space-y-1 text-sm text-[#667085]">
              {result.skipped.slice(0, 12).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {(status === "review" || status === "importing") && analysis ? (
        <section className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-4">
          <p className="text-xs font-extrabold uppercase text-[#0f766e]">Step 2</p>
          <h2 className="text-xl font-extrabold text-[#10252b]">Review AI mapping</h2>
          <p className="mt-2 text-sm text-[#667085]">{analysis.import_summary || "Review the suggested column mapping before importing."}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[#d6e5e2] bg-white p-3">
              <p className="text-xs font-bold uppercase text-[#667085]">Vehicles</p>
              <p className="font-bold text-[#10252b]">{counts.vehicles}</p>
            </div>
            <div className="rounded-lg border border-[#d6e5e2] bg-white p-3">
              <p className="text-xs font-bold uppercase text-[#667085]">Rentals</p>
              <p className="font-bold text-[#10252b]">{counts.rentals}</p>
            </div>
            <div className="rounded-lg border border-[#d6e5e2] bg-white p-3">
              <p className="text-xs font-bold uppercase text-[#667085]">Transactions</p>
              <p className="font-bold text-[#10252b]">{counts.transactions}</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {mappings.map((sheet, sheetIndex) => (
              <div className="rounded-lg border border-[#d6e5e2] bg-white p-3" key={sheet.sheet_name}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-extrabold text-[#10252b]">{sheet.sheet_name}</p>
                    <p className="text-sm text-[#667085]">{sheet.primary_data_type} / {Math.round((sheet.confidence || 0) * 100)}% confidence</p>
                  </div>
                  <select
                    className={`${inputClass} sm:max-w-[220px]`}
                    onChange={(event) => {
                      const value = event.target.value;
                      setMappings((current) => current.map((item, index) => (index === sheetIndex ? { ...item, primary_data_type: value } : item)));
                    }}
                    value={sheet.primary_data_type}
                  >
                    <option value="vehicles">Vehicles</option>
                    <option value="customers">Customers</option>
                    <option value="rentals">Rentals</option>
                    <option value="transactions">Transactions</option>
                  </select>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#edf2f7] text-xs uppercase text-[#667085]">
                        <th className="py-2">Import</th>
                        <th className="py-2">Source column</th>
                        <th className="py-2">Map</th>
                        <th className="py-2">RouteHQ field</th>
                        <th className="py-2">Confidence</th>
                        <th className="py-2">Samples</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.column_mappings.map((mapping, columnIndex) => (
                        <tr className="border-b border-[#edf2f7] last:border-0" key={`${sheet.sheet_name}-${mapping.source_column}`}>
                          <td className="py-2">
                            <label className="checkbox-label inline-flex rounded-lg border border-[#d6e5e2] bg-white px-2 py-1.5 text-xs font-bold text-[#344054]">
                              <input
                                checked={mapping.routehq_field !== "__ignore__"}
                                className="flex-shrink-0"
                                onChange={(event) => toggleColumnImport(sheetIndex, columnIndex, event.target.checked)}
                                type="checkbox"
                              />
                              <span>{mapping.routehq_field === "__ignore__" ? "Skip" : "Import"}</span>
                            </label>
                          </td>
                          <td className="py-2 font-semibold text-[#10252b]">{mapping.source_column}</td>
                          <td className="py-2 text-[#667085]">
                            <ArrowRight size={16} />
                          </td>
                          <td className="py-2">
                            <select className={inputClass} onChange={(event) => updateMapping(sheetIndex, columnIndex, event.target.value)} value={mapping.routehq_field || "__ignore__"}>
                              {fieldOptions.map((field) => (
                                <option key={field} value={field}>
                                  {field === "__ignore__" ? "Ignore" : field}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2">
                            <span className={`inline-flex h-3 w-3 rounded-full ${confidenceTone(mapping.confidence)}`} />
                          </td>
                          <td className="py-2 text-[#667085]">{(mapping.sample_values || []).slice(0, 3).join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {sheet.unmapped_columns?.length ? (
                  <div className="mt-3 rounded-lg border border-dashed border-[#d6e5e2] bg-[#f8fbfa] p-3 text-sm text-[#667085]">
                    <span className="font-bold text-[#10252b]">Unmapped:</span> {sheet.unmapped_columns.join(", ")}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#d6e5e2] bg-white px-4 py-3 text-sm font-bold text-[#344054]" onClick={reset} type="button">
              <RotateCcw size={17} />
              Go back
            </button>
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-3 text-sm font-bold text-white" disabled={status === "importing"} onClick={executeImport} type="button">
              {status === "importing" ? <Loader2 className="animate-spin" size={18} /> : null}
              Looks good, import
            </button>
          </div>
        </section>
      ) : null}

      {status === "done" && result ? (
        <section className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="text-[#16a34a]" size={28} />
            <div>
              <p className="text-xs font-extrabold uppercase text-[#0f766e]">Step 3</p>
              <h2 className="text-xl font-extrabold text-[#10252b]">Import complete</h2>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {Object.entries(result.imported).map(([key, value]) => (
              <div className="rounded-lg border border-[#d6e5e2] bg-white p-3" key={key}>
                <p className="text-xs font-bold uppercase text-[#667085]">{key}</p>
                <p className="text-2xl font-extrabold text-[#10252b]">{value}</p>
              </div>
            ))}
          </div>
          {result.skipped.length ? (
            <div className="mt-4 rounded-lg border border-[#fed7aa] bg-[#fff7ed] p-3">
              <p className="font-bold text-[#92400e]">Skipped rows</p>
              <ul className="mt-2 space-y-1 text-sm text-[#667085]">
                {result.skipped.slice(0, 12).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button className="inline-flex justify-center rounded-lg border border-[#d6e5e2] bg-white px-4 py-3 text-sm font-bold text-[#344054]" onClick={reset} type="button">
              Import another file
            </button>
            <Link className="inline-flex justify-center rounded-lg bg-[#0f766e] px-4 py-3 text-sm font-bold text-white" href="/fleet">
              View fleet
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
