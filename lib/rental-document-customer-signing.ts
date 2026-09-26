import { createHash, randomUUID } from "node:crypto";
import { htmlToPdf } from "@/lib/html-to-pdf";
import { buildContractVariables } from "@/lib/contract-rendering";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createRentalDocumentSignedUrl } from "@/lib/rental-document-storage";
import { recordActivityEventOnce } from "@/lib/supabase/activity";
import { emailExecutedDocumentToCustomer } from "@/lib/rental-document-email";

export const CUSTOMER_SIGNING_ACKNOWLEDGEMENTS = [
  {
    type: "agreement_reviewed",
    textVersion: "customer-ack-agreement-reviewed-v1",
    text: "I confirm that I have read and understood the rental agreement."
  },
  {
    type: "early_termination",
    // v2: v1 referred to "the stated standard daily rate", which many agreements don't state.
    textVersion: "customer-ack-early-termination-v2",
    text: "I understand that if I end the rental early, my charges may be recalculated as set out in the agreement."
  },
  {
    type: "damage_responsibility",
    textVersion: "customer-ack-damage-responsibility-v1",
    text: "I understand my responsibilities for loss or damage while the vehicle is in my possession, subject to the agreement and applicable law."
  },
  {
    type: "insurance",
    textVersion: "customer-ack-insurance-v1",
    text: "I understand that insurance is subject to the insurer's terms, limits, exclusions and claims procedures."
  },
  {
    type: "electronic_signature_records",
    textVersion: "customer-ack-electronic-signature-records-v1",
    text: "I consent to electronic records and electronic signatures being used for this rental."
  },
  {
    type: "data_handling",
    textVersion: "customer-ack-data-handling-v1",
    text: "I understand that my personal information and uploaded documents will be handled for this rental according to the rental company's applicable privacy and contract processes."
  }
] as const;

const CUSTOMER_SAFE_MATERIAL_CHANGE_MESSAGE =
  "This agreement is being updated by the rental company. Please contact the rental company or try again after they issue the revised agreement.";

function settingsObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function isRentalDocumentCustomerSigningEnabledForOrganization(organization: any) {
  return Boolean(organization?.id);
}

function hashFragment(hash: string | null | undefined) {
  const clean = String(hash || "").trim();
  return clean ? `${clean.slice(0, 8)}...${clean.slice(-8)}` : "";
}

function dataSnapshot(value: unknown) {
  return settingsObject(value);
}

function variablesFromVersion(version: any) {
  return settingsObject(dataSnapshot(version?.rendered_data_snapshot).variables);
}

function stringValue(value: unknown) {
  return String(value ?? "").trim();
}

function compare(label: string, current: unknown, snapshotted: unknown, issues: string[]) {
  if (stringValue(current) !== stringValue(snapshotted)) {
    issues.push(label);
  }
}

function materialChangeIssues({ organization, rental, customer, vehicle, bookingLink, version }: any) {
  const snapshot = dataSnapshot(version.rendered_data_snapshot);
  const variables = variablesFromVersion(version);
  const currentVariables = buildContractVariables({ organization, rental, customer, vehicle, bookingLink });
  const issues: string[] = [];

  compare("vehicle ID", vehicle?.id, snapshot.vehicle_id, issues);
  compare("customer ID", customer?.id, snapshot.customer_id, issues);
  compare("rental ID", rental?.id, snapshot.rental_id, issues);
  compare("vehicle registration", currentVariables.vehicle_registration, variables.vehicle_registration, issues);
  compare("start date", currentVariables.rental_start_date, variables.rental_start_date, issues);
  compare("start time", currentVariables.rental_start_time, variables.rental_start_time, issues);
  compare("end date", currentVariables.rental_end_date, variables.rental_end_date, issues);
  compare("end time", currentVariables.rental_end_time, variables.rental_end_time, issues);
  compare("open-ended status", rental?.is_indefinite ? "Open-ended" : "Fixed term", variables.open_ended_status, issues);
  compare("rental rate", currentVariables.rental_rate, variables.rental_rate, issues);
  compare("billing period", currentVariables.billing_period, variables.billing_period, issues);
  compare("contracted rate", rental?.contracted_rate || rental?.rental_rate, variables.contracted_rate, issues);
  compare("standard daily rate", rental?.standard_daily_rate ?? "", variables.standard_daily_rate, issues);
  compare("early termination minimum days", rental?.early_termination_minimum_days ?? "", variables.early_termination_minimum_days, issues);
  compare("deposit", currentVariables.deposit_amount, variables.deposit_amount, issues);
  compare("insurance excess", rental?.insurance_excess ?? "", variables.insurance_excess_amount, issues);
  compare("mileage allowance", rental?.mileage_allowance ?? "", variables.mileage_allowance_amount, issues);
  compare("excess mileage rate", rental?.excess_mileage_rate ?? "", variables.excess_mileage_rate_amount, issues);
  compare("delivery fee", rental?.delivery_fee ?? "", variables.delivery_fee, issues);
  compare("collection fee", rental?.collection_fee ?? "", variables.collection_fee, issues);
  compare("cancellation administration fee", rental?.cancellation_admin_fee ?? "", variables.cancellation_admin_fee, issues);
  compare("additional drivers", currentVariables.additional_drivers || "", variables.additional_drivers || "", issues);
  compare("special rental terms", currentVariables.special_conditions || "", variables.special_conditions || "", issues);

  return Array.from(new Set(issues));
}

async function loadByToken(token: string) {
  const supabase = createSupabaseAdminClient() as any;
  const { data: bookingLink, error: bookingError } = await supabase
    .from("booking_links")
    .select("*")
    .eq("token", token)
    .is("deleted_at", null)
    .maybeSingle();
  if (bookingError || !bookingLink) return { supabase, state: "not_found" as const };

  const [{ data: organization }, { data: rental }, { data: vehicle }, { data: customer }, { data: documents }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", bookingLink.organization_id).is("deleted_at", null).maybeSingle(),
    bookingLink.rental_id ? supabase.from("rentals").select("*").eq("id", bookingLink.rental_id).eq("organization_id", bookingLink.organization_id).is("deleted_at", null).maybeSingle() : Promise.resolve({ data: null }),
    bookingLink.vehicle_id ? supabase.from("vehicles").select("*").eq("id", bookingLink.vehicle_id).eq("organization_id", bookingLink.organization_id).is("deleted_at", null).maybeSingle() : Promise.resolve({ data: null }),
    bookingLink.customer_id ? supabase.from("customers").select("*").eq("id", bookingLink.customer_id).eq("organization_id", bookingLink.organization_id).is("deleted_at", null).maybeSingle() : Promise.resolve({ data: null }),
    bookingLink.customer_id
      ? supabase.from("documents").select("id, category").eq("organization_id", bookingLink.organization_id).eq("owner_type", "customer").eq("owner_id", bookingLink.customer_id).is("deleted_at", null)
      : Promise.resolve({ data: [] })
  ]);

  const { data: document } = rental?.id
    ? await supabase
        .from("rental_documents")
        .select("*")
        .eq("organization_id", bookingLink.organization_id)
        .eq("rental_id", rental.id)
        .eq("document_type", "rental_agreement")
        .not("status", "in", "(voided,superseded)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: version } = document?.current_version_id
    ? await supabase
        .from("rental_document_versions")
        .select("*")
        .eq("organization_id", bookingLink.organization_id)
        .eq("id", document.current_version_id)
        .eq("document_id", document.id)
        .maybeSingle()
    : { data: null };

  const { data: signatures } = version?.id
    ? await supabase
        .from("rental_document_signatures")
        .select("id, signer_role, signer_name, signed_at, content_hash_at_signing, signature_storage_bucket, signature_storage_path")
        .eq("organization_id", bookingLink.organization_id)
        .eq("document_version_id", version.id)
    : { data: [] };

  const { data: certificate } = version?.id
    ? await supabase
        .from("rental_document_execution_certificates")
        .select("id, certificate_storage_bucket, certificate_storage_path, verification_reference, generated_at")
        .eq("organization_id", bookingLink.organization_id)
        .eq("document_version_id", version.id)
        .maybeSingle()
    : { data: null };

  return { supabase, state: "found" as const, bookingLink, organization, rental, vehicle, customer, documents: documents || [], document, version, signatures: signatures || [], certificate };
}

export async function getCustomerSigningEligibility(token: string) {
  const ctx = await loadByToken(token);
  if (ctx.state !== "found") {
    return {
      eligible: false,
      blockingIssues: ["invalid_token"],
      warnings: [],
      customerSafeMessage: "This booking link could not be found.",
      documentReference: null,
      versionReference: null,
      contentHash: null,
      contentHashFragment: "",
      customerAlreadySigned: false,
      fullyExecuted: false
    };
  }

  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const { bookingLink, organization, rental, vehicle, customer, document, version, signatures, certificate } = ctx;

  if (!organization || !rental || !vehicle) blockingIssues.push("missing_booking_records");
  if (bookingLink.status === "cancelled") blockingIssues.push("booking_cancelled");
  if (bookingLink.status === "expired" || (bookingLink.expires_at && new Date(bookingLink.expires_at).getTime() < Date.now())) blockingIssues.push("booking_expired");
  if (!isRentalDocumentCustomerSigningEnabledForOrganization(organization)) blockingIssues.push("customer_signing_feature_disabled");
  if (!document) blockingIssues.push("missing_rental_agreement_document");
  if (document && ["voided", "superseded"].includes(String(document.status))) blockingIssues.push("document_not_current");
  if (!version) blockingIssues.push("missing_current_version");
  if (version && document?.current_version_id !== version.id) blockingIssues.push("version_not_current");
  if (version && (version.status !== "signed" || !version.finalised_at)) blockingIssues.push("version_not_finalised_and_business_signed");
  if (version && !version.content_hash) blockingIssues.push("missing_content_hash");
  if (version && !(version.final_pdf_storage_bucket || version.pdf_storage_bucket) && !(version.final_pdf_storage_path || version.pdf_storage_path)) blockingIssues.push("missing_final_pdf");

  const businessSignature = signatures.find((signature: any) => signature.signer_role === "authorised_business_signatory");
  const renterSignature = signatures.find((signature: any) => signature.signer_role === "renter");
  if (!businessSignature || businessSignature.content_hash_at_signing !== version?.content_hash) blockingIssues.push("missing_business_signature");

  if (customer) {
    if (!customer.full_name || !customer.nationality || !customer.phone || !customer.date_of_birth) warnings.push("customer_identity_can_be_completed");
    if (!customer.passport_number) warnings.push("passport_number_can_be_completed_or_uploaded");
    if (!customer.driver_license_number || !customer.driver_license_country || !customer.driver_license_expiry) warnings.push("driver_licence_can_be_completed_or_uploaded");
  } else {
    warnings.push("customer_record_will_be_created_from_form");
  }

  if (version && rental && vehicle) {
    const materialIssues = materialChangeIssues(ctx);
    if (materialIssues.length > 0) {
      blockingIssues.push("material_booking_change_detected");
      await recordActivityEventOnce(ctx.supabase, {
        organization_id: bookingLink.organization_id,
        entity_type: "document",
        entity_id: document?.id || rental.id,
        vehicle_id: rental.vehicle_id,
        rental_id: rental.id,
        customer_id: rental.customer_id,
        event_type: "rental_document_material_change_blocked",
        title: "Rental document signing blocked by material change",
        detail: `Customer signing blocked because current booking values differ from the immutable agreement snapshot: ${materialIssues.join(", ")}.`,
        metadata: { document_id: document?.id || null, version_id: version.id, material_issues: materialIssues }
      }, `rental_document_material_change_blocked:${version.id}:${createHash("sha256").update(materialIssues.join("|")).digest("hex")}`);
    }
  }

  return {
    eligible: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    customerSafeMessage: blockingIssues.includes("material_booking_change_detected") ? CUSTOMER_SAFE_MATERIAL_CHANGE_MESSAGE : null,
    documentReference: document ? { id: document.id, status: document.status } : null,
    versionReference: version ? { id: version.id, versionNumber: version.version_number, status: version.status } : null,
    contentHash: version?.content_hash || null,
    contentHashFragment: hashFragment(version?.content_hash),
    customerAlreadySigned: Boolean(renterSignature),
    fullyExecuted: Boolean(renterSignature && certificate)
  };
}

export async function loadPublicRentalAgreement(token: string) {
  const ctx = await loadByToken(token);
  if (ctx.state !== "found") return null;
  const eligibility = await getCustomerSigningEligibility(token);
  const version = ctx.version;
  const variables = version ? variablesFromVersion(version) : {};
  const business = dataSnapshot(version?.business_snapshot);
  const businessSignature = ctx.signatures.find((signature: any) => signature.signer_role === "authorised_business_signatory");
  const renterSignature = ctx.signatures.find((signature: any) => signature.signer_role === "renter");

  if (!version || !ctx.document || !ctx.rental) {
    return { eligibility, agreement: null };
  }

  return {
    eligibility,
    agreement: {
      reference: ctx.document.id,
      versionId: version.id as string,
      versionNumber: version.version_number,
      contentHashFragment: hashFragment(version.content_hash),
      renderedHtmlSnapshot: version.rendered_html_snapshot,
      businessIdentity: {
        name: stringValue(business.trading_name || business.legal_name || ctx.organization?.name || "Rental business"),
        legalName: stringValue(business.legal_name) || null,
        poweredByRouteHq: business.powered_by_routehq_enabled === true
      },
      renter: {
        name: stringValue(variables.renter_full_name || ctx.customer?.full_name),
        passportNumber: stringValue(variables.renter_passport_number),
        licenceNumber: stringValue(variables.renter_licence_number)
      },
      vehicleSummary: {
        title: [variables.vehicle_year, variables.vehicle_make, variables.vehicle_model].map(stringValue).filter(Boolean).join(" "),
        registration: stringValue(variables.vehicle_registration)
      },
      rentalSummary: {
        start: [variables.rental_start_date, variables.rental_start_time].map(stringValue).filter(Boolean).join(" "),
        end: [variables.rental_end_date, variables.rental_end_time].map(stringValue).filter(Boolean).join(" "),
        rate: stringValue(variables.rental_rate),
        billingPeriod: stringValue(variables.billing_period_label || variables.billing_period),
        standardDailyRate: stringValue(variables.standard_daily_rate),
        earlyTerminationMinimumDays: stringValue(variables.early_termination_minimum_days),
        deposit: stringValue(variables.deposit_amount),
        insuranceExcess: stringValue(variables.insurance_excess_amount),
        mileageAllowance: stringValue(variables.mileage_allowance_amount),
        excessMileageRate: stringValue(variables.excess_mileage_rate_amount),
        deliveryFee: stringValue(variables.delivery_fee),
        collectionFee: stringValue(variables.collection_fee),
        cancellationAdminFee: stringValue(variables.cancellation_admin_fee)
      },
      requiredAcknowledgements: CUSTOMER_SIGNING_ACKNOWLEDGEMENTS,
      businessSignatureStatus: businessSignature ? "signed" : "missing",
      customerSignatureStatus: renterSignature ? "signed" : "pending",
      executionStatus: eligibility.fullyExecuted ? "fully_executed" : renterSignature ? "signed" : "awaiting_renter_signature"
    }
  };
}

function parsePngDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Signature must be a PNG image.");
  const buffer = Buffer.from(match[1], "base64");
  if (buffer.length < 32 || buffer.length > 280_000) throw new Error("Signature image size is invalid.");
  if (!buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw new Error("Signature image is not a valid PNG.");
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width < 120 || height < 40 || width > 1600 || height > 800) {
    throw new Error("Signature image dimensions are invalid.");
  }
  return buffer;
}

function signaturePath({ organizationId, rentalId, documentId, versionId }: { organizationId: string; rentalId: string; documentId: string; versionId: string }) {
  return `organizations/${organizationId}/rentals/${rentalId}/rental-documents/${documentId}/versions/${versionId}/signatures/renter-${randomUUID()}.png`;
}

function certificatePath({ organizationId, rentalId, documentId, versionId }: { organizationId: string; rentalId: string; documentId: string; versionId: string }) {
  return `organizations/${organizationId}/rentals/${rentalId}/rental-documents/${documentId}/versions/${versionId}/execution/execution-certificate-${new Date().toISOString().replace(/[-:.TZ]/g, "")}.pdf`;
}

async function buildExecutionCertificatePdf(ctx: any, signerName: string, verificationReference: string) {
  const version = ctx.version;
  const business = dataSnapshot(version.business_snapshot);
  const businessSignature = ctx.signatures.find((signature: any) => signature.signer_role === "authorised_business_signatory");
  const acknowledgements = CUSTOMER_SIGNING_ACKNOWLEDGEMENTS.map((ack) => `<li><strong>${ack.type.replace(/_/g, " ")}</strong> (${ack.textVersion})</li>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8" /><style>
    body{font-family:Arial,sans-serif;color:#10252b;padding:28px;line-height:1.5}
    h1{font-size:24px;margin:0 0 12px} h2{font-size:16px;margin-top:22px}
    .box{border:1px solid #d6e5e2;border-radius:8px;padding:14px;margin-top:12px}
    .muted{color:#667085;font-size:12px}
  </style></head><body>
    <h1>Rental Agreement Execution Certificate</h1>
    <p>This certificate forms part of the rental agreement referenced below. It records the electronic execution of the immutable agreement version without altering the original final agreement PDF.</p>
    <div class="box">
      <p><strong>Verification reference:</strong> ${verificationReference}</p>
      <p><strong>Rental business:</strong> ${stringValue(business.legal_name || business.trading_name || ctx.organization?.name)}</p>
      <p><strong>Renter:</strong> ${stringValue(signerName)}</p>
      <p><strong>Agreement version:</strong> ${version.version_number}</p>
      <p><strong>Original content hash:</strong> ${version.content_hash}</p>
    </div>
    <h2>Signatures</h2>
    <div class="box">
      <p><strong>Business signature:</strong> ${stringValue(businessSignature?.signer_name)} at ${stringValue(businessSignature?.signed_at)}</p>
      <p><strong>Renter signature:</strong> ${stringValue(signerName)} at ${new Date().toISOString()}</p>
      <p class="muted">Customer-visible certificate excludes detailed IP address and user-agent data. Internal audit metadata remains stored privately.</p>
    </div>
    <h2>Acknowledgements</h2>
    <ul>${acknowledgements}</ul>
    <p class="muted">RouteHQ is not a contracting party. The agreement is issued by the rental business.</p>
  </body></html>`;
  return htmlToPdf(html);
}

export async function completeRentalDocumentCustomerSigning({
  token,
  signatureDataUrl,
  signerName,
  ipAddress,
  userAgent,
  acceptedAcknowledgementTypes,
  reviewedVersionId
}: {
  token: string;
  signatureDataUrl: string;
  signerName: string;
  ipAddress: string | null;
  userAgent: string | null;
  acceptedAcknowledgementTypes: string[];
  /** The agreement version the customer was shown. They may only sign that exact version. */
  reviewedVersionId: string;
}) {
  const ctx = await loadByToken(token);
  if (ctx.state !== "found" || !ctx.document || !ctx.version || !ctx.rental) {
    throw new Error("This booking link could not be found.");
  }
  if (ctx.version.id !== reviewedVersionId) {
    throw new Error("The agreement has changed since you opened it. Please reload the page, read the updated agreement and sign again.");
  }
  const eligibility = await getCustomerSigningEligibility(token);
  if (!eligibility.eligible) {
    throw new Error(eligibility.customerSafeMessage || "This agreement is not ready for customer signing.");
  }

  const requiredTypes = CUSTOMER_SIGNING_ACKNOWLEDGEMENTS.map((ack) => ack.type);
  if (!requiredTypes.every((type) => acceptedAcknowledgementTypes.includes(type))) {
    throw new Error("Please accept each required acknowledgement before signing.");
  }

  const normalizedSigner = stringValue(signerName);
  const customerName = stringValue(ctx.customer?.full_name);
  if (!normalizedSigner || (customerName && !normalizedSigner.toLowerCase().includes(customerName.split(/\s+/)[0].toLowerCase()))) {
    throw new Error("Signer name must correspond to the renter identity.");
  }

  const png = parsePngDataUrl(signatureDataUrl);
  const sigPath = signaturePath({
    organizationId: ctx.bookingLink.organization_id,
    rentalId: ctx.rental.id,
    documentId: ctx.document.id,
    versionId: ctx.version.id
  });
  const certPath = certificatePath({
    organizationId: ctx.bookingLink.organization_id,
    rentalId: ctx.rental.id,
    documentId: ctx.document.id,
    versionId: ctx.version.id
  });
  const verificationReference = `RD-${ctx.version.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  const certPdf = await buildExecutionCertificatePdf(ctx, normalizedSigner, verificationReference);

  const storage = (ctx.supabase as any).storage.from("documents");
  const uploadedPaths: string[] = [];
  const sigUpload = await storage.upload(sigPath, png, { contentType: "image/png", upsert: false });
  if (sigUpload.error) throw new Error(sigUpload.error.message);
  uploadedPaths.push(sigPath);
  const certUpload = await storage.upload(certPath, certPdf, { contentType: "application/pdf", upsert: false });
  if (certUpload.error) {
    await storage.remove(uploadedPaths);
    throw new Error(certUpload.error.message);
  }
  uploadedPaths.push(certPath);

  const acknowledgements = CUSTOMER_SIGNING_ACKNOWLEDGEMENTS.filter((ack) => acceptedAcknowledgementTypes.includes(ack.type));
  const { data, error } = await (ctx.supabase as any).rpc("complete_rental_document_customer_signing", {
    p_booking_token: token,
    p_signature_storage_bucket: "documents",
    p_signature_storage_path: sigPath,
    p_signer_name: normalizedSigner,
    p_ip_address: ipAddress,
    p_user_agent: userAgent,
    p_acknowledgements: acknowledgements,
    p_certificate_storage_bucket: "documents",
    p_certificate_storage_path: certPath,
    p_verification_reference: verificationReference,
    p_metadata: {
      acknowledgement_types: acknowledgements.map((ack) => ack.type),
      content_hash_fragment: hashFragment(ctx.version.content_hash)
    }
  });
  if (error) {
    await storage.remove(uploadedPaths);
    throw new Error(error.message);
  }
  const row = Array.isArray(data) ? data[0] : data;

  await recordActivityEventOnce(ctx.supabase, {
    organization_id: ctx.bookingLink.organization_id,
    entity_type: "document",
    entity_id: ctx.document.id,
    vehicle_id: ctx.rental.vehicle_id,
    rental_id: ctx.rental.id,
    customer_id: ctx.rental.customer_id,
    event_type: "rental_document_fully_executed",
    title: "Rental agreement fully executed",
    detail: `${normalizedSigner} signed rental agreement version ${ctx.version.version_number}.`,
    metadata: { document_id: ctx.document.id, version_id: ctx.version.id, verification_reference: verificationReference }
  }, `rental_document_fully_executed:${ctx.version.id}`);

  const businessSnapshot = settingsObject(ctx.version.business_snapshot);
  await emailExecutedDocumentToCustomer({
    supabase: ctx.supabase,
    organizationId: ctx.bookingLink.organization_id,
    rentalId: ctx.rental.id,
    vehicleId: ctx.rental.vehicle_id,
    customerId: ctx.rental.customer_id,
    documentId: ctx.document.id,
    versionId: ctx.version.id,
    documentLabel: "Rental agreement",
    recipientEmail: ctx.customer?.email,
    recipientName: stringValue(ctx.customer?.full_name),
    businessName: stringValue(businessSnapshot.trading_name || businessSnapshot.legal_name),
    files: [
      {
        bucket: ctx.version.final_pdf_storage_bucket || ctx.version.pdf_storage_bucket,
        path: ctx.version.final_pdf_storage_path || ctx.version.pdf_storage_path,
        filename: "rental-agreement.pdf"
      },
      { bucket: "documents", path: certPath, filename: "execution-certificate.pdf" }
    ]
  });

  return row;
}

export async function getCustomerExecutedAgreementDownload(token: string, kind: "original" | "certificate") {
  const ctx = await loadByToken(token);
  if (ctx.state !== "found" || !ctx.version || !ctx.certificate) throw new Error("Executed agreement is not available.");
  const eligibility = await getCustomerSigningEligibility(token);
  if (!eligibility.fullyExecuted) throw new Error("Agreement execution is not complete.");
  const bucket = kind === "certificate" ? ctx.certificate.certificate_storage_bucket : (ctx.version.final_pdf_storage_bucket || ctx.version.pdf_storage_bucket);
  const path = kind === "certificate" ? ctx.certificate.certificate_storage_path : (ctx.version.final_pdf_storage_path || ctx.version.pdf_storage_path);
  if (!bucket || !path) throw new Error("Download is not available.");
  return createRentalDocumentSignedUrl(bucket, path, 10 * 60);
}
