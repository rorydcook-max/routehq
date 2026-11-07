"use client";

import { useLocale } from "next-intl";
import type { SiteReview } from "@/lib/sites/types";
import { useSite } from "../site-context";
import { SectionHead, Stars } from "./parts";
import s from "../site.module.css";

/** A country code as its flag ("GB" → 🇬🇧). */
const flag = (code: string | null) => (code && /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "");

function Byline({ review }: { review: SiteReview }) {
  const locale = useLocale();
  const date = review.date ? new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }).format(new Date(review.date)) : "";
  return (
    <p className="text-[15px]">
      <span className="font-semibold">
        {review.name} {flag(review.country)}
      </span>
      <span className={s.muted}>{[review.vehicle, date].filter(Boolean).map((part) => ` · ${part}`).join("")}</span>
    </p>
  );
}

function Reply({ review }: { review: SiteReview }) {
  const { t, data } = useSite();
  if (!review.reply) return null;
  return (
    <p className={`${s.soft} mt-4 border-s-2 ps-4 text-[15px] leading-relaxed ${s.line}`}>
      <span className="block font-semibold text-[var(--s-ink)]">{t("review_reply", { business: data.business.name })}</span>
      {review.reply}
    </p>
  );
}

/**
 * Reviews: only real ones, left by renters through RoveHQ and published by the business (lib/reviews.ts). With none
 * yet, a link to their Google reviews when they have one; otherwise the section isn't shown at all.
 */
export function Reviews() {
  const { data, config, template, t } = useSite();
  const reviews = data.reviews.filter((review) => review.body || review.rating);
  const google = config.reviewsUrl || data.googleReviewsUrl;
  const layout = template.layout.reviews;

  if (!reviews.length) {
    if (!google) return null;
    return (
      <section aria-labelledby="reviews-title" className={s.section} id="reviews">
        <div className={`${s.wrap} flex flex-wrap items-center justify-between gap-6`}>
          <h2 className={`${s.display} text-[32px] sm:text-[40px]`} id="reviews-title">
            {t("reviews_google_title")}
          </h2>
          <a className={s.btn} href={google} rel="noopener noreferrer" target="_blank">
            {t("reviews_google")}
          </a>
        </div>
      </section>
    );
  }

  const stats = data.reviewStats.count ? data.reviewStats : { average: reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length, count: reviews.length };
  const summary = (
    <p className="flex items-center gap-3 text-[16px] font-semibold">
      <Stars label={t("stars", { rating: stats.average.toFixed(1) })} rating={stats.average} />
      {t("reviews_summary", { rating: stats.average.toFixed(1), count: stats.count })}
    </p>
  );

  if (layout === "quote") {
    // Coast: the latest review large, the rest in a row that swipes.
    const [first, ...rest] = reviews;
    return (
      <section aria-labelledby="reviews-title" className={s.section} id="reviews">
        <div className={s.wrap}>
          <SectionHead id="reviews" title="reviews.title">
            {summary}
          </SectionHead>
          <figure className="mt-12 max-w-[900px]">
            <Stars label={t("stars", { rating: first.rating })} rating={first.rating} size={22} />
            {first.body ? <blockquote className={`${s.display} mt-5 text-[28px] sm:text-[40px]`}>“{first.body}”</blockquote> : null}
            <figcaption className="mt-6">
              <Byline review={first} />
            </figcaption>
            <Reply review={first} />
          </figure>
          {rest.length ? (
            <ul className={`${s.rail} mt-14`}>
              {rest.map((review) => (
                <li className={`${s.card} flex flex-col p-6`} key={review.id}>
                  <Stars label={t("stars", { rating: review.rating })} rating={review.rating} size={16} />
                  {review.body ? <p className="mt-3 flex-1 text-[17px] leading-relaxed">“{review.body}”</p> : <span className="flex-1" />}
                  <div className="mt-5">
                    <Byline review={review} />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="reviews-title" className={`${s.section} ${layout === "cards" ? "" : s.raised}`} id="reviews">
      <div className={s.wrap}>
        <SectionHead id="reviews" title="reviews.title">
          {summary}
        </SectionHead>
        <ul className={`mt-10 ${layout === "stack" ? "columns-1 gap-4 sm:columns-2 lg:columns-3 [&>li]:mb-4 [&>li]:break-inside-avoid" : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"}`}>
          {reviews.map((review) => (
            <li className={`${s.card} flex flex-col p-6 ${layout === "cards" ? "shadow-[0_1px_2px_rgba(10,25,40,0.06),0_12px_32px_-20px_rgba(10,25,40,0.25)]" : ""}`} key={review.id}>
              <Stars label={t("stars", { rating: review.rating })} rating={review.rating} size={16} />
              {review.body ? <p className="mt-3 text-[16.5px] leading-relaxed">{review.body}</p> : null}
              <div className="mt-5">
                <Byline review={review} />
              </div>
              <Reply review={review} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
