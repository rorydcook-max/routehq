import Link from "next/link";
import type { ReactNode } from "react";
import { Smartphone, Zap } from "lucide-react";
import { alertSettings } from "@/lib/alerts";
import { isTelegramConfigured } from "@/lib/telegram";
import { CalendarFeedCard, EmailAlertsCard, IntegrationCard, TelegramCard } from "@/app/settings/integrations-panel";
import { SwitchField } from "@/components/switch-field";
import { effectiveLimits, fleetMix, fleetText, planById } from "@/lib/plans";
import { getCustomPlan } from "@/lib/custom-plan";
import { SettingsTabs } from "@/app/settings/settings-tabs";
import { isEmailConfigured } from "@/lib/email";
import type { Route } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { dateFormat } from "@/lib/i18n/dates";
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
import { InviteForm } from "@/app/invite/invite-form";
import { PaymentMethodsForm } from "@/app/settings/payment-methods-form";
import { ExtrasPanel, SeasonsPanel } from "@/app/settings/price-rules-panel";
import { extrasFrom, seasonsFrom } from "@/lib/price-rules";
import { PublicBookingPanel } from "@/app/settings/public-booking-panel";
import { UsualDepositPanel } from "@/app/settings/usual-deposit-panel";
import { PartnerNetworkPanel } from "@/app/settings/partner-network-panel";
import { DirectoryPanel } from "@/app/settings/directory-panel";
import { BookingAddressPanel } from "@/app/settings/booking-address-panel";
import { bookingAddress, canUseOwnDomain, canUseSubdomain, cleanSubdomain, rootDomain, subdomainUrl } from "@/lib/booking-address";
import { canBeListed, directorySettings } from "@/lib/directory";
import { partnerNetworkSettings } from "@/lib/partner-network";
import { FINDERS_FEE_PCT } from "@/lib/plans";
import { TeamMemberActions } from "@/app/settings/team-member-actions";
import { createSupabaseAdminClient as teamAdminClient } from "@/lib/supabase/admin";
import { BookingRulesPanel } from "@/app/settings/booking-rules-panel";
import { CustomerMessagesPanel } from "@/app/settings/customer-messages-panel";
import { customerMessagesOn, remindersOff } from "@/lib/customer-messages";
import { bookingRules } from "@/lib/booking-rules";
import { publicBookingSettings } from "@/lib/public-catalog";
import { TravelPolicyForm } from "@/app/settings/travel-policy-form";
import { AppShell } from "@/components/app-shell";
import { PageBand, bandTab } from "@/components/page-band";
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
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus-ring)]";

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
// "settingsPage". The vehicle catalogue tools at the bottom are for Lokalfleet staff only.
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
  /**
   * The one-line summary of a setting that can be switched on and off (Rory, 27 Oct): always
   * "Enabled: what that means" or "Disabled: what that means", the state word in bold
   * (green when enabled, muted grey when disabled, so what is on stands out when scanning).
   */
  const stateLine = (key: string, on: boolean, values: Record<string, string | number> = {}) =>
    (t.rich as unknown as (key: string, values: Record<string, unknown>) => ReactNode)(key, {
      ...values,
      b: (chunks: ReactNode) => <span className={on ? "font-bold text-[var(--success)]" : "font-bold text-[var(--muted)]"}>{chunks}</span>
    });
  // The small heading above each group of settings on the Rentals tab: quieter than the card titles under it.
  const groupHeading = "px-1 pt-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]";
  const { data: vehicleRates } = await ((await createSupabaseServerClient()) as any)
    .from("vehicles")
    .select("daily_rate, weekly_rate, monthly_rate, category_id")
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
  const { data: addressRow } = await supabase.from("organizations").select("booking_subdomain, custom_domain, custom_domain_status, trial_ends_at").eq("id", organization.id).maybeSingle();
  // Custom limits a Lokalfleet admin set for this business (none: the plan's own), read separately so a missing column can't break the page.
  const customPlan = await getCustomPlan(organization.id);
  const addressOrg = { ...(organization as any), ...(addressRow || {}), custom_limits: customPlan.custom_limits };

  const [
    { data: members },
    branches,
    categories,
    { data: vehicleMakes },
    { data: vehicleModels },
    { data: recentTrims },
    catalogSubmissionsResult,
    { data: lineMessages }
  ] = await Promise.all([
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
    .select("id, provider, display_name, status, last_error, webhook_key, updated_at")
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
  // A failure from before the token was last replaced no longer says anything about the account.
  for (const channel of (messagingChannels || []) as any[]) {
    const last = lastSendByChannel.get(channel.id);
    if (last?.failed && channel.updated_at && new Date(last.at).getTime() < new Date(channel.updated_at).getTime()) lastSendByChannel.delete(channel.id);
  }
  const typedVehicleMakes = (vehicleMakes || []) as VehicleMakeSetting[];
  const typedVehicleModels = (vehicleModels || []) as VehicleModelSetting[];
  const typedRecentTrims = (recentTrims || []) as VehicleTrimSetting[];
  const typedCatalogSubmissions = (catalogSubmissionsResult.data || []) as VehicleCatalogSubmissionSetting[];
  const catalogWaiting = typedCatalogSubmissions.filter((submission) => submission.status === "pending_review").length;
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
  // Plan and tools tab: the plan at a glance (the full page is Settings › Plan and subscription).
  const currentPlan = effectiveLimits({ subscription_tier: organization.subscription_tier, custom_limits: customPlan.custom_limits });
  const planStatus = String(organization.subscription_status || "trial");
  const trialEndsAt = addressOrg.trial_ends_at as string | null | undefined;
  const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))) : null;
  const fleetNow = fleetMix((vehicleRates || []) as Array<{ category_id: string | null }>, categories);
  // Friendly names for the currency and time zone line; anything else is shown as stored.
  const currencyName = organization.currency === "THB" ? say("currencyThb") : organization.currency;
  const zoneName = organization.timezone === "Asia/Bangkok" ? say("zoneBangkok") : organization.timezone.replace("_", " ");

  return (
    <AppShell
      hero={
        <PageBand title={say("title")}>
          <SettingsTabs
            label={say("title")}
            tabs={SETTINGS_TABS.map((entry) => ({
              key: entry.key,
              label: say(`tab_${entry.key}`),
              href: `/settings?tab=${entry.key}`,
              className: bandTab(tab === entry.key),
              active: tab === entry.key
            }))}
          />
        </PageBand>
      }
      userEmail={userEmail}
    >
      <OpenOnHash />

      {tab === "business" ? (
        <>
      <div>
        <ContractsBrandingSection
          aside={
            <section className="card p-4">
              <h2 className="card-title">{say("terms_title")}</h2>
              <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{say("terms_body")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link className="primary-action pressable" href="/settings/contracts">
                  {say("terms_btn")}
                </Link>
                <Link className="secondary-action pressable" href={"/settings/contracts#sample" as Route}>
                  {say("terms_sample")}
                </Link>
              </div>
            </section>
          }
          locations={
            <section className="card p-4">
              <h2 className="card-title">{say("loc_title")}</h2>
              <div className="mt-3">
                <BranchList branches={branches} organizationId={organization.id} />
              </div>
            </section>
          }
          footer={
        <p className="text-sm font-medium text-[var(--foreground-secondary)]">
          {t.rich("currencyLine", {
            currency: currencyName,
            zone: zoneName,
            link: (chunks) => (
              <Link className="tap-target font-bold text-[var(--primary)]" href="/account">
                {chunks}
              </Link>
            )
          })}
        </p>
          }
          logoDisplayUrl={logoDisplayUrl}
          organization={organization}
          signatureDisplayUrl={signatureDisplayUrl}
          whiteLabel={String(organization.subscription_status || "trial") === "trial" || planById(organization.subscription_tier).whiteLabel}
        />
      </div>
        </>
      ) : null}
      {tab === "messaging" ? (
        <Card className="scroll-mt-4 p-4">
          <div className="scroll-mt-4" id="chat-accounts" />
          <h2 className="card-title">{say("msg_title")}</h2>
          <p className="measure mb-4 mt-1 font-medium text-[var(--foreground-secondary)]">
            {t.rich("msg_body", {
              link: (chunks) => (
                <Link className="font-bold text-[var(--primary)]" href="/inbox">
                  {chunks}
                </Link>
              )
            })}
          </p>
          <MessagingPanel
            channels={((messagingChannels || []) as any[]).map((channel: any) => ({
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
          <Card className="p-4">
            <h2 className="card-title">{say("msgOut_title")}</h2>
            <div className="mt-2">
              <CustomerMessagesPanel
                enabled={customerMessagesOn(organization.settings)}
                off={remindersOff(organization.settings)}
                hasChannel={((messagingChannels || []) as any[]).some((channel) => channel.status !== "disconnected")}
                emailOn={isEmailConfigured()}
              />
            </div>
          </Card>
        </div>
      ) : null}
      {tab === "rentals" ? (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-3">
              <h2 className={groupHeading}>{say("grp_paid")}</h2>
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
            <Fold
              id="usual-deposit"
              summary={publicBookingSettings(organization.settings).deposit > 0 ? say("ud_summary", { amount: `฿${publicBookingSettings(organization.settings).deposit.toLocaleString("en-US")}` }) : say("ud_none")}
              title={say("ud_title")}
            >
              <UsualDepositPanel
                deposit={publicBookingSettings(organization.settings).deposit}
                enabled={publicBookingSettings(organization.settings).enabled}
                holdHours={bookingRules(organization.settings).holdHours}
                offer={publicBookingSettings(organization.settings).offer}
              />
            </Fold>
            <Fold id="paying-ahead" summary={organization.upfront_discount_enabled ? stateLine("st_aheadOn", true) : stateLine("st_aheadOff", false)} title={say("ahead_title")}>
              <p className="mb-3 font-medium text-[var(--foreground-secondary)]">{say("ahead_body")}</p>
              <form action={updateUpfrontDiscountSettings} className="mt-3 space-y-3">
                <SwitchField
                  defaultChecked={Boolean(organization.upfront_discount_enabled)}
                  label={say("ahead_offer")}
                  labelClassName="font-semibold text-[var(--foreground)]"
                  name="upfront_discount_enabled"
                  value="true"
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <span className="font-semibold text-[var(--foreground-secondary)]">{say("ahead_months")}</span>
                    <input
                      className={inputClass}
                      defaultValue={String(organization.upfront_discount_min_periods ?? 3)}
                      min="1"
                      name="upfront_discount_min_periods"
                      type="number"
                    />
                  </label>
                  <label className="block">
                    <span className="font-semibold text-[var(--foreground-secondary)]">{say("ahead_price")}</span>
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
                    <span className="font-semibold text-[var(--foreground-secondary)]">{say("ahead_label")}</span>
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
            </div>
              <div className="space-y-3">
              <h2 className={groupHeading}>{say("grp_prices")}</h2>
            <Fold
              id="high-season"
              summary={seasonsFrom(organization.settings).length ? stateLine("st_seasonOn", true, { count: seasonsFrom(organization.settings).length }) : stateLine("st_seasonOff", false)}
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
            <Fold id="travel" summary={travelSummary} title={say("travel_title")}>
              <p className="font-medium text-[var(--foreground-secondary)]">{say("travel_body")}</p>
              <TravelPolicyForm organizationId={organization.id} settings={travelPolicySettings} />
            </Fold>
            {/* Booking rules (holds and notice) sit with the other rules, not under "Booking online". */}
            <Fold id="holds" summary={say("hold_summary", { hours: bookingRules(organization.settings).holdHours })} title={say("hold_title")}>
              <BookingRulesPanel rules={bookingRules(organization.settings)} />
            </Fold>
            </div>
            </div>
          <div className="space-y-3">
            <h2 className={groupHeading}>{say("grp_online")}</h2>
          <Fold id="booking-page" summary={publicBookingSettings(organization.settings).enabled ? stateLine("st_bookOn", true) : stateLine("st_bookOff", false)} title={say("book_title")}>
            <PublicBookingPanel
              enabled={publicBookingSettings(organization.settings).enabled}
              deposit={publicBookingSettings(organization.settings).deposit}
                  offer={publicBookingSettings(organization.settings).offer}
              holdHours={bookingRules(organization.settings).holdHours}
              link={bookingAddress(addressOrg).url}
              pricedVehicles={publicVehicleCounts.priced}
              slug={organization.slug}
              totalVehicles={publicVehicleCounts.total}
            />
          </Fold>
          <Fold id="booking-address" summary={bookingAddress(addressOrg).url.replace(/^https?:\/\//, "")} title={say("ba_title")}>
            <BookingAddressPanel
              canDomain={canUseOwnDomain(addressOrg)}
              canSubdomain={canUseSubdomain(addressOrg)}
              domain={addressOrg.custom_domain || null}
              domainStatus={addressOrg.custom_domain_status || null}
              pathUrl={`${String(process.env.NEXT_PUBLIC_APP_URL || `https://${rootDomain()}`).replace(/\/$/, "")}/rent/${organization.slug}`}
              rootDomain={rootDomain()}
              subdomain={addressOrg.booking_subdomain || null}
              subdomainUrl={addressOrg.booking_subdomain ? subdomainUrl(addressOrg.booking_subdomain) : null}
              suggestion={cleanSubdomain(String(organization.name || organization.slug).replace(/\b(car|cars|rent|rental|rentals|test\d*)\b/gi, "")) || cleanSubdomain(organization.slug).slice(0, 20)}
            />
          </Fold>
          <Fold id="directory" summary={directorySettings(organization.settings).enabled && canBeListed(organization as any) && publicBookingSettings(organization.settings).enabled ? stateLine("st_dirOn", true) : stateLine("st_dirOff", false)} title={say("dir_title")}>
            <DirectoryPanel
              allowed={canBeListed(organization as any)}
              bookingPageOn={publicBookingSettings(organization.settings).enabled}
              enabled={directorySettings(organization.settings).enabled}
            />
          </Fold>
          <Fold id="partner-network" summary={partnerNetworkSettings(organization.settings).enabled ? stateLine("st_pnOn", true) : stateLine("st_pnOff", false)} title={say("pn_title")}>
            <PartnerNetworkPanel initial={partnerNetworkSettings(organization.settings)} pct={FINDERS_FEE_PCT} />
          </Fold>
          </div>
        </div>
      ) : null}
      {tab === "notifications" ? (
        <div className="space-y-4">
        {/* What you hear about and where: one grid on its own page. Then each connection as a card. */}
        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <h2 className="card-title">{say("ig_notifTitle")}</h2>
            <p className="measure mt-1 font-medium text-[var(--foreground-secondary)]">{say("ig_notifBody")}</p>
          </div>
          <Link className="primary-action pressable" href={"/settings/notifications" as Route}>
            {say("ig_notifBtn")}
          </Link>
        </Card>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <IntegrationCard icon={<Smartphone size={20} />} title={say("push_title")}>
            <PushToggle />
          </IntegrationCard>
          <EmailAlertsCard configured={isEmailConfigured()} emailTo={alertSettings(organizationSettings).email_to || null} ownerEmail={userEmail || null} />
          <TelegramCard configured={isTelegramConfigured()} connected={Boolean(organizationSettings.telegram_chat_id)} />
          <CalendarFeedCard
            feedUrl={
              organizationSettings.calendar_feed_token
                ? `${String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")}/api/calendar/${String(organizationSettings.calendar_feed_token)}.ics`
                : null
            }
          />
        </div>
        <Card className="p-4" >
          <div id="line" className="scroll-mt-4" />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="card-title">{say("line_title")}</h2>
              <p className="measure mt-1 font-medium text-[var(--foreground-secondary)]">{say("line_body")}</p>
            </div>
            <Badge tone={lineUserId ? "green" : "amber"}>{lineUserId ? say("line_connected") : say("line_notConnected")}</Badge>
          </div>

          {/* Connected: which LINE account, and a way to disconnect it. */}
          {lineUserId ? (
            <div className="mt-3 flex flex-col gap-3 rounded-2xl bg-[var(--panel-secondary)] p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-medium text-[var(--foreground-secondary)]">{say("line_account", { id: String(lineUserId).slice(-4) })}</p>
              <form action={disconnectLine}>
                <input name="organizationId" type="hidden" value={organization.id} />
                <PendingButton className="secondary-action" pendingLabel={say("line_disconnecting")} type="submit">
                  {say("line_disconnect")}
                </PendingButton>
              </form>
            </div>
          ) : (
            <p className="mt-3 font-medium text-[var(--foreground-secondary)]">{say("line_follow")}</p>
          )}

          {/* Not connected: add the Lokalfleet LINE account, then send a one-time code. */}
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

          {/* Notification settings, shown when connected. */}
          {lineUserId && (
            <form action={updateLineSettings} className="mt-4 space-y-3">
              <input name="organizationId" type="hidden" value={organization.id} />
              <input name="line_user_id" type="hidden" value={lineUserId} />
              <div className="divide-y divide-[var(--border)]">
                <SwitchField
                  className="pb-3"
                  defaultChecked={organization.line_notifications_enabled ?? false}
                  description={say("line_enableBody")}
                  label={say("line_enable")}
                  name="line_notifications_enabled"
                  value="on"
                />
                <SwitchField
                  className="pt-3"
                  defaultChecked={organization.line_daily_summary_enabled ?? true}
                  description={say("line_dailyBody")}
                  label={say("line_daily")}
                  name="line_daily_summary_enabled"
                  value="on"
                />
              </div>
              {/* The summary goes out once a day at 08:00 Bangkok (vercel.json); the time is kept as is. */}
              <input name="line_daily_summary_time" type="hidden" value={organization.line_daily_summary_time ?? "08:00"} />
              <PendingButton className="primary-action w-full sm:w-auto" pendingLabel={say("saving")} savedLabel={say("saved")} type="submit">
                {say("line_save")}
              </PendingButton>
            </form>
          )}

          {/* Test button */}
          {lineUserId && (
            <div className="mt-4 rounded-2xl bg-[var(--panel-secondary)] p-3.5">
              <p className="card-subtitle">{say("line_test")}</p>
              <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{say("line_testBody")}</p>
              <div className="mt-3">
                <LineTestButton />
              </div>
            </div>
          )}

          {/* Message log: only once LINE is connected; before that it is just noise. */}
          {lineUserId ? (
          <div className="mt-4">
            <p className="card-subtitle">{say("line_recent")}</p>
            {typedLineMessages.length === 0 ? (
              <p className="mt-2 font-medium text-[var(--muted)]">{say("line_none")}</p>
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
                            ? dateFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(msg.sent_at))
                            : dateFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(msg.created_at))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          ) : null}
        </Card>
      
        {/* What's coming, so operators know it's on the way rather than missing. */}
        <Card className="p-5">
          <h2 className="card-title">{say("ig_soonTitle")}</h2>
          <p className="measure mt-1 font-medium text-[var(--foreground-secondary)]">{say("ig_soonBody")}</p>
          <ul className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-3">
            {(["whatsapp", "messenger", "zapier", "make", "mailchimp", "klaviyo"] as const).map((key) => (
              <li className="flex items-start gap-3 rounded-2xl bg-[var(--panel-secondary)] p-3.5" key={key}>
                <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--muted)] sm:flex">
                  <Zap size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold text-[var(--foreground)]">{say(`ig_soon_${key}`)}</span>
                  <span className="hidden text-[14px] font-medium text-[var(--muted)] sm:block">{say(`ig_soon_${key}Body`)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
        </div>
      ) : null}
      {tab === "more" ? (
        <div className="page-form">
          {/* Your plan and how much of it you use, at a glance (importing lives on Fleet, the vehicle catalogue in the admin console). */}
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="card-title">{say("plan_title")}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-[26px] font-semibold leading-tight text-[var(--foreground)]">{say(`bl_${currentPlan.id}`)}</p>
                  <Badge tone={planStatus === "active" ? "green" : planStatus === "trial" ? "blue" : "red"}>
                    {t.has(`bl_st_${planStatus}` as never) ? say(`bl_st_${planStatus}`) : planStatus.replace(/_/g, " ")}
                  </Badge>
                </div>
                {planStatus === "trial" && trialDaysLeft !== null ? <p className="mt-1 font-semibold text-[var(--foreground-secondary)]">{say("bl_trialLeft", { days: trialDaysLeft })}</p> : null}
              </div>
              <Link className="primary-action pressable" href={"/settings/billing" as Route}>
                {say("plan_btn")}
              </Link>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { label: say("use_cars"), used: fleetNow.cars, limit: currentPlan.cars },
                { label: say("use_motorbikes"), used: fleetNow.motorbikes, limit: currentPlan.motorbikes },
                // Lokalfleet support's temporary access (admin "view as") is not one of their seats.
                { label: say("use_team"), used: (members || []).filter((member: any) => member.is_active && member.display_name !== "Lokalfleet support").length, limit: currentPlan.team }
              ].map((meter) => {
                const pct = meter.limit ? Math.min(100, Math.round((meter.used / meter.limit) * 100)) : 0;
                const over = meter.limit !== null && meter.used > meter.limit;
                return (
                  <div className="rounded-2xl bg-[var(--panel-secondary)] p-3.5" key={meter.label}>
                    <p className="text-[14px] font-semibold text-[var(--muted)]">{meter.label}</p>
                    <p className={`num mt-0.5 text-[22px] ${over ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>
                      {meter.used}
                      <span className="text-[15px] font-semibold text-[var(--muted)]"> / {meter.limit === null ? say("use_noLimit") : meter.limit}</span>
                    </p>
                    {meter.limit !== null ? (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--panel-tertiary)]">
                        <div className={`h-full rounded-full ${over ? "bg-[var(--danger)]" : "bg-[var(--primary)]"}`} style={{ width: `${Math.max(pct, meter.used > 0 ? 4 : 0)}%` }} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>
          {/* Every record in one file, any time (the FAQ promises it). Owner only: it holds every customer's details. */}
          {viewerIsOwner ? (
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="card-title">{say("export_title")}</h2>
                  <p className="mt-1 text-[15px] text-[var(--muted)]">{say("export_body")}</p>
                </div>
                <a className="secondary-action pressable" download href="/api/export/account">
                  {say("export_btn")}
                </a>
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}
      {tab === "team" ? (
        <div className="page-form space-y-4">
        {/* One column: the people, then the invite form, both the same width so the page reads as one piece. */}
        <Card className="p-5">
          <h2 className="card-title">{say("team_title")}</h2>
          <div className="mt-2 divide-y divide-[var(--border)]">
            {(members || []).filter((member: any) => member.is_active).map((member: any) => (
              <div className="flex flex-col gap-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between" key={member.id}>
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-[14px] font-bold uppercase text-[var(--primary)]">
                    {String(member.display_name || member.invited_email || (member.user_id === user?.id ? userEmail : "") || "?")
                      .split(/[\s@.]+/)
                      .filter(Boolean)
                      .slice(0, member.display_name ? 2 : 1)
                      .map((part: string) => part[0])
                      .join("")}
                  </span>
                <div className="min-w-0">
                  <p className="font-bold text-[var(--foreground)] [overflow-wrap:anywhere]">{member.display_name || member.invited_email || (member.user_id === user?.id ? userEmail : say("team_user"))}</p>
                  {/* Second line only when it adds something: the email under a name, or that they've joined. */}
                  {member.display_name && member.invited_email ? (
                    <p className="text-sm text-[var(--muted)]">{member.invited_email}</p>
                  ) : member.user_id && !waitingMembers.has(member.id) ? (
                    <p className="text-sm text-[var(--muted)]">{say("team_activeAccount")}</p>
                  ) : null}
                </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{member.role === "owner" ? say("team_owner") : member.role === "manager" ? say("team_manager") : say("team_mate")}</Badge>
                  {waitingMembers.has(member.id) ? <Badge tone="amber">{say("team_waiting")}</Badge> : null}
                </div>
                {viewerIsOwner && member.user_id !== user?.id ? (
                  <div className="w-full ps-[52px]">
                    <TeamMemberActions email={member.invited_email || null} memberId={member.id} role={member.role === "owner" ? "owner" : member.role === "manager" ? "manager" : "teammate"} waiting={waitingMembers.has(member.id)} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="card-title">{say("inv_title")}</h2>
          <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{say("inv_body")}</p>
          <div className="mt-3">
            <InviteForm />
          </div>
        </Card>
        </div>
      ) : null}
    </AppShell>
  );
}
