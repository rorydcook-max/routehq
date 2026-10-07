import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDocumentList } from "@/lib/documents-hub";
import { getDefaultOrganization } from "@/lib/organization";
import { DocumentsList } from "./documents-list";

export default async function DocumentsPage() {
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const documents = await getDocumentList(organization.id);
  const say = (await getTranslations("documentsPage")) as unknown as (key: string) => string;

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-4">
        <h1 className="page-title">{say("title")}</h1>
        <p className="page-subtitle page-subtitle-keep mt-1">{say("subtitle")}</p>
      </div>

      <DocumentsList documents={documents} />
    </AppShell>
  );
}
