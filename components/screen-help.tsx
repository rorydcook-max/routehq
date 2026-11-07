"use client";

import { CircleHelp, ExternalLink, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { helpArticleForScreen } from "@/app/actions/help-docs";

type Article = { slug: string; title: string; description: string; html: string; href: string };

/** The article's own HTML, styled to read like the help centre inside the panel. */
const articleBody =
  "text-[16px] leading-relaxed text-[var(--foreground-secondary)] [&_a]:font-semibold [&_a]:text-[var(--primary)] [&_a:hover]:underline [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-[19px] [&_h2]:font-bold [&_h2]:text-[var(--foreground)] [&_h3]:mb-1.5 [&_h3]:mt-5 [&_h3]:font-bold [&_h3]:text-[var(--foreground)] [&_li]:mt-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:my-3 [&_strong]:font-semibold [&_strong]:text-[var(--foreground)] [&_table]:my-3 [&_table]:w-full [&_td]:border-t [&_td]:border-[var(--border)] [&_td]:py-1.5 [&_td]:pe-2 [&_th]:py-1.5 [&_th]:pe-2 [&_th]:text-start [&_ul]:my-3 [&_ul]:list-disc [&_ul]:ps-5 [&_img]:my-3 [&_img]:rounded-xl [&_details]:my-2 [&_summary]:cursor-pointer [&_summary]:font-semibold";

/**
 * "Help with this page" (Rory, 2 Nov 2026; 7 Nov 2026): the help article for the screen you are on, opened in a panel
 * inside the app so you keep your place, with "Open in Help centre" for the full page. The tab counts (Settings ›
 * Team opens the article about inviting your team). With no article about this screen, a link to the help centre.
 */
export function ScreenHelp({ variant = "sidebar" }: { variant?: "sidebar" | "icon" }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [article, setArticle] = useState<Article | null | "loading">(null);

  async function show() {
    setOpen(true);
    setArticle("loading");
    // Read at the tap: the tab ("?tab=team") picks the article, and useSearchParams would make every page wait for it.
    const where = `${pathname || "/"}${typeof window !== "undefined" ? window.location.search : ""}`;
    const found = await helpArticleForScreen(where).catch(() => null);
    setArticle(found);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // A new screen closes it: the article was about the last one.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <div className="sheet-scrim fixed inset-0 z-[60] flex items-end bg-[var(--foreground)]/40 lg:items-stretch lg:justify-end" onClick={() => setOpen(false)}>
            {/* Phones: a sheet from the bottom. Computers: a panel down the right-hand side. */}
            <div
              aria-label={article && article !== "loading" ? article.title : t("helpForPage")}
              aria-modal="true"
              className="surface-panel phone-sheet flex max-h-[88vh] w-full flex-col rounded-t-3xl shadow-xl lg:max-h-none lg:w-[460px] lg:rounded-none lg:rounded-s-2xl"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
              <span aria-hidden="true" className="lg:hidden">
                <span className="sheet-grabber" />
              </span>
              <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 pb-3 pt-4">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--muted)]">{t("helpForPage")}</p>
                  <h2 className="sheet-title mt-0.5">{article && article !== "loading" ? article.title : article === "loading" ? t("helpLoading") : t("helpNoArticle")}</h2>
                </div>
                <button aria-label={t("close")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--panel-secondary)] text-[var(--foreground-secondary)]" onClick={() => setOpen(false)} type="button">
                  <X size={18} strokeWidth={2.4} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {article === "loading" ? (
                  <div className="space-y-3" aria-busy="true">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--panel-secondary)]" />
                    <div className="h-4 w-full animate-pulse rounded bg-[var(--panel-secondary)]" />
                    <div className="h-4 w-5/6 animate-pulse rounded bg-[var(--panel-secondary)]" />
                  </div>
                ) : article ? (
                  <>
                    {article.description ? <p className="text-[17px] font-medium text-[var(--foreground)]">{article.description}</p> : null}
                    <div className={articleBody} dangerouslySetInnerHTML={{ __html: article.html }} />
                  </>
                ) : (
                  <p className="font-medium text-[var(--foreground-secondary)]">{t("helpNoArticleBody")}</p>
                )}
              </div>
              <div className="border-t border-[var(--border)] px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
                <a className="secondary-action pressable w-full justify-center" href={article && article !== "loading" ? article.href : "/docs"} rel="noreferrer" target="_blank">
                  <ExternalLink size={16} />
                  {t("helpOpenCentre")}
                </a>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  if (variant === "icon") {
    return (
      <>
        <button aria-label={t("helpForPage")} className="pressable flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-strong)] bg-white text-[var(--foreground-secondary)] shadow-sm" onClick={() => void show()} title={t("helpForPage")} type="button">
          <CircleHelp size={18} />
        </button>
        {panel}
      </>
    );
  }
  return (
    <>
      <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left text-[13px] font-semibold text-[var(--sidebar-text-muted)] transition hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)]" onClick={() => void show()} type="button">
        <CircleHelp className="shrink-0" size={15} />
        {t("helpForPage")}
      </button>
      {panel}
    </>
  );
}
