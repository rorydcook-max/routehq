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
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-8">
      <section className="card w-full max-w-md p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <RouteHqLogo />
          {language ? <AuthLanguage /> : null}
        </div>
        <h1 className="text-[26px] font-bold leading-tight text-[var(--foreground)]">{title}</h1>
        {body ? <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{body}</p> : null}
        <div className="mt-4">{children}</div>
      </section>
    </main>
  );
}

/** Shared pieces of the sign-in forms, so they all look and behave the same. */
export const authLabel = "font-semibold text-[var(--foreground-secondary)]";
export const authInput = "mt-1 w-full";
export const authError = "rounded-xl bg-[var(--warning-light)] px-3 py-2.5 font-semibold text-[var(--foreground)]";
export const authSuccess = "rounded-xl bg-[var(--success-light)] px-3 py-2.5 font-semibold text-[var(--foreground)]";
