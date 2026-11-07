import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { siteLocale, type SiteParams } from "@/lib/site/static-page";
import { siteMetadata } from "@/lib/site/seo";
import { breadcrumbLd } from "@/lib/site/schema";
import { BOOKING_DEMOS } from "@/lib/booking-site-demos";
import { JsonLd } from "../_components/content-ui";
import { FinalCta } from "../_components/final-cta";
import { Check, Container, Eyebrow, SITE_LINKS, SiteLink } from "../_components/site-ui";
import s from "../site.module.css";

const CHANGES = [1, 2, 3, 4, 5, 6];

export async function generateMetadata({ params }: SiteParams): Promise<Metadata> {
  await siteLocale(params);
  const [m, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  return siteMetadata({ path: "/booking-pages", locale, title: m("metaBookingPagesTitle"), description: m("metaBookingPagesDescription") });
}

/**
 * Booking pages (Rory, 7 Nov 2026): what an operator's own booking page can look like. Each example is a made-up
 * business from lib/booking-site-demos.ts, shown as a phone picture of its live demo page (public/site/booking-pages,
 * taken from /rent/demo/<id>) with the live demo one tap away. All are labelled as demos; there are no reviews or
 * testimonials anywhere.
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

      <section aria-labelledby="examples" className={s.section}>
        <Container>
          <h2 className={s.h3} id="examples">
            {m("bxExamplesTitle")}
          </h2>
          <p className="mt-2 max-w-3xl">{m("bxExamplesBody")}</p>
          <ul className="mt-8 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {BOOKING_DEMOS.map((demo) => {
              const template = demo.site.template;
              return (
                <li className="flex flex-col" key={demo.id}>
                  <a aria-label={`${m("bxOpen")}: ${demo.name}`} className="mx-auto block w-full max-w-[280px]" href={`/rent/demo/${demo.id}`} rel="noopener" target="_blank">
                    {/* A phone picture of the live demo page. */}
                    <span className="block overflow-hidden rounded-[30px] border-[6px] border-[#13262b] bg-white shadow-[0_18px_40px_-18px_rgba(6,22,43,0.45)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt={m("bxPictureAlt", { name: demo.name })} className="block aspect-[540/1169] w-full object-cover object-top" height={1169} loading="lazy" src={`/site/booking-pages/${demo.id}.webp`} width={540} />
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

      <section aria-labelledby="change" className={`${s.mist} ${s.section}`}>
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
