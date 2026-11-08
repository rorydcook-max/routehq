import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { BackLink } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDocumentList, getUploadedBytes } from "@/lib/documents-hub";
import { getDefaultOrganization } from "@/lib/organization";
import { FilesList } from "./files-list";

/** "48 MB", "1.2 GB": rounded, for one line under the title. */
function sizeText(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Settings › Business › Files (Rory, 7 Nov 2026): every photo and document in one place, moved out of the side menu.
 * A short list, one row per vehicle, customer or booking; links are signed only when a file is opened (/api/files).
 */
export default async function FilesSettingsPage() {
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const [documents, bytes] = await Promise.all([getDocumentList(organization.id, 400, { signLinks: false }), getUploadedBytes(organization.id)]);
  const settings = (await getTranslations("settingsPage")) as unknown as (key: string) => string;
  const say = (await getTranslations("documentsPage")) as unknown as (key: string, values?: Record<string, string | number>) => string;

  return (
    <AppShell userEmail={userEmail}>
      {/* Left-aligned like the other Settings pages (it sat centered, its back link and title out of line with theirs). */}
      <div className="w-full max-w-4xl">
        <div className="page-hero mb-4">
          <BackLink href="/settings?tab=business" label={settings("title")} />
          <h1 className="page-title">{say("filesTitle")}</h1>
          {bytes > 0 ? <p className="mt-1 text-sm font-semibold text-[var(--foreground-secondary)]">{say("storageUsed", { size: sizeText(bytes) })}</p> : null}
        </div>
        <FilesList documents={documents} />
      </div>
    </AppShell>
  );
}
