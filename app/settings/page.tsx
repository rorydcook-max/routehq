import Link from "next/link";
import type { Route } from "next";
import {
  approveVehicleCatalogSubmission,
  createVehicleMake,
  createVehicleModel,
  createVehicleTrim,
  disconnectLine,
  mergeVehicleCatalogResearch,
  researchVehicleCatalogSubmission,
  rejectVehicleCatalogSubmission,
  updateLineSettings,
  updatePreferredLocale,
  updateUpfrontDiscountSettings
} from "@/app/actions/settings";
import { BranchList } from "@/app/settings/branch-list";
import { LogoUploadSection } from "@/app/settings/logo-upload-section";
import { SignatureUploadSection } from "@/app/settings/signature-upload-section";
import { LineTestButton } from "@/app/settings/line-test-button";
import { CopyButton } from "@/app/settings/copy-button";
import { InviteForm } from "@/app/invite/invite-form";
import { PaymentMethodsForm } from "@/app/settings/payment-methods-form";
import { TravelPolicyForm } from "@/app/settings/travel-policy-form";
import { AppShell } from "@/components/app-shell";
import { PendingButton } from "@/components/pending-button";
import { Badge, Card, SectionHeader } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { ensureDefaultBranch } from "@/lib/branches";
import { defaultCalendarForLocale, supportedCalendarOptions } from "@/lib/i18n/calendars";
import { supportedLocaleOptions } from "@/lib/i18n/locales";
import { getDefaultOrganization, getTravelPolicySettings, getVehicleCategories } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(18,184,200,0.16)]";

type VehicleMakeSetting = {
  id: string;
  name: string;
  slug: string;
  origin_country: string | null;
  logo_url: string | null;
  sort_order: number;
  is_active: boolean;
};

type VehicleModelSetting = {
  id: string;
  make_id: string;
  name: string;
  category_code: string;
  body_type: string | null;
  is_active: boolean;
};

type VehicleTrimSetting = {
  id: string;
  model_id: string;
  name: string;
  year_from: number;
  year_to: number | null;
  engine_cc: number | null;
  transmission: string | null;
  fuel_type: string | null;
  seating_capacity: number | null;
  drivetrain: string | null;
  created_at: string;
};

type VehicleCatalogSubmissionSetting = {
  id: string;
  status: string;
  make_name: string;
  model_name: string | null;
  trim_name: string | null;
  category_code: string | null;
  year_from: number | null;
  year_to: number | null;
  notes: string | null;
  research_status: string | null;
  research_payload: any;
  created_at: string;
};

function candidateLabel(candidate: any) {
  return [candidate?.make, candidate?.model, candidate?.trim].filter(Boolean).join(" ");
}

function candidateSpecs(candidate: any) {
  return [
    candidate?.year_from ? `${candidate.year_from}${candidate.year_to ? `-${candidate.year_to}` : "+"}` : null,
    candidate?.engine_cc ? `${candidate.engine_cc}cc` : null,
    candidate?.transmission,
    candidate?.fuel_type,
    candidate?.drivetrain
  ]
    .filter(Boolean)
    .join(" / ");
}

function logoStorageReferenceFromUrl(url: string | null | undefined) {
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

async function signedLogoUrl(supabase: any, logoUrl: string | null) {
  const storageReference = logoStorageReferenceFromUrl(logoUrl);

  if (!storageReference) {
    return logoUrl;
  }

  const { data } = await supabase.storage.from(storageReference.bucket).createSignedUrl(storageReference.path, 60 * 60);
  return data?.signedUrl || logoUrl;
}

export default async function SettingsPage() {
  const userEmail = await getCurrentUserEmail();
  const organization = await getDefaultOrganization();
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const { data: platformAdmin } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user?.id)
    .limit(1)
    .maybeSingle();
  const isPlatformAdmin = Boolean(platformAdmin);

  const [
    { data: profile },
    { data: members },
    branches,
    categories,
    { data: vehicleMakes },
    { data: vehicleModels },
    { data: recentTrims },
    catalogSubmissionsResult,
    { data: lineMessages }
  ] = await Promise.all([
    supabase.from("users").select("preferred_locale, preferred_calendar, full_name").eq("id", user?.id).maybeSingle(),
    supabase
      .from("organization_members")
      .select("id, user_id, role, display_name, invited_email, is_active, created_at")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: true }),
    ensureDefaultBranch(organization),
    getVehicleCategories(organization.id),
    supabase
      .from("vehicle_makes")
      .select("id, name, slug, origin_country, logo_url, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("vehicle_models")
      .select("id, make_id, name, category_code, body_type, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("vehicle_trims")
      .select("id, model_id, name, year_from, year_to, engine_cc, transmission, fuel_type, seating_capacity, drivetrain, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(12),
    isPlatformAdmin
      ? supabase
          .from("vehicle_catalog_submissions")
          .select("id, status, make_name, model_name, trim_name, category_code, year_from, year_to, notes, research_status, research_payload, created_at")
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    supabase
      .from("line_messages")
      .select("id, type, status, sent_at, created_at, error, recipient_line_id")
      .eq("organisation_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(10)
  ]);

  const typedVehicleMakes = (vehicleMakes || []) as VehicleMakeSetting[];
  const typedVehicleModels = (vehicleModels || []) as VehicleModelSetting[];
  const typedRecentTrims = (recentTrims || []) as VehicleTrimSetting[];
  const typedCatalogSubmissions = (catalogSubmissionsResult.data || []) as VehicleCatalogSubmissionSetting[];
  const businessLogoUrl = await signedLogoUrl(supabase, organization.logo_url);
  const organizationSettings = organization.settings && typeof organization.settings === "object" && !Array.isArray(organization.settings)
    ? (organization.settings as Record<string, unknown>)
    : {};
  const ownerSignatureUrl = String(organizationSettings.owner_signature_url || organization.owner_signature_url || "").trim() || null;
  const makeMap = new Map<string, VehicleMakeSetting>(typedVehicleMakes.map((make) => [make.id, make]));
  const modelMap = new Map<string, VehicleModelSetting>(typedVehicleModels.map((model) => [model.id, model]));
  const travelPolicySettings = getTravelPolicySettings(organization.settings);

  const lineUserId = organization.line_user_id ?? null;
  const lineOaId = process.env.LINE_OA_ID ?? "";
  const maskedLineUserId = lineUserId
    ? `${"•".repeat(Math.max(0, lineUserId.length - 4))}${lineUserId.slice(-4)}`
    : null;
  const typedLineMessages = (lineMessages ?? []) as Array<{
    id: string;
    type: string;
    status: string;
    sent_at: string | null;
    created_at: string;
    error: string | null;
    recipient_line_id: string | null;
  }>;

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-5">
        <p className="page-eyebrow">Settings</p>
        <h1 className="page-title">Account and organization</h1>
        <p className="page-subtitle mt-2">Manage language, locations, billing, contracts, team access, and catalog curation.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeader eyebrow="Profile" title="Language preference" />
          <div className="card-section">
          <p className="text-xs text-[#667085]">Set the user language and calendar used for date fields across the app.</p>
          <form action={updatePreferredLocale} className="mt-3 space-y-3">
            <label className="block">
              <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Preferred language</span>
              <select className={inputClass} defaultValue={profile?.preferred_locale || "en"} name="preferredLocale">
                {supportedLocaleOptions.map((locale) => (
                  <option key={locale.code} value={locale.code}>
                    {locale.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Calendar</span>
              <select className={inputClass} defaultValue={profile?.preferred_calendar || defaultCalendarForLocale(profile?.preferred_locale || organization.default_locale)} name="preferredCalendar">
                {supportedCalendarOptions.map((calendar) => (
                  <option key={calendar.code} value={calendar.code}>
                    {calendar.label}
                  </option>
                ))}
              </select>
            </label>
            <PendingButton className="primary-action w-full" pendingLabel="Saving..." type="submit">
              Save preferences
            </PendingButton>
          </form>
          </div>
        </Card>

        <Card>
          <SectionHeader eyebrow="Organization" title={organization.name} />
          <div className="card-section">
            <LogoUploadSection logoUrl={businessLogoUrl || organization.logo_url} orgName={organization.name} />
            <div className="mt-3">
              <SignatureUploadSection orgName={organization.name} signatureUrl={ownerSignatureUrl} />
            </div>
          </div>
          <div className="card-section grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[#dfe4ea] p-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#667085]">Currency</p>
              <p className="mt-0.5 text-[13px] font-bold">{organization.currency}</p>
            </div>
            <div className="rounded-lg border border-[#dfe4ea] p-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#667085]">Timezone</p>
              <p className="mt-0.5 text-[13px] font-bold">{organization.timezone}</p>
            </div>
            <div className="rounded-lg border border-[#dfe4ea] p-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#667085]">Default language</p>
              <p className="mt-0.5 text-[13px] font-bold">{organization.default_locale.toUpperCase()}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <SectionHeader eyebrow="Branches" title="Operating locations" />
          <BranchList branches={branches} organizationId={organization.id} />
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <SectionHeader eyebrow="Travel policy" title="Rental territory and contract terms" />
          <p className="mt-2 text-xs leading-5 text-[#667085]">
            Configure where vehicles are normally allowed to travel, deposits for island crossings, and the default terms used in rental contracts.
          </p>
          <TravelPolicyForm organizationId={organization.id} settings={travelPolicySettings} />
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <SectionHeader eyebrow="Payments & receipts" title="Payment Methods" />
          <p className="mt-2 text-xs leading-5 text-[#667085]">
            Choose which payment methods you accept. Only enabled methods will be shown to customers in the booking link.
          </p>
          <PaymentMethodsForm
            businessName={organization.name}
            settings={{
              accepted_payment_methods: organization.accepted_payment_methods,
              promptpay_id: organization.promptpay_id,
              promptpay_qr_url: organization.promptpay_qr_url,
              bank_name: organization.bank_name,
              bank_account_number: organization.bank_account_number,
              bank_account_name: organization.bank_account_name,
              wise_link: organization.wise_link,
              revolut_link: organization.revolut_link,
              receipt_prefix: organization.receipt_prefix,
              receipt_footer_text: organization.receipt_footer_text,
              default_payment_method: organization.default_payment_method
            }}
          />
          <div className="mt-4 border-t border-[#dfe4ea] pt-4">
            <p className="text-sm font-bold text-[#172026]">Upfront payment discount</p>
            <p className="mt-1 text-xs text-[#667085]">Offer customers a discounted rate when they pay multiple months upfront. Only shown for monthly billing.</p>
            <form action={updateUpfrontDiscountSettings} className="mt-3 space-y-3">
              <label className="checkbox-label sub-surface min-h-10 font-semibold text-[var(--foreground)]" style={{ display: "flex", alignItems: "center", padding: "8px 12px" }}>
                <input
                  className="flex-shrink-0"
                  defaultChecked={Boolean(organization.upfront_discount_enabled)}
                  name="upfront_discount_enabled"
                  type="checkbox"
                  value="true"
                />
                <span>Offer upfront payment discount to customers</span>
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Minimum months required</span>
                  <input
                    className={inputClass}
                    defaultValue={String(organization.upfront_discount_min_periods ?? 3)}
                    min="1"
                    name="upfront_discount_min_periods"
                    type="number"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Discounted rate per month</span>
                  <input
                    className={inputClass}
                    defaultValue={organization.upfront_discount_rate ? String(organization.upfront_discount_rate) : ""}
                    min="0"
                    name="upfront_discount_rate"
                    placeholder="e.g. 9000"
                    step="0.01"
                    type="number"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Offer label / headline</span>
                  <input
                    className={inputClass}
                    defaultValue={organization.upfront_discount_label || ""}
                    name="upfront_discount_label"
                    placeholder="e.g. Pay 3 months, save 10%"
                    type="text"
                  />
                </label>
              </div>
              <PendingButton className="primary-action" pendingLabel="Saving..." type="submit">
                Save upfront discount settings
              </PendingButton>
            </form>
          </div>
        </Card>
      </div>

      {/* ── LINE NOTIFICATIONS ── */}
      <div className="mt-4">
        <Card>
          <SectionHeader eyebrow="LINE" title="LINE Notifications" />
          <p className="mt-2 text-xs text-[#667085]">
            Receive daily fleet summaries and real-time alerts directly in LINE.
          </p>

          {/* Connection status */}
          <div className="mt-3 flex flex-col gap-3 rounded-lg border border-[#dfe4ea] bg-[#f8fafc] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 flex-shrink-0 rounded-full ${lineUserId ? "bg-[#16a34a]" : "bg-[#d97706]"}`} />
              <div>
                <p className="text-sm font-semibold text-[#172026]">
                  {lineUserId ? "Connected" : "Not connected"}
                </p>
                {lineUserId && maskedLineUserId ? (
                  <p className="text-xs text-[#667085]">LINE User ID: {maskedLineUserId}</p>
                ) : (
                  <p className="text-xs text-[#667085]">Follow the steps below to connect your LINE account.</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={lineUserId ? "green" : "amber"}>{lineUserId ? "Connected" : "Not connected"}</Badge>
              {lineUserId && (
                <form action={disconnectLine}>
                  <input name="organizationId" type="hidden" value={organization.id} />
                  <PendingButton className="rounded-lg border border-[#fecdd3] bg-white px-3 py-1.5 text-sm font-semibold text-[#dc2626] hover:bg-[#fff1f2]" pendingLabel="Disconnecting…" type="submit">
                    Disconnect
                  </PendingButton>
                </form>
              )}
            </div>
          </div>

          {/* Setup instructions — shown when NOT connected */}
          {!lineUserId && (
            <div className="mt-3 space-y-3 rounded-lg border border-[#dfe4ea] p-3">
              <p className="text-sm font-semibold text-[#172026]">How to connect</p>

              {/* Step 1 */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-[#0f766e]">Step 1 — Add RouteHQ on LINE</p>
                <p className="text-sm text-[#344054]">
                  Search for <span className="font-mono font-semibold">{lineOaId || "@routehq"}</span> in LINE and add as a friend.
                </p>
                {lineOaId && (
                  <a
                    className="inline-flex items-center gap-2 rounded-lg border border-[#0f766e] px-3 py-2 text-sm font-semibold text-[#0f766e] hover:bg-[#f0fdf4]"
                    href={`https://line.me/ti/p/${lineOaId}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open LINE to add
                  </a>
                )}
              </div>

              {/* Step 2 */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-[#0f766e]">Step 2 — Enter your LINE User ID</p>
                <form action={updateLineSettings} className="space-y-3">
                  <input name="organizationId" type="hidden" value={organization.id} />
                  <input name="line_notifications_enabled" type="hidden" value="on" />
                  <input name="line_daily_summary_enabled" type="hidden" value="on" />
                  <input name="line_daily_summary_time" type="hidden" value="08:00" />
                  <label className="block">
                    <input
                      className={inputClass}
                      name="line_user_id"
                      placeholder="U1234567890abcdef…"
                      type="text"
                    />
                  </label>
                  <p className="text-xs text-[#667085]">
                    Find this in LINE app → Profile → Your LINE ID, or in the LINE Developers Console → your channel → Basic Settings → Your user ID at the bottom of the page.
                  </p>
                  <PendingButton className="primary-action w-full sm:w-auto" pendingLabel="Saving…" type="submit">
                    Save and connect
                  </PendingButton>
                </form>
              </div>
            </div>
          )}

          {/* Webhook configuration card — always shown */}
          {(() => {
            const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://your-domain.com").replace(/\/$/, "");
            const webhookUrl = `${appUrl}/api/line/webhook`;
            return (
              <div className="mt-3 rounded-lg border border-[#dfe4ea] bg-[#f8fafc] p-3">
                <p className="text-sm font-semibold text-[#172026]">Webhook configuration</p>
                <p className="mt-1 text-xs text-[#667085]">
                  Copy this URL and paste it into your LINE Developers Console → your channel → Messaging API → Webhook URL. Then click <strong>Verify</strong>.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <code className="flex-1 rounded-lg border border-[#dfe4ea] bg-white px-3 py-2 text-xs font-mono text-[#334155] break-all">
                    {webhookUrl}
                  </code>
                  <CopyButton text={webhookUrl} />
                </div>
                <p className="mt-3 rounded-lg border border-[#fef3c7] bg-[#fffbeb] px-3 py-2 text-xs text-[#78350f]">
                  <strong>Local development:</strong> Use your ngrok URL instead:{" "}
                  <code>ngrok http 3000</code>, then set{" "}
                  <code>https://[ngrok-url]/api/line/webhook</code> as the webhook URL.
                </p>
              </div>
            );
          })()}

          {/* Notification settings — shown when connected */}
          {lineUserId && (
            <form action={updateLineSettings} className="mt-3 space-y-5">
              <input name="organizationId" type="hidden" value={organization.id} />
              <input name="line_user_id" type="hidden" value={lineUserId} />

              {/* Master toggle */}
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#dfe4ea] p-3">
                <div>
                  <p className="text-sm font-semibold text-[#172026]">Enable LINE notifications</p>
                  <p className="mt-0.5 text-xs text-[#667085]">Master switch — turn off to pause all LINE messages.</p>
                </div>
                <div className="relative flex-shrink-0">
                  <input
                    className="peer sr-only"
                    defaultChecked={organization.line_notifications_enabled ?? false}
                    name="line_notifications_enabled"
                    type="checkbox"
                    value="on"
                  />
                  <div className="h-6 w-11 rounded-full bg-[#cbd5e1] transition-colors peer-checked:bg-[#0f766e]" />
                  <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                </div>
              </label>

              {/* Daily summary sub-settings */}
              <div className="ml-2 space-y-3 border-l-2 border-[#dfe4ea] pl-4">
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#dfe4ea] p-3">
                  <div>
                    <p className="text-sm font-semibold text-[#172026]">Daily morning summary</p>
                    <p className="mt-0.5 text-xs text-[#667085]">Sent each morning with active rentals, returns, compliance alerts, and revenue.</p>
                  </div>
                  <div className="relative flex-shrink-0">
                    <input
                      className="peer sr-only"
                      defaultChecked={organization.line_daily_summary_enabled ?? true}
                      name="line_daily_summary_enabled"
                      type="checkbox"
                      value="on"
                    />
                    <div className="h-6 w-11 rounded-full bg-[#cbd5e1] transition-colors peer-checked:bg-[#0f766e]" />
                    <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                  </div>
                </label>

                <label className="block rounded-lg border border-[#dfe4ea] p-3">
                  <p className="text-sm font-semibold text-[#172026]">Send at</p>
                  <input
                    className={`${inputClass} max-w-[160px]`}
                    defaultValue={organization.line_daily_summary_time ?? "08:00"}
                    max="23:59"
                    min="00:00"
                    name="line_daily_summary_time"
                    type="time"
                  />
                  <p className="mt-1 text-xs text-[#667085]">
                    Your local time ({organization.timezone || "Asia/Bangkok"}). The server converts to UTC automatically.
                  </p>
                </label>
              </div>

              <PendingButton className="primary-action w-full sm:w-auto" pendingLabel="Saving…" type="submit">
                Save LINE settings
              </PendingButton>
            </form>
          )}

          {/* Test button */}
          {lineUserId && (
            <div className="mt-3 rounded-lg border border-[#dfe4ea] p-3">
              <p className="text-sm font-semibold text-[#172026]">Send test summary</p>
              <p className="mt-1 text-xs text-[#667085]">Sends the daily summary to your LINE right now using live data.</p>
              <div className="mt-3">
                <LineTestButton />
              </div>
            </div>
          )}

          {/* Message log */}
          <div className="mt-3">
            <p className="text-sm font-semibold text-[#172026]">Recent messages</p>
            {typedLineMessages.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-[#cbd5e1] p-3 text-sm text-[#667085]">
                No messages sent yet.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border border-[#dfe4ea]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#dfe4ea] bg-[#f8fafc] text-left text-xs font-semibold uppercase text-[#667085]">
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Sent at</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#dfe4ea]">
                    {typedLineMessages.map((msg) => (
                      <tr key={msg.id}>
                        <td className="px-4 py-2 font-medium text-[#172026]">
                          {msg.type.replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-2">
                          <Badge tone={msg.status === "sent" ? "green" : msg.status === "failed" ? "red" : "neutral"}>
                            {msg.status}
                          </Badge>
                          {msg.status === "failed" && msg.error && (
                            <p className="mt-0.5 text-xs text-[#dc2626]">{msg.error.slice(0, 60)}</p>
                          )}
                        </td>
                        <td className="px-4 py-2 text-[#667085]">
                          {msg.sent_at
                            ? new Date(msg.sent_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                            : new Date(msg.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <SectionHeader eyebrow="Fleet import" title="Smart vehicle import" />
              <p className="mt-2 text-xs text-[#667085]">Use AI to map vehicle spreadsheets, Excel files, and public Google Sheets into your fleet.</p>
            </div>
            <Link className="primary-action pressable" href="/fleet/import">
              Open fleet importer
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <SectionHeader eyebrow="Contracts" title="Rental agreement template" />
              <p className="mt-2 text-xs text-[#667085]">Edit the default customer-facing rental contract and preview the variables used during booking.</p>
            </div>
            <Link className="primary-action pressable" href="/settings/contracts">
              Open contract editor
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <SectionHeader eyebrow="Notifications" title="LINE alerts and daily summary" />
              <p className="mt-2 text-xs text-[#667085]">Configure your LINE connection, daily morning summary, and event-triggered alerts.</p>
            </div>
            <Link className="primary-action pressable" href="/settings/notifications">
              Open notifications
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <SectionHeader eyebrow="Billing" title="Plan and subscription" />
              <p className="mt-2 text-xs text-[#667085]">View your free trial, pricing tiers, and manual subscription instructions.</p>
            </div>
            <Link className="primary-action pressable" href={"/settings/billing" as Route}>
              Open billing
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <SectionHeader eyebrow="Users" title="Organization members" />
          <div className="mt-4 space-y-3">
            {(members || []).map((member: any) => (
              <div className="flex flex-col gap-3 rounded-lg border border-[#dfe4ea] p-3 sm:flex-row sm:items-center sm:justify-between" key={member.id}>
                <div>
                  <p className="font-bold text-[#172026]">{member.display_name || member.invited_email || (member.user_id === user?.id ? userEmail : "User")}</p>
                  <p className="text-sm text-[#667085]">{member.invited_email || "Active account"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="green">{member.role}</Badge>
                  <Badge tone={member.is_active ? "blue" : "neutral"}>{member.is_active ? "Active" : "Inactive"}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeader eyebrow="Invite" title="Add owner user" />
          <p className="mt-2 text-xs text-[#667085]">For v1, invited users receive full owner-level access.</p>
          <div className="mt-3">
            <InviteForm />
          </div>
          <Link className="mt-4 inline-flex text-sm font-bold text-[#0f766e]" href="/invite">
            Open invite page
          </Link>
        </Card>
      </div>

      {isPlatformAdmin ? (
      <div className="mt-4">
        <Card>
          <SectionHeader eyebrow="Vehicle catalog" title="Makes, models, and trims" />
          <p className="mt-2 text-xs text-[#667085]">
            Platform admin tools for reviewing user submissions and curating the global vehicle catalog.
          </p>

          <div className="mt-3">
            <div className="rounded-lg border border-[#dfe4ea] bg-white p-3">
              <SectionHeader eyebrow="Review queue" title="Recent suggestions" />
              <p className="mt-2 text-xs text-[#667085]">
                These are captured automatically when an operator saves a vehicle using a custom make, model, or trim.
              </p>
              <div className="mt-4 space-y-3">
                {typedCatalogSubmissions.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#cbd5e1] p-3 text-sm text-[#667085]">No catalog suggestions yet.</p>
                ) : (
                  typedCatalogSubmissions.map((submission) => (
                    <div className="rounded-lg border border-[#edf2f7] p-3" key={submission.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-[#10252b]">
                            {[submission.make_name, submission.model_name, submission.trim_name].filter(Boolean).join(" ")}
                          </p>
                          <p className="text-sm text-[#667085]">
                            {[submission.category_code, submission.year_from ? `${submission.year_from}${submission.year_to ? `-${submission.year_to}` : "+"}` : null]
                              .filter(Boolean)
                              .join(" / ") || "Details pending"}
                          </p>
                        </div>
                        <Badge tone={submission.status === "pending_review" ? "amber" : "green"}>{submission.status.replace(/_/g, " ")}</Badge>
                      </div>
                      {submission.notes ? <p className="mt-2 text-xs text-[#667085]">{submission.notes}</p> : null}
                      {submission.status === "pending_review" ? (
                        <div className="mt-3 space-y-3">
                          <form action={researchVehicleCatalogSubmission} className="rounded-lg border border-[#bfdbfe] bg-[#eff6ff] p-3">
                            <input name="submissionId" type="hidden" value={submission.id} />
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-bold text-[#10252b]">AI catalog research</p>
                                <p className="text-sm text-[#667085]">Searches for likely matches, misspellings, and related missing trims. Nothing is added automatically.</p>
                              </div>
                              <PendingButton className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-bold text-white" pendingLabel="Researching..." type="submit">
                                Research with AI
                              </PendingButton>
                            </div>
                          </form>

                          {submission.research_status === "failed" ? (
                            <div className="rounded-lg border border-[#fecdd3] bg-[#fff1f2] p-3 text-sm text-[#be123c]">
                              <p className="font-bold">Research failed</p>
                              <p className="mt-1">
                                {submission.research_payload?.error || "Check API quota, model access, or try again."}
                              </p>
                            </div>
                          ) : null}

                          {submission.research_payload ? (
                            <div className="rounded-lg border border-[#dbeafe] bg-white p-3">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p className="text-sm font-bold text-[#10252b]">Research result</p>
                                  <p className="mt-1 text-sm text-[#667085]">{submission.research_payload.summary || "No summary returned."}</p>
                                </div>
                                <Badge tone={submission.research_payload.status === "found" ? "green" : submission.research_payload.status === "not_found" ? "red" : "amber"}>
                                  {submission.research_payload.review_recommendation || submission.research_payload.status || "review"}
                                </Badge>
                              </div>

                              {Array.isArray(submission.research_payload.likely_matches) && submission.research_payload.likely_matches.length > 0 ? (
                                <div className="mt-3">
                                  <p className="text-xs font-semibold uppercase text-[#0f766e]">Likely matches</p>
                                  <div className="mt-2 space-y-2">
                                    {submission.research_payload.likely_matches.slice(0, 4).map((candidate: any, index: number) => (
                                      <div className="rounded-lg border border-[#edf2f7] p-3" key={`${candidateLabel(candidate)}-${index}`}>
                                        <p className="font-bold text-[#10252b]">{candidateLabel(candidate) || "Candidate vehicle"}</p>
                                        <p className="text-sm text-[#667085]">{candidateSpecs(candidate) || candidate.rationale || "Specs pending"}</p>
                                        {Array.isArray(candidate.source_urls) && candidate.source_urls.length > 0 ? (
                                          <div className="mt-2 flex flex-wrap gap-2">
                                            {candidate.source_urls.slice(0, 3).map((url: string) => (
                                              <a className="text-xs font-bold text-[#2563eb]" href={url} key={url} rel="noreferrer" target="_blank">
                                                Source
                                              </a>
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {Array.isArray(submission.research_payload.missing_related_trims) && submission.research_payload.missing_related_trims.length > 0 ? (
                                <div className="mt-3">
                                  <p className="text-xs font-semibold uppercase text-[#0f766e]">Related trims to consider adding</p>
                                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                    {submission.research_payload.missing_related_trims.slice(0, 8).map((candidate: any, index: number) => (
                                      <div className="rounded-lg border border-[#edf2f7] p-3" key={`${candidateLabel(candidate)}-related-${index}`}>
                                        <p className="font-bold text-[#10252b]">{candidateLabel(candidate) || "Related trim"}</p>
                                        <p className="text-sm text-[#667085]">{candidateSpecs(candidate) || "Specs pending"}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {((Array.isArray(submission.research_payload.likely_matches) && submission.research_payload.likely_matches.length > 0) ||
                                (Array.isArray(submission.research_payload.missing_related_trims) && submission.research_payload.missing_related_trims.length > 0)) ? (
                                <form action={mergeVehicleCatalogResearch} className="mt-3 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-3">
                                  <input name="submissionId" type="hidden" value={submission.id} />
                                  <p className="text-sm font-bold text-[#166534]">Merge researched candidates</p>
                                  <p className="mt-1 text-sm text-[#667085]">
                                    Adds the AI-researched candidates to the global catalog as verified admin-reviewed data.
                                  </p>
                                  <PendingButton className="mt-3 w-full rounded-lg bg-[#16a34a] px-3 py-2 text-sm font-bold text-white" pendingLabel="Adding..." type="submit">
                                    Add AI candidates to global catalog
                                  </PendingButton>
                                </form>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="grid gap-3 lg:grid-cols-2">
                          <form action={approveVehicleCatalogSubmission} className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-3">
                            <input name="submissionId" type="hidden" value={submission.id} />
                            <label className="block">
                              <span className="text-xs font-semibold uppercase text-[#166534]">Approval note</span>
                              <input className={inputClass} name="curatorNotes" placeholder="Verified from manufacturer source" />
                            </label>
                            <PendingButton className="mt-3 w-full rounded-lg bg-[#16a34a] px-3 py-2 text-sm font-bold text-white" pendingLabel="Adding..." type="submit">
                              Add to global catalog
                            </PendingButton>
                          </form>
                          <form action={rejectVehicleCatalogSubmission} className="rounded-lg border border-[#fecdd3] bg-[#fff1f2] p-3">
                            <input name="submissionId" type="hidden" value={submission.id} />
                            <label className="block">
                              <span className="text-xs font-semibold uppercase text-[#be123c]">Rejection note</span>
                              <input className={inputClass} name="curatorNotes" placeholder="Duplicate, unclear, or incorrect" />
                            </label>
                            <PendingButton className="mt-3 w-full rounded-lg bg-[#be123c] px-3 py-2 text-sm font-bold text-white" pendingLabel="Rejecting..." type="submit">
                              Reject suggestion
                            </PendingButton>
                          </form>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-3">
            <form action={createVehicleMake} className="rounded-lg border border-[#d6e5e2] bg-[#f8fffd] p-3">
              <p className="text-sm font-extrabold uppercase text-[#0f766e]">New make</p>
              <label className="mt-4 block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Make name</span>
                <input className={inputClass} name="name" placeholder="Chery" required />
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Origin country</span>
                  <input className={inputClass} maxLength={2} name="originCountry" placeholder="CN" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Sort order</span>
                  <input className={inputClass} min="0" name="sortOrder" placeholder="1000" type="number" />
                </label>
              </div>
              <label className="mt-3 block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Logo URL</span>
                <input className={inputClass} name="logoUrl" placeholder="https://..." type="url" />
              </label>
              <PendingButton className="primary-action mt-4 w-full" pendingLabel="Adding..." type="submit">
                Add make
              </PendingButton>
            </form>

            <form action={createVehicleModel} className="rounded-lg border border-[#d6e5e2] bg-[#f8fffd] p-3">
              <p className="text-sm font-extrabold uppercase text-[#0f766e]">New model</p>
              <label className="mt-4 block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Make</span>
                <select className={inputClass} name="makeId" required>
                  <option value="">Select make</option>
                  {typedVehicleMakes.map((make) => (
                    <option key={make.id} value={make.id}>
                      {make.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Model name</span>
                <input className={inputClass} name="name" placeholder="Yaris Cross" required />
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Category</span>
                  <select className={inputClass} name="categoryCode" required>
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.code}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Body type</span>
                  <input className={inputClass} name="bodyType" placeholder="SUV" />
                </label>
              </div>
              <PendingButton className="primary-action mt-4 w-full" pendingLabel="Adding..." type="submit">
                Add model
              </PendingButton>
            </form>

            <form action={createVehicleTrim} className="rounded-lg border border-[#d6e5e2] bg-[#f8fffd] p-3">
              <p className="text-sm font-extrabold uppercase text-[#0f766e]">New trim</p>
              <label className="mt-4 block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Model</span>
                <select className={inputClass} name="modelId" required>
                  <option value="">Select model</option>
                  {typedVehicleModels.map((model) => {
                    const make = makeMap.get(model.make_id);
                    return (
                      <option key={model.id} value={model.id}>
                        {make?.name || "Make"} {model.name} ({model.category_code})
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="mt-3 block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Trim name</span>
                <input className={inputClass} name="name" placeholder="Premium HEV" required />
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Year from</span>
                  <input className={inputClass} min="1900" name="yearFrom" placeholder="2024" required type="number" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Year to</span>
                  <input className={inputClass} min="1900" name="yearTo" placeholder="Optional" type="number" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Engine CC</span>
                  <input className={inputClass} min="0" name="engineCc" type="number" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Seats</span>
                  <input className={inputClass} min="0" name="seatingCapacity" type="number" />
                </label>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Transmission</span>
                  <input className={inputClass} name="transmission" placeholder="Automatic" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Fuel type</span>
                  <input className={inputClass} name="fuelType" placeholder="hybrid" />
                </label>
              </div>
              <label className="mt-3 block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Drivetrain</span>
                <input className={inputClass} name="drivetrain" placeholder="FWD" />
              </label>
              <PendingButton className="primary-action mt-4 w-full" pendingLabel="Adding..." type="submit">
                Add trim
              </PendingButton>
            </form>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-lg border border-[#dfe4ea] bg-white p-3">
              <p className="text-sm font-extrabold text-[#10252b]">Active makes</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {typedVehicleMakes.slice(0, 28).map((make) => (
                  <Badge key={make.id} tone="blue">
                    {make.name}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-[#dfe4ea] bg-white p-3">
              <p className="text-sm font-extrabold text-[#10252b]">Recent trims</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {typedRecentTrims.map((trim) => {
                  const model = modelMap.get(trim.model_id);
                  const make = model ? makeMap.get(model.make_id) : null;
                  return (
                    <div className="rounded-lg border border-[#edf2f7] p-3" key={trim.id}>
                      <p className="font-bold text-[#10252b]">
                        {make?.name || "Make"} {model?.name || "Model"}
                      </p>
                      <p className="text-sm text-[#667085]">
                        {trim.name} / {trim.year_from}
                        {trim.year_to ? `-${trim.year_to}` : "+"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      </div>
      ) : null}
    </AppShell>
  );
}
