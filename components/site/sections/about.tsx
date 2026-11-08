"use client";

import { Check, Star } from "lucide-react";
import { Txt, useSite } from "../site-context";
import { SiteImage } from "../site-image";
import { useFacts } from "./hero";
import { imageTreatment } from "./parts";
import s from "../site.module.css";

/** About: who they are, in their words (or a plain line from their details), with up to four highlights. */
export function About() {
  const { template, config, images } = useSite();
  const highlights = config.highlights;
  const layout = template.layout.about;
  // No photo to show and none chosen: no picture, rather than drawn art that reads as an empty placeholder.
  const picture = images.about.type === "art" && !config.images.about ? null : images.about;

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
              {picture ? (
                <div className={`${s.image} mt-8 hidden aspect-[4/3] lg:block`}>
                  <SiteImage image={picture} />
                </div>
              ) : null}
            </div>
            <div>
              <Txt as="p" className={`${s.soft} whitespace-pre-line text-[18px] leading-relaxed`} slot="about.body" />
              {highlights.length ? (
                <ul className="mt-8 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {highlights.map((line) => (
                    <li className="flex items-start gap-3 text-[16px] font-semibold leading-snug" key={line}>
                      <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--s-accent-soft)] text-[var(--s-accent-text)]">
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

  if (layout === "steps") return <StepsAbout />;
  if (layout === "stats") return <StatsAbout />;
  if (layout === "quote") return <QuoteAbout />;

  // Coast: editorial. A tall picture beside large, unhurried text. (Riviera, Dolce and Villa frame the picture.)
  const treat = imageTreatment(template);
  return (
    <section aria-labelledby="about-title" className={s.section} id="about">
      <div className={`${s.wrap} grid items-center gap-10 ${picture ? "lg:grid-cols-[5fr_7fr]" : ""} lg:gap-20`}>
        {picture ? (
          <div className={`${s.image} aspect-[4/5] max-lg:order-2 max-lg:aspect-[16/11]${treat ? ` ${treat}` : ""}`}>
            <SiteImage image={picture} />
          </div>
        ) : null}
        <div className={picture ? "" : "max-w-3xl"}>
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

/* Phase 2 (sites2) layouts. */

function Highlights({ className = "" }: { className?: string }) {
  const { config } = useSite();
  if (!config.highlights.length) return null;
  return (
    <ul className={`grid gap-x-6 gap-y-3 sm:grid-cols-2 ${className}`}>
      {config.highlights.map((line) => (
        <li className="flex items-start gap-3 text-[16.5px] font-semibold leading-snug" key={line}>
          <Check aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--s-accent-text)]" size={19} strokeWidth={2.6} />
          {line}
        </li>
      ))}
    </ul>
  );
}

/** Runway, Haven, Nomad, Roam: who they are, then how renting works, in three real steps. */
function StepsAbout() {
  const { data, t } = useSite();
  const delivery = data.areas.find((area) => area.radiusKm && area.radiusKm > 0);
  const values = { business: data.business.name, place: data.business.place || data.areas[0]?.name || "", km: delivery?.radiusKm || 0 };
  const steps = [
    { title: t("step1_t"), body: t("step1_b") },
    { title: t("step2_t"), body: t("step2_b", values) },
    delivery ? { title: t("step3d_t"), body: t("step3d_b", { ...values, place: delivery.name }) } : { title: t("step3p_t"), body: values.place ? t("step3p_b", values) : t("step3p_b_np", values) }
  ];
  return (
    <section aria-labelledby="about-title" className={s.section} id="about">
      <div className={`${s.wrap} grid items-start gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-20`}>
        <div>
          <Txt as="h2" className={`${s.display} text-[36px] sm:text-[48px]`} id="about-title" slot="about.title" />
          <Txt as="p" className={`${s.soft} mt-5 whitespace-pre-line text-[18px] leading-relaxed sm:text-[19px]`} slot="about.body" />
          <Highlights className="mt-8" />
        </div>
        <div className={`${s.card} p-6 sm:p-10`}>
          <h3 className={`${s.display} text-[26px] sm:text-[30px]`}>{t("steps_title")}</h3>
          <ol className="mt-7 space-y-7">
            {steps.map((step, index) => (
              <li className="grid grid-cols-[44px_1fr] gap-4" key={index}>
                <span aria-hidden="true" className={`${s.display} flex h-11 w-11 items-center justify-center rounded-full bg-[var(--s-accent)] text-[20px] text-[var(--s-accent-ink)]`}>
                  {index + 1}
                </span>
                <div>
                  <p className="text-[18px] font-bold leading-snug">{step.title}</p>
                  <p className={`${s.soft} mt-1 text-[16px] leading-relaxed`}>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/** Swell, Metro, Trail, Volt: the business's real figures as a bold band, then who they are. */
function StatsAbout() {
  const facts = useFacts(true);
  return (
    <section aria-labelledby="about-title" className={s.section} id="about">
      <div className={s.wrap}>
        {facts.length > 1 ? (
          <dl className={`${s.card} grid grid-cols-2 gap-x-6 gap-y-8 !bg-[var(--s-accent)] p-6 text-[var(--s-accent-ink)] sm:p-10 ${facts.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            {facts.slice(0, 4).map((fact) => (
              <div key={fact.label}>
                <dt className="sr-only">{fact.label}</dt>
                <dd className={`${s.display} flex items-center gap-1.5 text-[38px] sm:text-[56px]`}>
                  {fact.value}
                  {fact.star ? <Star aria-hidden="true" className="fill-current" size={28} /> : null}
                </dd>
                <dd className="mt-1 text-[15px] font-semibold leading-snug opacity-85">{fact.label}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <div className="mt-12 grid gap-8 lg:mt-16 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
          <Txt as="h2" className={`${s.display} text-[36px] sm:text-[52px]`} id="about-title" slot="about.title" />
          <div>
            <Txt as="p" className={`${s.soft} whitespace-pre-line text-[18px] leading-relaxed sm:text-[20px]`} slot="about.body" />
            <Highlights className="mt-8" />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Lagoon, Noir, Washi, Folio, Amber: their words set large as a pull quote, highlights under it. */
function QuoteAbout() {
  const { config, text } = useSite();
  const long = text("about.body").length > 260;
  return (
    <section aria-labelledby="about-title" className={s.section} id="about">
      <div className={`${s.wrap} flex flex-col items-center text-center`}>
        <Txt as="h2" className={`${s.muted} text-[16px] font-semibold`} id="about-title" slot="about.title" />
        <span aria-hidden="true" className="mt-6 block h-px w-16 bg-[var(--s-accent)]" />
        <Txt
          as="p"
          className={`${s.display} mt-8 max-w-[30ch] whitespace-pre-line ${long ? "text-[24px] sm:text-[30px]" : "text-[30px] sm:text-[44px] lg:text-[52px]"}`}
          slot="about.body"
        />
        {config.highlights.length ? (
          <ul className="mt-12 flex max-w-[900px] flex-wrap justify-center gap-2.5">
            {config.highlights.map((line) => (
              <li className={`${s.card} inline-flex min-h-11 items-center gap-2 px-4 text-[15.5px] font-semibold`} key={line}>
                <Check aria-hidden="true" className="text-[var(--s-accent-text)]" size={17} strokeWidth={2.6} />
                {line}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
