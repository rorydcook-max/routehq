import process from "node:process";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const DEV_PROJECT_REF = "adxwmzfbljlanfnxhsoa";
const PROD_PROJECT_REF = "loutrkhqnkslwapqxpkm";
const organizationId = process.argv.find((arg) => arg.startsWith("--organization-id="))?.split("=")[1];

loadEnv({ path: ".env.development.local" });

function assertDevelopmentProject() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!url.includes(DEV_PROJECT_REF) || url.includes(PROD_PROJECT_REF)) {
    throw new Error(`Refusing to upload QA assets: active Supabase URL must be ${DEV_PROJECT_REF}.`);
  }
  if (!organizationId) throw new Error("Pass --organization-id=<development organization uuid>.");
}

async function main() {
  assertDevelopmentProject();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const logoPath = `${organizationId}/branding/phase7-logo-${runId}.png`;
  const signaturePath = `${organizationId}/branding/signatures/phase7-signature-${runId}.png`;
  const onePixelPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l7qU8wAAAABJRU5ErkJggg==",
    "base64"
  );
  const [logo, signature] = [onePixelPng, onePixelPng];
  for (const [path, body] of [[logoPath, logo], [signaturePath, signature]]) {
    const { error } = await supabase.storage.from("branding").upload(path, body, {
      contentType: "image/png",
      upsert: false,
      metadata: { organization_id: organizationId, phase7_qa: "true" }
    });
    if (error) throw new Error(error.message);
  }
  const now = new Date().toISOString();
  const { error } = await supabase.from("organizations").update({
    business_logo_storage_bucket: "branding",
    business_logo_storage_path: logoPath,
    authorised_signature_storage_bucket: "branding",
    authorised_signature_storage_path: signaturePath,
    signature_authorised_at: now,
    signature_authorisation_text_version: "business-signature-authorisation-v1"
  }).eq("id", organizationId);
  if (error) throw new Error(error.message);
  console.log(JSON.stringify({ organizationId, logoPath, signaturePath }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
