"use client";

import { Plus } from "lucide-react";
import { Txt, useSite } from "../site-context";
import s from "../site.module.css";

/** Questions the owner answered (Booking page tool › Sections). Not shown until there is at least one. */
export function Faqs() {
  const { config } = useSite();
  if (!config.faqs.length) return null;
  return (
    <section aria-labelledby="faqs-title" className={s.section} id="faqs">
      <div className={`${s.wrap} grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:gap-20`}>
        <Txt as="h2" className={`${s.display} text-[36px] sm:text-[48px]`} id="faqs-title" slot="faqs.title" />
        <div className={`divide-y border-y ${s.line} [&>details]:border-[var(--s-line)]`}>
          {config.faqs.map((faq) => (
            <details className="group" key={faq.q}>
              <summary className={`${s.focus} flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[18px] font-semibold [&::-webkit-details-marker]:hidden`}>
                {faq.q}
                <Plus aria-hidden="true" className="shrink-0 text-[var(--s-accent-text)] transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none" size={22} />
              </summary>
              <p className={`${s.soft} max-w-[62ch] whitespace-pre-line pb-6 text-[16.5px] leading-relaxed`}>{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
