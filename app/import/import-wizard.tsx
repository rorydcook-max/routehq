"use client";

import { AlertTriangle, Camera, CheckCircle2, FileSpreadsheet, Loader2, MessageSquareText, RotateCcw, Undo2, X } from "lucide-react";
import { compressImage } from "@/lib/direct-upload-client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { longDate, numberLocale } from "@/lib/i18n/dates";
import { IMPORT_FIELD_GROUPS, IMPORT_FIELDS } from "@/lib/import/fields";
import type { ImportPreview, PreviewCustomer, PreviewRental, PreviewTransaction, PreviewVehicle, Problem } from "@/lib/import/preview";
import { previewCounts } from "@/lib/import/preview";
import { answerQuestion, importQuestions, type ImportQuestion } from "@/lib/import/questions";

type Say = (key: string, values?: Record<string, string | number>) => string;

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[15px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";
const smallInput = `${inputClass} py-1.5 text-sm`;

type ColumnMapping = { source_column: string; routehq_field: string; confidence?: number; sample_values?: string[] };
type SheetMapping = {
  sheet_name: string;
  primary_data_type: string;
  confidence?: number;
  row_count?: number;
  column_mappings: ColumnMapping[];
  date_order?: "dmy" | "mdy";
  date_order_unsure?: boolean;
  date_example?: string | null;
  rate_period?: "day" | "week" | "month";
};

/**
 * The few things the file didn't settle (which way round its dates are, what a rent is per), asked as one-tap
 * questions above the cards. Each answer re-reads the sheet; the current reading is the highlighted choice, so
 * leaving them is fine too.
 */
function QuickQuestions({ questions, busy, onAnswer, t, locale }: { questions: ImportQuestion[]; busy: boolean; onAnswer: (question: ImportQuestion, answer: string) => void; t: Say; locale: string }) {
  if (!questions.length) return null;
  const choice = (question: ImportQuestion, value: string, label: string, current: boolean) => (
    <button
      aria-pressed={current}
      className={`pressable tap-target rounded-full px-3.5 py-1.5 text-sm font-bold ${current ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`}
      disabled={busy}
      key={value}
      onClick={() => onAnswer(question, value)}
      type="button"
    >
      {label}
    </button>
  );
  return (
    <div className="mt-4 rounded-xl border border-[var(--primary)]/25 bg-[var(--primary-light)] p-3">
      <p className="text-sm font-bold text-[var(--foreground)]">{t(questions.length === 1 ? "q_titleOne" : "q_title")}</p>
      <div className="mt-2 space-y-3">
        {questions.map((question) => (
          <div key={question.id}>
            {question.kind === "date_order" ? (
              <>
                <p className="text-sm text-[var(--foreground)]">{t("q_date", { sheet: question.sheet, example: question.example })}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {choice(question, "dmy", longDate(question.dayFirst, locale), question.current === "dmy")}
                  {choice(question, "mdy", longDate(question.monthFirst, locale), question.current === "mdy")}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-[var(--foreground)]">{t("q_rent", { sheet: question.sheet, amount: question.amount.toLocaleString(numberLocale(locale)), customer: question.customer || "—" })}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {(["day", "week", "month"] as const).map((period) => choice(question, period, t(`q_per_${period}`), question.current === period))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

type Result = {
  counts: { vehicles: number; vehiclesUpdated: number; customers: number; rentals: number; transactions: number; tasks: number };
  failed: string[];
  batchId: string;
};

export type RecentImport = { id: string; sourceName: string; createdAt: string; status: string; counts: Record<string, number> };

const dataTypes = ["vehicles", "customers", "rentals", "transactions"];
const SOFT: Problem[] = ["already_in_fleet", "already_a_customer", "already_booked", "cancelled_in_file"];
const SHOW = 40;

/** Where a card came from: the sheet and row, or "From your messages" for what was read from messages, photos or a calendar. */
function rowLabel(sheet: string, row: number, t: Say) {
  if (/\(messages\)$/.test(sheet)) return t("fromMessages");
  if (/\(photos\)$/.test(sheet)) return t("fromPhotos");
  if (/\(calendar\)$/.test(sheet)) return t("fromCalendar");
  return t("fromRow", { sheet, row });
}

/** The name of an earlier import: a file's own name, or what it was read from. */
function sourceLabel(name: string, t: Say) {
  if (!name) return t("aSpreadsheet");
  if (name === "Pasted messages") return t("srcMessages");
  if (name === "Calendar") return t("srcCalendar");
  if (name === "Google Sheet") return t("srcSheet");
  const photos = name.match(/^(\d+) photos?$/);
  if (photos) return t("srcPhotos", { count: Number(photos[1]) });
  return name;
}

function needsLook(problems: Problem[]) {
  return problems.filter((problem) => !SOFT.includes(problem));
}

function Flag({ problems, t }: { problems: Problem[]; t: Say }) {
  const look = needsLook(problems);
  const soft = problems.filter((problem) => SOFT.includes(problem));
  if (!look.length && !soft.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {look.length ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warning-light)] px-2 py-0.5 text-xs font-bold text-[var(--warning)]">
          <AlertTriangle size={12} /> {t("needsLook")}: {look.map((problem) => t(`p_${problem}`)).join(", ")}
        </span>
      ) : null}
      {soft.map((problem) => (
        <span className="rounded-full bg-[var(--panel-secondary)] px-2 py-0.5 text-xs font-bold text-[var(--info)]" key={problem}>
          {t(`p_${problem}`)}
        </span>
      ))}
    </div>
  );
}

function Include({ checked, onChange, t }: { checked: boolean; onChange: (value: boolean) => void; t: Say }) {
  return (
    <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--foreground-secondary)]">
      <input checked={checked} className="h-5 w-5" onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      {t("bringIn")}
    </label>
  );
}

function More({ total, shown, onMore, t }: { total: number; shown: number; onMore: () => void; t: Say }) {
  if (total <= shown) return null;
  return (
    <button className="mt-3 text-sm font-bold text-[var(--primary)]" onClick={onMore} type="button">
      {t("showAll", { count: total })}
    </button>
  );
}

export function ImportWizard({ recent = [] }: { defaultImportType?: string; recent?: RecentImport[] }) {
  const t = useTranslations("importer") as unknown as Say;
  const locale = useLocale();
  const [file, setFile] = useState<File | null>(null);
  // Photos of registration books, notebook pages and lists (up to 8).
  const [photos, setPhotos] = useState<File[]>([]);
  const [sheetUrl, setSheetUrl] = useState("");
  // Messages pasted from a LINE or WhatsApp chat.
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  // Earlier imports show three; the rest are one tap away.
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [status, setStatus] = useState<"idle" | "analyzing" | "review" | "remapping" | "importing" | "done" | "error">("idle");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  // The business's vehicles, for rentals whose vehicle the file doesn't name.
  const [fleet, setFleet] = useState<{ id: string; label: string }[]>([]);
  const [mappings, setMappings] = useState<SheetMapping[]>([]);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [tab, setTab] = useState<"vehicles" | "rentals" | "customers" | "transactions">("vehicles");
  const [shown, setShown] = useState(SHOW);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [undone, setUndone] = useState<Set<string>>(new Set());

  const counts = useMemo(() => (preview ? previewCounts(preview) : null), [preview]);
  const questions = useMemo(() => (preview ? importQuestions(mappings, preview) : []), [mappings, preview]);

  function answer(question: ImportQuestion, value: string) {
    const next = answerQuestion(mappings, question, value) as SheetMapping[];
    setMappings(next);
    void remap(next);
  }
  const clashes = useMemo(
    () =>
      mappings.map((sheet) => {
        const seen = new Map<string, number>();
        sheet.column_mappings.forEach((mapping) => {
          if (mapping.routehq_field && mapping.routehq_field !== "__ignore__") seen.set(mapping.routehq_field, (seen.get(mapping.routehq_field) || 0) + 1);
        });
        return new Set(Array.from(seen.entries()).filter(([, count]) => count > 1).map(([field]) => field));
      }),
    [mappings]
  );
  const hasClashes = clashes.some((set) => set.size > 0);

  function reset() {
    setPreview(null);
    setMappings([]);
    setResult(null);
    setBatchId(null);
    setStatus("idle");
    setError("");
    setNotice("");
    setMappingOpen(false);
    setShown(SHOW);
  }

  async function analyzeFile() {
    if (!file && !sheetUrl.trim() && !photos.length && !chatText.trim()) {
      setError(t("needFile"));
      setStatus("error");
      return;
    }
    setError("");
    setNotice("");
    setStatus("analyzing");
    const formData = new FormData();
    if (chatText.trim()) {
      formData.append("chatText", chatText.trim());
    } else if (photos.length) {
      // Smaller photos upload faster and still read well.
      for (const photo of photos) formData.append("photo", await compressImage(photo, 1800, 0.82));
    } else {
      if (file) formData.append("file", file);
      formData.append("sheetUrl", sheetUrl.trim());
    }
    const response = await fetch("/api/import/analyze", { method: "POST", body: formData });
    const payload = await response.json().catch(() => ({ error: t("readFailed") }));
    if (!response.ok) {
      setError(payload.error || t("readFailed"));
      setStatus("error");
      return;
    }
    setMappings(payload.analysis?.sheets || []);
    setPreview(payload.preview || { vehicles: [], rentals: [], customers: [], transactions: [] });
    setFleet(Array.isArray(payload.fleet) ? payload.fleet : []);
    setBatchId(payload.batchId || null);
    setNotice(payload.warning || "");
    const next = payload.preview as ImportPreview | undefined;
    setTab(next?.vehicles.length ? "vehicles" : next?.rentals.length ? "rentals" : next?.customers.length ? "customers" : "transactions");
    setStatus("review");
  }

  async function remap(next: SheetMapping[] = mappings) {
    if (!batchId) return;
    setStatus("remapping");
    const response = await fetch("/api/import/remap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId, mappings: next }) });
    const payload = await response.json().catch(() => ({}));
    if (response.ok && payload.preview) {
      setPreview(payload.preview);
      setMappingOpen(false);
    } else setError(payload.error || t("readFailed"));
    setStatus("review");
  }

  async function executeImport() {
    if (!batchId || !preview) return;
    setStatus("importing");
    setError("");
    const response = await fetch("/api/import/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId, preview }) });
    const payload = await response.json().catch(() => ({ error: t("importFailed") }));
    if (!response.ok) {
      setError(payload.error || t("importFailed"));
      if (payload.counts) setResult({ ...payload, batchId });
      setStatus("error");
      return;
    }
    setResult(payload);
    setStatus("done");
  }

  async function undo(id: string) {
    const response = await fetch("/api/import/undo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId: id }) });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setUndone((current) => new Set([...current, id]));
    else setError(payload.error || t("importFailed"));
  }

  function patch<K extends keyof ImportPreview>(list: K, key: string, changes: Partial<ImportPreview[K][number]>) {
    setPreview((current) => (current ? { ...current, [list]: current[list].map((item) => (item.key === key ? { ...item, ...changes } : item)) } : current));
  }

  function updateMapping(sheetIndex: number, columnIndex: number, routehqField: string) {
    setMappings((current) =>
      current.map((sheet, index) =>
        index === sheetIndex ? { ...sheet, column_mappings: sheet.column_mappings.map((mapping, column) => (column === columnIndex ? { ...mapping, routehq_field: routehqField } : mapping)) } : sheet
      )
    );
  }

  const vehicleLabel = (plate: string, vehicleKey: string | null, existingVehicleId?: string | null) => {
    const own = vehicleKey && preview?.vehicles.find((vehicle) => vehicle.key === vehicleKey);
    if (own) return `${own.make} ${own.model} ${own.plate}`.trim();
    const inFleet = existingVehicleId && fleet.find((vehicle) => vehicle.id === existingVehicleId);
    return plate || (inFleet ? inFleet.label : t("noPlate"));
  };

  return (
    <div className="space-y-5">
      {/* 1. The file */}
      {/* One left edge for everything in the card: help first, then the inputs, then the button that reads them. */}
      <section className="card p-4">
        <h2 className="card-title flex items-center gap-2">
          <FileSpreadsheet aria-hidden="true" className="shrink-0 text-[var(--primary)]" size={20} />
          {t("s1")}
        </h2>
        <p className="measure mt-1 text-sm text-[var(--foreground-secondary)]">{t("s1Body")}</p>
        <p className="measure mt-1 text-sm text-[var(--muted)]">{chatText.trim() ? t("chatWorks") : photos.length ? t("photosWork") : t("whatWorks")}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block min-w-0">
            <span className="secondary-action pressable w-full cursor-pointer">
              <FileSpreadsheet aria-hidden="true" className="shrink-0" size={18} />
              <span className="truncate">{file ? file.name : t("file")}</span>
            </span>
            <input
              accept=".csv,.xlsx,.xls,.ics,.txt,text/csv,text/calendar,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setSheetUrl("");
                setPhotos([]);
                setChatText("");
                reset();
              }}
              type="file"
            />
          </label>
          <label className="block min-w-0">
            <span className="secondary-action pressable w-full cursor-pointer">
              <Camera className="shrink-0" size={18} />
              {photos.length ? t("photosChosen", { count: photos.length }) : t("photos")}
            </span>
            <input
              accept="image/*"
              className="sr-only"
              multiple
              onChange={(event) => {
                const picked = Array.from(event.target.files || []);
                event.target.value = "";
                if (!picked.length) return;
                setPhotos((current) => [...current, ...picked].slice(0, 8));
                setFile(null);
                setSheetUrl("");
                setChatText("");
                reset();
              }}
              type="file"
            />
          </label>
          <label className="col-span-2 block">
            <span className="sr-only">{t("orLink")}</span>
            <input
              className={`${inputClass} mt-0 h-11 !py-0`}
              onChange={(event) => {
                setSheetUrl(event.target.value);
                setFile(null);
                setPhotos([]);
                setChatText("");
                reset();
              }}
              placeholder={t("orLink")}
              type="url"
              value={sheetUrl}
            />
          </label>
        </div>
        {photos.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {photos.map((photo, index) => (
              <li className="flex max-w-full items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel)] py-1 pl-3 pr-1.5 text-sm font-medium" key={`${photo.name}-${index}`}>
                <span className="truncate">{photo.name}</span>
                <button aria-label={t("removePhoto", { name: photo.name })} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-[var(--panel-secondary)]" onClick={() => { setPhotos((current) => current.filter((_, at) => at !== index)); reset(); }} type="button">
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {chatOpen ? (
          <label className="mt-3 block text-sm font-semibold text-[var(--foreground)]">
            {t("chatLabel")}
            <textarea
              className={`${inputClass} min-h-[9rem] font-normal`}
              onChange={(event) => {
                setChatText(event.target.value);
                if (event.target.value) {
                  setFile(null);
                  setSheetUrl("");
                  setPhotos([]);
                }
                reset();
              }}
              placeholder={t("chatPlaceholder")}
              value={chatText}
            />
          </label>
        ) : (
          <button className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)]" onClick={() => setChatOpen(true)} type="button">
            <MessageSquareText size={16} />
            {t("chatOpen")}
          </button>
        )}
        <button
          className="primary-action pressable mt-4 w-full sm:w-auto"
          disabled={status === "analyzing" || (!file && !sheetUrl.trim() && !photos.length && !chatText.trim())}
          onClick={analyzeFile}
          title={!file && !sheetUrl.trim() && !photos.length && !chatText.trim() ? t("readNeeds") : undefined}
          type="button"
        >
          {status === "analyzing" ? <Loader2 className="animate-spin" size={18} /> : null}
          {status === "analyzing" ? (photos.length ? t("readingPhotos", { count: photos.length }) : t("reading")) : t("read")}
        </button>
        {error ? <p className="mt-3 rounded-lg bg-[var(--danger-light)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
        <p className="mt-3 text-sm">
          <Link className="font-semibold text-[var(--primary)]" href={"/help?topic=import" as any}>
            {t("sendToUs")}
          </Link>
        </p>
      </section>

      {/* 2. What we found, in Lokalfleet's shape */}
      {(status === "review" || status === "remapping" || status === "importing") && preview && counts ? (
        <section className="card p-4">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">{t("foundTitle")}</h2>
          <p className="mt-1 text-[16px] font-medium text-[var(--foreground)]">
            {t("foundLine", { vehicles: counts.vehicles, rentals: counts.rentals, rentedNow: counts.rentedNow, customers: counts.customers, transactions: counts.transactions })}
            {counts.needsLook ? <span className="text-[var(--warning)]"> {t("foundLook", { count: counts.needsLook })}</span> : null}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("foundBody")}</p>
          {notice ? <p className="mt-3 rounded-lg bg-[var(--warning-light)] px-3 py-2 text-sm font-semibold text-[var(--warning)]">{notice}</p> : null}
          <QuickQuestions busy={status !== "review"} locale={locale} onAnswer={answer} questions={questions} t={t} />

          <div className="mt-4 flex flex-wrap gap-2">
            {(["vehicles", "rentals", "customers", "transactions"] as const).map((key) => {
              const count = key === "rentals" ? counts.rentals : counts[key];
              const look = preview[key].filter((item) => item.include && needsLook(item.problems).length).length;
              return (
                <button
                  className={`pressable rounded-full px-4 py-2 text-sm font-bold ${tab === key ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`}
                  key={key}
                  onClick={() => {
                    setTab(key);
                    setShown(SHOW);
                  }}
                  type="button"
                >
                  {t(`tab_${key}`)} · {count}
                  {look ? <span className={`ml-1 ${tab === key ? "opacity-90" : "text-[var(--warning)]"}`}>({look})</span> : null}
                </button>
              );
            })}
          </div>

          <div className="mt-4 space-y-3">
            {tab === "vehicles" ? (
              preview.vehicles.length ? (
                preview.vehicles.slice(0, shown).map((vehicle) => <VehicleCard key={vehicle.key} onChange={(changes) => patch("vehicles", vehicle.key, changes)} t={t} vehicle={vehicle} />)
              ) : (
                <p className="text-sm text-[var(--muted)]">{t("noneHere")}</p>
              )
            ) : null}
            {tab === "rentals" ? (
              preview.rentals.length ? (
                preview.rentals.slice(0, shown).map((rental) => <RentalCard
                    choices={[...fleet.map((vehicle) => ({ value: `fleet:${vehicle.id}`, label: vehicle.label })), ...preview.vehicles.filter((vehicle) => vehicle.include && !vehicle.existingId).map((vehicle) => ({ value: `new:${vehicle.key}`, label: `${vehicle.make} ${vehicle.model} ${vehicle.plate}`.trim() }))]}
                    key={rental.key}
                    onChange={(changes) => patch("rentals", rental.key, changes)}
                    rental={rental}
                    t={t}
                    vehicleLabel={vehicleLabel(rental.plate, rental.vehicleKey, rental.existingVehicleId)}
                  />)
              ) : (
                <p className="text-sm text-[var(--muted)]">{t("noneHere")}</p>
              )
            ) : null}
            {tab === "customers" ? (
              preview.customers.length ? (
                preview.customers.slice(0, shown).map((customer) => <CustomerCard customer={customer} key={customer.key} onChange={(changes) => patch("customers", customer.key, changes)} t={t} />)
              ) : (() => {
                // No customer list in the file, but the renters become customers: say so, and who (the count above includes them).
                const renters = preview.rentals.filter((rental) => rental.include && rental.customerName);
                const unique = renters.filter((rental, index) => renters.findIndex((other) => (other.phone && other.phone === rental.phone) || other.customerName.toLowerCase() === rental.customerName.toLowerCase()) === index);
                return unique.length ? (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] p-4 text-sm">
                    <p className="font-semibold text-[var(--foreground)]">{t("customersFromRentals", { count: unique.length })}</p>
                    <ul className="mt-2 space-y-1 text-[var(--foreground-secondary)]">
                      {unique.map((rental) => (
                        <li key={rental.key}>
                          {rental.customerName}
                          {rental.phone ? <span className="text-[var(--muted)]"> · {rental.phone}</span> : null}
                          {rental.existingCustomer ? <span className="text-[var(--muted)]"> · {t("alreadySaved")}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--muted)]">{t("noneHere")}</p>
                );
              })()
            ) : null}
            {tab === "transactions" ? (
              preview.transactions.length ? (
                preview.transactions.slice(0, shown).map((transaction) => <TransactionRow key={transaction.key} onChange={(changes) => patch("transactions", transaction.key, changes)} t={t} transaction={transaction} vehicleLabel={transaction.business ? t("businessCost") : vehicleLabel(transaction.plate, transaction.vehicleKey)} />)
              ) : (
                <p className="text-sm text-[var(--muted)]">{t("noneHere")}</p>
              )
            ) : null}
            <More onMore={() => setShown((value) => value + 200)} shown={shown} t={t} total={preview[tab].length} />
          </div>

          {/* The column mapping, for the rare case the reading was wrong. */}
          <details className="mt-5 rounded-lg border border-[var(--border)] bg-white p-3" onToggle={(event) => setMappingOpen((event.target as HTMLDetailsElement).open)} open={mappingOpen}>
            <summary className="cursor-pointer font-bold text-[var(--foreground)]">{t("s2")}</summary>
            <p className="mt-2 text-sm text-[var(--muted)]">{t("s2Body")}</p>
            <div className="mt-3 space-y-4">
              {mappings.map((sheet, sheetIndex) => (
                <div className="rounded-lg border border-[var(--border)] p-3" key={sheet.sheet_name}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold text-[var(--foreground)]">
                      {sheet.sheet_name} <span className="font-medium text-[var(--muted)]">· {t("rows", { count: sheet.row_count ?? 0 })}</span>
                    </p>
                    <label className="block sm:max-w-[260px]">
                      <span className="sr-only">{t("eachRow")}</span>
                      <select className={smallInput} onChange={(event) => setMappings((current) => current.map((item, index) => (index === sheetIndex ? { ...item, primary_data_type: event.target.value } : item)))} value={sheet.primary_data_type}>
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
                                <select aria-label={`${t("thAs")}: ${mapping.source_column}`} className={`${smallInput} mt-0 ${clash ? "border-[var(--danger)]" : ""}`} onChange={(event) => updateMapping(sheetIndex, columnIndex, event.target.value)} value={mapping.routehq_field || "__ignore__"}>
                                  <option value="__ignore__">{t("ignore")}</option>
                                  {IMPORT_FIELD_GROUPS.map((group) => (
                                    <optgroup key={group} label={t(`g_${group.replace(/ /g, "_")}`)}>
                                      {IMPORT_FIELDS.filter((field) => field.group === group).map((field) => (
                                        <option key={field.key} value={field.key}>
                                          {t(`f_${field.key}`)}
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
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
              <p className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--danger-light)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">
                <AlertTriangle size={16} /> {t("clashAll")}
              </p>
            ) : null}
            <button className="secondary-action pressable mt-3" disabled={hasClashes || status === "remapping"} onClick={() => void remap()} type="button">
              {status === "remapping" ? <Loader2 className="animate-spin" size={16} /> : null}
              {t("reread")}
            </button>
          </details>

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button className="secondary-action pressable" onClick={reset} type="button">
              <RotateCcw size={17} />
              {t("again")}
            </button>
            <button className="primary-action pressable" disabled={status === "importing" || hasClashes} onClick={executeImport} type="button">
              {status === "importing" ? <Loader2 className="animate-spin" size={18} /> : null}
              {status === "importing" ? t("importing") : t("bringItIn")}
            </button>
          </div>
          <p className="mt-2 text-right text-xs text-[var(--muted)]">{t("undoNote")}</p>
        </section>
      ) : null}

      {/* 3. Done */}
      {(status === "done" || (status === "error" && result)) && result ? (
        <section className="card p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="text-[var(--success)]" size={28} />
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">{t("done")}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{t("doneBody")}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["vehicles", "customers", "rentals", "transactions"] as const).map((key) => (
              <div className="rounded-lg border border-[var(--border)] bg-white p-3" key={key}>
                <p className="text-xs font-bold uppercase text-[var(--muted)]">{t(`tab_${key}`)}</p>
                <p className="text-2xl font-semibold text-[var(--foreground)]">{Number(result.counts[key] || 0).toLocaleString("en-US")}</p>
                {key === "vehicles" && result.counts.vehiclesUpdated ? <p className="text-xs font-medium text-[var(--muted)]">{t("updated", { count: result.counts.vehiclesUpdated })}</p> : null}
              </div>
            ))}
          </div>
          {result.counts.tasks ? (
            <p className="mt-3 rounded-lg bg-[var(--warning-light)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]">
              {t("tasksMade", { count: result.counts.tasks })}{" "}
              <Link className="font-bold text-[var(--primary)]" href="/tasks">
                {t("openTodo")}
              </Link>
            </p>
          ) : null}
          {result.failed.length ? (
            <div className="mt-3 rounded-lg border border-[var(--warning-line)] bg-[var(--warning-light)] p-3">
              <p className="font-bold text-[var(--warning)]">
                {t("notImported")} ({result.failed.length})
              </p>
              <ul className="mt-2 space-y-1 text-sm text-[var(--foreground-secondary)]">
                {result.failed.slice(0, 20).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
            {!undone.has(result.batchId) ? (
              <button className="secondary-action pressable" onClick={() => undo(result.batchId)} type="button">
                <Undo2 size={16} /> {t("undo")}
              </button>
            ) : (
              <span className="self-center text-sm font-semibold text-[var(--muted)]">{t("undone")}</span>
            )}
            <button className="secondary-action pressable" onClick={reset} type="button">
              {t("another")}
            </button>
            <Link className="primary-action pressable" href="/fleet">
              {t("viewFleet")}
            </Link>
          </div>
        </section>
      ) : null}

      {/* Earlier imports, each one undoable for 30 days */}
      {recent.length ? (
        <section className="card p-4">
          <h2 className="card-title">{t("recentTitle")}</h2>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {(showAllRecent ? recent : recent.slice(0, 3)).map((item) => {
              const gone = item.status === "undone" || undone.has(item.id);
              // Only what came in: "3 vehicles · 4 rentals", never "0 customers, 0 money records".
              const countLine = (["vehicles", "rentals", "customers", "transactions"] as const)
                .filter((key) => Number(item.counts[key] || 0) > 0)
                .map((key) => t(`cnt_${key}`, { count: Number(item.counts[key]) }))
                .join(" · ");
              const when = `${longDate(item.createdAt.slice(0, 10), locale)}, ${new Date(item.createdAt).toLocaleTimeString(numberLocale(locale), { hour: "2-digit", minute: "2-digit" })}`;
              return (
                <li className="flex flex-wrap items-center justify-between gap-2 py-2.5" key={item.id}>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-[var(--foreground)]">
                      {sourceLabel(item.sourceName, t)}
                      <span className={`badge inline-flex items-center ${gone ? "bg-[var(--panel-tertiary)] text-[var(--muted)]" : "bg-[var(--success-light)] text-[var(--success)]"}`}>{gone ? t("undone") : t("imported")}</span>
                    </p>
                    <p className="text-sm text-[var(--muted)]">{[when, countLine].filter(Boolean).join(" · ")}</p>
                  </div>
                  {!gone && item.status === "imported" ? (
                    <button className="secondary-action pressable min-h-10 px-3 text-sm" onClick={() => undo(item.id)} type="button">
                      <Undo2 size={15} /> {t("undo")}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {recent.length > 3 && !showAllRecent ? (
            <button className="mt-1 text-sm font-semibold text-[var(--primary)]" onClick={() => setShowAllRecent(true)} type="button">
              {t("showAll", { count: recent.length })}
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function VehicleCard({ vehicle, onChange, t }: { vehicle: PreviewVehicle; onChange: (changes: Partial<PreviewVehicle>) => void; t: Say }) {
  const faded = !vehicle.include ? "opacity-50" : "";
  return (
    <div className={`rounded-xl border border-[var(--border)] bg-white p-3 ${faded}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-bold text-[var(--foreground)]">
            {vehicle.make || t("unknownMake")} {vehicle.model} <span className="font-medium text-[var(--muted)]">{vehicle.plate || t("noPlate")}</span>
          </p>
          <p className="text-xs text-[var(--muted)]">{rowLabel(vehicle.sheet, vehicle.row, t)}</p>
        </div>
        <Include checked={vehicle.include} onChange={(include) => onChange({ include })} t={t} />
      </div>
      <Flag problems={vehicle.problems} t={t} />
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="block text-xs font-semibold text-[var(--muted)]">
          {t("c_plate")}
          <input className={smallInput} onChange={(event) => onChange({ plate: event.target.value.toUpperCase() })} value={vehicle.plate} />
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          {t("c_make")}
          <input className={smallInput} onChange={(event) => onChange({ make: event.target.value })} value={vehicle.make} />
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          {t("c_model")}
          <input className={smallInput} onChange={(event) => onChange({ model: event.target.value })} value={vehicle.model} />
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          {t("c_year")}
          <input className={smallInput} inputMode="numeric" maxLength={4} onChange={(event) => onChange({ year: event.target.value ? Number(event.target.value) : null })} value={vehicle.year ?? ""} />
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          {t("c_mileage")}
          <input className={smallInput} inputMode="numeric" onChange={(event) => onChange({ mileage: event.target.value ? Number(event.target.value) : null })} value={vehicle.mileage ?? ""} />
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          {t("c_daily")}
          <input className={smallInput} inputMode="numeric" onChange={(event) => onChange({ dailyRate: event.target.value ? Number(event.target.value) : null })} value={vehicle.dailyRate ?? ""} />
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          {t("c_weekly")}
          <input className={smallInput} inputMode="numeric" onChange={(event) => onChange({ weeklyRate: event.target.value ? Number(event.target.value) : null })} value={vehicle.weeklyRate ?? ""} />
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          {t("c_monthly")}
          <input className={smallInput} inputMode="numeric" onChange={(event) => onChange({ monthlyRate: event.target.value ? Number(event.target.value) : null })} value={vehicle.monthlyRate ?? ""} />
        </label>
      </div>
    </div>
  );
}

function RentalCard({ rental, vehicleLabel, choices, onChange, t }: { rental: PreviewRental; vehicleLabel: string; choices: { value: string; label: string }[]; onChange: (changes: Partial<PreviewRental>) => void; t: Say }) {
  // The file doesn't say which vehicle (another system's export often has only its own car number): the owner picks.
  const needsVehicle = rental.problems.includes("unknown_vehicle") || rental.problems.includes("no_plate");
  const [choosing] = useState(needsVehicle);
  const wanted = (rental.vehicleName || "").toLowerCase().split(/\s+/).filter((word) => word.length > 1);
  const score = (label: string) => wanted.filter((word) => label.toLowerCase().includes(word)).length;
  const ordered = wanted.length ? [...choices].sort((a, b) => score(b.label) - score(a.label)) : choices;
  const picked = rental.existingVehicleId ? `fleet:${rental.existingVehicleId}` : rental.vehicleKey ? `new:${rental.vehicleKey}` : "";
  const faded = !rental.include ? "opacity-50" : "";
  return (
    <div className={`rounded-xl border border-[var(--border)] bg-white p-3 ${faded}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-bold text-[var(--foreground)]">
            {rental.customerName || t("unnamed")} <span className="font-medium text-[var(--muted)]">· {vehicleLabel}</span>
          </p>
          <p className="text-xs text-[var(--muted)]">
            <span className={`mr-2 rounded-full px-2 py-0.5 font-bold ${rental.status === "active" ? "bg-[var(--primary-light)] text-[var(--primary)]" : "bg-[var(--panel-secondary)] text-[var(--foreground-secondary)]"}`}>{t(`st_${rental.status}`)}</span>
            {rowLabel(rental.sheet, rental.row, t)}
          </p>
        </div>
        <Include checked={rental.include} onChange={(include) => onChange({ include })} t={t} />
      </div>
      <Flag problems={rental.problems} t={t} />
      {choosing ? (
        <label className="mt-2 block text-xs font-semibold text-[var(--warning)]">
          {t("c_whichVehicle")}
          <select
            className={`${smallInput} border-[var(--warning)]`}
            onChange={(event) => {
              const value = event.target.value;
              const cleared = rental.problems.filter((problem) => problem !== "unknown_vehicle" && problem !== "no_plate");
              if (value.startsWith("fleet:")) onChange({ existingVehicleId: value.slice(6), vehicleKey: null, problems: cleared });
              else if (value.startsWith("new:")) onChange({ vehicleKey: value.slice(4), existingVehicleId: null, problems: cleared });
            }}
            value={picked}
          >
            <option value="">{t("c_chooseVehicle")}</option>
            {ordered.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="block text-xs font-semibold text-[var(--muted)]">
          {t("c_customer")}
          <input className={smallInput} onChange={(event) => onChange({ customerName: event.target.value })} value={rental.customerName} />
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          {t("c_phone")}
          <input className={smallInput} inputMode="tel" onChange={(event) => onChange({ phone: event.target.value })} value={rental.phone} />
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          {t("c_start")}
          <input className={smallInput} onChange={(event) => onChange({ startDate: event.target.value || null })} type="date" value={rental.startDate || ""} />
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          {t("c_end")}
          <input className={smallInput} onChange={(event) => onChange({ endDate: event.target.value || null })} type="date" value={rental.endDate || ""} />
        </label>
        <label className="col-span-2 block text-xs font-semibold text-[var(--muted)]">
          {t("c_rent")}
          <span className="mt-1 flex gap-1">
            <input className={`${smallInput} !mt-0 !w-auto min-w-0 flex-1`} inputMode="numeric" onChange={(event) => onChange({ rate: event.target.value ? Number(event.target.value) : null })} value={rental.rate ?? ""} />
            <select aria-label={t("c_ratePer")} className={`${smallInput} !mt-0 !w-28 shrink-0`} onChange={(event) => onChange({ ratePeriod: event.target.value as PreviewRental["ratePeriod"] })} value={rental.ratePeriod || "month"}>
              <option value="day">{t("per_day")}</option>
              <option value="week">{t("per_week")}</option>
              <option value="month">{t("per_month")}</option>
            </select>
          </span>
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          {t("c_deposit")}
          <input className={smallInput} inputMode="numeric" onChange={(event) => onChange({ deposit: event.target.value ? Number(event.target.value) : null, depositHeld: Number(event.target.value) > 0 })} value={rental.deposit ?? ""} />
        </label>
        {rental.status === "active" ? (
          <label className={`block text-xs font-semibold ${rental.paidUntil ? "text-[var(--muted)]" : "text-[var(--warning)]"} sm:col-span-2`}>
            {t("c_paidUntil")}
            <input className={`${smallInput} ${rental.paidUntil ? "" : "border-[var(--warning)]"}`} onChange={(event) => onChange({ paidUntil: event.target.value || null, problems: rental.problems.filter((problem) => problem !== "paid_until_unknown") })} type="date" value={rental.paidUntil || ""} />
          </label>
        ) : null}
      </div>
    </div>
  );
}

function CustomerCard({ customer, onChange, t }: { customer: PreviewCustomer; onChange: (changes: Partial<PreviewCustomer>) => void; t: Say }) {
  const faded = !customer.include ? "opacity-50" : "";
  return (
    <div className={`rounded-xl border border-[var(--border)] bg-white p-3 ${faded}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-bold text-[var(--foreground)]">{customer.fullName || t("unnamed")}</p>
          <p className="text-xs text-[var(--muted)]">{rowLabel(customer.sheet, customer.row, t)}</p>
        </div>
        <Include checked={customer.include} onChange={(include) => onChange({ include })} t={t} />
      </div>
      <Flag problems={customer.problems} t={t} />
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="block text-xs font-semibold text-[var(--muted)]">
          {t("c_customer")}
          <input className={smallInput} onChange={(event) => onChange({ fullName: event.target.value })} value={customer.fullName} />
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          {t("c_phone")}
          <input className={smallInput} inputMode="tel" onChange={(event) => onChange({ phone: event.target.value })} value={customer.phone} />
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          {t("c_email")}
          <input className={smallInput} inputMode="email" onChange={(event) => onChange({ email: event.target.value })} value={customer.email} />
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          {t("c_passport")}
          <input className={smallInput} onChange={(event) => onChange({ passport: event.target.value })} value={customer.passport} />
        </label>
      </div>
    </div>
  );
}

const MONEY_TYPES = ["rental_income", "charge_recovered", "repair", "servicing", "maintenance", "fuel", "insurance", "tax", "finance", "fine", "accessories", "refund", "deposit", "deposit_received", "deposit_refunded", "other"];

function TransactionRow({ transaction, vehicleLabel, onChange, t }: { transaction: PreviewTransaction; vehicleLabel: string; onChange: (changes: Partial<PreviewTransaction>) => void; t: Say }) {
  const faded = !transaction.include ? "opacity-50" : "";
  return (
    <div className={`rounded-xl border border-[var(--border)] bg-white p-3 ${faded}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-bold text-[var(--foreground)]">
          {vehicleLabel} <span className="font-medium text-[var(--muted)]">· {rowLabel(transaction.sheet, transaction.row, t)}</span>
        </p>
        <Include checked={transaction.include} onChange={(include) => onChange({ include })} t={t} />
      </div>
      <Flag problems={transaction.problems} t={t} />
      <div className="mt-2 grid grid-cols-3 gap-2">
        <label className="block text-xs font-semibold text-[var(--muted)]">
          {t("c_date")}
          <input className={smallInput} onChange={(event) => onChange({ date: event.target.value || null })} type="date" value={transaction.date || ""} />
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          {t("c_type")}
          <select className={smallInput} onChange={(event) => onChange({ type: event.target.value })} value={transaction.type}>
            {MONEY_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`mt_${type}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          {t("c_amount")}
          <input className={smallInput} inputMode="numeric" onChange={(event) => onChange({ amount: event.target.value ? Number(event.target.value) : null })} value={transaction.amount ?? ""} />
        </label>
      </div>
      {/* What it was for, as the sheet said it ("Front wipers"): the category above was worked out from this. */}
      <label className="mt-2 block text-xs font-semibold text-[var(--muted)]">
        {t("c_what")}
        <input className={smallInput} onChange={(event) => onChange({ notes: event.target.value })} value={transaction.notes || ""} />
      </label>
    </div>
  );
}
