import Link from "next/link";

/** A wrong or old link: say so plainly and offer the way back, instead of the framework's bare "404". */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-5">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-white p-6 text-center shadow-[var(--shadow-sm)]">
        <h1 className="text-xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">We could not find that page</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">The link may be old, or the booking, vehicle or customer may have been removed.</p>
        <Link className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white" href="/">
          Go to the dashboard
        </Link>
      </div>
    </main>
  );
}
