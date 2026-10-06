"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { IMPORT_FIELD_GROUPS, IMPORT_FIELDS } from "@/lib/import/fields";

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

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
  if (confidence >= 0.85) return "bg-[var(--success)]";
  if (confidence >= 0.65) return "bg-[var(--warning)]";
  return "bg-[var(--danger)]";
}

function IssueList({ title, items, tone }: { title: string; items: string[]; tone: "amber" | "blue" }) {
  const [showAll, setShowAll] = useState(false);
  if (!items.length) return null;
  const shown = showAll ? items : items.slice(0, 12);
  return (
    <div className={`mt-4 rounded-lg border p-3 ${tone === "amber" ? "border-[var(--warning-line)] bg-[var(--warning-light)]" : "border-[var(--info-line)] bg-[var(--panel-secondary)]"}`}>
      <p className={`font-bold ${tone === "amber" ? "text-[var(--warning)]" : "text-[var(--info)]"}`}>
        {title} ({items.length})
      </p>
      <ul className="mt-2 space-y-1 text-sm text-[var(--foreground-secondary)]">
        {shown.map((item, index) => (
          <li key={`${index}-${item}`}>{item}</li>
        ))}
      </ul>
      {items.length > 12 ? (
        <button className="mt-2 text-sm font-bold text-[var(--primary)]" onClick={() => setShowAll((value) => !value)} type="button">
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
      <section className="rounded-lg border border-[var(--info-line)] bg-[var(--panel-secondary)] p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--info-line)] text-[var(--info)]">
            <FileSpreadsheet size={22} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--primary)]">Step 1</p>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Choose your spreadsheet</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">A CSV or Excel file, or a Google Sheet shared as “anyone with the link can view”. Every tab is read.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Spreadsheet file</span>
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
            <span className="text-sm font-semibold text-[var(--foreground-secondary)]">What's in it?</span>
            <select className={inputClass} onChange={(event) => setImportType(event.target.value)} value={importType}>
              <option value="mixed">Work it out for me</option>
              <option value="vehicles">Vehicles</option>
              <option value="customers">Customers</option>
              <option value="rentals">Rentals</option>
              <option value="transactions">Payments and expenses</option>
            </select>
          </label>
        </div>

        <label className="mt-4 block rounded-lg border border-[var(--border)] bg-white p-3">
          <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Or a Google Sheets link</span>
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
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60 sm:w-auto"
          disabled={status === "analyzing" || (!file && !sheetUrl.trim())}
          onClick={analyzeFile}
          type="button"
        >
          {status === "analyzing" ? <Loader2 className="animate-spin" size={18} /> : null}
          {status === "analyzing" ? "Reading the spreadsheet..." : "Read spreadsheet"}
        </button>
        {error ? <p className="mt-3 rounded-lg bg-[var(--danger-light)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
        {status === "error" && result ? (
          <>
            <IssueList items={result.skipped} title="Not imported" tone="amber" />
            <IssueList items={result.warnings || []} title="Check these" tone="blue" />
          </>
        ) : null}
      </section>

      {(status === "review" || status === "importing") && analysis ? (
        <section className="rounded-lg border border-[var(--success-line)] bg-[var(--success-light)] p-4">
          <p className="text-xs font-semibold uppercase text-[var(--primary)]">Step 2</p>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Check where each column goes</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Every column is listed. Columns set to “Don't import” are left out - pick a field for any you want to keep.
          </p>
          {notice ? <p className="mt-3 rounded-lg bg-[var(--warning-light)] px-3 py-2 text-sm font-semibold text-[var(--warning)]">{notice}</p> : null}

          <div className="mt-5 space-y-4">
            {mappings.map((sheet, sheetIndex) => (
              <div className="rounded-lg border border-[var(--border)] bg-white p-3" key={sheet.sheet_name}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">{sheet.sheet_name}</p>
                    <p className="text-sm text-[var(--muted)]">
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
                      <tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted)]">
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
                          <tr className={`border-b border-[var(--border)] last:border-0 ${ignored ? "text-[var(--muted)]" : ""}`} key={`${sheet.sheet_name}-${columnIndex}`}>
                            <td className="py-2 pr-3 font-semibold">{mapping.source_column}</td>
                            <td className="max-w-[240px] truncate py-2 pr-3 text-[var(--muted)]">{(mapping.sample_values || []).slice(0, 3).join(", ")}</td>
                            <td className="py-2">
                              <div className="flex items-center gap-2">
                                {!ignored ? <span className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${confidenceTone(mapping.confidence)}`} title="How sure the suggestion is" /> : null}
                                <select
                                  aria-label={`Import ${mapping.source_column} as`}
                                  className={`${inputClass} ${clash ? "border-[var(--danger)]" : ""}`}
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
                              {clash ? <p className="mt-1 text-xs font-semibold text-[var(--danger)]">Another column is also going here - choose one.</p> : null}
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
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-[var(--danger-light)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">
              <AlertTriangle size={16} /> Two columns are set to the same field. Change one before importing.
            </p>
          ) : null}

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-3 text-sm font-bold text-[var(--foreground-secondary)]" onClick={reset} type="button">
              <RotateCcw size={17} />
              Start again
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
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
        <section className="rounded-lg border border-[var(--success-line)] bg-[var(--success-light)] p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="text-[var(--success)]" size={28} />
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--primary)]">Step 3</p>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Import finished</h2>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {Object.entries(result.imported).map(([key, value]) => (
              <div className="rounded-lg border border-[var(--border)] bg-white p-3" key={key}>
                <p className="text-xs font-bold uppercase text-[var(--muted)]">{key === "transactions" ? "payments & expenses" : key}</p>
                <p className="text-2xl font-semibold text-[var(--foreground)]">{value}</p>
              </div>
            ))}
          </div>
          <IssueList items={result.skipped} title="Not imported" tone="amber" />
          <IssueList items={result.warnings || []} title="Check these" tone="blue" />
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button className="inline-flex justify-center rounded-lg border border-[var(--border)] bg-white px-4 py-3 text-sm font-bold text-[var(--foreground-secondary)]" onClick={reset} type="button">
              Import another file
            </button>
            <Link className="inline-flex justify-center rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white" href="/fleet">
              View fleet
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
