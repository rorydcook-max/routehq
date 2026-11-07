"use client";

import { Check } from "lucide-react";
import { Txt, useSite } from "../site-context";
import { SiteImage } from "../site-image";
import s from "../site.module.css";

/** About: who they are, in their words (or a plain line from their details), with up to four highlights. */
export function About() {
  const { template, config, images } = useSite();
  const highlights = config.highlights;
  const layout = template.layout.about;

  if (layout === "stacked") {
    // Moto: a big statement, then the highlights as bold tiles.
    return (
      <section aria-labelledby="about-title" className={s.section} id="about">
        <div className={s.wrap}>
          <Txt as="h2" className={`${s.display} max-w-[14ch] text-[44px] sm:text-[72px] lg:text-[88px]`} id="about-title" slot="about.title" />
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
            <Txt as="p" className={`${s.soft} whitespace-pre-line text-[19px] leading-relaxed sm:text-[21px]`} slot="about.body" />
            {highlights.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {highlights.map((line, index) => (
                  <li
                    className={`${s.card} flex min-h-[112px] flex-col justify-between gap-4 p-5 text-[17px] font-semibold leading-snug ${index === 0 ? "!bg-[var(--s-accent)] text-[var(--s-accent-ink)]" : ""}`}
                    key={line}
                  >
                    <Check aria-hidden="true" size={22} strokeWidth={2.6} />
                    {line}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  if (layout === "panel") {
    // Summit: a calm panel, heading on the left, words and highlights on the right.
    return (
      <section aria-labelledby="about-title" className={s.section} id="about">
        <div className={s.wrap}>
          <div className={`${s.card} grid gap-8 p-6 sm:p-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:p-14`}>
            <div>
              <Txt as="h2" className={`${s.display} text-[34px] sm:text-[44px]`} id="about-title" slot="about.title" />
              {images.about ? (
                <div className={`${s.image} mt-8 hidden aspect-[4/3] lg:block`}>
                  <SiteImage image={images.about} />
                </div>
              ) : null}
            </div>
            <div>
              <Txt as="p" className={`${s.soft} whitespace-pre-line text-[18px] leading-relaxed`} slot="about.body" />
              {highlights.length ? (
                <ul className="mt-8 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {highlights.map((line) => (
                    <li className="flex items-start gap-3 text-[16px] font-semibold leading-snug" key={line}>
                      <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--s-accent-soft)] text-[var(--s-accent)]">
                        <Check size={15} strokeWidth={3} />
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Coast: editorial. A tall picture beside large, unhurried text.
  return (
    <section aria-labelledby="about-title" className={s.section} id="about">
      <div className={`${s.wrap} grid items-center gap-10 lg:grid-cols-[5fr_7fr] lg:gap-20`}>
        <div className={`${s.image} aspect-[4/5] max-lg:order-2 max-lg:aspect-[16/11]`}>
          <SiteImage image={images.about} />
        </div>
        <div>
          <Txt as="h2" className={`${s.display} text-[38px] sm:text-[52px]`} id="about-title" slot="about.title" />
          <Txt as="p" className={`${s.soft} mt-6 whitespace-pre-line text-[19px] leading-[1.75] sm:text-[21px]`} slot="about.body" />
          {highlights.length ? (
            <ul className={`mt-10 divide-y border-y ${s.line} [&>li]:border-[var(--s-line)]`}>
              {highlights.map((line) => (
                <li className="flex items-center gap-4 py-4 text-[17px] font-medium" key={line}>
                  <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[var(--s-accent)]" />
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
