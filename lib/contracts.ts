import { buildContractVariables, contractVariableKeys, renderContractTemplate } from "@/lib/contract-rendering";
import { defaultRentalContractTemplate } from "@/lib/default-contract-template";

export { defaultRentalContractTemplate } from "@/lib/default-contract-template";

export const contractVariables = contractVariableKeys.map((key) => ({
  key,
  token: `{{${key}}}`
}));

const defaultTemplateMinimumLength = 5000;

function isStaleDefaultTemplate(template: any) {
  const content = String(template?.content_html || template?.body || "");
  return (
    !content ||
    content.length < defaultTemplateMinimumLength ||
    !content.includes("bilingual-section") ||
    !content.includes("lang-th") ||
    !content.includes("info-grid") ||
    !content.includes("routehq-template-v3")
  );
}

function storageReferenceFromUrl(url: string | null | undefined) {
  if (!url) return null;

  for (const bucket of ["branding", "documents"] as const) {
    const publicMarker = `/storage/v1/object/public/${bucket}/`;
    const signedMarker = `/storage/v1/object/sign/${bucket}/`;
    const marker = url.includes(publicMarker) ? publicMarker : url.includes(signedMarker) ? signedMarker : null;

    if (marker) {
      const [, pathWithQuery] = url.split(marker);
      return {
        bucket,
        path: decodeURIComponent(pathWithQuery.split("?")[0])
      };
    }
  }

  return url.startsWith("http") || url.startsWith("data:")
    ? null
    : {
        bucket: "branding" as const,
        path: url.replace(/^\/+/, "")
      };
}

function contentTypeFromUrl(url: string, fallback = "image/png") {
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  return fallback;
}

export async function logoUrlToDataUri(supabase: any, logoUrl: string | null | undefined) {
  const rawUrl = String(logoUrl || "").trim();
  if (!rawUrl || rawUrl.startsWith("data:")) {
    return rawUrl;
  }

  try {
    let fetchUrl = rawUrl;
    const storageReference = storageReferenceFromUrl(rawUrl);
    if (storageReference && !rawUrl.startsWith("http")) {
      const { data } = await supabase.storage.from(storageReference.bucket).createSignedUrl(storageReference.path, 60 * 10);
      fetchUrl = data?.signedUrl || rawUrl;
    }

    const response = await fetch(fetchUrl);
    if (!response.ok) {
      return rawUrl;
    }

    const contentType = response.headers.get("content-type") || contentTypeFromUrl(fetchUrl);
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${bytes.toString("base64")}`;
  } catch {
    return rawUrl;
  }
}

export async function embedLogoInContractVariables(supabase: any, variables: Record<string, unknown>) {
  for (const key of [
    "business_logo_url",
    "owner_signature_url",
    "customer_signature_url",
    "delivery_customer_signature_url",
    "delivery_fuel_image_url"
  ]) {
    const url = String(variables[key] || "").trim();
    if (url) {
      variables[key] = await logoUrlToDataUri(supabase, url);
    }
  }
  return variables;
}

export function buildSampleContractVariables(organization: any) {
  return buildContractVariables({
    organization,
    customer: {
      full_name: "Alex Morgan",
      passport_number: "AB1234567",
      driver_license_number: "UK-MORGAN-2026",
      driver_license_country: "United Kingdom",
      driver_license_expiry: "2028-11-20",
      nationality: "British",
      phone: "+44 7700 900123",
      email: "alex@example.com",
      address: "Demo hotel, Chaweng",
      preferred_locale: organization?.default_locale || "en"
    },
    vehicle: {
      make: "Ford",
      model: "Ranger",
      trim: "WildTrak 2.0L Bi-Turbo 4x4 10AT",
      year: "2018",
      registration_number: "ขษ 5168",
      color: "White",
      voluntary_insurance_type: "First-class rental-use",
      specifications: { fuel_type: "diesel" }
    },
    rental: {
      start_date: "2026-05-24T10:00:00+07:00",
      end_date: "2026-06-24T10:00:00+07:00",
      pricing_model: "monthly",
      rental_rate: 23000,
      deposit_amount: 10000,
      currency: "THB",
      is_indefinite: false,
      delivery_location: "Samui Airport"
    },
    bookingLink: {
      booking_data: {
        delivery_method: "deliver",
        delivery_location: "Samui Airport",
        delivery_datetime: "2026-05-24T10:00:00+07:00",
        insurance_excess: 10000,
        special_conditions: "No cross-border travel without written approval."
      },
      included_items: ["Full insurance", "Compulsory insurance", "Delivery and collection", "Breakdown cover"],
      special_conditions: "No cross-border travel without written approval."
    }
  });
}

export function renderSampleContract(template: string) {
  return renderContractTemplate(template, buildSampleContractVariables({ name: "FleetOS Demo Rentals", settings: {} }));
}

export async function ensureDefaultContractTemplate(supabase: any, organizationId: string) {
  const { data: existingDefault, error: defaultError } = await supabase
    .from("contract_templates")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_default", true)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (defaultError) {
    throw new Error(defaultError.message);
  }

  if (existingDefault) {
    if (!isStaleDefaultTemplate(existingDefault)) {
      return existingDefault;
    }

    const { data, error } = await supabase
      .from("contract_templates")
      .update({
        name: existingDefault.name || "Standard rental agreement",
        title: existingDefault.title || "Standard rental agreement",
        body: defaultRentalContractTemplate,
        content_html: defaultRentalContractTemplate,
        language: existingDefault.language || existingDefault.locale || "en",
        locale: existingDefault.locale || "en",
        is_default: true,
        is_active: true,
        variables: contractVariableKeys
      })
      .eq("id", existingDefault.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  const { data: existingStandard, error: standardError } = await supabase
    .from("contract_templates")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("template_key", "standard_rental")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (standardError) {
    throw new Error(standardError.message);
  }

  if (existingStandard) {
    const shouldReplaceWeakSeed = isStaleDefaultTemplate(existingStandard);
    const { data, error } = await supabase
      .from("contract_templates")
      .update({
        name: existingStandard.name || "Standard rental agreement",
        title: existingStandard.title || "Standard rental agreement",
        body: shouldReplaceWeakSeed ? defaultRentalContractTemplate : existingStandard.body,
        content_html: shouldReplaceWeakSeed ? defaultRentalContractTemplate : existingStandard.content_html || existingStandard.body,
        language: existingStandard.language || existingStandard.locale || "en",
        locale: existingStandard.locale || "en",
        is_default: true,
        variables: contractVariableKeys
      })
      .eq("id", existingStandard.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  const { data, error } = await supabase
    .from("contract_templates")
    .insert({
      organization_id: organizationId,
      template_type: "contract",
      template_key: "standard_rental",
      locale: "en",
      language: "en",
      version: 1,
      title: "Standard rental agreement",
      name: "Standard rental agreement",
      body: defaultRentalContractTemplate,
      content_html: defaultRentalContractTemplate,
      variables: contractVariableKeys,
      jurisdiction: "TH",
      is_default: true,
      is_active: true
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getContractGenerationContext(supabase: any, rentalId?: string | null, token?: string | null) {
  let bookingLink = null;
  let rental = null;

  if (token) {
    const { data, error } = await supabase.from("booking_links").select("*").eq("token", token).is("deleted_at", null).maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    bookingLink = data;
  }

  if (bookingLink?.rental_id || rentalId) {
    const { data, error } = await supabase.from("rentals").select("*").eq("id", bookingLink?.rental_id || rentalId).is("deleted_at", null).maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    rental = data;
  }

  if (!rental) {
    throw new Error("Rental was not found.");
  }

  const [{ data: organization }, { data: vehicle }, { data: customer }, { data: contract }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", rental.organization_id).maybeSingle(),
    supabase.from("vehicles").select("*").eq("id", rental.vehicle_id).maybeSingle(),
    supabase.from("customers").select("*").eq("id", rental.customer_id).maybeSingle(),
    rental.contract_id ? supabase.from("contracts").select("*").eq("id", rental.contract_id).maybeSingle() : Promise.resolve({ data: null })
  ]);

  if (!organization || !vehicle || !customer) {
    throw new Error("Contract context is incomplete.");
  }

  if (!bookingLink) {
    const { data, error } = await supabase.from("booking_links").select("*").eq("rental_id", rental.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    bookingLink = data || { organization_id: rental.organization_id, booking_data: {}, included_items: [], special_conditions: null };
  }

  const template = await ensureDefaultContractTemplate(supabase, rental.organization_id);
  const templateHtml = template.content_html || template.body || defaultRentalContractTemplate;
  const variables = await embedLogoInContractVariables(supabase, buildContractVariables({ organization, customer, vehicle, rental, bookingLink }));
  const html = renderContractTemplate(templateHtml, variables);
  const { htmlToPdf } = await import("@/lib/html-to-pdf");
  const pdfBytes = await htmlToPdf(html);

  return {
    organization,
    vehicle,
    customer,
    rental,
    contract,
    bookingLink,
    template,
    html,
    pdfBytes
  };
}
