"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Languages, Maximize2, Plus, Trash2 } from "lucide-react";
import { saveAgreementTerms } from "@/app/actions/contracts";
import { InfoTip } from "@/components/info-tip";
import { PendingButton } from "@/components/pending-button";
import { ownerTermsHtml, renderContractTemplate } from "@/lib/contract-rendering";
import { ActionForm } from "@/components/action-form";

type Say = (key: string, values?: Record<string, string | number>) => string;

const MAX_TERMS = 20;
const h2 = "card-title";
const soft = "font-medium text-[var(--foreground-secondary)]";

/**
 * The owner's side of the rental agreement, with nothing technical in it.
 *
 * RoveHQ writes the agreement: the layout, the standard terms in English and
 * the business location's language, and the details of each booking. The page
 * leads with the agreement itself (Rory, 3 Nov 2026: owners should see straight
 * away that there is a ready agreement, that they can change it, and that they
 * can upload their own), with the upload panel (`side`) beside it. Below: the
 * numbers it uses and the owner's own terms, plain sentences shown in the
 * agreement as they type. `templateHtml` arrives already localized (server side).
 */
export function AgreementTerms({
  organizationId,
  initialTerms,
  numbers,
  numbersHref,
  templateHtml,
  sampleData,
  languageLabel,
  languageTip,
  side
}: {
  organizationId: string;
  initialTerms: string[];
  numbers: Array<{ label: string; value: string }>;
  numbersHref: string;
  templateHtml: string;
  sampleData: Record<string, unknown>;
  languageLabel: string;
  languageTip?: string;
  side?: ReactNode;
}) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const [terms, setTerms] = useState<string[]>(initialTerms.length ? initialTerms : [""]);
  const filled = terms.map((term) => term.trim()).filter(Boolean);
  const preview = useMemo(() => withScreenMargin(renderContractTemplate(templateHtml, { ...sampleData, owner_extra_terms: ownerTermsHtml(filled) })), [templateHtml, sampleData, filled.join("\n\u0000")]); // eslint-disable-line react-hooks/exhaustive-deps

  function openSample() {
    const url = URL.createObjectURL(new Blob([preview], { type: "text/html" }));
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <div className="space-y-4">
      {/* The agreement first, as the page's hero, with the upload panel beside it on a computer. On a phone the panel
          sits between the agreement's header and the agreement itself (grid order), so both are seen right away. */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-x-5">
        <div className="flex flex-wrap items-center justify-between gap-2 lg:col-start-1 lg:row-start-1">
          <p className="flex items-center gap-1.5 font-semibold text-[var(--foreground-secondary)]">
            <Languages aria-hidden size={18} />
            {languageLabel}
            {languageTip ? <InfoTip label={languageLabel} text={languageTip} /> : null}
          </p>
          <button className="secondary-action pressable" onClick={openSample} type="button">
            <Maximize2 size={18} />
            {say("ag_sampleOpen")}
          </button>
        </div>
        {side ? <div className="lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">{side}</div> : null}
        <div className="lg:col-start-1 lg:row-start-2">
          <SampleFrame html={preview} loadingLabel={say("ag_sampleLoading")} title={say("ag_sampleTitle")} />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
      {/* No numbers when the owner's own uploaded agreement is in use: its amounts are in their own wording. */}
      {numbers.length ? (
      <section className="card p-4">
        <h2 className={`${h2} flex items-center gap-1.5`}>
          {say("ag_numbersTitle")}
          <InfoTip label={say("ag_numbersTitle")} text={say("ag_numbersBody")} />
        </h2>
        {/* Label and value side by side on one row each, with dividers so they're easy to match up. */}
        <dl className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {numbers.map((row) => (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 py-2.5" key={row.label}>
              <dt className={soft}>{row.label}</dt>
              <dd className="text-right font-semibold text-[var(--foreground)]">{row.value}</dd>
            </div>
          ))}
        </dl>
        <a className="secondary-action pressable mt-4 w-full sm:w-auto" href={numbersHref}>
          {say("ag_numbersChange")}
        </a>
      </section>
      ) : null}

      <section className="card p-4">
        <h2 className={h2}>{say("ag_ownTitle")}</h2>
        <p className={`mt-1 ${soft}`}>{say("ag_ownBody")}</p>
        <ActionForm action={saveAgreementTerms} className="mt-3 space-y-3">
          <input name="organizationId" type="hidden" value={organizationId} />
          {terms.map((term, index) => (
            <div key={index}>
              <div className="flex items-center justify-between gap-2">
                <label className="font-semibold text-[var(--foreground-secondary)]" htmlFor={`term-${index}`}>
                  {say("ag_term", { number: index + 1 })}
                </label>
                {terms.length > 1 || term ? (
                  <button
                    aria-label={say("ag_remove", { number: index + 1 })}
                    className="pressable flex min-h-11 items-center gap-1 px-2 font-bold text-[var(--danger)]"
                    onClick={() => setTerms((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : [""]))}
                    type="button"
                  >
                    <Trash2 size={18} />
                    {say("ag_removeShort")}
                  </button>
                ) : null}
              </div>
              <textarea
                className="mt-1 w-full resize-none"
                id={`term-${index}`}
                maxLength={1500}
                name="terms"
                onChange={(event) => setTerms((current) => current.map((value, i) => (i === index ? event.target.value : value)))}
                placeholder={index === 0 ? say("ag_placeholder") : ""}
                rows={3}
                value={term}
              />
            </div>
          ))}
          {/* Adding a term is a quiet text action under the boxes; Save is the card's one primary, at the end. */}
          {terms.length < MAX_TERMS ? (
            <button className="pressable flex min-h-11 items-center gap-1.5 px-1 font-bold text-[var(--primary)]" onClick={() => setTerms((current) => [...current, ""])} type="button">
              <Plus size={18} />
              {say("ag_add")}
            </button>
          ) : null}
          <p className={`text-sm ${soft}`}>{say("ag_applies")}</p>
          <PendingButton className="primary-action w-full sm:w-auto" pendingLabel={say("saving")} savedLabel={say("saved")} type="submit">
            {say("save")}
          </PendingButton>
        </ActionForm>
      </section>
      </div>
    </div>
  );
}

/** The agreement has no page margin on screen (the PDF gets its A4 margins from @page): give the preview some room. */
function withScreenMargin(html: string) {
  const style = "<style>@media screen { body { padding: 24px 28px; } } @media screen and (max-width: 520px) { body { padding: 14px; } }</style>";
  return html.includes("</head>") ? html.replace("</head>", `${style}</head>`) : `${style}${html}`;
}

/**
 * The sample agreement, in its own frame (the agreement carries its own styles).
 *
 * Why it used to show as an empty white box: the frame was sandboxed with no permissions at all, which
 * gives it an opaque origin, and Chrome then renders it in a separate process and paints it late (and
 * not at all in full-page captures); it also arrived in the server HTML as one very long srcdoc, with
 * nothing on screen while it loaded. Now the frame is created after the page loads, keeps the page's
 * origin (scripts stay blocked: no allow-scripts), and a skeleton shows until its first paint.
 */
function SampleFrame({ html, title, loadingLabel }: { html: string; title: string; loadingLabel: string }) {
  const [mounted, setMounted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="relative h-[520px] overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-[var(--border)] lg:h-[calc(100vh-10rem)] lg:min-h-[640px]">
      {!loaded ? (
        <div aria-busy="true" aria-label={loadingLabel} className="absolute inset-0 animate-pulse space-y-3 p-6" role="status">
          <div className="h-8 w-40 rounded-lg bg-[var(--panel-secondary)]" />
          <div className="h-10 w-full rounded-lg bg-[var(--panel-tertiary,var(--panel-secondary))]" />
          {Array.from({ length: 8 }).map((_, index) => (
            <div className="h-3 rounded bg-[var(--panel-secondary)]" key={index} style={{ width: `${92 - ((index * 13) % 30)}%` }} />
          ))}
          <span className="sr-only">{loadingLabel}</span>
        </div>
      ) : null}
      {mounted ? (
        <iframe
          className={`h-full w-full transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          sandbox="allow-same-origin"
          srcDoc={html}
          style={{ border: 0 }}
          title={title}
        />
      ) : null}
    </div>
  );
}
