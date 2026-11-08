import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { roveHref } from "@/lib/rove/paths";
import s from "./rove.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("directory");
  return { title: t("rv.nfTitle"), description: t("rv.homeDescription2"), robots: { index: false, follow: true } };
}

/**
 * rove.rent's "not found" (final-web test, 8 Nov 2026): an unknown guide, vehicle or place showed the operator app's
 * page ("Go to the dashboard") or the framework's bare "404". Drawn inside Rove's own layout, header and footer
 * included, with the ways back a renter needs.
 */
export default async function RoveNotFound() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("directory")]);
  return (
    <div className={s.wrap} style={{ paddingBottom: 72 }}>
      <header className={s.pageHead} style={{ paddingTop: 48 }}>
        <p className={`${s.small} ${s.muted}`}>404</p>
        <h1 className={s.pageTitle}>{t("rv.nfTitle")}</h1>
        <p className={s.pageLede}>{t("rv.nfBody")}</p>
      </header>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
        <Link className={s.btnCoral} href={roveHref("/search", locale) as any}>
          {t("rv.searchTitle")}
        </Link>
        <Link className={s.btnQuiet} href={roveHref("/destinations", locale) as any}>
          {t("rv.allDestinations")}
        </Link>
        <Link className={s.btnQuiet} href={roveHref("/", locale) as any}>
          {t("rv.homeLabel")}
        </Link>
      </div>
    </div>
  );
}
