import Link from "next/link";
import { getTranslations } from "next-intl/server";

/** A wrong or old link: say so plainly and offer the way back, instead of the framework's bare "404". */
export default async function NotFound() {
  const t = await getTranslations("errorPages");
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-5">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-white p-6 text-center shadow-[var(--shadow-sm)]">
        <h1 className="text-xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">{t("notFoundTitle")}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{t("notFoundBody")}</p>
        <Link className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white" href="/">
          {t("goHome")}
        </Link>
      </div>
    </main>
  );
}
