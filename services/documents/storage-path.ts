import type { Database } from "@/lib/supabase/database.types";

export function buildDocumentStoragePath({
  organizationId,
  ownerType,
  ownerId,
  fileName
}: {
  organizationId: string;
  ownerType: Database["public"]["Enums"]["document_owner_type"];
  ownerId: string;
  fileName: string;
}) {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${organizationId}/${ownerType}/${ownerId}/${crypto.randomUUID()}-${safeFileName}`;
}
