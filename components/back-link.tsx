"use client";

import { clsx } from "clsx";
import { ChevronLeft } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const PREVIOUS = "rovehq_prev_page";
const CURRENT = "rovehq_this_page";

/** Remembers the page you were on before this one (in this tab), so "back" can really go back. Mounted once, in the app's frame. */
export function BackTrail() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      const here = window.location.pathname + window.location.search;
      const last = window.sessionStorage.getItem(CURRENT);
      if (last && last !== here) window.sessionStorage.setItem(PREVIOUS, last);
      window.sessionStorage.setItem(CURRENT, here);
    } catch {
      // Private mode: the link simply goes where it says.
    }
  }, [pathname]);
  return null;
}

/** A form or a check you have just finished is not somewhere "back" should drop you. */
const flow = (path: string) => /\/(new|edit|import)(\/|\?|$)/.test(path) || path.startsWith("/inspections");

/**
 * The one way back on a sub-page: a chevron and the name of where it goes, above the page title.
 * It goes to the page you actually came from when that was another page of the app (Rory, 11 Nov 2026: opening a
 * booking from To do and pressing back used to land on the bookings list). Otherwise it goes to the named page.
 */
export function BackLink({ href, label, className }: { href: string; label: string; className?: string }) {
  const common = useTranslations("common");
  const [cameFrom, setCameFrom] = useState<string | null>(null);
  useEffect(() => {
    try {
      const here = window.location.pathname;
      // This runs before the trail above has noted the move to this page (a page's own effects run first), so until
      // it has, "the page you were on" is still filed as the current one. Tested 12 Nov 2026: To do, a booking, back.
      const noted = window.sessionStorage.getItem(CURRENT);
      const previous = noted && noted.split("?")[0] !== here ? noted : window.sessionStorage.getItem(PREVIOUS);
      // The same list with a filter on it counts too: back returns to the filtered list, not the whole one.
      if (previous && previous.split("?")[0] !== here && previous !== href && !flow(previous) && window.history.length > 1) setCameFrom(previous);
    } catch {
      // Stays the plain link.
    }
  }, [href]);
  return (
    <Link
      className={clsx("pressable -ms-1 mb-3 inline-flex min-h-9 items-center gap-0.5 rounded-full pe-2 text-[14px] font-semibold text-[var(--primary)] hover:underline", className)}
      href={(cameFrom || href) as Route}
      onClick={(event) => {
        if (!cameFrom || event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        window.history.back();
      }}
    >
      <ChevronLeft aria-hidden="true" className="rtl:rotate-180" size={18} />
      {cameFrom && cameFrom.split("?")[0] !== href.split("?")[0] && common.has("back") ? common("back") : label}
    </Link>
  );
}
