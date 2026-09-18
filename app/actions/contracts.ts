"use server";

import { revalidatePath } from "next/cache";
import { defaultRentalContractTemplate, ensureDefaultContractTemplate } from "@/lib/contracts";
import { htmlToPdf } from "@/lib/html-to-pdf";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  if (!value) {
    throw new Error(`${key} is required.`);
  }
  return value;
}

export async function saveContractTemplate(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const organizationId = requiredString(formData, "organizationId");
  const templateIdValue = String(formData.get("templateId") || "").trim();
  const seededTemplate = templateIdValue ? null : await ensureDefaultContractTemplate(supabase, organizationId);
  const templateId = templateIdValue || seededTemplate?.id;
  const name = requiredString(formData, "name");
  const language = requiredString(formData, "language");
  const contentHtml = requiredString(formData, "contentHtml");

  if (!templateId) {
    throw new Error("Contract template was not found.");
  }

  const { error } = await supabase
    .from("contract_templates")
    .update({
      name,
      title: name,
      language,
      locale: language,
      body: contentHtml,
      content_html: contentHtml,
      is_default: true,
      is_active: true
    })
    .eq("id", templateId)
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/contracts");
}

export async function resetContractTemplate(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const organizationId = requiredString(formData, "organizationId");
  const template = await ensureDefaultContractTemplate(supabase, organizationId);

  const { error } = await supabase
    .from("contract_templates")
    .update({
      name: "Standard rental agreement",
      title: "Standard rental agreement",
      language: "en",
      locale: "en",
      body: defaultRentalContractTemplate,
      content_html: defaultRentalContractTemplate,
      is_default: true,
      is_active: true
    })
    .eq("id", template.id)
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/contracts");
}

export async function signOperatorContract(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const organizationId = requiredString(formData, "organizationId");
  const rentalId = requiredString(formData, "rentalId");
  const contractId = requiredString(formData, "contractId");
  const signature = requiredString(formData, "signature");
  const signedName = requiredString(formData, "signedName");

  if (signature.length > 280_000) {
    throw new Error("Signature is too large. Please clear and sign again.");
  }

  const [{ data: contract, error: contractError }, { data: rental, error: rentalError }] = await Promise.all([
    supabase
      .from("contracts")
      .select("*")
      .eq("id", contractId)
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("rentals")
      .select("id, display_code, reference, vehicle_id, customer_id, contract_id")
      .eq("id", rentalId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle()
  ]);

  if (contractError || !contract) {
    throw new Error(contractError?.message || "Contract was not found.");
  }
  if (rentalError || !rental) {
    throw new Error(rentalError?.message || "Booking was not found.");
  }
  if (!contract.customer_signed_at || !contract.customer_signature) {
    throw new Error("The customer must sign the contract before the operator signs.");
  }

  const [{ data: customer }, { data: vehicle }] = await Promise.all([
    supabase.from("customers").select("id, full_name, phone, email, preferred_locale").eq("id", rental.customer_id).eq("organization_id", organizationId).maybeSingle(),
    supabase.from("vehicles").select("id, make, model, registration_number").eq("id", rental.vehicle_id).eq("organization_id", organizationId).maybeSingle()
  ]);

  const signedAt = new Date().toISOString();
  const existingHtml = String(contract.content_html || "");
  const withoutPreviousOperatorSignature = existingHtml.replace(/<hr \/>\s*<h3>Operator Signature<\/h3>[\s\S]*$/i, "").trim();
  const fullySignedHtml = `${withoutPreviousOperatorSignature}
    <hr />
    <h3>Operator Signature</h3>
    <p>Signed by ${signedName} on ${new Date(signedAt).toLocaleString("en-TH")}.</p>
    <img alt="Operator signature" src="${signature}" style="max-width: 320px; border: 1px solid #d6e5e2; border-radius: 8px;" />
  `;

  const pdfBytes = await htmlToPdf(fullySignedHtml);
  const storagePath = `${organizationId}/contracts/${contractId}/fully-signed-contract-${Date.now()}.pdf`;
  const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, pdfBytes, {
    contentType: "application/pdf",
    upsert: true
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .insert({
      organization_id: organizationId,
      owner_type: "contract",
      owner_id: contractId,
      storage_bucket: "documents",
      storage_path: storagePath,
      file_name: "fully-signed-contract.pdf",
      mime_type: "application/pdf",
      size_bytes: pdfBytes.byteLength,
      category: "rental_agreement",
      locale: contract.locale || "en",
      ocr_status: "not_started",
      extracted_data: {}
    })
    .select("id")
    .single();

  if (documentError || !document) {
    throw new Error(documentError?.message || "Unable to save the signed contract document.");
  }

  const metadata = typeof contract.metadata === "object" && contract.metadata ? contract.metadata : {};
  const { error: updateError } = await supabase
    .from("contracts")
    .update({
      status: "signed",
      content_html: fullySignedHtml,
      content_pdf_url: storagePath,
      document_id: document.id,
      owner_signature: signature,
      owner_signed_at: signedAt,
      signed_at: signedAt,
      metadata: {
        ...metadata,
        owner_signed_name: signedName,
        fully_signed_document_id: document.id
      }
    })
    .eq("id", contractId)
    .eq("organization_id", organizationId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const vehicleLabel = [vehicle?.make, vehicle?.model, vehicle?.registration_number].filter(Boolean).join(" ");
  await Promise.all([
    recordActivityEvent(supabase, {
      organization_id: organizationId,
      actor_id: user.id,
      entity_type: "contract",
      entity_id: contractId,
      vehicle_id: rental.vehicle_id,
      rental_id: rentalId,
      customer_id: rental.customer_id,
      event_type: "contract_operator_signed",
      title: "Contract fully signed",
      detail: `${rental.reference || rental.display_code || rentalId} was signed by the operator.`
    }),
    supabase.from("notifications").insert({
      organization_id: organizationId,
      customer_id: rental.customer_id,
      rental_id: rentalId,
      vehicle_id: rental.vehicle_id,
      channel: "in_app",
      provider: "routehq",
      locale: "en",
      status: "queued",
      recipient: organizationId,
      subject: "Contract fully signed",
      body: `The contract for ${customer?.full_name || "the customer"} ${vehicleLabel ? `(${vehicleLabel})` : ""} has been signed by the operator.`,
      metadata: { contract_id: contractId, document_id: document.id, storage_path: storagePath }
    }),
    customer?.email || customer?.phone
      ? supabase.from("notifications").insert({
          organization_id: organizationId,
          customer_id: rental.customer_id,
          rental_id: rentalId,
          vehicle_id: rental.vehicle_id,
          channel: customer?.email ? "email" : "whatsapp",
          provider: "routehq",
          locale: customer?.preferred_locale || "en",
          status: "queued",
          recipient: customer?.email || customer?.phone,
          subject: "Your rental contract is fully signed",
          body: `Your rental contract for ${vehicleLabel || "your vehicle"} has been signed by both parties. Please contact the rental operator if you need a copy resent.`,
          metadata: { contract_id: contractId, document_id: document.id, storage_path: storagePath }
        })
      : Promise.resolve()
  ]);

  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rentalId}`);
  revalidatePath(`/fleet/${rental.vehicle_id}`);

  return { signedAt, documentId: document.id as string };
}
