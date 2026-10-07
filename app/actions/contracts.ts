"use server";

import { revalidatePath } from "next/cache";
import { defaultRentalContractTemplate, ensureDefaultContractTemplate } from "@/lib/contracts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth/roles";

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  if (!value) {
    throw new Error(`${key} is required.`);
  }
  return value;
}

/** The owner's own terms for the agreement: plain sentences, one per box on the Rental agreement page. */
export async function saveAgreementTerms(formData: FormData) {
  await requireOwner();
  const supabase = (await createSupabaseServerClient()) as any;
  const organizationId = requiredString(formData, "organizationId");
  const terms = formData
    .getAll("terms")
    .map((term) => String(term || "").trim().slice(0, 1500))
    .filter(Boolean)
    .slice(0, 20);

  const { data: organization, error: readError } = await supabase.from("organizations").select("settings").eq("id", organizationId).maybeSingle();
  if (readError || !organization) {
    throw new Error(readError?.message || "Organization was not found.");
  }
  const current = typeof organization.settings === "object" && organization.settings && !Array.isArray(organization.settings) ? organization.settings : {};
  const { error } = await supabase
    .from("organizations")
    .update({ settings: { ...current, agreement_extra_terms: terms } })
    .eq("id", organizationId);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings/contracts");
}

export async function saveContractTemplate(formData: FormData) {
  await requireOwner();
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
  await requireOwner();
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

