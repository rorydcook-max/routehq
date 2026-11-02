import { businessToday } from "@/lib/business-time";
import { getOnboardingStatus } from "@/lib/onboarding";
import { notifyOperator } from "@/lib/notify-operator";

/**
 * Nudges in the free trial (Rory, 2 Nov 2026): on day 1, 3 and 7 after signing up, a business that hasn't finished
 * getting going gets one short alert (phone, LINE, Telegram, whichever they use) pointing at its next step.
 * Each is sent once; a business that has taken a booking or rental is left alone.
 */
const NUDGE_DAYS = [1, 3, 7];

const WORDS: Record<string, { en: string; th: string; url: string }> = {
  first_vehicle: {
    en: "🚗 Add your vehicles to RoveHQ: tell the assistant, send a photo, or bring in a list. It takes a minute.",
    th: "🚗 เพิ่มรถของคุณใน RoveHQ: บอกผู้ช่วย ส่งรูป หรือนำเข้ารายการ ใช้เวลาไม่ถึงนาที",
    url: "/onboarding?step=2"
  },
  current_rentals: {
    en: "📋 Who's renting your vehicles now? Add them and RoveHQ shows what's due and reminds them before rent is due.",
    th: "📋 ตอนนี้ใครเช่ารถของคุณอยู่บ้าง? เพิ่มไว้ แล้ว RoveHQ จะแสดงยอดที่ต้องเก็บและเตือนลูกค้าก่อนถึงกำหนด",
    url: "/onboarding?step=2&rentals=1"
  },
  reminders: {
    en: "💬 Connect LINE or Telegram so payment reminders go to your customers by themselves.",
    th: "💬 เชื่อมต่อ LINE หรือ Telegram เพื่อให้การเตือนชำระเงินส่งถึงลูกค้าโดยอัตโนมัติ",
    url: "/settings?tab=messaging"
  },
  booking_page: {
    en: "🔗 Put your booking page on your Facebook page, Google Maps and LINE profile so customers can book any time.",
    th: "🔗 ใส่ลิงก์หน้าจองของคุณใน Facebook, Google Maps และโปรไฟล์ LINE ให้ลูกค้าจองได้ตลอดเวลา",
    url: "/"
  },
  signature: {
    en: "✍️ Add your signature once, and customers can sign the rental agreement on their phone.",
    th: "✍️ เพิ่มลายเซ็นของคุณครั้งเดียว แล้วลูกค้าเซ็นสัญญาเช่าบนมือถือได้เลย",
    url: "/settings/signature"
  },
  payment_methods: {
    en: "💳 Add your PromptPay or bank details so customers can pay straight from their booking page.",
    th: "💳 เพิ่ม PromptPay หรือบัญชีธนาคาร ให้ลูกค้าชำระเงินจากหน้าจองได้ทันที",
    url: "/settings?tab=rentals#payment-methods"
  }
};

function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10)) - Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10))) / 86_400_000);
}

export async function sendTrialNudges(admin: any): Promise<number> {
  const today = businessToday();
  const since = new Date(Date.now() - 9 * 86_400_000).toISOString();
  const { data: orgs } = await admin
    .from("organizations")
    .select("id, created_at, default_locale, settings, subscription_status")
    .gte("created_at", since)
    .is("deleted_at", null);
  let sent = 0;
  for (const org of (orgs || []) as any[]) {
    if (org.subscription_status && org.subscription_status !== "trial") continue;
    const signedUp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(org.created_at));
    const day = daysBetween(signedUp, today);
    if (!NUDGE_DAYS.includes(day)) continue;
    const settings = org.settings || {};
    const done: number[] = Array.isArray(settings.trial_nudges) ? settings.trial_nudges : [];
    if (done.includes(day)) continue;
    const status = await getOnboardingStatus(admin, org.id).catch(() => null);
    if (!status || status.counts.rentals > 0) continue;
    const next = status.items.find((item) => !item.completed && WORDS[item.step]);
    if (!next) continue;
    const words = WORDS[next.step];
    // Marked first, so a second run the same day can't send it twice.
    await admin.from("organizations").update({ settings: { ...settings, trial_nudges: [...done, day] } }).eq("id", org.id);
    await notifyOperator(org.id, String(org.default_locale || "").startsWith("th") ? words.th : words.en, "trial_nudge", words.url).catch(() => null);
    sent += 1;
  }
  return sent;
}
