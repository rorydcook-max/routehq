import { NextResponse } from "next/server";
import { getContractGenerationContext } from "@/lib/contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function assertRentalAccess(rentalId: string | null) {
  if (!rentalId) {
    throw new Error("rentalId is required when no bookingLinkToken is supplied.");
  }

  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data, error } = await supabase.from("rentals").select("id").eq("id", rentalId).is("deleted_at", null).maybeSingle();
  if (error || !data) {
    return false;
  }

  return true;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rentalId = String(body.rentalId || "").trim() || null;
    const bookingLinkToken = String(body.bookingLinkToken || body.token || "").trim() || null;

    if (!bookingLinkToken && !(await assertRentalAccess(rentalId))) {
      return NextResponse.json({ error: "Unauthorized or rental not found." }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient() as any;
    const context = await getContractGenerationContext(supabase, rentalId, bookingLinkToken);
    let contract = context.contract;

    if (!contract?.id) {
      const { data, error } = await supabase
        .from("contracts")
        .insert({
          organization_id: context.rental.organization_id,
          rental_id: context.rental.id,
          customer_id: context.customer.id,
          booking_link_id: context.bookingLink?.id || null,
          template_id: context.template.id,
          locale: context.template.locale || context.template.language || "en",
          status: "draft",
          content_html: context.html,
          metadata: {
            generated_from: "api/contracts/generate"
          }
        })
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Unable to create contract.");
      }

      contract = data;
      await Promise.all([
        supabase.from("rentals").update({ contract_id: contract.id }).eq("id", context.rental.id).eq("organization_id", context.rental.organization_id),
        context.bookingLink?.id
          ? supabase.from("booking_links").update({ contract_id: contract.id }).eq("id", context.bookingLink.id).eq("organization_id", context.rental.organization_id)
          : Promise.resolve()
      ]);
    }

    const storagePath = `${context.rental.organization_id}/contracts/${contract.id}/contract-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, context.pdfBytes, {
      contentType: "application/pdf",
      upsert: true
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .insert({
        organization_id: context.rental.organization_id,
        owner_type: "contract",
        owner_id: contract.id,
        storage_bucket: "documents",
        storage_path: storagePath,
        file_name: "rental-contract.pdf",
        mime_type: "application/pdf",
        size_bytes: context.pdfBytes.byteLength,
        category: "rental_agreement",
        locale: context.template.locale || context.template.language || "en",
        ocr_status: "not_started",
        extracted_data: {}
      })
      .select("id")
      .single();

    if (documentError || !document) {
      throw new Error(documentError?.message || "Unable to create contract document.");
    }

    const { error: contractError } = await supabase
      .from("contracts")
      .update({
        template_id: context.template.id,
        content_html: context.html,
        content_pdf_url: storagePath,
        document_id: document.id
      })
      .eq("id", contract.id)
      .eq("organization_id", context.rental.organization_id);

    if (contractError) {
      throw new Error(contractError.message);
    }

    const { data: signedUrl } = await supabase.storage.from("documents").createSignedUrl(storagePath, 60 * 60);

    return NextResponse.json({
      html: context.html,
      contractId: contract.id,
      documentId: document.id,
      pdfStoragePath: storagePath,
      pdfUrl: signedUrl?.signedUrl || null
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate contract." }, { status: 400 });
  }
}
