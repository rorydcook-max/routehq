"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, Plus, Trash2 } from "lucide-react";
import { saveAgreementTerms } from "@/app/actions/contracts";
import { PendingButton } from "@/components/pending-button";
import { ownerTermsHtml, renderContractTemplate } from "@/lib/contract-rendering";

type Say = (key: string, values?: Record<string, string | number>) => string;

const MAX_TERMS = 20;
const h2 = "text-[17px] font-bold text-[var(--foreground)]";
const soft = "font-medium text-[var(--foreground-secondary)]";

/**
 * The owner's side of the rental agreement, with nothing technical in it.
 *
 * RouteHQ writes the agreement: the layout, the standard terms in English and
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
                    className="pressable flex min-h-11 items-center gap-1 px-2 font-bold text-[var(--primary)]"
                    onClick={() => setTerms((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : [""]))}
                    type="button"
                  >
                    <Trash2 size={18} />
                    {say("ag_removeShort")}
                  </button>
                ) : null}
              </div>
              <textarea
                className="mt-1 w-full"
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
          {terms.length < MAX_TERMS ? (
            <button className="secondary-action pressable w-full sm:w-auto" onClick={() => setTerms((current) => [...current, ""])} type="button">
              <Plus size={18} />
              {say("ag_add")}
            </button>
          ) : null}
          <PendingButton className="primary-action w-full sm:w-auto" pendingLabel={say("saving")} savedLabel={say("saved")} type="submit">
            {say("save")}
          </PendingButton>
          <p className={soft}>{say("ag_applies")}</p>
        </form>
      </section>

      <section className="card p-4">
        <h2 className={h2}>{say("ag_numbersTitle")}</h2>
        <p className={`mt-1 ${soft}`}>{say("ag_numbersBody")}</p>
        <div className="mt-3 space-y-2">
          {numbers.map((row) => (
            <div className="flex items-baseline justify-between gap-3" key={row.label}>
              <span className={soft}>{row.label}</span>
              <span className="text-right font-bold text-[var(--foreground)]">{row.value}</span>
            </div>
          ))}
        </div>
        <a className="secondary-action pressable mt-3 w-full sm:w-auto" href={numbersHref}>
          {say("ag_numbersChange")}
        </a>
      </section>

      <section className="card p-4">
        <h2 className={h2}>{say("ag_sampleTitle")}</h2>
        <p className={`mt-1 ${soft}`}>{say("ag_sampleBody")}</p>
        <button className="secondary-action pressable mt-3 w-full sm:w-auto" onClick={openSample} type="button">
          <Eye size={18} />
          {say("ag_sampleOpen")}
        </button>
        {/* In its own frame: the agreement carries its own styles. */}
        <iframe className="mt-3 w-full rounded-xl bg-white" sandbox="" srcDoc={preview} style={{ height: 560, border: "1px solid var(--border)" }} title={say("ag_sampleTitle")} />
      </section>
    </div>
  );
}
