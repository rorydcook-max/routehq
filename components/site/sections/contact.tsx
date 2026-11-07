"use client";

import { useActionState } from "react";
import { useLocale } from "next-intl";
import { Clock, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { sendSiteMessage, type SiteMessageState } from "@/app/actions/sites";
import { mapLinks, socialHref, telHref } from "@/lib/sites/format";
import type { SiteSocial } from "@/lib/sites/config";
import { Txt, useSite } from "../site-context";
import s from "../site.module.css";

const FIELD = "!border-[var(--s-line)] !bg-[var(--s-surface)] !text-[var(--s-ink)]";
const SOCIAL_LABELS: Record<keyof SiteSocial, string> = { facebook: "Facebook", instagram: "Instagram", line: "LINE", tiktok: "TikTok", whatsapp: "WhatsApp" };

/** Every way to reach the business, from the site's own links and Settings › Business. */
function useChannels() {
  const { config, data } = useSite();
  const social = (key: keyof SiteSocial) => {
    const value = config.social[key] || data.business.social[key] || "";
    return value ? socialHref(key, value) : null;
  };
  const chats = [
    social("whatsapp") ? { key: "whatsapp", label: "WhatsApp", href: social("whatsapp") as string } : null,
    social("line") ? { key: "line", label: "LINE", href: social("line") as string } : null
  ].filter(Boolean) as Array<{ key: string; label: string; href: string }>;
  const others = (["facebook", "instagram", "tiktok"] as const).flatMap((key) => (social(key) ? [{ key, label: SOCIAL_LABELS[key], href: social(key) as string }] : []));
  return { chats, others, phone: data.business.phone, email: data.business.email };
}

function Hours() {
  const { config, t } = useSite();
  const locale = useLocale();
  if (!config.hours) return null;
  const dayName = (index: number) => new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + index)));
  return (
    <div>
      <p className="flex items-center gap-2 text-[17px] font-bold">
        <Clock aria-hidden="true" className="text-[var(--s-accent)]" size={19} />
        {t("hours_title")}
      </p>
      <dl className="mt-3 space-y-1.5 text-[15.5px]">
        {config.hours.map((day, index) => (
          <div className="flex justify-between gap-6" key={index}>
            <dt className={s.soft}>{dayName(index)}</dt>
            <dd className={day ? "tabular-nums font-medium" : s.muted}>{day ? `${day.open} – ${day.close}` : t("closed")}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function useMapQuery() {
  const { config, data } = useSite();
  return config.mapQuery || data.business.address || data.business.place;
}

function MapBlock({ tall = false, big = false }: { tall?: boolean; big?: boolean }) {
  const { t } = useSite();
  const query = useMapQuery();
  if (!query) return null;
  const links = mapLinks(query);
  return (
    <div className={`${s.image} border ${s.line} bg-[var(--s-raised)]`}>
      <iframe className={`block w-full border-0 ${big ? "h-[380px] sm:h-[460px] lg:h-[580px]" : tall ? "h-[360px] lg:h-full lg:min-h-[420px]" : "h-[300px]"}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={links.embed} title={t("map_title")} />
      <a className={`${s.focus} flex items-center gap-2 bg-[var(--s-surface)] px-4 py-3 text-[15px] font-semibold`} href={links.open} rel="noopener noreferrer" target="_blank">
        <MapPin aria-hidden="true" className="shrink-0 text-[var(--s-accent)]" size={17} />
        <span className="min-w-0 flex-1 truncate">{query}</span>
        <span className="text-[var(--s-accent)]">{t("map_open")}</span>
      </a>
    </div>
  );
}

/** The contact form: lands in the business's RoveHQ Inbox as a Website conversation. */
function ContactForm() {
  const { data, edit, t } = useSite();
  const [state, action, pending] = useActionState<SiteMessageState, FormData>(sendSiteMessage.bind(null, data.slug), { n: 0 });
  const off = data.demo || edit;
  if (state.status === "sent") {
    return (
      <div className={`${s.card} p-6 sm:p-8`} role="status">
        <p className={`${s.display} text-[28px]`}>{t("form_sent_title")}</p>
        <p className={`${s.soft} mt-2 text-[16px]`}>{t("form_sent", { business: data.business.name })}</p>
      </div>
    );
  }
  const values = state.values || { name: "", contact: "", message: "" };
  return (
    <form action={action} className={`${s.card} ${s.form} space-y-4 p-5 sm:p-8`} key={state.n}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-[15px] font-semibold">
          {t("form_name")}
          <input autoComplete="name" className={`${s.field} ${FIELD} mt-1.5`} defaultValue={values.name} maxLength={120} name="name" required />
        </label>
        <label className="block text-[15px] font-semibold">
          {t("form_contact")}
          <input autoComplete="email" className={`${s.field} ${FIELD} mt-1.5`} defaultValue={values.contact} maxLength={160} name="contact" required />
        </label>
      </div>
      <label className="block text-[15px] font-semibold">
        {t("form_message")}
        <textarea className={`${s.field} ${FIELD} mt-1.5 min-h-[140px] resize-y`} defaultValue={values.message} maxLength={2000} name="message" required />
      </label>
      {/* Hidden from people; bots fill it in and are ignored. */}
      <input aria-hidden="true" autoComplete="off" className="hidden" name="website" tabIndex={-1} />
      {state.error ? (
        <p className="text-[15px] font-semibold text-[#c2410c]" role="alert">
          {t(`form_err_${state.error}`)}
        </p>
      ) : null}
      {data.demo ? <p className={`${s.muted} text-[15px] font-semibold`}>{t("demo_noSend")}</p> : null}
      <button className={`${s.btn} w-full sm:w-auto`} disabled={pending || off} type="submit">
        <Send aria-hidden="true" size={18} />
        {pending ? t("form_sending") : t("form_send")}
      </button>
    </form>
  );
}

export function Contact() {
  const { template, config } = useSite();
  const { chats, others, phone, email } = useChannels();
  const mapQuery = useMapQuery();
  // Map first needs somewhere to point; without one it falls back to the split layout.
  const layout = template.layout.contact === "mapfirst" && !mapQuery ? "split" : template.layout.contact;
  const row = "flex items-center gap-3 text-[17px] font-semibold";
  const icon = "shrink-0 text-[var(--s-accent)]";
  const details = (
    <ul className="space-y-4">
      {phone ? (
        <li>
          <a className={`${s.focus} ${row}`} href={telHref(phone)}>
            <Phone aria-hidden="true" className={icon} size={20} />
            {phone}
          </a>
        </li>
      ) : null}
      {chats.map((chat) => (
        <li key={chat.key}>
          <a className={`${s.focus} ${row}`} href={chat.href} rel="noopener noreferrer" target="_blank">
            <MessageCircle aria-hidden="true" className={icon} size={20} />
            {chat.label}
          </a>
        </li>
      ))}
      {email ? (
        <li>
          <a className={`${s.focus} ${row} break-all`} href={`mailto:${email}`}>
            <Mail aria-hidden="true" className={icon} size={20} />
            {email}
          </a>
        </li>
      ) : null}
      {others.length ? (
        <li className="flex flex-wrap gap-2 pt-1">
          {others.map((link) => (
            <a className={`${s.focus} inline-flex min-h-10 items-center rounded-full bg-[var(--s-surface)] px-4 text-[15px] font-semibold shadow-[inset_0_0_0_1.5px_var(--s-line)]`} href={link.href} key={link.key} rel="noopener noreferrer" target="_blank">
              {link.label}
            </a>
          ))}
        </li>
      ) : null}
    </ul>
  );
  const heading = (
    <>
      <Txt as="h2" className={`${s.display} text-[36px] sm:text-[48px]`} id="contact-title" slot="contact.title" />
      <Txt as="p" className={`${s.soft} mt-3 max-w-[44ch] text-[18px]`} slot="contact.subline" />
    </>
  );

  if (layout === "mapfirst") {
    // Lagoon, Pier, Villa, Haven, Nomad, Roam, Amber: the map across the page, how to reach them resting on it.
    return (
      <section aria-labelledby="contact-title" className={s.section} id="contact">
        <div className={s.wrap}>
          <div className="relative">
            <MapBlock big />
            <div className={`${s.card} mt-4 p-6 shadow-[0_24px_60px_-30px_rgba(10,20,30,0.45)] sm:p-8 lg:absolute lg:start-6 lg:top-6 lg:mt-0 lg:max-h-[calc(100%-96px)] lg:w-[420px] lg:overflow-y-auto`}>
              {heading}
              <div className="mt-8 space-y-8">
                {details}
                <Hours />
              </div>
            </div>
          </div>
          <div className="mt-10 max-w-[760px]">
            <ContactForm />
          </div>
        </div>
      </section>
    );
  }

  if (layout === "minimal") {
    // Swell, Noir, Fjord, Block: centered, the number and chats as large links, then the form.
    return (
      <section aria-labelledby="contact-title" className={s.section} id="contact">
        <div className={`${s.wrap} max-w-[880px]`}>
          <div className="flex flex-col items-center text-center">
            {heading}
            {phone ? (
              <a className={`${s.focus} ${s.display} mt-8 text-[34px] sm:text-[52px]`} href={telHref(phone)}>
                {phone}
              </a>
            ) : null}
            {chats.length || email || others.length ? (
              <p className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-3 text-[18px] font-semibold">
                {[...chats, ...(email ? [{ key: "email", label: email, href: `mailto:${email}` }] : []), ...others].map((link) => (
                  <a className={`${s.focus} break-all text-[var(--s-accent)] underline decoration-2 underline-offset-[6px]`} href={link.href} key={link.key} rel="noopener noreferrer" target={link.key === "email" ? undefined : "_blank"}>
                    {link.label}
                  </a>
                ))}
              </p>
            ) : null}
          </div>
          {config.hours ? (
            <div className={`mx-auto mt-10 max-w-[420px] border-y py-6 ${s.line}`}>
              <Hours />
            </div>
          ) : null}
          <div className="mt-10">
            <ContactForm />
          </div>
          <div className="mt-8">
            <MapBlock />
          </div>
        </div>
      </section>
    );
  }

  if (layout === "bold") {
    // Moto: one tap to chat or call, as big buttons.
    return (
      <section aria-labelledby="contact-title" className={s.section} id="contact">
        <div className={s.wrap}>
          {heading}
          {chats.length || phone ? (
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {chats.map((chat) => (
                <a className={`${s.btn} !min-h-16 text-[18px]`} href={chat.href} key={chat.key} rel="noopener noreferrer" target="_blank">
                  <MessageCircle aria-hidden="true" size={22} />
                  {chat.label}
                </a>
              ))}
              {phone ? (
                <a className={`${s.btn} ${s.btnGhost} !min-h-16 text-[18px]`} href={telHref(phone)}>
                  <Phone aria-hidden="true" size={20} />
                  {phone}
                </a>
              ) : null}
            </div>
          ) : null}
          <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1.3fr_1fr]">
            <ContactForm />
            <div className="space-y-8">
              <Hours />
              <MapBlock />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (layout === "cards") {
    // Summit: reach, visit and hours side by side, then the form beside the map.
    return (
      <section aria-labelledby="contact-title" className={`${s.section} ${s.raised}`} id="contact">
        <div className={s.wrap}>
          {heading}
          <div className="mt-10 grid items-start gap-5 lg:grid-cols-[1fr_1.15fr]">
            <div className="space-y-5">
              {phone || email || chats.length || others.length ? <div className={`${s.card} p-6`}>{details}</div> : null}
              {config.hours ? (
                <div className={`${s.card} p-6`}>
                  <Hours />
                </div>
              ) : null}
            </div>
            <ContactForm />
          </div>
          <div className="mt-5">
            <MapBlock />
          </div>
        </div>
      </section>
    );
  }

  // Coast: details on the left, the form on the right, the map underneath.
  return (
    <section aria-labelledby="contact-title" className={s.section} id="contact">
      <div className={s.wrap}>
        <div className="grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div className="space-y-10">
            <div>{heading}</div>
            {details}
            <Hours />
          </div>
          <ContactForm />
        </div>
        <div className="mt-14">
          <MapBlock />
        </div>
      </div>
    </section>
  );
}
