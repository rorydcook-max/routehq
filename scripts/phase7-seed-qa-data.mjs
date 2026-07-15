import { randomUUID } from "node:crypto";
import process from "node:process";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const DEV_PROJECT_REF = "adxwmzfbljlanfnxhsoa";
const PROD_PROJECT_REF = "loutrkhqnkslwapqxpkm";

loadEnv({ path: ".env.development.local" });

function assertDevelopmentProject() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!url.includes(DEV_PROJECT_REF) || url.includes(PROD_PROJECT_REF)) {
    throw new Error(`Refusing to seed: active Supabase URL must be ${DEV_PROJECT_REF}.`);
  }
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing development Supabase URL or service role key.");
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function main() {
  assertDevelopmentProject();
  const supabase = adminClient();
  const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const email = `phase7.operator.${runId}@example.invalid`;
  const password = `Phase7-${randomUUID().slice(0, 8)}!qa`;

  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Phase 7 QA Operator" }
  });
  if (userError || !userData.user) throw new Error(userError?.message || "Unable to create QA auth user.");
  const userId = userData.user.id;

  await supabase.from("users").upsert({
    id: userId,
    full_name: "Phase 7 QA Operator",
    preferred_locale: "en",
    preferred_calendar: "gregory",
    timezone: "Asia/Bangkok"
  });

  const orgId = randomUUID();
  const categoryId = randomUUID();
  const customerId = randomUUID();
  const vehicleId = randomUUID();
  const rentalId = randomUUID();
  const now = new Date().toISOString();

  const orgName = `Phase 7 QA Rental Co ${runId}`;
  const inserts = [
    supabase.from("organizations").insert({
      id: orgId,
      name: orgName,
      slug: slug(orgName),
      country_code: "TH",
      timezone: "Asia/Bangkok",
      default_locale: "en",
      fallback_locale: "en",
      currency: "THB",
      supported_locales: ["en", "th"],
      supported_currencies: ["THB", "USD"],
      settings: { rental_document_engine_enabled: true, phase7_qa: true },
      onboarding_completed: true,
      onboarding_completed_at: now,
      subscription_status: "trial",
      subscription_tier: "starter",
      trading_name: `Phase 7 QA Rentals ${runId}`,
      legal_name: `Phase 7 QA Rentals Legal Co., Ltd. ${runId}`,
      business_address: "99 QA Road, Bangkok 10110",
      business_phone: "+66 2 000 0000",
      business_email: email,
      contract_accent_colour: "#0f766e",
      authorised_signatory_name: "Mali Phase Seven",
      authorised_signatory_title: "Managing Director",
      signature_authorised_at: now,
      signature_authorisation_text_version: "business-signature-authorisation-v1",
      default_contract_locale: "en",
      powered_by_routehq_enabled: true,
      created_by: userId
    }),
    supabase.from("organization_members").insert({
      organization_id: orgId,
      user_id: userId,
      role: "owner",
      display_name: "Phase 7 QA Operator",
      invited_email: email,
      is_active: true
    }),
    supabase.from("vehicle_categories").insert({
      id: categoryId,
      organization_id: orgId,
      code: `phase7_qa_${runId}`,
      name: "Phase 7 QA Vehicles",
      sort_order: 100,
      is_system: false
    }),
    supabase.from("customers").insert({
      id: customerId,
      organization_id: orgId,
      full_name: "Alex Phase Seven",
      email: `phase7.customer.${runId}@example.invalid`,
      phone: "+66 81 000 0000",
      preferred_locale: "en",
      preferred_currency: "THB",
      document_status: "pending",
      lifetime_value: 0,
      open_balance: 0,
      created_by: userId
    }),
    supabase.from("vehicles").insert({
      id: vehicleId,
      organization_id: orgId,
      category_id: categoryId,
      make: "Toyota",
      model: "Yaris Ativ",
      trim: "Smart 1.2 CVT",
      year: 2024,
      vin: `PHASE7${runId}`,
      registration_number: `QA-${runId.slice(-4)}`,
      color: "White",
      mileage: 1200,
      status: "available",
      availability_status: "available_now",
      service_area: "home_branch",
      partner_network_enabled: false,
      daily_rate: 1200,
      weekly_rate: 7000,
      monthly_rate: 26000,
      utilization_12_month: 0,
      utilization_lifecycle: 0,
      revenue_generated: 0,
      profit_generated: 0,
      health_score: 95,
      specifications: {},
      metadata: { phase7_qa: true },
      created_by: userId
    })
  ];

  for (const insert of inserts) {
    const { error } = await insert;
    if (error) throw new Error(error.message);
  }

  const { error: rentalError } = await supabase.from("rentals").insert({
    id: rentalId,
    organization_id: orgId,
    reference: `PHASE7-${runId}`,
    customer_id: customerId,
    vehicle_id: vehicleId,
    start_date: "2026-07-15",
    end_date: "2026-08-15",
    is_indefinite: false,
    status: "booked",
    pricing_model: "monthly",
    recurring_billing: true,
    billing_interval: "monthly",
    rental_rate: 26000,
    contracted_rate: 26000,
    billing_period: "monthly",
    standard_daily_rate: 1200,
    delivery_fee: 500,
    collection_fee: 500,
    insurance_excess: 10000,
    mileage_allowance: 3000,
    excess_mileage_rate: 5,
    deposit_amount: 10000,
    deposit_held: 10000,
    deposit_status: "received",
    deposit_received_at: now,
    deposit_refunded_amount: 0,
    deposit_forfeited_amount: 0,
    balance_due: 26000,
    currency: "THB",
    delivery_method: "delivery",
    delivery_location: "Phase 7 QA Hotel, Bangkok",
    delivery_datetime: "2026-07-15T10:00:00+07:00",
    return_location: "Phase 7 QA Hotel, Bangkok",
    created_by: userId
  });
  if (rentalError) throw new Error(rentalError.message);

  console.log(JSON.stringify({ email, password, organizationId: orgId, rentalId, vehicleId, customerId }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
