import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDocumentList } from "@/lib/documents-hub";
import { getDefaultOrganization } from "@/lib/organization";
import { DocumentsList } from "./documents-list";

export default async function DocumentsPage() {
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const documents = await getDocumentList(organization.id);

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-5">
        <p className="page-eyebrow">Documents</p>
        <h1 className="page-title">File library</h1>
        <p className="page-subtitle mt-2">Contracts, licenses, receipts, and inspection media across your fleet.</p>
      </div>

      <DocumentsList documents={documents} />
    </AppShell>
  );
}
