import { AuthLanguage } from "@/components/auth-language";
import { RouteHqLogo } from "@/components/brand-logo";

export function AuthCard({
  title,
  body,
  language = true,
  children
}: {
  /** Kept so older callers still compile; no longer shown. */
  eyebrow?: string;
  title: string;
  body?: string;
  /** Hide the language switch where the person already has a language (signed in). */
  language?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center bg-[var(--background)] px-4 py-6 sm:justify-center sm:py-10">
      <div className="w-full max-w-md">
        {/* The same header row as the public pages: logo left, language pill right, fixed height, outside the card. */}
        <header className="mb-4 flex h-12 items-center justify-between gap-3">
          <a aria-label="Lokalfleet" href="/login">
            <RouteHqLogo />
          </a>
          {language ? <AuthLanguage /> : null}
        </header>
        <section className="card w-full p-5 sm:p-6">
          <h1 className="text-[26px] font-bold leading-tight text-[var(--foreground)]">{title}</h1>
          {body ? <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{body}</p> : null}
          <div className="mt-5">{children}</div>
        </section>
      </div>
    </main>
  );
}

/** Shared pieces of the sign-in forms, so they all look and behave the same. */
export const authLabel = "font-semibold text-[var(--foreground-secondary)]";
export const authInput = "mt-1.5 w-full";
/** Helper text under a field: close to the field it explains. */
export const authHelp = "mt-1.5 block text-sm font-medium text-[var(--foreground-secondary)]";
export const authError = "rounded-xl bg-[var(--warning-light)] px-3 py-2.5 font-semibold text-[var(--foreground)]";
export const authSuccess = "rounded-xl bg-[var(--success-light)] px-3 py-2.5 font-semibold text-[var(--foreground)]";
/** Space between field groups and before the main button. */
export const authStack = "space-y-5";
