import Link from "next/link";
import { ImportWizard } from "@/app/import/import-wizard";
import { AppShell } from "@/components/app-shell";
import { getTranslations } from "next-intl/server";
import { getCurrentUserEmail } from "@/lib/auth/session";

export default async function ImportVehiclesPage() {
  const userEmail = await getCurrentUserEmail();
  const t = await getTranslations("importer");

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <Link className="font-bold text-[var(--primary)]" href="/fleet">
            {t("back")}
          </Link>
          <h1 className="page-title mt-2">{t("title")}</h1>
          <p className="page-subtitle mt-2">{t("subtitle")}</p>
        </div>

        <ImportWizard defaultImportType="vehicles" />
      </div>
    </AppShell>
  );
}
