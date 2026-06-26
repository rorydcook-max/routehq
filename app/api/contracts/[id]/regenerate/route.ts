import { NextResponse } from "next/server";
import { buildContractVariables, renderContractTemplate } from "@/lib/contract-rendering";
import { defaultRentalContractTemplate, embedLogoInContractVariables, getContractGenerationContext } from "@/lib/contracts";
import { htmlToPdf } from "@/lib/html-to-pdf";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const deliveryKeys = [
  "delivery_odometer",
  "delivery_fuel_level",
  "delivery_fuel_image_url",
  "delivery_damage_report",
  "delivery_customer_signature_url",
  "delivery_customer_signed_at",
  "delivery_date",
  "delivery_location"
] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = (await createSupabaseServerClient()) as any;
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: accessibleContract, error: accessError } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (accessError || !accessibleContract) {
      return NextResponse.json({ error: accessError?.message || "Contract not found." }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const admin = createSupabaseAdminClient() as any;
    const { data: contract, error: contractError } = await admin
      .from("contracts")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (contractError || !contract) {
      throw new Error(contractError?.message || "Contract not found.");
    }

    const generationContext = await getContractGenerationContext(admin, contract.rental_id, null);
    const existingBookingData =
      generationContext.bookingLink?.booking_data && typeof generationContext.bookingLink.booking_data === "object"
        ? generationContext.bookingLink.booking_data
        : {};
    const deliveryData: Record<string, unknown> = {};

    for (const key of deliveryKeys) {
      if (body[key] !== undefined) {
        deliveryData[key] = body[key];
      }
    }

    const bookingLink = {
      ...generationContext.bookingLink,
      booking_data: {
        ...existingBookingData,
        ...deliveryData
      }
    };

    const metadata = contract.metadata && typeof contract.metadata === "object" && !Array.isArray(contract.metadata)
      ? { ...contract.metadata }
      : {};

    const variables = buildContractVariables({
      organization: generationContext.organization,
      customer: generationContext.customer,
      vehicle: generationContext.vehicle,
      rental: generationContext.rental,
      bookingLink
    });

    if (!variables.customer_signature_url && metadata.customer_signature_url) {
      variables.customer_signature_url = String(metadata.customer_signature_url);
    }
    if (!variables.customer_signed_at && metadata.customer_signed_at) {
      variables.customer_signed_at = String(metadata.customer_signed_at);
    }

    const embeddedVariables = await embedLogoInContractVariables(admin, variables);
    const templateHtml = generationContext.template.content_html || generationContext.template.body || defaultRentalContractTemplate;
    const html = renderContractTemplate(templateHtml, embeddedVariables);
    const pdfBytes = await htmlToPdf(html);
    const pdfStoragePath =
      String(contract.content_pdf_url || "").trim() ||
      `${generationContext.rental.organization_id}/contracts/${contract.id}/contract-${Date.now()}.pdf`;

    const { error: uploadError } = await admin.storage.from("documents").upload(pdfStoragePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { error: updateError } = await admin
      .from("contracts")
      .update({
        content_html: html,
        content_pdf_url: pdfStoragePath,
        delivery_completed_at: new Date().toISOString(),
        metadata: {
          ...metadata,
          has_delivery_appendix: true
        }
      })
      .eq("id", contract.id)
      .eq("organization_id", generationContext.rental.organization_id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const { data: signedUrl } = await admin.storage.from("documents").createSignedUrl(pdfStoragePath, 60 * 60);

    return NextResponse.json({
      contractId: contract.id,
      pdfUrl: signedUrl?.signedUrl || null,
      pdfStoragePath,
      hasDeliveryAppendix: true
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to regenerate contract." }, { status: 400 });
  }
}
