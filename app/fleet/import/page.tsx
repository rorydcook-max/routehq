import Link from "next/link";
import { ImportWizard } from "@/app/import/import-wizard";
import { AppShell } from "@/components/app-shell";
import { Card, SectionHeader } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";

export default async function ImportVehiclesPage() {
  const userEmail = await getCurrentUserEmail();

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 rounded-3xl border border-[var(--border)] bg-white px-5 py-4 shadow-[0_16px_38px_rgba(15,23,42,0.06)]">
          <Link className="text-sm font-bold text-[var(--primary)]" href="/fleet">
            Back to fleet
          </Link>
          <h1 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[var(--foreground)] sm:text-3xl">Import vehicles</h1>
          <p className="mt-1 text-sm font-medium text-[var(--muted)]">
            Upload a spreadsheet or paste a public Google Sheets link. RouteHQ will use AI to map the columns before import.
          </p>
        </div>

        <Card>
          <SectionHeader eyebrow="Fleet import" title="AI-assisted vehicle import" />
          <div className="mt-5">
            <ImportWizard defaultImportType="vehicles" />
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
