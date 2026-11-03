import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { PageBand } from "@/components/page-band";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDocumentList } from "@/lib/documents-hub";
import { getDefaultOrganization } from "@/lib/organization";
import { DocumentsList } from "./documents-list";

export default async function DocumentsPage() {
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const documents = await getDocumentList(organization.id);
  const say = (await getTranslations("documentsPage")) as unknown as (key: string) => string;

  return (
    <AppShell hero={<PageBand keepSubtitle subtitle={say("subtitle")} title={say("title")} />} userEmail={userEmail}>

      <DocumentsList documents={documents} />
    </AppShell>
  );
}
