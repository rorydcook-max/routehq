import { getCurrentMembership } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { signedAgreementHtml, storedPngDataUrl } from "@/lib/rental-document-signed-copy";

/**
 * A signed document shown as a page, to read on the phone without downloading a PDF (Rory, 12 Nov 2026).
 * The same text the PDF was made from: the agreement with both signatures and its signing record, or the handover
 * or return report with its photos. Read with the member's own access, so only their business's documents open.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const { id: rentalId, documentId } = await params;
  const membership = await getCurrentMembership();
  if (!membership) return Response.redirect(new URL("/login", request.url), 302);
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: document } = await supabase
    .from("rental_documents")
    .select("id, document_type, current_version_id, rental_id")
    .eq("id", documentId)
    .eq("rental_id", rentalId)
    .eq("organization_id", membership.organizationId)
    .maybeSingle();
  if (!document?.current_version_id) return new Response("This document could not be found.", { status: 404 });
  const [{ data: version }, { data: signatures }, { data: certificate }, { data: organization }] = await Promise.all([
    supabase.from("rental_document_versions").select("id, rendered_html_snapshot, content_hash, version_number").eq("id", document.current_version_id).maybeSingle(),
    supabase.from("rental_document_signatures").select("signer_role, signer_name, signed_at, signature_storage_bucket, signature_storage_path").eq("document_version_id", document.current_version_id),
    supabase.from("rental_document_execution_certificates").select("verification_reference").eq("document_version_id", document.current_version_id).maybeSingle(),
    supabase.from("organizations").select("name, timezone").eq("id", membership.organizationId).maybeSingle()
  ]);
  if (!version?.rendered_html_snapshot) return new Response("This document could not be found.", { status: 404 });

  // Access was checked above with the member's own rights; files are read with the service key.
  const admin = createSupabaseAdminClient() as any;
  let html = String(version.rendered_html_snapshot);
  const renter = (signatures || []).find((s: any) => s.signer_role === "renter");
  const business = (signatures || []).find((s: any) => s.signer_role === "authorised_business_signatory");
  if (document.document_type === "rental_agreement" && renter?.signature_storage_path) {
    const signatureDataUrl = await storedPngDataUrl(admin, renter.signature_storage_bucket, renter.signature_storage_path).catch(() => null);
    if (signatureDataUrl) {
      html = signedAgreementHtml({
        html,
        signatureDataUrl,
        signerName: renter.signer_name,
        signedAt: renter.signed_at,
        timeZone: organization?.timezone || "UTC",
        verificationReference: certificate?.verification_reference || "",
        contentHash: version.content_hash || null,
        versionNumber: version.version_number ?? null,
        business: { name: organization?.name || "", signer: business?.signer_name || null, signedAt: business?.signed_at || null }
      });
    }
  }
  // Photos in reports are stored as "storage:documents/<path>": each gets a short-lived link.
  const refs = [...new Set([...html.matchAll(/src="storage:documents\/([^"]+)"/g)].map((match) => match[1]))];
  const links = new Map<string, string>();
  await Promise.all(
    refs.map(async (path) => {
      const { data } = await admin.storage.from("documents").createSignedUrl(path, 60 * 60);
      if (data?.signedUrl) links.set(path, data.signedUrl);
    })
  );
  html = html.replace(/src="storage:documents\/([^"]+)"/g, (_, path) => `src="${(links.get(path) || "").replace(/"/g, "&quot;")}"`);

  // A bar to get back, and the page sized for a phone (the document itself is laid out for A4).
  const back = `/bookings/${rentalId}`;
  const bar = `<div style="position:sticky;top:0;z-index:10;display:flex;gap:10px;align-items:center;justify-content:space-between;padding:10px 14px;background:#1e1b4b;color:#fff;font:600 15px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><a href="${back}" style="color:#fff;text-decoration:none;">&#8249; Back to the booking</a><span style="opacity:.75;">View only</span></div>`;
  const viewport = `<meta name="viewport" content="width=device-width, initial-scale=1"><style>body{max-width:900px;margin:0 auto !important;} img{max-width:100%;height:auto;}</style>`;
  html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (head) => `${head}${viewport}`) : `${viewport}${html}`;
  html = /<body[^>]*>/i.test(html) ? html.replace(/<body[^>]*>/i, (body) => `${body}${bar}`) : `${bar}${html}`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
}
