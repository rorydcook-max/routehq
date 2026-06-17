"use client";

import { useMemo, useRef, useState } from "react";
import { Eye, FileText, RotateCcw, Save } from "lucide-react";
import { resetContractTemplate, saveContractTemplate } from "@/app/actions/contracts";
import { PendingButton } from "@/components/pending-button";
import { renderContractTemplate } from "@/lib/contract-rendering";

const inputClass =
  "mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(18,184,200,0.16)]";

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
    const previewWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!previewWindow) return;
    previewWindow.document.write(preview);
    previewWindow.document.close();
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
      <form action={saveContractTemplate} className="content-section">
        <input name="organizationId" type="hidden" value={organizationId} />
        <input name="templateId" type="hidden" value={template.id} />
        <input name="contentHtml" type="hidden" value={content} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-bold text-[#344054]">Template name</span>
            <input className={inputClass} name="name" onChange={(event) => setName(event.target.value)} value={name} />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-[#344054]">Language</span>
            <select className={inputClass} name="language" onChange={(event) => setLanguage(event.target.value)} value={language}>
              <option value="en">English</option>
              <option value="th">Thai</option>
              <option value="ru">Russian</option>
              <option value="zh">Chinese</option>
              <option value="fr">French</option>
              <option value="ja">Japanese</option>
            </select>
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-bold text-[#344054]">Contract HTML</span>
          <textarea
            className={`${inputClass} min-h-[520px] font-mono text-sm leading-6`}
            onChange={(event) => setContent(event.target.value)}
            ref={textareaRef}
            spellCheck={false}
            value={content}
          />
        </label>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <PendingButton className="primary-action flex-1" pendingLabel="Saving..." type="submit">
            <Save size={18} />
            Save template
          </PendingButton>
          <button
            className="secondary-action pressable flex-1 text-[var(--primary)]"
            onClick={openPreviewWindow}
            type="button"
          >
            <Eye size={18} />
            Preview contract
          </button>
          <button
            className="secondary-action pressable flex-1"
            onClick={() => setPreviewOpen((current) => !current)}
            type="button"
          >
            <Eye size={18} />
            {previewOpen ? "Hide preview" : "Show preview"}
          </button>
        </div>
      </form>

      <aside className="space-y-4">
        <section className="content-section">
          <div className="flex items-center gap-2">
            <FileText className="text-[#0f766e]" size={19} />
            <h2 className="font-black text-[#10252b]">Variables</h2>
          </div>
          <p className="mt-2 text-sm text-[#667085]">Click a variable to insert it at the cursor.</p>
          <div className="mt-4 grid gap-2">
            {variables.map((variable) => (
              <button
                className="pressable rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-left font-mono text-xs font-bold text-[var(--primary)]"
                key={variable.key}
                onClick={() => insertVariable(variable.token)}
                type="button"
              >
                {variable.token}
              </button>
            ))}
          </div>
        </section>

        <form action={resetContractTemplate} className="rounded-lg border border-[#fecdd3] bg-[#fff1f2] p-4" onSubmit={(event) => {
          if (!window.confirm("This will replace your current template with the comprehensive bilingual English/Thai default. Are you sure?")) {
            event.preventDefault();
          }
        }}>
          <input name="organizationId" type="hidden" value={organizationId} />
          <PendingButton className="pressable inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#be123c] px-4 py-3 text-sm font-black text-white" pendingLabel="Resetting..." type="submit">
            <RotateCcw size={18} />
            Reset to comprehensive bilingual template
          </PendingButton>
          <p className="mt-2 text-xs text-[#9f1239]">This replaces the current template with the comprehensive bilingual English/Thai default.</p>
        </form>
      </aside>

      {previewOpen ? (
        <section className="content-section xl:col-span-2">
          <div className="flex items-center gap-2">
            <Eye className="text-[#0f766e]" size={19} />
            <h2 className="font-black text-[#10252b]">Preview with sample data</h2>
          </div>
          <div className="contract-preview sub-surface mt-4 p-5 text-sm leading-7 text-[var(--foreground-secondary)]" dangerouslySetInnerHTML={{ __html: preview }} />
        </section>
      ) : null}
    </div>
  );
}
