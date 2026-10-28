import type { ReactNode } from "react";
import { BusinessLogoImage } from "@/components/business-logo-image";
import { CustomerLanguagePicker } from "@/components/customer-language-picker";

/**
 * One frame for every page a customer sees (/rent, a business's booking page, a booking link, a change to sign):
 * the same header row (who it is from on the left, the language pill on the right, always 56px tall) and the same
 * content width for each kind of page, so nothing jumps sideways or up and down between them.
 *
 * - "wide": pages that list vehicles (960px).
 * - "narrow": one booking, one change, one message (768px).
 */
export const PUBLIC_WIDTH = { wide: "max-w-[960px]", narrow: "max-w-[768px]" } as const;

export function PublicShell({
  width,
  brand,
  children,
  className = ""
}: {
  width: keyof typeof PUBLIC_WIDTH;
  /** Left of the header row: the business (PublicBrand) or the Lokalfleet logo. */
  brand?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={`public-shell min-h-screen bg-[var(--panel-secondary)] px-4 pb-10 pt-[calc(16px+env(safe-area-inset-top))] text-[var(--foreground)] sm:pt-6 ${className}`}>
      <div className={`mx-auto w-full ${PUBLIC_WIDTH[width]}`}>
        <header className="mb-5 flex h-14 items-center justify-between gap-3">
          <div className="min-w-0 flex-1">{brand}</div>
          <CustomerLanguagePicker className="shrink-0" />
        </header>
        {children}
      </div>
    </main>
  );
}

/** The business in the header row: its logo, or its first letter on a brand tile, with its name beside it. */
export function PublicBrand({ name, logoUrl, detail, href }: { name: string; logoUrl?: string | null; detail?: string | null; href?: string }) {
  const tile = <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-[17px] font-semibold text-white">{name.slice(0, 1).toUpperCase()}</span>;
  const body = (
    <span className="flex min-w-0 items-center gap-3">
      {logoUrl ? <BusinessLogoImage alt={`${name} logo`} className="max-h-10 max-w-[120px] shrink-0 object-contain" fallback={tile} src={logoUrl} /> : tile}
      <span className="min-w-0">
        <span className="block truncate text-[17px] font-semibold leading-tight text-[var(--foreground)]">{name}</span>
        {detail ? <span className="block truncate text-sm text-[var(--muted)]">{detail}</span> : null}
      </span>
    </span>
  );
  return href ? (
    <a className="inline-flex min-w-0 max-w-full" href={href}>
      {body}
    </a>
  ) : (
    body
  );
}

/** The plain white card every public page uses: one look, no extra borders (the same soft card as the app). */
export const publicCard = "rounded-[24px] bg-white p-5 shadow-[var(--shadow-card)]";
