import { RouteHqLogo } from "@/components/brand-logo";

export function AuthCard({
  eyebrow,
  title,
  children
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-8">
      <section className="surface-panel w-full max-w-md p-6">
        <div className="mb-6">
          <RouteHqLogo className="mb-5" />
          <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--primary)]">{eyebrow}</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.03em] text-[var(--foreground)]">{title}</h1>
        </div>
        {children}
      </section>
    </main>
  );
}
