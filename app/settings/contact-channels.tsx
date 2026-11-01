"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";

/**
 * How customers reach the business (Rory, 1 Nov 2026): tap the apps you use and add your name or number on each.
 * Only the ones switched on are saved; WhatsApp and LINE go where agreements print them, the rest are kept with the
 * business's settings for booking links and messages. Renters from different countries use different apps, so the
 * list covers the main ones by country.
 */
const CHANNELS = [
  { key: "whatsapp", label: "WhatsApp", field: "whatsapp", placeholder: "+66 81 234 5678" },
  { key: "line", label: "LINE", field: "line_id", placeholder: "@yourbusiness" },
  { key: "messenger", label: "Messenger", field: "contact_messenger", placeholder: "facebook.com/yourpage" },
  { key: "instagram", label: "Instagram", field: "contact_instagram", placeholder: "@yourbusiness" },
  { key: "telegram", label: "Telegram", field: "contact_telegram", placeholder: "@yourbusiness" },
  { key: "wechat", label: "WeChat", field: "contact_wechat", placeholder: "WeChat ID" },
  { key: "kakaotalk", label: "KakaoTalk", field: "contact_kakaotalk", placeholder: "KakaoTalk ID" },
  { key: "zalo", label: "Zalo", field: "contact_zalo", placeholder: "+84 …" },
  { key: "viber", label: "Viber", field: "contact_viber", placeholder: "+66 …" }
] as const;

export function ContactChannels({ values, inputClass, form }: { values: Record<string, string>; inputClass: string; form?: string }) {
  const say = useTranslations("settingsPage") as unknown as (key: string, vars?: Record<string, string>) => string;
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(CHANNELS.map((channel) => [channel.key, Boolean(values[channel.field])])));
  const [text, setText] = useState<Record<string, string>>(() => Object.fromEntries(CHANNELS.map((channel) => [channel.key, values[channel.field] || ""])));

  return (
    <div className="sm:col-span-2">
      <p className="font-semibold text-[var(--foreground-secondary)]">{say("cc_title")}</p>
      <p className="text-sm text-[var(--muted)]">{say("cc_hint")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {CHANNELS.map((channel) => (
          <button
            aria-pressed={on[channel.key]}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${
              on[channel.key] ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--primary)]/35 bg-white text-[var(--primary)]"
            }`}
            key={channel.key}
            onClick={() => setOn((current) => ({ ...current, [channel.key]: !current[channel.key] }))}
            type="button"
          >
            {on[channel.key] ? <Check size={14} /> : null}
            {channel.label}
          </button>
        ))}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {CHANNELS.map((channel) =>
          on[channel.key] ? (
            <label className="block" key={channel.key}>
              <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{channel.label}</span>
              <input
                className={inputClass}
                form={form}
                name={channel.field}
                onChange={(event) => setText((current) => ({ ...current, [channel.key]: event.target.value }))}
                placeholder={channel.placeholder}
                value={text[channel.key]}
              />
            </label>
          ) : (
            // Switched off: sent empty, so saving clears it.
            <input form={form} key={channel.key} name={channel.field} type="hidden" value="" />
          )
        )}
      </div>
    </div>
  );
}
