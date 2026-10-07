"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, ChevronDown, Copy } from "lucide-react";
import { connectChannel, disconnectChannel } from "@/app/actions/inbox";
import { shortDate } from "@/lib/i18n/dates";

type Say = (key: string, values?: Record<string, string | number>) => string;
type Channel = { id: string; provider: string; display_name: string | null; status: string; last_error: string | null; webhook: string; send_error?: string | null; send_failed_at?: string | null };

// Wording keys per provider (settingsPage mp_*). The names of buttons inside
// LINE's and Telegram's own screens stay in English because that is what the
// operator will see there.
const GUIDES = {
  line: { name: "mp_line", blurb: "mp_lineBlurb", steps: ["mp_line1", "mp_line2", "mp_line3", "mp_line4", "mp_line5", "mp_line6"], tokenLabel: "mp_lineToken", secretLabel: "mp_lineSecret" },
  telegram: { name: "mp_telegram", blurb: "mp_telegramBlurb", steps: ["mp_tg1", "mp_tg2", "mp_tg3", "mp_tg4"], tokenLabel: "mp_tgToken", secretLabel: null }
} as const;

type ProviderKey = keyof typeof GUIDES;
const labelClass = "font-semibold text-[var(--foreground-secondary)]";

function ConnectForm({ provider, publicUrl }: { provider: ProviderKey; publicUrl: boolean }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const guide = GUIDES[provider];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState("");
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setFailed(false);
    startTransition(async () => {
      const result = await connectChannel({ provider, accessToken: token, channelSecret: secret }).catch(() => ({ ok: false as const }));
      if (!result.ok) {
        setFailed(true);
        return;
      }
      setToken("");
      setSecret("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl bg-[var(--panel-secondary)]">
      <button aria-expanded={open} className="flex w-full items-center justify-between gap-3 p-3.5 text-left" onClick={() => setOpen((value) => !value)} type="button">
        <span>
          <span className="block text-[16px] font-bold text-[var(--foreground)]">{say("mp_connect", { name: say(guide.name) })}</span>
          <span className="mt-0.5 block font-medium text-[var(--foreground-secondary)]">{say(guide.blurb)}</span>
        </span>
        <ChevronDown className={`flex-shrink-0 text-[var(--muted)] transition ${open ? "rotate-180" : ""}`} size={20} />
      </button>
      {open ? (
        <div className="px-3.5 pb-3.5">
          <ol className="list-decimal space-y-1.5 pl-5 font-medium text-[var(--foreground)]">
            {guide.steps.map((step) => (
              <li key={step}>{say(step)}</li>
            ))}
          </ol>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>{say(guide.tokenLabel)}</span>
              <input autoComplete="off" className="mt-1 w-full" onChange={(event) => setToken(event.target.value)} spellCheck={false} type="password" value={token} />
            </label>
            {guide.secretLabel ? (
              <label className="block">
                <span className={labelClass}>{say(guide.secretLabel)}</span>
                <input autoComplete="off" className="mt-1 w-full" onChange={(event) => setSecret(event.target.value)} spellCheck={false} type="password" value={secret} />
              </label>
            ) : null}
          </div>
          {!publicUrl ? <p className="mt-3 rounded-xl bg-[var(--warning-light)] px-4 py-3 font-medium text-[var(--foreground)]">{say("mp_private")}</p> : null}
          {failed ? (
            <p className="mt-3 rounded-xl bg-[var(--danger-light)] px-4 py-3 font-bold text-[var(--danger)]" role="alert">
              {say("mp_connectFailed")}
            </p>
          ) : null}
          <button className="primary-action pressable mt-4" disabled={isPending || !token.trim()} onClick={submit} type="button">
            {isPending ? say("mp_checking") : say("mp_connectBtn")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ConnectedChannel({ channel }: { channel: Channel }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const locale = useLocale();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const guide = GUIDES[channel.provider as ProviderKey];
  const providerName = guide ? say(guide.name) : channel.provider;
  const tokenRejected = /auth|token|unauthor|401|403|credential/i.test(channel.send_error || "");

  return (
    <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {channel.send_error ? <AlertTriangle className="flex-shrink-0 text-[var(--danger)]" size={22} /> : <CheckCircle2 className="flex-shrink-0 text-[var(--success)]" size={22} />}
          <div>
            <p className="text-[16px] font-bold leading-tight text-[var(--foreground)]">{channel.display_name || providerName}</p>
            <p className={`mt-0.5 ${channel.send_error ? "font-bold text-[var(--danger)]" : "font-medium text-[var(--foreground-secondary)]"}`}>
              {providerName} · {channel.send_error ? say("mp_connectedBad") : say("mp_connected")}
            </p>
          </div>
        </div>
        {confirming ? (
          <div className="flex items-center gap-2">
            <button className="secondary-action pressable" onClick={() => setConfirming(false)} type="button">
              {say("mp_keep")}
            </button>
            <button
              className="pressable min-h-[44px] rounded-full bg-[var(--danger)] px-4 font-bold text-white disabled:opacity-60"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await disconnectChannel(channel.id);
                  router.refresh();
                })
              }
              type="button"
            >
              {isPending ? say("mp_disconnecting") : say("mp_yesDisconnect")}
            </button>
          </div>
        ) : (
          <button className="secondary-action pressable" onClick={() => setConfirming(true)} type="button">
            {say("mp_disconnect")}
          </button>
        )}
      </div>
      {confirming ? <p className="mt-2 font-medium text-[var(--foreground-secondary)]">{say("mp_disconnectNote")}</p> : null}
      {channel.send_error ? (
        <div className="mt-3 rounded-xl bg-[var(--danger-light)] px-4 py-3 font-medium text-[var(--foreground)]">
          <p>
            {channel.send_failed_at ? say("mp_lastFailedOn", { date: shortDate(String(channel.send_failed_at).slice(0, 10), locale) }) : say("mp_lastFailed")} {tokenRejected ? say("mp_tokenRejected") : ""}
          </p>
          <p className="mt-1">{say("mp_fix")}</p>
        </div>
      ) : null}
      {channel.last_error ? (
        <div className="mt-3 rounded-xl bg-[var(--warning-light)] px-4 py-3 font-medium text-[var(--foreground)]">
          <p>
            {say("mp_webhookFailed")} {channel.provider === "line" ? say("mp_webhookLine") : ""}
          </p>
          {channel.provider === "line" ? (
            <button
              className="mt-2 inline-flex min-h-[44px] max-w-full items-center gap-2 rounded-xl bg-white px-3 font-mono"
              onClick={async () => {
                await navigator.clipboard.writeText(channel.webhook).catch(() => undefined);
                setCopied(true);
              }}
              type="button"
            >
              <span className="truncate">{channel.webhook}</span>
              <Copy className="flex-shrink-0" size={16} />
              {copied ? say("copied") : ""}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Settings, Messaging: connect the business's own chat accounts to the shared inbox. */
export function MessagingPanel({ channels, publicUrl }: { channels: Channel[]; publicUrl: boolean }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const connected = new Set(channels.map((channel) => channel.provider));
  return (
    <div className="space-y-2.5">
      {channels.map((channel) => (
        <ConnectedChannel channel={channel} key={channel.id} />
      ))}
      {(Object.keys(GUIDES) as ProviderKey[])
        .filter((provider) => !connected.has(provider))
        .map((provider) => (
          <ConnectForm key={provider} provider={provider} publicUrl={publicUrl} />
        ))}
      <p className="px-1 font-medium text-[var(--foreground-secondary)]">{say("mp_soon")}</p>
    </div>
  );
}
