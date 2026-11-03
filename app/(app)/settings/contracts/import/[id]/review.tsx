"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, Plus, RotateCcw, X } from "lucide-react";
import { chooseImportedAgreement, chooseRoveAgreement, recheckImportedAgreement, saveImportedAgreement } from "@/app/actions/contract-import";
import {
  IMPORT_VARIABLES,
  THAI_CHECKS,
  buildUploadedTemplateHtml,
  isImportVariable,
  type ImportedAgreement,
  type ImportedClause,
  type ImportedField,
  type ThaiCheck
} from "@/lib/contract-import-template";
import { renderContractTemplate } from "@/lib/contract-rendering";

type Say = (key: string, values?: Record<string, string | number>) => string;
const soft = "font-medium text-[var(--foreground-secondary)]";
const ADDED_HEADING = { en: "Thailand rental rules", th: "ข้อกำหนดตามประกาศคณะกรรมการว่าด้วยสัญญา" };

/** A textarea's text back into clauses: one per paragraph (a blank line between clauses). */
function paragraphs(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Pair the first-language clauses with their translations by position; extra translations stay with the last clause. */
function pairClauses(primary: string[], secondary: string[]): ImportedClause[] {
  const clauses: ImportedClause[] = primary.map((text, index) => ({ text, text_secondary: secondary[index] || undefined }));
  if (secondary.length > primary.length && clauses.length) {
    const last = clauses[clauses.length - 1];
    last.text_secondary = [last.text_secondary, ...secondary.slice(primary.length)].filter(Boolean).join("\n");
  }
  return clauses;
}

export function ImportReview({
  id,
  initialDoc,
  initialIncludeDetails,
  initialCheck,
  isActive,
  isThai,
  originals,
  sourceType,
  extractedText,
  sampleData,
  styleCss,
  thaiClauses
}: {
  id: string;
  initialDoc: ImportedAgreement;
  initialIncludeDetails: boolean;
  initialCheck: ThaiCheck | null;
  isActive: boolean;
  isThai: boolean;
  originals: Array<{ url: string; name: string }>;
  sourceType: "pdf" | "docx" | "images";
  extractedText: string;
  sampleData: Record<string, unknown>;
  styleCss: string;
  thaiClauses: Record<string, { en: string; th: string }>;
}) {
  const say = useTranslations("contractImport") as unknown as Say;
  const router = useRouter();
  const [doc, setDoc] = useState<ImportedAgreement>(initialDoc);
  const [includeDetails, setIncludeDetails] = useState(initialIncludeDetails);
  const [check, setCheck] = useState<ThaiCheck | null>(initialCheck);
  const [added, setAdded] = useState<string[]>([]);
  // What is typed in each section's box, kept as typed (re-joining parsed clauses would swallow a half-typed blank line).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const bilingual = doc.sections.some((section) => section.clauses.some((clause) => clause.text_secondary));

  const templateHtml = useMemo(() => buildUploadedTemplateHtml(doc, { styleCss, includeDetails }), [doc, styleCss, includeDetails]);
  const preview = useMemo(() => renderContractTemplate(templateHtml, sampleData), [templateHtml, sampleData]);

  function change(next: ImportedAgreement) {
    setDoc(next);
    setDirty(true);
    setMessage(null);
  }

  function setField(fieldId: string, variable: string) {
    change({ ...doc, fields: doc.fields.map((field) => (field.id === fieldId ? { ...field, variable } : field)) });
  }

  function editSection(index: number, side: "p" | "s", text: string) {
    setDrafts((current) => ({ ...current, [`${index}:${side}`]: text }));
    const section = doc.sections[index];
    const primary = side === "p" ? paragraphs(text) : section.clauses.map((clause) => clause.text);
    const secondary = side === "s" ? paragraphs(text) : section.clauses.map((clause) => clause.text_secondary || "");
    const clauses = pairClauses(primary, secondary);
    change({ ...doc, sections: doc.sections.map((item, i) => (i === index ? { ...item, clauses } : item)) });
  }

  function editHeading(index: number, heading: string) {
    change({ ...doc, sections: doc.sections.map((item, i) => (i === index ? { ...item, heading } : item)) });
  }

  /** "Add this clause": the RoveHQ Thailand wording (content/contracts/th.yaml), English with Thai, in its own section at the end. */
  function addClause(checkId: string) {
    const wording = thaiClauses[checkId];
    if (!wording) return;
    const thaiFirst = doc.languages[0] === "th";
    const clause: ImportedClause = thaiFirst ? { text: wording.th, text_secondary: wording.en } : { text: wording.en, text_secondary: wording.th || undefined };
    const at = doc.sections.findIndex((section) => section.heading === (thaiFirst ? ADDED_HEADING.th : ADDED_HEADING.en));
    const sections =
      at >= 0
        ? doc.sections.map((section, i) => (i === at ? { ...section, clauses: [...section.clauses, clause] } : section))
        : [...doc.sections, { heading: thaiFirst ? ADDED_HEADING.th : ADDED_HEADING.en, heading_secondary: thaiFirst ? ADDED_HEADING.en : ADDED_HEADING.th, clauses: [clause] }];
    // The section's text box shows the new clause too.
    setDrafts((current) => {
      const next = { ...current };
      delete next[`${at >= 0 ? at : sections.length - 1}:p`];
      delete next[`${at >= 0 ? at : sections.length - 1}:s`];
      return next;
    });
    setAdded((current) => [...current, checkId]);
    change({ ...doc, languages: doc.languages.includes("th") ? doc.languages : [...doc.languages, "th"], sections });
  }

  async function save() {
    const result = await saveImportedAgreement(id, doc, includeDetails);
    if (!result.ok) {
      setMessage({ tone: "error", text: result.error });
      return false;
    }
    setDirty(false);
    return true;
  }

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      try {
        await action();
      } catch (error) {
        setMessage({ tone: "error", text: error instanceof Error ? error.message : say("error") });
      }
    });
  }

  const usedIds = new Set(
    doc.sections.flatMap((section) => section.clauses.flatMap((clause) => [...`${clause.text} ${clause.text_secondary || ""}`.matchAll(/\[\[\s*([A-Za-z0-9_-]+)\s*\]\]/g)].map((match) => match[1])))
  );
  const fields = doc.fields.filter((field) => usedIds.has(field.id));

  return (
    <div className="space-y-3">
      <section className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold">{isActive ? say("statusActive") : say("statusDraft")}</p>
          <p className={`text-sm ${soft}`}>{say("signedNeverChange")}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="secondary-action pressable" disabled={pending || !dirty} onClick={() => run(async () => { if (await save()) setMessage({ tone: "ok", text: say("saved") }); router.refresh(); })} type="button">
            {say("save")}
          </button>
          {isActive ? (
            <button className="secondary-action pressable" disabled={pending} onClick={() => run(async () => { const result = await chooseRoveAgreement(); if (!result.ok) setMessage({ tone: "error", text: result.error }); else router.push("/settings/contracts"); })} type="button">
              {say("goBack")}
            </button>
          ) : null}
          <button
            className="primary-action pressable"
            disabled={pending}
            onClick={() =>
              run(async () => {
                if (dirty && !(await save())) return;
                const result = await chooseImportedAgreement(id);
                if (!result.ok) setMessage({ tone: "error", text: result.error });
                else {
                  setMessage({ tone: "ok", text: say("nowInUse") });
                  router.refresh();
                }
              })
            }
            type="button"
          >
            {isActive ? say("saveInUse") : say("useThis")}
          </button>
        </div>
      </section>
      {message ? (
        <p className={`font-semibold ${message.tone === "error" ? "text-[var(--danger)]" : "text-[var(--success,var(--primary))]"}`} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="card-title">{say("originalTitle")}</h2>
          <div className="mt-3 h-[720px] overflow-auto rounded-xl bg-white ring-1 ring-[var(--border)]">
            {sourceType === "images" ? (
              <div className="space-y-3 p-2">
                {originals.map((file, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={say("pageAlt", { number: index + 1 })} className="w-full" key={file.url || index} src={file.url} />
                ))}
              </div>
            ) : sourceType === "pdf" && originals[0]?.url ? (
              <iframe className="h-full w-full" src={originals[0].url} style={{ border: 0 }} title={say("originalTitle")} />
            ) : (
              <pre className="whitespace-pre-wrap p-4 font-sans text-sm text-[#1a1d21]">{extractedText}</pre>
            )}
          </div>
          {originals.length ? (
            <p className="mt-2 text-sm">
              {originals.map((file) => (
                <a className="mr-3 font-bold text-[var(--primary)] underline" href={file.url} key={file.url} rel="noreferrer" target="_blank">
                  {file.name}
                </a>
              ))}
            </p>
          ) : null}
        </section>

        <section className="card p-4">
          <h2 className="card-title">{say("previewTitle")}</h2>
          <p className={`mt-1 text-sm ${soft}`}>{say("previewBody")}</p>
          <div className="mt-3 h-[684px] overflow-hidden rounded-xl bg-white ring-1 ring-[var(--border)]">
            <iframe className="h-full w-full" sandbox="allow-same-origin" srcDoc={preview} style={{ border: 0 }} title={say("previewTitle")} />
          </div>
        </section>
      </div>

      <section className="card p-4">
        <h2 className="card-title">{say("fieldsTitle")}</h2>
        <p className={`mt-1 ${soft}`}>{say("fieldsBody")}</p>
        {fields.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {fields.map((field) => (
              <FieldChip field={field} key={field.id} onChange={(variable) => setField(field.id, variable)} say={say} />
            ))}
          </ul>
        ) : (
          <p className={`mt-3 ${soft}`}>{say("noFields")}</p>
        )}
        <label className="mt-4 flex min-h-11 items-center gap-2">
          <input checked={includeDetails} onChange={(event) => { setIncludeDetails(event.target.checked); setDirty(true); }} type="checkbox" />
          <span className="font-semibold">{say("includeDetails")}</span>
        </label>
      </section>

      {isThai ? (
        <section className="card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="card-title">{say("thTitle")}</h2>
            <button
              className="pressable flex min-h-11 items-center gap-1 px-2 font-bold text-[var(--primary)]"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  if (dirty && !(await save())) return;
                  const result = await recheckImportedAgreement(id);
                  if (result.ok) {
                    setCheck(result.check || null);
                    setAdded([]);
                  } else setMessage({ tone: "error", text: result.error });
                })
              }
              type="button"
            >
              <RotateCcw size={16} />
              {say("thRecheck")}
            </button>
          </div>
          <p className={`mt-1 ${soft}`}>{say("thBody")}</p>
          {check ? (
            <ul className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {THAI_CHECKS.map((item) => {
                const result = check.items.find((entry) => entry.id === item.id);
                const covered = Boolean(result?.present) || added.includes(item.id);
                return (
                  <li className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between" key={item.id}>
                    <div className="flex items-start gap-2">
                      {covered ? <Check className="mt-0.5 shrink-0 text-[var(--success,var(--primary))]" size={18} /> : <AlertTriangle className="mt-0.5 shrink-0 text-[var(--warning,#b45309)]" size={18} />}
                      <div>
                        <p className="font-semibold">{say(`th_${item.id}`)}</p>
                        {added.includes(item.id) ? <p className={`text-sm ${soft}`}>{say("thAdded")}</p> : result?.note && !covered ? <p className={`text-sm ${soft}`}>{result.note}</p> : null}
                      </div>
                    </div>
                    {!covered && thaiClauses[item.id] ? (
                      <button className="secondary-action pressable shrink-0" onClick={() => addClause(item.id)} type="button">
                        <Plus size={16} />
                        {say("thAdd")}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={`mt-3 ${soft}`}>{say("thNotRun")}</p>
          )}
        </section>
      ) : null}

      <section className="card p-4">
        <h2 className="card-title">{say("wordingTitle")}</h2>
        <p className={`mt-1 ${soft}`}>{say("wordingBody")}</p>
        <label className="mt-3 block">
          <span className="font-semibold text-[var(--foreground-secondary)]">{say("agreementTitle")}</span>
          <input className="mt-1 w-full" maxLength={200} onChange={(event) => change({ ...doc, title: event.target.value })} value={doc.title} />
        </label>
        <div className="mt-3 space-y-4">
          {doc.sections.map((section, index) => (
            <div className="space-y-2 border-t border-[var(--border)] pt-3" key={index}>
              <label className="block">
                <span className="font-semibold text-[var(--foreground-secondary)]">{say("sectionHeading", { number: index + 1 })}</span>
                <input className="mt-1 w-full" maxLength={200} onChange={(event) => editHeading(index, event.target.value)} value={section.heading} />
              </label>
              <textarea
                aria-label={say("sectionText", { number: index + 1 })}
                className="w-full"
                onChange={(event) => editSection(index, "p", event.target.value)}
                rows={Math.min(14, Math.max(4, section.clauses.length * 3))}
                value={drafts[`${index}:p`] ?? section.clauses.map((clause) => clause.text).join("\n\n")}
              />
              {bilingual ? (
                <textarea
                  aria-label={say("sectionTranslation", { number: index + 1 })}
                  className="w-full"
                  onChange={(event) => editSection(index, "s", event.target.value)}
                  rows={Math.min(14, Math.max(4, section.clauses.length * 3))}
                  value={drafts[`${index}:s`] ?? section.clauses.map((clause) => clause.text_secondary || "").join("\n\n")}
                />
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** One blank from the original: which booking detail fills it, a line to write on, or put the original text back. */
function FieldChip({ field, onChange, say }: { field: ImportedField; onChange: (variable: string) => void; say: Say }) {
  const removed = field.variable === "";
  const value = isImportVariable(field.variable) ? field.variable : field.variable.startsWith("custom:") ? "custom" : "";
  const label = field.label || field.placeholder_text_in_original;
  return (
    <li className={`flex items-center gap-1 rounded-full py-1 pl-3 pr-1 ring-1 ring-[var(--border)] ${removed ? "opacity-60" : "bg-[var(--panel-secondary)]"}`}>
      <span className="text-sm font-semibold">
        [[{field.id}]] {label}
      </span>
      {removed ? (
        <button className="pressable flex min-h-9 items-center gap-1 px-2 text-sm font-bold text-[var(--primary)]" onClick={() => onChange(`custom:${field.label || "Other"}`)} type="button">
          {say("putBack")}
        </button>
      ) : (
        <>
          <select aria-label={say("fieldSelect", { label })} className="min-h-9 text-sm" onChange={(event) => onChange(event.target.value === "custom" ? `custom:${field.label || "Other"}` : event.target.value)} value={value}>
            {IMPORT_VARIABLES.map((variable) => (
              <option key={variable.key} value={variable.key}>
                {say(`v_${variable.key}`)}
              </option>
            ))}
            <option value="custom">{say("customLine")}</option>
          </select>
          <button aria-label={say("fieldRemove", { label })} className="pressable flex min-h-9 min-w-9 items-center justify-center" onClick={() => onChange("")} type="button">
            <X size={16} />
          </button>
        </>
      )}
    </li>
  );
}
