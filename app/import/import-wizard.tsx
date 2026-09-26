"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { IMPORT_FIELD_GROUPS, IMPORT_FIELDS } from "@/lib/import/fields";

const inputClass =
  "mt-1 w-full rounded-lg border border-[#d6e5e2] bg-white px-3 py-3 text-base text-[#10252b] outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15";

type ColumnMapping = {
  source_column: string;
  routehq_field: string;
  confidence?: number;
  sample_values?: string[];
};

type SheetMapping = {
  sheet_name: string;
  primary_data_type: string;
  confidence?: number;
  row_count?: number;
  column_mappings: ColumnMapping[];
};

type Analysis = {
  detected_data_types?: string[];
  import_summary?: string;
  sheets?: SheetMapping[];
};

type Result = {
  imported: { vehicles: number; customers: number; rentals: number; transactions: number };
  skipped: string[];
  warnings?: string[];
};

const dataTypeLabels: Record<string, string> = {
  vehicles: "Vehicles",
  customers: "Customers",
  rentals: "Rentals",
  transactions: "Payments and expenses"
};

function confidenceTone(confidence = 0) {
  if (confidence >= 0.85) return "bg-[#16a34a]";
  if (confidence >= 0.65) return "bg-[#b7791f]";
  return "bg-[#be123c]";
}

function IssueList({ title, items, tone }: { title: string; items: string[]; tone: "amber" | "blue" }) {
  const [showAll, setShowAll] = useState(false);
  if (!items.length) return null;
  const shown = showAll ? items : items.slice(0, 12);
  return (
    <div className={`mt-4 rounded-lg border p-3 ${tone === "amber" ? "border-[#fed7aa] bg-[#fff7ed]" : "border-[#bfdbfe] bg-[#f8fbff]"}`}>
      <p className={`font-bold ${tone === "amber" ? "text-[#92400e]" : "text-[#1e40af]"}`}>
        {title} ({items.length})
      </p>
      <ul className="mt-2 space-y-1 text-sm text-[#475467]">
        {shown.map((item, index) => (
          <li key={`${index}-${item}`}>{item}</li>
        ))}
      </ul>
      {items.length > 12 ? (
        <button className="mt-2 text-sm font-bold text-[#0f766e]" onClick={() => setShowAll((value) => !value)} type="button">
          {showAll ? "Show fewer" : `Show all ${items.length}`}
        </button>
      ) : null}
    </div>
  );
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
  const [notice, setNotice] = useState("");

  // A field can only take one column per sheet; flag clashes before importing.
  const clashes = useMemo(
    () =>
      mappings.map((sheet) => {
        const seen = new Map<string, number>();
        sheet.column_mappings.forEach((mapping) => {
          if (mapping.routehq_field && mapping.routehq_field !== "__ignore__") {
            seen.set(mapping.routehq_field, (seen.get(mapping.routehq_field) || 0) + 1);
          }
        });
        return new Set(Array.from(seen.entries()).filter(([, count]) => count > 1).map(([field]) => field));
      }),
    [mappings]
  );
  const hasClashes = clashes.some((set) => set.size > 0);

  async function analyzeFile() {
    if (!file && !sheetUrl.trim()) {
      setError("Choose a spreadsheet file or paste a public Google Sheets link first.");
      setStatus("error");
      return;
    }

    setError("");
    setNotice("");
    setStatus("analyzing");
    const formData = new FormData();
    if (file) formData.append("file", file);
    formData.append("sheetUrl", sheetUrl.trim());
    formData.append("importType", importType);

    const response = await fetch("/api/import/analyze", { method: "POST", body: formData });
    const payload = await response.json().catch(() => ({ error: "The spreadsheet could not be read." }));

    if (!response.ok) {
      setError(payload.error || "Reading the spreadsheet failed.");
      setStatus("error");
      return;
    }

    const nextAnalysis = payload.analysis as Analysis;
    setAnalysis(nextAnalysis);
    setMappings(nextAnalysis.sheets || []);
    setNotice(payload.warning || "");
    setStatus("review");
  }

  async function executeImport() {
    if (!file && !sheetUrl.trim()) return;

    setStatus("importing");
    setError("");
    const formData = new FormData();
    if (file) formData.append("file", file);
    formData.append("sheetUrl", sheetUrl.trim());
    formData.append("mapping", JSON.stringify(mappings));

    const response = await fetch("/api/import/execute", { method: "POST", body: formData });
    const payload = await response.json().catch(() => ({ error: "Import failed." }));

    if (!response.ok) {
      if (payload.imported || payload.skipped) {
        setResult({
          imported: payload.imported || { vehicles: 0, customers: 0, rentals: 0, transactions: 0 },
          skipped: payload.skipped || [],
          warnings: payload.warnings || []
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

  function reset() {
    setAnalysis(null);
    setMappings([]);
    setResult(null);
    setStatus("idle");
    setError("");
    setNotice("");
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
            <h2 className="text-xl font-extrabold text-[#10252b]">Choose your spreadsheet</h2>
            <p className="mt-1 text-sm text-[#667085]">A CSV or Excel file, or a Google Sheet shared as “anyone with the link can view”. Every tab is read.</p>
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
                setSheetUrl("");
                reset();
              }}
              type="file"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#344054]">What's in it?</span>
            <select className={inputClass} onChange={(event) => setImportType(event.target.value)} value={importType}>
              <option value="mixed">Work it out for me</option>
              <option value="vehicles">Vehicles</option>
              <option value="customers">Customers</option>
              <option value="rentals">Rentals</option>
              <option value="transactions">Payments and expenses</option>
            </select>
          </label>
        </div>

        <label className="mt-4 block rounded-lg border border-[#d6e5e2] bg-white p-3">
          <span className="text-sm font-semibold text-[#344054]">Or a Google Sheets link</span>
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

        <button
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-3 text-sm font-bold text-white disabled:opacity-60 sm:w-auto"
          disabled={status === "analyzing" || (!file && !sheetUrl.trim())}
          onClick={analyzeFile}
          type="button"
        >
          {status === "analyzing" ? <Loader2 className="animate-spin" size={18} /> : null}
          {status === "analyzing" ? "Reading the spreadsheet..." : "Read spreadsheet"}
        </button>
        {error ? <p className="mt-3 rounded-lg bg-[#ffe4e6] px-3 py-2 text-sm font-semibold text-[#be123c]">{error}</p> : null}
        {status === "error" && result ? (
          <>
            <IssueList items={result.skipped} title="Not imported" tone="amber" />
            <IssueList items={result.warnings || []} title="Check these" tone="blue" />
          </>
        ) : null}
      </section>

      {(status === "review" || status === "importing") && analysis ? (
        <section className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-4">
          <p className="text-xs font-extrabold uppercase text-[#0f766e]">Step 2</p>
          <h2 className="text-xl font-extrabold text-[#10252b]">Check where each column goes</h2>
          <p className="mt-2 text-sm text-[#667085]">
            Every column is listed. Columns set to “Don't import” are left out - pick a field for any you want to keep.
          </p>
          {notice ? <p className="mt-3 rounded-lg bg-[#fffbeb] px-3 py-2 text-sm font-semibold text-[#92400e]">{notice}</p> : null}

          <div className="mt-5 space-y-4">
            {mappings.map((sheet, sheetIndex) => (
              <div className="rounded-lg border border-[#d6e5e2] bg-white p-3" key={sheet.sheet_name}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-extrabold text-[#10252b]">{sheet.sheet_name}</p>
                    <p className="text-sm text-[#667085]">
                      {sheet.row_count ?? 0} row{sheet.row_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <label className="block sm:max-w-[240px]">
                    <span className="sr-only">Each row is</span>
                    <select
                      className={inputClass}
                      onChange={(event) => {
                        const value = event.target.value;
                        setMappings((current) => current.map((item, index) => (index === sheetIndex ? { ...item, primary_data_type: value } : item)));
                      }}
                      value={sheet.primary_data_type}
                    >
                      {Object.entries(dataTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          Each row is: {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#edf2f7] text-xs uppercase text-[#667085]">
                        <th className="py-2">Column in your sheet</th>
                        <th className="py-2">Examples</th>
                        <th className="py-2">Import as</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.column_mappings.map((mapping, columnIndex) => {
                        const ignored = !mapping.routehq_field || mapping.routehq_field === "__ignore__";
                        const clash = clashes[sheetIndex]?.has(mapping.routehq_field);
                        return (
                          <tr className={`border-b border-[#edf2f7] last:border-0 ${ignored ? "text-[#98a2b3]" : ""}`} key={`${sheet.sheet_name}-${columnIndex}`}>
                            <td className="py-2 pr-3 font-semibold">{mapping.source_column}</td>
                            <td className="max-w-[240px] truncate py-2 pr-3 text-[#667085]">{(mapping.sample_values || []).slice(0, 3).join(", ")}</td>
                            <td className="py-2">
                              <div className="flex items-center gap-2">
                                {!ignored ? <span className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${confidenceTone(mapping.confidence)}`} title="How sure the suggestion is" /> : null}
                                <select
                                  aria-label={`Import ${mapping.source_column} as`}
                                  className={`${inputClass} ${clash ? "border-[#be123c]" : ""}`}
                                  onChange={(event) => updateMapping(sheetIndex, columnIndex, event.target.value)}
                                  value={mapping.routehq_field || "__ignore__"}
                                >
                                  <option value="__ignore__">Don't import</option>
                                  {IMPORT_FIELD_GROUPS.map((group) => (
                                    <optgroup key={group} label={group}>
                                      {IMPORT_FIELDS.filter((field) => field.group === group).map((field) => (
                                        <option key={field.key} value={field.key}>
                                          {field.label}
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                              </div>
                              {clash ? <p className="mt-1 text-xs font-semibold text-[#be123c]">Another column is also going here - choose one.</p> : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {hasClashes ? (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-[#ffe4e6] px-3 py-2 text-sm font-semibold text-[#be123c]">
              <AlertTriangle size={16} /> Two columns are set to the same field. Change one before importing.
            </p>
          ) : null}

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#d6e5e2] bg-white px-4 py-3 text-sm font-bold text-[#344054]" onClick={reset} type="button">
              <RotateCcw size={17} />
              Start again
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              disabled={status === "importing" || hasClashes}
              onClick={executeImport}
              type="button"
            >
              {status === "importing" ? <Loader2 className="animate-spin" size={18} /> : null}
              {status === "importing" ? "Importing..." : "Import"}
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
              <h2 className="text-xl font-extrabold text-[#10252b]">Import finished</h2>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {Object.entries(result.imported).map(([key, value]) => (
              <div className="rounded-lg border border-[#d6e5e2] bg-white p-3" key={key}>
                <p className="text-xs font-bold uppercase text-[#667085]">{key === "transactions" ? "payments & expenses" : key}</p>
                <p className="text-2xl font-extrabold text-[#10252b]">{value}</p>
              </div>
            ))}
          </div>
          <IssueList items={result.skipped} title="Not imported" tone="amber" />
          <IssueList items={result.warnings || []} title="Check these" tone="blue" />
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
