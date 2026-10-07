"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, RotateCcw, Save } from "lucide-react";
import { supportedLocaleOptions } from "@/lib/i18n/locales";
import { resetContractTemplate, saveContractTemplate } from "@/app/actions/contracts";
import { PendingButton } from "@/components/pending-button";
import { renderContractTemplate } from "@/lib/contract-rendering";

const inputClass = "mt-1 w-full";
const labelClass = "font-semibold text-[var(--foreground-secondary)]";

type Variable = {
  key: string;
  token: string;
};

export function ContractTemplateEditor({
  organizationId,
  sampleData,
  template,
  variables
}: {
  organizationId: string;
  sampleData: Record<string, unknown>;
  template: any;
  variables: Variable[];
}) {
  const say = useTranslations("settingsPage") as unknown as (key: string) => string;
  const [name, setName] = useState<string>(template.name || template.title || "Standard rental agreement");
  const [language, setLanguage] = useState<string>(template.language || template.locale || "en");
  const [content, setContent] = useState<string>(template.content_html || template.body || "");
  const [previewOpen, setPreviewOpen] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preview = useMemo(() => renderContractTemplate(content, sampleData), [content, sampleData]);

  function insertVariable(token: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((current) => `${current}${token}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = `${content.slice(0, start)}${token}${content.slice(end)}`;
    setContent(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = start + token.length;
      textarea.selectionEnd = start + token.length;
    });
  }

  function openPreviewWindow() {
    // Opened from a file-like address: a blank window asked for with "noopener" hands nothing back to write into, so this button used to do nothing.
    const url = URL.createObjectURL(new Blob([`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><body style="font-family: system-ui, sans-serif; max-width: 820px; margin: 24px auto; padding: 0 16px; line-height: 1.6">${preview}</body>`], { type: "text/html" }));
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
      <form action={saveContractTemplate} className="card p-4">
        <input name="organizationId" type="hidden" value={organizationId} />
        <input name="templateId" type="hidden" value={template.id} />
        <input name="contentHtml" type="hidden" value={content} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>{say("ct_name")}</span>
            <input className={inputClass} name="name" onChange={(event) => setName(event.target.value)} value={name} />
          </label>
          <label className="block">
            <span className={labelClass}>{say("ct_language")}</span>
            <select className={inputClass} name="language" onChange={(event) => setLanguage(event.target.value)} value={language}>
              {supportedLocaleOptions.some((option) => option.code === language) ? null : <option value={language}>{language}</option>}
              {supportedLocaleOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-4 block">
          <span className={labelClass}>{say("ct_wording")}</span>
          <textarea
            className={`${inputClass} font-mono text-[14px] leading-6`}
            onChange={(event) => setContent(event.target.value)}
            ref={textareaRef}
            spellCheck={false}
            style={{ minHeight: 420 }}
            value={content}
          />
        </label>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <PendingButton className="primary-action flex-1" pendingLabel={say("saving")} savedLabel={say("saved")} type="submit">
            <Save size={18} />
            {say("save")}
          </PendingButton>
          <button
            className="secondary-action pressable flex-1 text-[var(--primary)]"
            onClick={openPreviewWindow}
            type="button"
          >
            <Eye size={18} />
            {say("ct_openPreview")}
          </button>
          <button
            className="secondary-action pressable flex-1"
            onClick={() => setPreviewOpen((current) => !current)}
            type="button"
          >
            <Eye size={18} />
            {previewOpen ? say("ct_hide") : say("ct_show")}
          </button>
        </div>
      </form>

      <aside className="space-y-4">
        <section className="card p-4">
          <h2 className="text-[17px] font-bold text-[var(--foreground)]">{say("ct_fields")}</h2>
          <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{say("ct_fieldsBody")}</p>
          <div className="mt-4 grid gap-2">
            {variables.map((variable) => (
              <button
                className="pressable rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-left font-mono text-[14px] font-bold text-[var(--primary)]"
                key={variable.key}
                onClick={() => insertVariable(variable.token)}
                type="button"
              >
                {variable.token}
              </button>
            ))}
          </div>
        </section>

        <form action={resetContractTemplate} className="card p-4" onSubmit={(event) => {
          if (!window.confirm(say("ct_resetConfirm"))) {
            event.preventDefault();
          }
        }}>
          <input name="organizationId" type="hidden" value={organizationId} />
          <PendingButton className="secondary-action w-full" pendingLabel={say("ct_resetting")} type="submit">
            <RotateCcw size={18} />
            {say("ct_reset")}
          </PendingButton>
          <p className="mt-2 font-medium text-[var(--foreground-secondary)]">{say("ct_resetBody")}</p>
        </form>
      </aside>

      {previewOpen ? (
        <section className="card p-4 xl:col-span-2">
          <h2 className="text-[17px] font-bold text-[var(--foreground)]">{say("ct_sample")}</h2>
          {/* In its own frame: the agreement carries its own styles, and written straight into the page they restyled the whole screen. */}
          <iframe className="mt-3 w-full rounded-xl bg-white" sandbox="" srcDoc={preview} style={{ height: 720, border: "1px solid var(--border)" }} title={say("ct_sample")} />
        </section>
      ) : null}
    </div>
  );
}
