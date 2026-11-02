"use client";

import { CircleHelp } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { helpForScreen } from "@/app/actions/help-docs";

/**
 * "Help with this page" (Rory, 2 Nov 2026): opens the help article for the screen you are on, in a new tab so you keep
 * your place; the help centre's front page when no article is about this screen.
 */
export function ScreenHelp({ variant = "sidebar" }: { variant?: "sidebar" | "icon" }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  async function open() {
    // Opened straight away (a tab opened after waiting is blocked as a pop-up), then pointed at the article.
    const tab = window.open("/docs", "_blank");
    const href = await helpForScreen(pathname || "/").catch(() => null);
    if (href && tab) tab.location.href = href;
    else if (href) window.location.href = href;
  }

  if (variant === "icon") {
    return (
      <button aria-label={t("helpForPage")} className="pressable flex h-9 w-9 items-center justify-center rounded-full bg-white text-[var(--foreground-secondary)] shadow-sm" onClick={() => void open()} title={t("helpForPage")} type="button">
        <CircleHelp size={18} />
      </button>
    );
  }
  return (
    <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left text-[13px] font-semibold text-[var(--sidebar-text-muted)] transition hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)]" onClick={() => void open()} type="button">
      <CircleHelp className="shrink-0" size={15} />
      {t("helpForPage")}
    </button>
  );
}
