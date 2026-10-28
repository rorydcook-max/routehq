"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, Plus, Trash2 } from "lucide-react";
import { saveAgreementTerms } from "@/app/actions/contracts";
import { PendingButton } from "@/components/pending-button";
import { ownerTermsHtml, renderContractTemplate } from "@/lib/contract-rendering";

type Say = (key: string, values?: Record<string, string | number>) => string;

const MAX_TERMS = 20;
const h2 = "card-title";
const soft = "font-medium text-[var(--foreground-secondary)]";

/**
 * The owner's side of the rental agreement, with nothing technical in it.
 *
 * Lokalfleet writes the agreement: the layout, the standard terms in English and
 * Thai, and the details of each booking. The owner adds their own terms as
 * plain sentences, one box each, and sees the result straight away. The page
 * used to be an editor for the agreement's raw HTML, and what was saved there
 * was replaced by the standard wording the next time it was opened.
 */
export function AgreementTerms({
  organizationId,
  initialTerms,
  numbers,
  numbersHref,
  templateHtml,
  sampleData
}: {
  organizationId: string;
  initialTerms: string[];
  numbers: Array<{ label: string; value: string }>;
  numbersHref: string;
  templateHtml: string;
  sampleData: Record<string, unknown>;
}) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const [terms, setTerms] = useState<string[]>(initialTerms.length ? initialTerms : [""]);
  const filled = terms.map((term) => term.trim()).filter(Boolean);
  const preview = useMemo(() => renderContractTemplate(templateHtml, { ...sampleData, owner_extra_terms: ownerTermsHtml(filled) }), [templateHtml, sampleData, filled.join("\n\u0000")]); // eslint-disable-line react-hooks/exhaustive-deps

  function openSample() {
    const url = URL.createObjectURL(new Blob([preview], { type: "text/html" }));
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <div className="space-y-3">
      <section className="card p-4">
        <h2 className={h2}>{say("ag_ownTitle")}</h2>
        <p className={`mt-1 ${soft}`}>{say("ag_ownBody")}</p>
        <form action={saveAgreementTerms} className="mt-3 space-y-3">
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
        </form>
      </section>

      <section className="card p-4">
        <h2 className={h2}>{say("ag_numbersTitle")}</h2>
        <p className={`mt-1 ${soft}`}>{say("ag_numbersBody")}</p>
        {/* Label and value side by side on one row each, with dividers so they're easy to match up. */}
        <dl className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {numbers.map((row) => (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 py-2.5 sm:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]" key={row.label}>
              <dt className={soft}>{row.label}</dt>
              <dd className="text-right font-semibold text-[var(--foreground)] sm:text-left">{row.value}</dd>
            </div>
          ))}
        </dl>
        <a className="secondary-action pressable mt-4 w-full sm:w-auto" href={numbersHref}>
          {say("ag_numbersChange")}
        </a>
      </section>

      <section className="card scroll-mt-4 p-4" id="sample">
        <h2 className={h2}>{say("ag_sampleTitle")}</h2>
        <p className={`mt-1 ${soft}`}>{say("ag_sampleBody")}</p>
        <button className="secondary-action pressable mt-3 w-full sm:w-auto" onClick={openSample} type="button">
          <Eye size={18} />
          {say("ag_sampleOpen")}
        </button>
        <SampleFrame html={preview} loadingLabel={say("ag_sampleLoading")} title={say("ag_sampleTitle")} />
      </section>
    </div>
  );
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
    <div className="relative mt-3 h-[560px] overflow-hidden rounded-xl bg-white ring-1 ring-[var(--border)]">
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
