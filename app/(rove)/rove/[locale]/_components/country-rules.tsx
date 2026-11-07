import { getTranslations } from "next-intl/server";
import type { CountryRules, Source } from "@/lib/rove/destinations";
import s from "../rove.module.css";

/** A country's renting rules (licence, motorbikes, helmets, deposits, insurance, road safety), each topic in a row. */
export async function CountryRulesList({ rules }: { rules: CountryRules }) {
  const t = await getTranslations("directory");
  const rows: Array<{ title: string; items: string[] }> = [
    { title: t("rv.ruleLicence"), items: rules.licence },
    { title: t("rv.ruleMotorbike"), items: rules.motorbike },
    { title: t("rv.ruleHelmet"), items: rules.helmet },
    { title: t("rv.ruleDeposits"), items: rules.deposits },
    { title: t("rv.ruleInsurance"), items: rules.insurance },
    { title: t("rv.ruleSafety"), items: rules.safety }
  ];
  return (
    <div lang="en">
      {rows.map((row) => (
        <div className={s.rule} key={row.title}>
          <h3 className={s.h3} style={{ fontSize: 19 }}>
            {row.title}
          </h3>
          <ul>
            {row.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Where the facts on a page come from. */
export async function SourceList({ sources, checked }: { sources: Source[]; checked: string }) {
  const t = await getTranslations("directory");
  const unique = [...new Map(sources.map((source) => [source.url, source])).values()];
  if (!unique.length) return null;
  return (
    <aside className={s.sources}>
      <p style={{ margin: 0, fontWeight: 700 }}>{t("rv.sourcesTitle")}</p>
      <p className={s.muted} style={{ margin: "2px 0 0" }}>
        {t("rv.sourcesNote", { date: checked })}
      </p>
      <ol>
        {unique.map((source) => (
          <li key={source.url}>
            <a href={source.url} rel="noopener" target="_blank">
              {source.label}
            </a>
          </li>
        ))}
      </ol>
    </aside>
  );
}
