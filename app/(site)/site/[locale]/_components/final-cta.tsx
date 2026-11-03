import { getTranslations } from "next-intl/server";
import { Container, RICH_SERIF, SITE_LINKS, SiteLink } from "./site-ui";
import s from "../site.module.css";

/** The last word on every page: start. The one centred thing on the site. */
export async function FinalCta() {
  const m = await getTranslations("marketing");
  return (
    <section className={`${s.dark} ${s.section} ${s.final}`}>
      <Container>
        <h2 className={s.h2}>{m.rich("finalTitle", RICH_SERIF)}</h2>
        <p className={s.lede}>{m("finalBody")}</p>
        <SiteLink className={`${s.btn} ${s.btnLight}`} href={SITE_LINKS.signUp}>
          {m("finalCta")}
        </SiteLink>
        <p className={s.note}>{m("finalNote")}</p>
      </Container>
    </section>
  );
}
