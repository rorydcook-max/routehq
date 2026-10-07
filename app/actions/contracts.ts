"use server";

import { revalidatePath } from "next/cache";
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

