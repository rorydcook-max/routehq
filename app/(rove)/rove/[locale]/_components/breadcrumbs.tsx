import { breadcrumbLd } from "@/lib/rove/seo";
import { parseRovePath, roveHasLocale, roveHref } from "@/lib/rove/paths";
import { JsonLd } from "./json-ld";
import s from "../rove.module.css";

/** A crumb's language: the page's own, or English for a page not written in it yet. */
function crumbLocale(path: string, locale: string) {
  const page = parseRovePath(path);
  return page && roveHasLocale(page.section, locale) ? locale : "en";
}

/** The trail back up (and its BreadcrumbList for search engines). The last item is the page itself. */
export function Breadcrumbs({ items, locale, label }: { items: Array<{ name: string; path: string }>; locale: string; label: string }) {
  return (
    <>
      <JsonLd data={breadcrumbLd(items.map((item) => ({ ...item, locale: crumbLocale(item.path, locale) })), locale)} />
      <nav aria-label={label}>
        <ol className={s.crumbs}>
          {items.map((item, index) =>
            index === items.length - 1 ? (
              <li aria-current="page" key={item.path}>
                {item.name}
              </li>
            ) : (
              <li key={item.path}>
                <a href={roveHref(item.path, crumbLocale(item.path, locale))}>{item.name}</a>
              </li>
            )
          )}
        </ol>
      </nav>
    </>
  );
}
