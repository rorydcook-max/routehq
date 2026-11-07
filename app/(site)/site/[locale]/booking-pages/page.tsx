import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { siteLocale, type SiteParams } from "@/lib/site/static-page";
import { siteMetadata } from "@/lib/site/seo";
import { breadcrumbLd } from "@/lib/site/schema";
import { SITE_DEMOS } from "@/lib/sites/demos";
import { JsonLd } from "../_components/content-ui";
import { FinalCta } from "../_components/final-cta";
import { Check, Container, Eyebrow, SITE_LINKS, SiteLink } from "../_components/site-ui";
import s from "../site.module.css";

const CHANGES = [1, 2, 3, 4, 5, 6];
/** Twelve of the 24 templates, across kinds of business (pictures from scripts/site-template-previews.mjs). */
const RANGE = ["lagoon", "riviera", "swell", "metro", "runway", "noir", "trail", "dolce", "nomad", "washi", "folio", "neon"] as const;

export async function generateMetadata({ params }: SiteParams): Promise<Metadata> {
  await siteLocale(params);
  const [m, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  return siteMetadata({ path: "/booking-pages", locale, title: m("metaBookingPagesTitle"), description: m("metaBookingPagesDescription") });
}

/**
 * Booking pages (Rory, 7 Nov 2026): what an operator's own website can look like, one example per template. Each is a
 * made-up business from lib/sites/demos.ts, shown as a computer and a phone picture of its live demo
 * (public/site/booking-pages/<id>-desktop.webp and <id>.webp, taken from /rent/demo/<id>), with the live demo one tap
 * away. All are labelled as demos; there are no reviews or testimonials anywhere.
 */
export default async function BookingPagesPage({ params }: SiteParams) {
  await siteLocale(params);
  const [m, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  const jsonLd = breadcrumbLd(
    [
      { name: m("breadcrumbHome"), path: "/" },
      { name: m("bxEyebrow"), path: "/booking-pages" }
    ],
    locale
  );

  return (
    <>
      <JsonLd data={jsonLd} />
      <section className={`${s.dark} ${s.hero} ${s.heroPlain}`}>
        <Container>
          <div className={s.rise}>
            <Eyebrow>{m("bxEyebrow")}</Eyebrow>
            <h1 className={`${s.h1} mt-6`}>{m("bxTitle")}</h1>
            <p className={`${s.lede} ${s.heroBody}`}>{m("bxBody")}</p>
            <p className="mt-5 max-w-2xl text-[19px] font-semibold">{m("bxNote")}</p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <SiteLink className={`${s.btn} ${s.btnLight}`} href={SITE_LINKS.signUp}>
                {m("navStart")}
              </SiteLink>
            </div>
          </div>
        </Container>
      </section>

      <section aria-labelledby="range" className={s.section}>
        <Container>
          <h2 className={s.h3} id="range">
            {m("bxRangeTitle")}
          </h2>
          <p className="mt-2 max-w-3xl">{m("bxRangeBody")}</p>
          <ul className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {RANGE.map((id) => (
              <li className="flex flex-col" key={id}>
                <a aria-label={`${m("bxRangeOpen")}: ${m(`bxT_${id}`)}`} className="block overflow-hidden rounded-[14px] border border-[#d5dde0] bg-white shadow-[0_18px_40px_-24px_rgba(6,22,43,0.45)]" href={`/rent/demo/${id}`} rel="noopener" target="_blank">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={m("bxRangeAlt", { name: m(`bxT_${id}`) })} className="block aspect-[16/10] w-full object-cover object-top" height={500} loading="lazy" src={`/site/templates/${id}.webp`} width={800} />
                </a>
                <p className="mt-4 inline-flex self-start rounded-full bg-[#fff1c2] px-3 py-1 text-[13px] font-bold text-[#4a3700]">{m("bxRangeLabel")}</p>
                <h3 className="mt-2 text-[19px] font-semibold leading-tight">{m(`bxT_${id}`)}</h3>
                <p className="mt-1 text-[15px] leading-6">{m(`bxTd_${id}`)}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="examples" className={`${s.mist} ${s.section}`}>
        <Container>
          <h2 className={s.h3} id="examples">
            {m("bxExamplesTitle")}
          </h2>
          <p className="mt-2 max-w-3xl">{m("bxExamplesBody")}</p>
          <ul className="mt-8 grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
            {SITE_DEMOS.map((demo) => {
              const template = demo.config.template;
              return (
                <li className="flex flex-col" key={demo.id}>
                  <a aria-label={`${m("bxOpen")}: ${demo.name}`} className="relative block w-full pb-6" href={`/rent/demo/${demo.id}`} rel="noopener" target="_blank">
                    {/* The live demo as a computer screen, with the phone version in front. */}
                    <span className="block overflow-hidden rounded-[18px] border border-[#d5dde0] bg-white shadow-[0_24px_50px_-24px_rgba(6,22,43,0.45)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt={m("bxPictureAlt", { name: demo.name })} className="block aspect-[16/10] w-full object-cover object-top" height={800} loading="lazy" src={`/site/booking-pages/${demo.id}-desktop.webp`} width={1280} />
                    </span>
                    <span className="absolute bottom-0 right-4 block w-[27%] overflow-hidden rounded-[16px] border-[4px] border-[#13262b] bg-white shadow-[0_18px_40px_-14px_rgba(6,22,43,0.55)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt="" className="block aspect-[9/19] w-full object-cover object-top" height={760} loading="lazy" src={`/site/booking-pages/${demo.id}.webp`} width={360} />
                    </span>
                  </a>
                  <p className="mt-5 inline-flex self-start rounded-full bg-[#fff1c2] px-3 py-1 text-[13px] font-bold text-[#4a3700]">{m("bxDemoLabel")}</p>
                  <h3 className="mt-2 text-[20px] font-semibold leading-tight">{demo.name}</h3>
                  <p className="mt-1 text-[15px] font-semibold text-[#0e5e6f]">{m(`bxT_${template}`)}</p>
                  <p className="mt-1 text-[15px] leading-6">{m(`bxTd_${template}`)}</p>
                  <a className={`${s.link} mt-3`} href={`/rent/demo/${demo.id}`} rel="noopener" target="_blank">
                    {m("bxOpen")}
                  </a>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="change" className={s.section}>
        <Container>
          <h2 className={s.h3} id="change">
            {m("bxChangeTitle")}
          </h2>
          <ul className="mt-6 grid max-w-4xl gap-3 sm:grid-cols-2">
            {CHANGES.map((n) => (
              <li className="flex items-start gap-3 text-[17px] leading-7" key={n}>
                <span className="mt-1.5 shrink-0">
                  <Check />
                </span>
                {m(`bxChange${n}`)}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
