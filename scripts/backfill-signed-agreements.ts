// One-off (12 Nov 2026): make the signed copy (both signatures on the agreement, signing record as the last page)
// for agreements the customer signed before it existed. Run: npx tsx scripts/backfill-signed-agreements.ts [--dry] [--rental <id>]
// Uses .env.local. Each agreement is done once; ones that already have a signed copy are skipped.
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const key = line.slice(0, line.indexOf("="));
  if (!process.env[key]) process.env[key] = line.slice(line.indexOf("=") + 1).replace(/^"|"$/g, "");
}

async function main() {
  const dry = process.argv.includes("--dry");
  const onlyRental = process.argv.includes("--rental") ? process.argv[process.argv.indexOf("--rental") + 1] : null;
  const { createClient } = await import("@supabase/supabase-js");
  const { makeSignedAgreementCopy, signedCopyPath, storedPngDataUrl } = await import("../lib/rental-document-signed-copy");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }) as any;

  let query = admin.from("rental_document_execution_certificates").select("id, organization_id, rental_id, document_id, document_version_id, verification_reference, metadata");
  if (onlyRental) query = query.eq("rental_id", onlyRental);
  const { data: certificates, error } = await query;
  if (error) throw error;
  for (const certificate of certificates || []) {
    const ids = { organizationId: certificate.organization_id, rentalId: certificate.rental_id, documentId: certificate.document_id, versionId: certificate.document_version_id };
    const folder = signedCopyPath(ids).replace(/\/signed-agreement\.pdf$/, "");
    const { data: present } = await admin.storage.from("documents").list(folder);
    if ((present || []).some((file: any) => file.name === "signed-agreement.pdf")) {
      console.log(`skip ${certificate.rental_id}: already has a signed copy`);
      continue;
    }
    const [{ data: version }, { data: signatures }, { data: organization }, { data: document }] = await Promise.all([
      admin.from("rental_document_versions").select("*").eq("id", certificate.document_version_id).single(),
      admin.from("rental_document_signatures").select("signer_role, signer_name, signed_at, signature_storage_bucket, signature_storage_path").eq("document_version_id", certificate.document_version_id),
      admin.from("organizations").select("name, timezone").eq("id", certificate.organization_id).single(),
      admin.from("rental_documents").select("document_type, current_version_id").eq("id", certificate.document_id).single()
    ]);
    const renter = (signatures || []).find((s: any) => s.signer_role === "renter");
    const business = (signatures || []).find((s: any) => s.signer_role === "authorised_business_signatory");
    if (document?.document_type !== "rental_agreement" || !renter?.signature_storage_path) {
      console.log(`skip ${certificate.rental_id}: ${document?.document_type} / renter signature ${renter ? "file missing" : "missing"}`);
      continue;
    }
    if (dry) {
      console.log(`would make ${certificate.rental_id} (${organization?.name}, ${renter.signer_name})`);
      continue;
    }
    const signatureDataUrl = await storedPngDataUrl(admin, renter.signature_storage_bucket, renter.signature_storage_path);
    if (!signatureDataUrl) {
      console.log(`skip ${certificate.rental_id}: could not read the renter signature`);
      continue;
    }
    const ref = await makeSignedAgreementCopy(admin, {
      organizationId: certificate.organization_id,
      rentalId: certificate.rental_id,
      documentId: certificate.document_id,
      versionId: certificate.document_version_id,
      version,
      signatureDataUrl,
      signerName: renter.signer_name,
      signedAt: renter.signed_at,
      timeZone: organization?.timezone || "UTC",
      verificationReference: certificate.verification_reference,
      business: { name: organization?.name || "", signer: business?.signer_name || null, signedAt: business?.signed_at || null }
    });
    console.log(`${ref ? "made" : "FAILED"} ${certificate.rental_id} (${organization?.name}, ${renter.signer_name})${ref ? " -> " + ref.path : ""}`);
  }
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
