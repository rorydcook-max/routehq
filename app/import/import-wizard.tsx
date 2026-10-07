"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type Say = (key: string, values?: Record<string, string | number>) => string;
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

const dataTypes = ["vehicles", "customers", "rentals", "transactions"];

function confidenceTone(confidence = 0) {
  if (confidence >= 0.85) return "bg-[var(--success)]";
  if (confidence >= 0.65) return "bg-[var(--warning)]";
  return "bg-[var(--danger)]";
}

function IssueList({ title, items, tone }: { title: string; items: string[]; tone: "amber" | "blue" }) {
  const [showAll, setShowAll] = useState(false);
  const t = useTranslations("importer") as unknown as Say;
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
          {showAll ? t("fewer") : t("showAll", { count: items.length })}
        </button>
      ) : null}
    </div>
  );
}

export function ImportWizard({ defaultImportType = "mixed" }: { defaultImportType?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  // What the sheet holds is worked out when it is read, and can be changed per tab at the next step.
  const importType = defaultImportType;
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [mappings, setMappings] = useState<SheetMapping[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [status, setStatus] = useState<"idle" | "analyzing" | "review" | "importing" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const t = useTranslations("importer") as unknown as Say;

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
      setError(t("needFile"));
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
    const payload = await response.json().catch(() => ({ error: t("readFailed") }));

    if (!response.ok) {
      setError(payload.error || t("readFailed"));
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
    const payload = await response.json().catch(() => ({ error: t("importFailed") }));

    if (!response.ok) {
      if (payload.imported || payload.skipped) {
        setResult({
          imported: payload.imported || { vehicles: 0, customers: 0, rentals: 0, transactions: 0 },
          skipped: payload.skipped || [],
          warnings: payload.warnings || []
        });
      }
      setError(payload.error || t("importFailed"));
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
            <h2 className="text-xl font-semibold text-[var(--foreground)]">{t("s1")}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{t("s1Body")}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="secondary-action pressable w-full cursor-pointer">{file ? file.name : t("file")}</span>
            <input
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setSheetUrl("");
                reset();
              }}
              type="file"
            />
          </label>
        </div>

        <label className="mt-4 block rounded-lg border border-[var(--border)] bg-white p-3">
          <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{t("orLink")}</span>
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
          {status === "analyzing" ? t("reading") : t("read")}
        </button>
        {error ? <p className="mt-3 rounded-lg bg-[var(--danger-light)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
        {status === "error" && result ? (
          <>
            <IssueList items={result.skipped} title={t("notImported")} tone="amber" />
            <IssueList items={result.warnings || []} title={t("checkThese")} tone="blue" />
          </>
        ) : null}
      </section>

      {(status === "review" || status === "importing") && analysis ? (
        <section className="rounded-lg border border-[var(--success-line)] bg-[var(--success-light)] p-4">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">{t("s2")}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {t("s2Body")}
          </p>
          {notice ? <p className="mt-3 rounded-lg bg-[var(--warning-light)] px-3 py-2 text-sm font-semibold text-[var(--warning)]">{notice}</p> : null}

          <div className="mt-5 space-y-4">
            {mappings.map((sheet, sheetIndex) => (
              <div className="rounded-lg border border-[var(--border)] bg-white p-3" key={sheet.sheet_name}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">{sheet.sheet_name}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {t("rows", { count: sheet.row_count ?? 0 })}
                    </p>
                  </div>
                  <label className="block sm:max-w-[240px]">
                    <span className="sr-only">{t("eachRow")}</span>
                    <select
                      className={inputClass}
                      onChange={(event) => {
                        const value = event.target.value;
                        setMappings((current) => current.map((item, index) => (index === sheetIndex ? { ...item, primary_data_type: value } : item)));
                      }}
                      value={sheet.primary_data_type}
                    >
                      {dataTypes.map((value) => (
                        <option key={value} value={value}>
                          {t("eachRow")}: {t(`dt_${value}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted)]">
                        <th className="py-2">{t("thColumn")}</th>
                        <th className="py-2">{t("thExamples")}</th>
                        <th className="py-2">{t("thAs")}</th>
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
                                {!ignored ? <span className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${confidenceTone(mapping.confidence)}`} title={t("sure")} /> : null}
                                <select
                                  aria-label={`${t("thAs")}: ${mapping.source_column}`}
                                  className={`${inputClass} ${clash ? "border-[var(--danger)]" : ""}`}
                                  onChange={(event) => updateMapping(sheetIndex, columnIndex, event.target.value)}
                                  value={mapping.routehq_field || "__ignore__"}
                                >
                                  <option value="__ignore__">{t("ignore")}</option>
                                  {IMPORT_FIELD_GROUPS.map((group) => (
                                    <optgroup key={group} label={(t as unknown as (key: string) => string)(`g_${group.replace(/ /g, "_")}`)}>
                                      {IMPORT_FIELDS.filter((field) => field.group === group).map((field) => (
                                        <option key={field.key} value={field.key}>
                                          {(t as unknown as (key: string) => string)(`f_${field.key}`)}
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                              </div>
                              {clash ? <p className="mt-1 text-xs font-semibold text-[var(--danger)]">{t("clash")}</p> : null}
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
              <AlertTriangle size={16} /> {t("clashAll")}
            </p>
          ) : null}

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-3 text-sm font-bold text-[var(--foreground-secondary)]" onClick={reset} type="button">
              <RotateCcw size={17} />
              {t("again")}
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              disabled={status === "importing" || hasClashes}
              onClick={executeImport}
              type="button"
            >
              {status === "importing" ? <Loader2 className="animate-spin" size={18} /> : null}
              {status === "importing" ? t("importing") : t("import")}
            </button>
          </div>
        </section>
      ) : null}

      {status === "done" && result ? (
        <section className="rounded-lg border border-[var(--success-line)] bg-[var(--success-light)] p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="text-[var(--success)]" size={28} />
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">{t("done")}</h2>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {Object.entries(result.imported).filter(([key, value]) => value > 0 || key === "vehicles").map(([key, value]) => (
              <div className="rounded-lg border border-[var(--border)] bg-white p-3" key={key}>
                <p className="text-xs font-bold uppercase text-[var(--muted)]">{t(`dt_${key}`)}</p>
                <p className="text-2xl font-semibold text-[var(--foreground)]">{value}</p>
              </div>
            ))}
          </div>
          <IssueList items={result.skipped} title={t("notImported")} tone="amber" />
          <IssueList items={result.warnings || []} title={t("checkThese")} tone="blue" />
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button className="inline-flex justify-center rounded-lg border border-[var(--border)] bg-white px-4 py-3 text-sm font-bold text-[var(--foreground-secondary)]" onClick={reset} type="button">
              {t("another")}
            </button>
            <Link className="inline-flex justify-center rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white" href="/fleet">
              {t("viewFleet")}
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
