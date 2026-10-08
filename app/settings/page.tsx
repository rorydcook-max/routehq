import Link from "next/link";
import type { Route } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { intlLocale } from "@/lib/i18n/dates";
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
import { ExtrasPanel, SeasonsPanel } from "@/app/settings/price-rules-panel";
import { extrasFrom, seasonsFrom } from "@/lib/price-rules";
import { PublicBookingPanel } from "@/app/settings/public-booking-panel";
import { TeamMemberActions } from "@/app/settings/team-member-actions";
import { createSupabaseAdminClient as teamAdminClient } from "@/lib/supabase/admin";
import { BookingRulesPanel } from "@/app/settings/booking-rules-panel";
import { CustomerMessagesPanel } from "@/app/settings/customer-messages-panel";
import { customerMessagesOn } from "@/lib/customer-messages";
import { bookingRules } from "@/lib/booking-rules";
import { publicBookingSettings } from "@/lib/public-catalog";
import { TravelPolicyForm } from "@/app/settings/travel-policy-form";
import { AppShell } from "@/components/app-shell";
import { PendingButton } from "@/components/pending-button";
import { Badge, Card, Fold, SectionHeader } from "@/components/ui";
import { OpenOnHash } from "@/components/open-on-hash";
import { freshPromptPayQrUrl } from "@/lib/promptpay-qr";
import { PushToggle } from "@/components/push-toggle";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { resolveOrganizationBrandingDisplayUrls } from "@/lib/branding-assets";
import { ensureDefaultBranch } from "@/lib/branches";
import { getDefaultOrganization, getTravelPolicySettings, getVehicleCategories } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus-ring)]";

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

// The wording for the parts operators see is in locales/<language>/common.json under
// "settingsPage". The vehicle catalogue tools at the bottom are for RouteHQ staff only.
const SETTINGS_TABS = [{ key: "business" }, { key: "rentals" }, { key: "messaging" }, { key: "notifications" }, { key: "team" }, { key: "more" }] as const;

type Say = (key: string, values?: Record<string, string | number>) => string;

type SettingsTab = (typeof SETTINGS_TABS)[number]["key"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const requestedTab = (await searchParams).tab;
  const tab: SettingsTab = SETTINGS_TABS.some((entry) => entry.key === requestedTab) ? (requestedTab as SettingsTab) : "business";
  const userEmail = await getCurrentUserEmail();
  const organization = await getDefaultOrganization();
  const t = await getTranslations("settingsPage");
  const say = t as unknown as Say;
  const locale = await getLocale();
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
  // An account can be connected and still not be delivering (a token that was revoked, say).
  // The last message sent on each account says which: if it failed, the account says so here.
  const { data: recentSends } = await supabase
    .from("conversation_messages")
    .select("status, error, created_at, conversations!inner(channel_id)")
    .eq("organization_id", organization.id)
    .eq("direction", "out")
    .order("created_at", { ascending: false })
    .limit(60);
  const lastSendByChannel = new Map<string, { failed: boolean; error: string | null; at: string }>();
  for (const send of (recentSends || []) as any[]) {
    const channelId = String(send.conversations?.channel_id || "");
    if (!channelId || lastSendByChannel.has(channelId)) continue;
    lastSendByChannel.set(channelId, { failed: send.status === "failed", error: send.error || null, at: String(send.created_at || "") });
  }
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

  // Who has been invited but has not finished joining, so the owner can see it and send the invite again.
  const waitingMembers = new Set<string>();
  if (tab === "team") {
    const teamAdmin = teamAdminClient() as any;
    await Promise.all(
      (members || [])
        .filter((member: any) => member.is_active && member.invited_email && member.user_id !== user?.id)
        .map(async (member: any) => {
          const { data } = await teamAdmin.auth.admin.getUserById(member.user_id);
          if (data?.user?.invited_at && !data.user.email_confirmed_at) waitingMembers.add(member.id);
        })
    );
  }
  const viewerIsOwner = (members || []).some((member: any) => member.user_id === user?.id && member.role === "owner");
  const promptPayQrDisplayUrl = tab === "rentals" ? await freshPromptPayQrUrl(await createSupabaseServerClient(), organization.promptpay_qr_url, 60 * 60) : organization.promptpay_qr_url;
  const paymentNames: Record<string, string> = { cash: say("pay_cash"), promptpay: say("pay_promptpay"), bank_transfer: say("pay_bank_transfer"), wise: say("pay_wise"), revolut: say("pay_revolut") };
  const acceptedMethods = Array.from(new Set(["cash", ...((organization.accepted_payment_methods as unknown as string[] | null) || [])])).filter((method) => method in paymentNames);
  const paymentSummary = acceptedMethods.map((method) => paymentNames[method]).join(", ");
  const travelSummary = `${travelPolicySettings.home_territory || say("travel_noHome")} · ${
    travelPolicySettings.island_travel_policy === "not_permitted" ? say("travel_not_permitted") : travelPolicySettings.island_travel_policy === "notice_only" ? say("travel_notice_only") : say("travel_deposit")
  }`;

  return (
    <AppShell userEmail={userEmail}>
      <OpenOnHash />
      <div className="page-hero mb-5">
        <h1 className="page-title">{say("title")}</h1>
      </div>

      <nav aria-label={say("title")} className="mb-5 flex flex-wrap gap-2">
        {SETTINGS_TABS.map((entry) => (
          <Link
            aria-current={tab === entry.key ? "page" : undefined}
            className={`pressable flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-center font-bold leading-tight transition ${tab === entry.key ? "bg-[var(--primary)] text-white" : "bg-white text-[var(--foreground)]"}`}
            href={`/settings?tab=${entry.key}` as Route}
            key={entry.key}
          >
            {say(`tab_${entry.key}`)}
          </Link>
        ))}
      </nav>

      {tab === "business" ? (
        <>
      <div>
        <ContractsBrandingSection
          logoDisplayUrl={logoDisplayUrl}
          organization={organization}
          signatureDisplayUrl={signatureDisplayUrl}
        />
        <p className="mt-3 px-1 font-medium text-[var(--foreground-secondary)]">
          {t.rich("currencyLine", {
            currency: organization.currency,
            zone: organization.timezone.replace("_", " "),
            link: (chunks) => (
              <Link className="font-bold text-[var(--primary)]" href="/account">
                {chunks}
              </Link>
            )
          })}
        </p>
      </div>
        </>
      ) : null}
      {tab === "business" ? (
        <>
      <div className="mt-4">
        <Card>
          <SectionHeader title={say("loc_title")} />
          <BranchList branches={branches} organizationId={organization.id} />
        </Card>
      </div>
        </>
      ) : null}
      {tab === "messaging" ? (
        <Card>
          <SectionHeader title={say("msg_title")} />
          <p className="mb-4 mt-2 font-medium text-[var(--foreground-secondary)]">
            {t.rich("msg_body", {
              link: (chunks) => (
                <Link className="font-bold text-[var(--primary)]" href="/inbox">
                  {chunks}
                </Link>
              )
            })}
          </p>
          <MessagingPanel
            channels={((messagingChannels || []) as any[]).map((channel) => ({
              id: channel.id,
              provider: channel.provider,
              display_name: channel.display_name,
              status: channel.status,
              last_error: channel.last_error,
                send_error: lastSendByChannel.get(channel.id)?.failed ? lastSendByChannel.get(channel.id)?.error || say("msg_notDelivered") : null,
                send_failed_at: lastSendByChannel.get(channel.id)?.failed ? lastSendByChannel.get(channel.id)?.at || null : null,
              webhook: webhookUrl(channel.provider, channel.webhook_key)
            }))}
            publicUrl={webhookReachable()}
          />
        </Card>
      ) : null}
      {tab === "messaging" ? (
        <div className="mt-4">
          <Card>
            <SectionHeader title={say("msgOut_title")} />
            <div className="mt-3">
              <CustomerMessagesPanel
                enabled={customerMessagesOn(organization.settings)}
                hasChannel={((messagingChannels || []) as any[]).some((channel) => channel.status !== "disconnected")}
              />
            </div>
          </Card>
        </div>
      ) : null}
      {tab === "rentals" ? (
        <div className="space-y-3">
          {/* Each section says what is set now, and opens with one tap. Getting paid comes first. */}
          <Fold id="payment-methods" summary={paymentSummary} title={say("pay_title")}>
            <p className="mb-3 font-medium text-[var(--foreground-secondary)]">{say("pay_body")}</p>
            <PaymentMethodsForm
            businessName={organization.name}
            settings={{
              accepted_payment_methods: organization.accepted_payment_methods,
              promptpay_id: organization.promptpay_id,
              promptpay_qr_url: promptPayQrDisplayUrl,
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
          </Fold>
          <Fold id="booking-page" summary={publicBookingSettings(organization.settings).enabled ? say("book_on") : say("book_off")} title={say("book_title")}>
            <PublicBookingPanel
              enabled={publicBookingSettings(organization.settings).enabled}
              deposit={publicBookingSettings(organization.settings).deposit}
                  offer={publicBookingSettings(organization.settings).offer}
              holdHours={bookingRules(organization.settings).holdHours}
              pricedVehicles={publicVehicleCounts.priced}
              slug={organization.slug}
              totalVehicles={publicVehicleCounts.total}
            />
          </Fold>
          <Fold id="holds" summary={say("hold_summary", { hours: bookingRules(organization.settings).holdHours })} title={say("hold_title")}>
            <BookingRulesPanel rules={bookingRules(organization.settings)} />
          </Fold>
          <Fold
            id="high-season"
            summary={seasonsFrom(organization.settings).length ? say("season_summary", { count: seasonsFrom(organization.settings).length }) : say("season_none")}
            title={say("season_title")}
          >
            <SeasonsPanel initial={seasonsFrom(organization.settings)} />
          </Fold>
          <Fold
            id="extras"
            summary={extrasFrom(organization.settings).length ? extrasFrom(organization.settings).map((extra) => extra.name).join(", ") : say("extra_none")}
            title={say("extra_title")}
          >
            <ExtrasPanel currencySymbol={(organization.currency || "THB") === "THB" ? "฿" : organization.currency || ""} initial={extrasFrom(organization.settings)} />
          </Fold>
          <Fold id="paying-ahead" summary={organization.upfront_discount_enabled ? say("ahead_on") : say("ahead_off")} title={say("ahead_title")}>
            <p className="mb-3 font-medium text-[var(--foreground-secondary)]">{say("ahead_body")}</p>
            <form action={updateUpfrontDiscountSettings} className="mt-3 space-y-3">
              <label className="checkbox-label sub-surface min-h-10 font-semibold text-[var(--foreground)]" style={{ display: "flex", alignItems: "center", padding: "8px 12px" }}>
                <input
                  className="flex-shrink-0"
                  defaultChecked={Boolean(organization.upfront_discount_enabled)}
                  name="upfront_discount_enabled"
                  type="checkbox"
                  value="true"
                />
                <span>{say("ahead_offer")}</span>
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">{say("ahead_months")}</span>
                  <input
                    className={inputClass}
                    defaultValue={String(organization.upfront_discount_min_periods ?? 3)}
                    min="1"
                    name="upfront_discount_min_periods"
                    type="number"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">{say("ahead_price")}</span>
                  <input
                    className={inputClass}
                    defaultValue={organization.upfront_discount_rate ? String(organization.upfront_discount_rate) : ""}
                    min="0"
                    name="upfront_discount_rate"
                    placeholder={say("ahead_pricePh")}
                    step="0.01"
                    type="number"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">{say("ahead_label")}</span>
                  <input
                    className={inputClass}
                    defaultValue={organization.upfront_discount_label || ""}
                    name="upfront_discount_label"
                    placeholder={say("ahead_labelPh")}
                    type="text"
                  />
                </label>
              </div>
              <PendingButton className="primary-action" pendingLabel={say("saving")} savedLabel={say("saved")} type="submit">
                {say("save")}
              </PendingButton>
            </form>
          </Fold>
          <Fold id="travel" summary={travelSummary} title={say("travel_title")}>
            <p className="font-medium text-[var(--foreground-secondary)]">{say("travel_body")}</p>
            <TravelPolicyForm organizationId={organization.id} settings={travelPolicySettings} />
          </Fold>
        </div>
      ) : null}
      {tab === "notifications" ? (
        <>
      <Card>
        <SectionHeader title={say("push_title")} />
        <div className="card-section">
          <PushToggle />
        </div>
      </Card>
      <div className="mt-4">
        <Card>
          <SectionHeader title={say("line_title")} />
          <p className="mt-2 font-medium text-[var(--foreground-secondary)]">{say("line_body")}</p>

          {/* Connection status */}
          <div className="mt-3 flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 flex-shrink-0 rounded-full ${lineUserId ? "bg-[var(--success)]" : "bg-[var(--warning)]"}`} />
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {lineUserId ? say("line_connected") : say("line_notConnected")}
                </p>
                {lineUserId && maskedLineUserId ? (
                  <p className="font-medium text-[var(--foreground-secondary)]">{say("line_account", { id: String(lineUserId).slice(-4) })}</p>
                ) : (
                  <p className="font-medium text-[var(--foreground-secondary)]">{say("line_follow")}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {lineUserId && (
                <form action={disconnectLine}>
                  <input name="organizationId" type="hidden" value={organization.id} />
                  <PendingButton className="secondary-action" pendingLabel={say("line_disconnecting")} type="submit">
                    {say("line_disconnect")}
                  </PendingButton>
                </form>
              )}
            </div>
          </div>

          {/* Not connected: add the RouteHQ LINE account, then send a one-time code. */}
          {!lineUserId && <LineConnectPanel lineOaId={lineOaId} organizationId={organization.id} />}

          {/* Developers only: where LINE should send messages. Operators never need this. */}
          {process.env.NODE_ENV === "development" ? (
            <div className="mt-3 rounded-lg border border-[var(--warning-light)] bg-[var(--warning-light)] p-3 text-xs text-[var(--warning)]">
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
                  <p className="font-bold text-[var(--foreground)]">{say("line_enable")}</p>
                  <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">{say("line_enableBody")}</p>
                </div>
                <div className="relative flex-shrink-0">
                  <input
                    className="peer sr-only"
                    defaultChecked={organization.line_notifications_enabled ?? false}
                    name="line_notifications_enabled"
                    type="checkbox"
                    value="on"
                  />
                  <div className="h-6 w-11 rounded-full bg-[var(--border)] transition-colors peer-checked:bg-[var(--primary)]" />
                  <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                </div>
              </label>

              {/* Daily summary sub-settings */}
              <div className="ml-2 space-y-3 border-l-2 border-[var(--border)] pl-4">
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3">
                  <div>
                    <p className="font-bold text-[var(--foreground)]">{say("line_daily")}</p>
                    <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">{say("line_dailyBody")}</p>
                  </div>
                  <div className="relative flex-shrink-0">
                    <input
                      className="peer sr-only"
                      defaultChecked={organization.line_daily_summary_enabled ?? true}
                      name="line_daily_summary_enabled"
                      type="checkbox"
                      value="on"
                    />
                    <div className="h-6 w-11 rounded-full bg-[var(--border)] transition-colors peer-checked:bg-[var(--primary)]" />
                    <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                  </div>
                </label>

                {/* The summary goes out once a day at 08:00 Bangkok (vercel.json); the time is kept as is. */}
                <input name="line_daily_summary_time" type="hidden" value={organization.line_daily_summary_time ?? "08:00"} />
              </div>

              <PendingButton className="primary-action w-full sm:w-auto" pendingLabel={say("saving")} savedLabel={say("saved")} type="submit">
                {say("line_save")}
              </PendingButton>
            </form>
          )}

          {/* Test button */}
          {lineUserId && (
            <div className="mt-3 rounded-lg border border-[var(--border)] p-3">
              <p className="font-bold text-[var(--foreground)]">{say("line_test")}</p>
              <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{say("line_testBody")}</p>
              <div className="mt-3">
                <LineTestButton />
              </div>
            </div>
          )}

          {/* Message log */}
          <div className="mt-3">
            <p className="font-bold text-[var(--foreground)]">{say("line_recent")}</p>
            {typedLineMessages.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                {say("line_none")}
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--panel-secondary)] text-left text-xs font-semibold uppercase text-[var(--muted)]">
                      <th className="px-4 py-2">{say("line_colType")}</th>
                      <th className="px-4 py-2">{say("line_colStatus")}</th>
                      <th className="px-4 py-2">{say("line_colSent")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {typedLineMessages.map((msg) => (
                      <tr key={msg.id}>
                        <td className="px-4 py-2 font-medium text-[var(--foreground)]">
                          {t.has(`lt_${msg.type}` as never) ? say(`lt_${msg.type}`) : msg.type.replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-2">
                          <Badge tone={msg.status === "sent" ? "green" : msg.status === "failed" ? "red" : "neutral"}>
                            {t.has(`lm_${msg.status}` as never) ? say(`lm_${msg.status}`) : msg.status}
                          </Badge>
                          {msg.status === "failed" && msg.error && (
                            <p className="mt-0.5 text-xs text-[var(--danger)]">{msg.error.slice(0, 60)}</p>
                          )}
                        </td>
                        <td className="px-4 py-2 text-[var(--muted)]">
                          {msg.sent_at
                            ? new Date(msg.sent_at).toLocaleString(intlLocale(locale), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })
                            : new Date(msg.created_at).toLocaleString(intlLocale(locale), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })}
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
              <SectionHeader title={say("imp_title")} />
              <p className="mt-2 font-medium text-[var(--foreground-secondary)]">{say("imp_body")}</p>
            </div>
            <Link className="primary-action pressable" href="/fleet/import">
              {say("imp_btn")}
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
              <SectionHeader title={say("terms_title")} />
              <p className="mt-2 font-medium text-[var(--foreground-secondary)]">{say("terms_body")}</p>
            </div>
            <Link className="primary-action pressable" href="/settings/contracts">
              {say("terms_btn")}
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
              <SectionHeader title={say("which_title")} />
              <p className="mt-2 font-medium text-[var(--foreground-secondary)]">{say("which_body")}</p>
            </div>
            <Link className="primary-action pressable" href="/settings/notifications">
              {say("which_btn")}
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
              <SectionHeader title={say("plan_title")} />
              <p className="mt-2 font-medium text-[var(--foreground-secondary)]">{say("plan_body")}</p>
            </div>
            <Link className="primary-action pressable" href={"/settings/billing" as Route}>
              {say("plan_btn")}
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
          <SectionHeader title={say("team_title")} />
          <div className="mt-4 space-y-3">
            {(members || []).filter((member: any) => member.is_active).map((member: any) => (
              <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between" key={member.id}>
                <div>
                  <p className="font-bold text-[var(--foreground)]">{member.display_name || member.invited_email || (member.user_id === user?.id ? userEmail : say("team_user"))}</p>
                  <p className="text-sm text-[var(--muted)]">{member.invited_email || say("team_activeAccount")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{member.role === "owner" ? say("team_owner") : say("team_mate")}</Badge>
                  {waitingMembers.has(member.id) ? <Badge tone="amber">{say("team_waiting")}</Badge> : null}
                </div>
                {viewerIsOwner && member.user_id !== user?.id ? (
                  <TeamMemberActions email={member.invited_email || null} memberId={member.id} role={member.role === "owner" ? "owner" : "teammate"} waiting={waitingMembers.has(member.id)} />
                ) : null}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeader title={say("inv_title")} />
          <p className="mt-2 font-medium text-[var(--foreground-secondary)]">{say("inv_body")}</p>
          <div className="mt-3">
            <InviteForm />
          </div>
          <Link className="mt-4 inline-flex text-sm font-bold text-[var(--primary)]" href="/invite">
            {say("inv_open")}
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
                          <form action={researchVehicleCatalogSubmission} className="rounded-lg border border-[var(--info-line)] bg-[var(--info-light)] p-3">
                            <input name="submissionId" type="hidden" value={submission.id} />
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-bold text-[var(--foreground)]">AI catalog research</p>
                                <p className="text-sm text-[var(--muted)]">Searches for likely matches, misspellings, and related missing trims. Nothing is added automatically.</p>
                              </div>
                              <PendingButton className="rounded-lg bg-[var(--info)] px-4 py-2 text-sm font-bold text-white" pendingLabel="Researching..." type="submit">
                                Research with AI
                              </PendingButton>
                            </div>
                          </form>

                          {submission.research_status === "failed" ? (
                            <div className="rounded-lg border border-[var(--danger-line)] bg-[var(--danger-light)] p-3 text-sm text-[var(--danger)]">
                              <p className="font-bold">Research failed</p>
                              <p className="mt-1">
                                {submission.research_payload?.error || "Check API quota, model access, or try again."}
                              </p>
                            </div>
                          ) : null}

                          {submission.research_payload ? (
                            <div className="rounded-lg border border-[var(--info-line)] bg-white p-3">
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
                                              <a className="text-xs font-bold text-[var(--info)]" href={url} key={url} rel="noreferrer" target="_blank">
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
                                <form action={mergeVehicleCatalogResearch} className="mt-3 rounded-lg border border-[var(--success-line)] bg-[var(--success-light)] p-3">
                                  <input name="submissionId" type="hidden" value={submission.id} />
                                  <p className="text-sm font-bold text-[var(--success)]">Merge researched candidates</p>
                                  <p className="mt-1 text-sm text-[var(--muted)]">
                                    Adds the AI-researched candidates to the global catalog as verified admin-reviewed data.
                                  </p>
                                  <PendingButton className="mt-3 w-full rounded-lg bg-[var(--success)] px-3 py-2 text-sm font-bold text-white" pendingLabel="Adding..." type="submit">
                                    Add AI candidates to global catalog
                                  </PendingButton>
                                </form>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="grid gap-3 lg:grid-cols-2">
                          <form action={approveVehicleCatalogSubmission} className="rounded-lg border border-[var(--success-line)] bg-[var(--success-light)] p-3">
                            <input name="submissionId" type="hidden" value={submission.id} />
                            <label className="block">
                              <span className="text-xs font-semibold uppercase text-[var(--success)]">Approval note</span>
                              <input className={inputClass} name="curatorNotes" placeholder="Verified from manufacturer source" />
                            </label>
                            <PendingButton className="mt-3 w-full rounded-lg bg-[var(--success)] px-3 py-2 text-sm font-bold text-white" pendingLabel="Adding..." type="submit">
                              Add to global catalog
                            </PendingButton>
                          </form>
                          <form action={rejectVehicleCatalogSubmission} className="rounded-lg border border-[var(--danger-line)] bg-[var(--danger-light)] p-3">
                            <input name="submissionId" type="hidden" value={submission.id} />
                            <label className="block">
                              <span className="text-xs font-semibold uppercase text-[var(--danger)]">Rejection note</span>
                              <input className={inputClass} name="curatorNotes" placeholder="Duplicate, unclear, or incorrect" />
                            </label>
                            <PendingButton className="mt-3 w-full rounded-lg bg-[var(--danger)] px-3 py-2 text-sm font-bold text-white" pendingLabel="Rejecting..." type="submit">
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
            <form action={createVehicleMake} className="rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] p-3">
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

            <form action={createVehicleModel} className="rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] p-3">
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

            <form action={createVehicleTrim} className="rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] p-3">
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
