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
  updateUpfrontDiscountSettings
} from "@/app/actions/settings";
import { BranchList } from "@/app/settings/branch-list";
import { ContractsBrandingSection } from "@/app/settings/contracts-branding-section";
import { MessagingPanel } from "@/app/settings/messaging-panel";
import { webhookReachable, webhookUrl } from "@/lib/inbox/store";
import { LineTestButton } from "@/app/settings/line-test-button";
import { LineConnectPanel } from "@/app/settings/line-connect-panel";
import { supportedLocaleOptions } from "@/lib/i18n/locales";
import { InviteForm } from "@/app/invite/invite-form";
import { PaymentMethodsForm } from "@/app/settings/payment-methods-form";
import { PublicBookingPanel } from "@/app/settings/public-booking-panel";
import { publicBookingSettings } from "@/lib/public-catalog";
import { TravelPolicyForm } from "@/app/settings/travel-policy-form";
import { AppShell } from "@/components/app-shell";
import { PendingButton } from "@/components/pending-button";
import { Badge, Card, SectionHeader } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { resolveOrganizationBrandingDisplayUrls } from "@/lib/branding-assets";
import { ensureDefaultBranch } from "@/lib/branches";
import { getDefaultOrganization, getTravelPolicySettings, getVehicleCategories } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(15,118,110,0.16)]";

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

function browserSafeAssetFallback(value: string | null | undefined) {
  const rawValue = String(value || "").trim();
  return rawValue.startsWith("http") || rawValue.startsWith("data:") ? rawValue : null;
}

const SETTINGS_TABS = [
  { key: "business", label: "Business" },
  { key: "rentals", label: "Rentals & payments" },
  { key: "messaging", label: "Messaging" },
  { key: "notifications", label: "LINE alerts" },
  { key: "team", label: "Team" },
  { key: "more", label: "Plan & tools" }
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number]["key"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const requestedTab = (await searchParams).tab;
  const tab: SettingsTab = SETTINGS_TABS.some((entry) => entry.key === requestedTab) ? (requestedTab as SettingsTab) : "business";
  const userEmail = await getCurrentUserEmail();
  const organization = await getDefaultOrganization();
  const { data: vehicleRates } = await ((await createSupabaseServerClient()) as any)
    .from("vehicles")
    .select("daily_rate, weekly_rate, monthly_rate")
    .eq("organization_id", organization.id)
    .is("deleted_at", null);
  const publicVehicleCounts = {
    total: (vehicleRates || []).length,
    priced: (vehicleRates || []).filter((v: any) => Number(v.daily_rate) > 0 || Number(v.weekly_rate) > 0 || Number(v.monthly_rate) > 0).length
  };
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

  const { data: messagingChannels } = await supabase
    .from("messaging_channels")
    .select("id, provider, display_name, status, last_error, webhook_key")
    .eq("organization_id", organization.id)
    .neq("status", "disconnected")
    .order("created_at", { ascending: true });
  const typedVehicleMakes = (vehicleMakes || []) as VehicleMakeSetting[];
  const typedVehicleModels = (vehicleModels || []) as VehicleModelSetting[];
  const typedRecentTrims = (recentTrims || []) as VehicleTrimSetting[];
  const typedCatalogSubmissions = (catalogSubmissionsResult.data || []) as VehicleCatalogSubmissionSetting[];
  const brandingDisplayUrls = await resolveOrganizationBrandingDisplayUrls(supabase, organization, { allowExternalUrl: true });
  const organizationSettings = organization.settings && typeof organization.settings === "object" && !Array.isArray(organization.settings)
    ? (organization.settings as Record<string, unknown>)
    : {};
  const ownerSignatureUrl = String(organizationSettings.owner_signature_url || organization.owner_signature_url || "").trim() || null;
  const logoDisplayUrl = organization.business_logo_storage_bucket && organization.business_logo_storage_path
    ? "/api/branding-assets/logo"
    : brandingDisplayUrls.logoUrl || browserSafeAssetFallback(organization.logo_url);
  const signatureDisplayUrl = organization.authorised_signature_storage_bucket && organization.authorised_signature_storage_path
    ? "/api/branding-assets/signature"
    : brandingDisplayUrls.signatureUrl || browserSafeAssetFallback(ownerSignatureUrl);
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
        <h1 className="page-title">Settings</h1>
      </div>

      <nav aria-label="Settings sections" className="scrollbar-none -mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-[var(--border)] px-4 sm:mx-0 sm:px-0">
        {SETTINGS_TABS.map((entry) => (
          <Link
            aria-current={tab === entry.key ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition ${tab === entry.key ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"}`}
            href={`/settings?tab=${entry.key}` as Route}
            key={entry.key}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      {tab === "business" ? (
        <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeader eyebrow="Profile" title="Your language" />
          <div className="card-section">
            <p className="text-xs text-[var(--muted)]">
              Language and calendar are personal, so each person in your business sets their own in My account.
            </p>
            <Link className="mt-3 inline-block text-sm font-bold text-[var(--primary)]" href="/account">
              Open My account
            </Link>
          </div>
        </Card>

        <Card>
          <SectionHeader eyebrow="Organization" title={organization.name} />
          <div className="card-section grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--border)] p-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Currency</p>
              <p className="mt-0.5 text-[13px] font-bold">{organization.currency}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Timezone</p>
              <p className="mt-0.5 text-[13px] font-bold">{organization.timezone}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Default language</p>
              <p className="mt-0.5 text-[13px] font-bold">
                {supportedLocaleOptions.find((option) => option.code === organization.default_locale)?.english || organization.default_locale.toUpperCase()}
              </p>
            </div>
          </div>
        </Card>
      </div>
        </>
      ) : null}
      {tab === "business" ? (
        <>
      <div className="mt-4">
        <ContractsBrandingSection
          logoDisplayUrl={logoDisplayUrl}
          organization={organization}
          signatureDisplayUrl={signatureDisplayUrl}
        />
      </div>
        </>
      ) : null}
      {tab === "business" ? (
        <>
      <div className="mt-4">
        <Card>
          <SectionHeader eyebrow="Branches" title="Operating locations" />
          <BranchList branches={branches} organizationId={organization.id} />
        </Card>
      </div>
        </>
      ) : null}
      {tab === "messaging" ? (
        <Card>
          <SectionHeader eyebrow="Messaging" title="Customer chats in one inbox" />
          <p className="mb-4 mt-2 text-[13px] text-[var(--muted)]">
            Connect the accounts your customers already message you on. Their chats arrive in your{" "}
            <Link className="font-semibold text-[var(--primary)]" href="/inbox">
              Inbox
            </Link>
            , and you reply from RouteHQ.
          </p>
          <MessagingPanel
            channels={((messagingChannels || []) as any[]).map((channel) => ({
              id: channel.id,
              provider: channel.provider,
              display_name: channel.display_name,
              status: channel.status,
              last_error: channel.last_error,
              webhook: webhookUrl(channel.provider, channel.webhook_key)
            }))}
            publicUrl={webhookReachable()}
          />
        </Card>
      ) : null}
      {tab === "rentals" ? (
        <div className="mt-4">
          <Card>
            <SectionHeader eyebrow="Online booking" title="Your booking page" />
            <PublicBookingPanel
              enabled={publicBookingSettings(organization.settings).enabled}
              deposit={publicBookingSettings(organization.settings).deposit}
              holdHours={publicBookingSettings(organization.settings).holdHours}
              pricedVehicles={publicVehicleCounts.priced}
              slug={organization.slug}
              totalVehicles={publicVehicleCounts.total}
            />
          </Card>
        </div>
      ) : null}
      {tab === "rentals" ? (
        <>
      <div className="mt-4">
        <Card>
          <SectionHeader eyebrow="Travel policy" title="Rental territory and contract terms" />
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            Configure where vehicles are normally allowed to travel, deposits for island crossings, and the default terms used in rental contracts.
          </p>
          <TravelPolicyForm organizationId={organization.id} settings={travelPolicySettings} />
        </Card>
      </div>
        </>
      ) : null}
      {tab === "rentals" ? (
        <>
      <div className="mt-4">
        <Card>
          <SectionHeader eyebrow="Payments & receipts" title="Payment Methods" />
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
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
          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <p className="text-sm font-bold text-[var(--foreground)]">Upfront payment discount</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Offer customers a discounted rate when they pay multiple months upfront. Only shown for monthly billing.</p>
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
        </>
      ) : null}
      {tab === "notifications" ? (
        <>
      <div className="mt-4">
        <Card>
          <SectionHeader eyebrow="LINE" title="LINE Notifications" />
          <p className="mt-2 text-xs text-[var(--muted)]">
            Receive daily fleet summaries and real-time alerts directly in LINE.
          </p>

          {/* Connection status */}
          <div className="mt-3 flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[#fbfaf8] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 flex-shrink-0 rounded-full ${lineUserId ? "bg-[#16a34a]" : "bg-[#d97706]"}`} />
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {lineUserId ? "Connected" : "Not connected"}
                </p>
                {lineUserId && maskedLineUserId ? (
                  <p className="text-xs text-[var(--muted)]">LINE User ID: {maskedLineUserId}</p>
                ) : (
                  <p className="text-xs text-[var(--muted)]">Follow the steps below to connect your LINE account.</p>
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

          {/* Not connected: add the RouteHQ LINE account, then send a one-time code. */}
          {!lineUserId && <LineConnectPanel lineOaId={lineOaId} organizationId={organization.id} />}

          {/* Developers only: where LINE should send messages. Operators never need this. */}
          {process.env.NODE_ENV === "development" ? (
            <div className="mt-3 rounded-lg border border-[#fef3c7] bg-[#fffbeb] p-3 text-xs text-[#78350f]">
              <p className="font-semibold">Development: LINE webhook</p>
              <p className="mt-1">
                Set the channel's webhook URL to <code>{(process.env.NEXT_PUBLIC_APP_URL || "https://your-domain.com").replace(/\/$/, "")}/api/line/webhook</code>{" "}
                (or an ngrok URL when testing locally).
              </p>
            </div>
          ) : null}

          {/* Notification settings — shown when connected */}
          {lineUserId && (
            <form action={updateLineSettings} className="mt-3 space-y-5">
              <input name="organizationId" type="hidden" value={organization.id} />
              <input name="line_user_id" type="hidden" value={lineUserId} />

              {/* Master toggle */}
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Enable LINE notifications</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">Master switch — turn off to pause all LINE messages.</p>
                </div>
                <div className="relative flex-shrink-0">
                  <input
                    className="peer sr-only"
                    defaultChecked={organization.line_notifications_enabled ?? false}
                    name="line_notifications_enabled"
                    type="checkbox"
                    value="on"
                  />
                  <div className="h-6 w-11 rounded-full bg-[#cbd5e1] transition-colors peer-checked:bg-[var(--primary)]" />
                  <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                </div>
              </label>

              {/* Daily summary sub-settings */}
              <div className="ml-2 space-y-3 border-l-2 border-[var(--border)] pl-4">
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">Daily morning summary</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">Around 8:00 each morning (Thailand time): rentals out, returns, payments due, expiring documents and this month&apos;s rent.</p>
                  </div>
                  <div className="relative flex-shrink-0">
                    <input
                      className="peer sr-only"
                      defaultChecked={organization.line_daily_summary_enabled ?? true}
                      name="line_daily_summary_enabled"
                      type="checkbox"
                      value="on"
                    />
                    <div className="h-6 w-11 rounded-full bg-[#cbd5e1] transition-colors peer-checked:bg-[var(--primary)]" />
                    <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                  </div>
                </label>

                {/* The summary goes out once a day at 08:00 Bangkok (vercel.json); the time is kept as is. */}
                <input name="line_daily_summary_time" type="hidden" value={organization.line_daily_summary_time ?? "08:00"} />
              </div>

              <PendingButton className="primary-action w-full sm:w-auto" pendingLabel="Saving…" type="submit">
                Save LINE settings
              </PendingButton>
            </form>
          )}

          {/* Test button */}
          {lineUserId && (
            <div className="mt-3 rounded-lg border border-[var(--border)] p-3">
              <p className="text-sm font-semibold text-[var(--foreground)]">Send test summary</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Sends the daily summary to your LINE right now using live data.</p>
              <div className="mt-3">
                <LineTestButton />
              </div>
            </div>
          )}

          {/* Message log */}
          <div className="mt-3">
            <p className="text-sm font-semibold text-[var(--foreground)]">Recent messages</p>
            {typedLineMessages.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                No messages sent yet.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[#fbfaf8] text-left text-xs font-semibold uppercase text-[var(--muted)]">
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Sent at</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {typedLineMessages.map((msg) => (
                      <tr key={msg.id}>
                        <td className="px-4 py-2 font-medium text-[var(--foreground)]">
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
                        <td className="px-4 py-2 text-[var(--muted)]">
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
        </>
      ) : null}
      {tab === "more" ? (
        <>
      <div className="mt-4">
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <SectionHeader eyebrow="Fleet import" title="Smart vehicle import" />
              <p className="mt-2 text-xs text-[var(--muted)]">Use AI to map vehicle spreadsheets, Excel files, and public Google Sheets into your fleet.</p>
            </div>
            <Link className="primary-action pressable" href="/fleet/import">
              Open fleet importer
            </Link>
          </div>
        </Card>
      </div>
        </>
      ) : null}
      {tab === "business" ? (
        <>
      <div className="mt-4">
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <SectionHeader eyebrow="Contracts" title="Rental agreement template" />
              <p className="mt-2 text-xs text-[var(--muted)]">Edit the default customer-facing rental contract and preview the variables used during booking.</p>
            </div>
            <Link className="primary-action pressable" href="/settings/contracts">
              Open contract editor
            </Link>
          </div>
        </Card>
      </div>
        </>
      ) : null}
      {tab === "notifications" ? (
        <>
      <div className="mt-4">
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <SectionHeader eyebrow="Notifications" title="Which alerts you get" />
              <p className="mt-2 text-xs text-[var(--muted)]">Pick the events that send you a LINE message: new bookings, payments, returns and more.</p>
            </div>
            <Link className="primary-action pressable" href="/settings/notifications">
              Choose alerts
            </Link>
          </div>
        </Card>
      </div>
        </>
      ) : null}
      {tab === "more" ? (
        <>
      <div className="mt-4">
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <SectionHeader eyebrow="Billing" title="Plan and subscription" />
              <p className="mt-2 text-xs text-[var(--muted)]">View your free trial, pricing tiers, and manual subscription instructions.</p>
            </div>
            <Link className="primary-action pressable" href={"/settings/billing" as Route}>
              Open billing
            </Link>
          </div>
        </Card>
      </div>
        </>
      ) : null}
      {tab === "team" ? (
        <>
      <div className="mt-4 grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <SectionHeader eyebrow="Users" title="Organization members" />
          <div className="mt-4 space-y-3">
            {(members || []).map((member: any) => (
              <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] p-3 sm:flex-row sm:items-center sm:justify-between" key={member.id}>
                <div>
                  <p className="font-bold text-[var(--foreground)]">{member.display_name || member.invited_email || (member.user_id === user?.id ? userEmail : "User")}</p>
                  <p className="text-sm text-[var(--muted)]">{member.invited_email || "Active account"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="green">{member.role === "owner" ? "Owner" : "Teammate"}</Badge>
                  <Badge tone={member.is_active ? "blue" : "neutral"}>{member.is_active ? "Active" : "Inactive"}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeader eyebrow="Invite" title="Invite a team member" />
          <p className="mt-2 text-xs text-[var(--muted)]">Choose Owner for a business partner, Teammate for staff who handle bookings and handovers.</p>
          <div className="mt-3">
            <InviteForm />
          </div>
          <Link className="mt-4 inline-flex text-sm font-bold text-[var(--primary)]" href="/invite">
            Open invite page
          </Link>
        </Card>
      </div>
        </>
      ) : null}
      {tab === "more" ? (
        <>
      {isPlatformAdmin ? (
      <div className="mt-4">
        <Card>
          <SectionHeader eyebrow="Vehicle catalog" title="Makes, models, and trims" />
          <p className="mt-2 text-xs text-[var(--muted)]">
            Platform admin tools for reviewing user submissions and curating the global vehicle catalog.
          </p>

          <div className="mt-3">
            <div className="rounded-lg border border-[var(--border)] bg-white p-3">
              <SectionHeader eyebrow="Review queue" title="Recent suggestions" />
              <p className="mt-2 text-xs text-[var(--muted)]">
                These are captured automatically when an operator saves a vehicle using a custom make, model, or trim.
              </p>
              <div className="mt-4 space-y-3">
                {typedCatalogSubmissions.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">No catalog suggestions yet.</p>
                ) : (
                  typedCatalogSubmissions.map((submission) => (
                    <div className="rounded-lg border border-[var(--border)] p-3" key={submission.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-[var(--foreground)]">
                            {[submission.make_name, submission.model_name, submission.trim_name].filter(Boolean).join(" ")}
                          </p>
                          <p className="text-sm text-[var(--muted)]">
                            {[submission.category_code, submission.year_from ? `${submission.year_from}${submission.year_to ? `-${submission.year_to}` : "+"}` : null]
                              .filter(Boolean)
                              .join(" / ") || "Details pending"}
                          </p>
                        </div>
                        <Badge tone={submission.status === "pending_review" ? "amber" : "green"}>{submission.status.replace(/_/g, " ")}</Badge>
                      </div>
                      {submission.notes ? <p className="mt-2 text-xs text-[var(--muted)]">{submission.notes}</p> : null}
                      {submission.status === "pending_review" ? (
                        <div className="mt-3 space-y-3">
                          <form action={researchVehicleCatalogSubmission} className="rounded-lg border border-[#bfdbfe] bg-[#eff6ff] p-3">
                            <input name="submissionId" type="hidden" value={submission.id} />
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-bold text-[var(--foreground)]">AI catalog research</p>
                                <p className="text-sm text-[var(--muted)]">Searches for likely matches, misspellings, and related missing trims. Nothing is added automatically.</p>
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
                                  <p className="text-sm font-bold text-[var(--foreground)]">Research result</p>
                                  <p className="mt-1 text-sm text-[var(--muted)]">{submission.research_payload.summary || "No summary returned."}</p>
                                </div>
                                <Badge tone={submission.research_payload.status === "found" ? "green" : submission.research_payload.status === "not_found" ? "red" : "amber"}>
                                  {submission.research_payload.review_recommendation || submission.research_payload.status || "review"}
                                </Badge>
                              </div>

                              {Array.isArray(submission.research_payload.likely_matches) && submission.research_payload.likely_matches.length > 0 ? (
                                <div className="mt-3">
                                  <p className="text-xs font-semibold uppercase text-[var(--primary)]">Likely matches</p>
                                  <div className="mt-2 space-y-2">
                                    {submission.research_payload.likely_matches.slice(0, 4).map((candidate: any, index: number) => (
                                      <div className="rounded-lg border border-[var(--border)] p-3" key={`${candidateLabel(candidate)}-${index}`}>
                                        <p className="font-bold text-[var(--foreground)]">{candidateLabel(candidate) || "Candidate vehicle"}</p>
                                        <p className="text-sm text-[var(--muted)]">{candidateSpecs(candidate) || candidate.rationale || "Specs pending"}</p>
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
                                  <p className="text-xs font-semibold uppercase text-[var(--primary)]">Related trims to consider adding</p>
                                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                    {submission.research_payload.missing_related_trims.slice(0, 8).map((candidate: any, index: number) => (
                                      <div className="rounded-lg border border-[var(--border)] p-3" key={`${candidateLabel(candidate)}-related-${index}`}>
                                        <p className="font-bold text-[var(--foreground)]">{candidateLabel(candidate) || "Related trim"}</p>
                                        <p className="text-sm text-[var(--muted)]">{candidateSpecs(candidate) || "Specs pending"}</p>
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
                                  <p className="mt-1 text-sm text-[var(--muted)]">
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
            <form action={createVehicleMake} className="rounded-lg border border-[var(--border)] bg-[#fbfaf8] p-3">
              <p className="text-sm font-semibold uppercase text-[var(--primary)]">New make</p>
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

            <form action={createVehicleModel} className="rounded-lg border border-[var(--border)] bg-[#fbfaf8] p-3">
              <p className="text-sm font-semibold uppercase text-[var(--primary)]">New model</p>
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

            <form action={createVehicleTrim} className="rounded-lg border border-[var(--border)] bg-[#fbfaf8] p-3">
              <p className="text-sm font-semibold uppercase text-[var(--primary)]">New trim</p>
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
            <div className="rounded-lg border border-[var(--border)] bg-white p-3">
              <p className="text-sm font-semibold text-[var(--foreground)]">Active makes</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {typedVehicleMakes.slice(0, 28).map((make) => (
                  <Badge key={make.id} tone="blue">
                    {make.name}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-white p-3">
              <p className="text-sm font-semibold text-[var(--foreground)]">Recent trims</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {typedRecentTrims.map((trim) => {
                  const model = modelMap.get(trim.model_id);
                  const make = model ? makeMap.get(model.make_id) : null;
                  return (
                    <div className="rounded-lg border border-[var(--border)] p-3" key={trim.id}>
                      <p className="font-bold text-[var(--foreground)]">
                        {make?.name || "Make"} {model?.name || "Model"}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
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
        </>
      ) : null}
    </AppShell>
  );
}
