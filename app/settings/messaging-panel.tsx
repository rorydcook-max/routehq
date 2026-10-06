"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronDown, Copy } from "lucide-react";
import { connectChannel, disconnectChannel } from "@/app/actions/inbox";

type Channel = { id: string; provider: string; display_name: string | null; status: string; last_error: string | null; webhook: string; send_error?: string | null; send_failed_at?: string | null };

const GUIDES = {
  line: {
    name: "LINE Official Account",
    blurb: "Customers who message your LINE Official Account appear in your inbox.",
    steps: [
      "Open developers.line.biz and sign in with the LINE account that manages your Official Account.",
      "Choose your provider, then the Messaging API channel for your Official Account (create one if there isn't one yet).",
      "On the Basic settings tab, copy the Channel secret.",
      "On the Messaging API tab, press Issue under Channel access token (long-lived) and copy it.",
      "Paste both below. We'll point LINE at RouteHQ for you.",
      "Back on the Messaging API tab, switch on “Use webhook”, and turn off LINE's auto-reply messages so customers only hear from you."
    ],
    tokenLabel: "Channel access token",
    secretLabel: "Channel secret"
  },
  telegram: {
    name: "Telegram bot",
    blurb: "Customers who message your Telegram bot appear in your inbox.",
    steps: [
      "In Telegram, open a chat with @BotFather.",
      "Send /newbot and follow the two questions (a name, then a username ending in “bot”).",
      "BotFather replies with a token that looks like 123456:ABC-DEF… Copy it.",
      "Paste it below. Share your bot's link (t.me/yourbot) with customers."
    ],
    tokenLabel: "Bot token",
    secretLabel: null
  }
} as const;

type ProviderKey = keyof typeof GUIDES;

function ConnectForm({ provider, publicUrl }: { provider: ProviderKey; publicUrl: boolean }) {
  const guide = GUIDES[provider];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await connectChannel({ provider, accessToken: token, channelSecret: secret });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setToken("");
      setSecret("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white">
      <button aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => setOpen((value) => !value)} type="button">
        <span>
          <span className="block text-[15px] font-semibold text-[var(--foreground)]">Connect {guide.name}</span>
          <span className="block text-[13px] text-[var(--muted)]">{guide.blurb}</span>
        </span>
        <ChevronDown className={`flex-shrink-0 text-[var(--muted)] transition ${open ? "rotate-180" : ""}`} size={18} />
      </button>
      {open ? (
        <div className="border-t border-[var(--border)] px-4 py-4">
          <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-[var(--foreground-secondary)]">
            {guide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              {guide.tokenLabel}
              <input autoComplete="off" className="mt-1 w-full" onChange={(event) => setToken(event.target.value)} spellCheck={false} type="password" value={token} />
            </label>
            {guide.secretLabel ? (
              <label className="block">
                {guide.secretLabel}
                <input autoComplete="off" className="mt-1 w-full" onChange={(event) => setSecret(event.target.value)} spellCheck={false} type="password" value={secret} />
              </label>
            ) : null}
          </div>
          {!publicUrl ? (
            <p className="mt-3 rounded-lg bg-[var(--warning-light)] px-3 py-2 text-[13px] text-[var(--foreground-secondary)]">
              This copy of RouteHQ is running on a private address, so messages can&apos;t reach it yet. You can still connect; messages will arrive once RouteHQ is on its public address.
            </p>
          ) : null}
          {error ? (
            <p className="mt-3 rounded-lg bg-[var(--danger-light)] px-3 py-2 text-[13px] font-medium text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}
          <button className="primary-action pressable mt-4 disabled:opacity-60" disabled={isPending || !token.trim()} onClick={submit} type="button">
            {isPending ? "Checking…" : "Connect"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ConnectedChannel({ channel }: { channel: Channel }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const guide = GUIDES[channel.provider as ProviderKey];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {channel.send_error ? <AlertTriangle className="flex-shrink-0 text-[var(--danger)]" size={20} /> : <CheckCircle2 className="flex-shrink-0 text-[var(--success)]" size={20} />}
          <div>
            <p className="text-[15px] font-semibold text-[var(--foreground)]">{channel.display_name || guide?.name || channel.provider}</p>
            <p className={`text-[13px] ${channel.send_error ? "font-semibold text-[var(--danger)]" : "text-[var(--muted)]"}`}>
              {guide?.name || channel.provider} · {channel.send_error ? "connected, but messages are not going out" : "connected"}
            </p>
          </div>
        </div>
        {confirming ? (
          <div className="flex items-center gap-2">
            <button className="secondary-action pressable min-h-9 px-3 text-[13px]" onClick={() => setConfirming(false)} type="button">
              Keep it
            </button>
            <button
              className="pressable min-h-9 rounded-[9px] bg-[var(--danger)] px-3 text-[13px] font-semibold text-white disabled:opacity-60"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await disconnectChannel(channel.id);
                  router.refresh();
                })
              }
              type="button"
            >
              {isPending ? "Disconnecting…" : "Yes, disconnect"}
            </button>
          </div>
        ) : (
          <button className="secondary-action pressable min-h-9 px-3 text-[13px]" onClick={() => setConfirming(true)} type="button">
            Disconnect
          </button>
        )}
      </div>
      {confirming ? <p className="mt-2 text-[13px] text-[var(--muted)]">New messages will stop arriving. Your past chats stay in the inbox.</p> : null}
      {channel.send_error ? (
        <div className="mt-3 rounded-lg bg-[var(--danger-light)] px-3 py-2 text-[13px] text-[var(--foreground-secondary)]">
          <p>
            The last message sent from here{channel.send_failed_at ? ` (${new Date(channel.send_failed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" })})` : ""} was not delivered. {/auth|token|unauthor|401|403|credential/i.test(channel.send_error) ? "The access token is no longer accepted." : channel.send_error}
          </p>
          <p className="mt-1">To fix it, disconnect this account and connect it again with a new access token. Your past chats stay in the inbox.</p>
        </div>
      ) : null}
      {channel.last_error ? (
        <div className="mt-3 rounded-lg bg-[var(--warning-light)] px-3 py-2 text-[13px] text-[var(--foreground-secondary)]">
          <p>
            We couldn&apos;t set the delivery address automatically ({channel.last_error}).
            {channel.provider === "line" ? " In LINE Developers, open the Messaging API tab, paste this as the Webhook URL and switch on “Use webhook”:" : ""}
          </p>
          {channel.provider === "line" ? (
            <button
              className="mt-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 font-mono text-[12px]"
              onClick={async () => {
                await navigator.clipboard.writeText(channel.webhook).catch(() => undefined);
                setCopied(true);
              }}
              type="button"
            >
              <span className="truncate">{channel.webhook}</span>
              <Copy className="flex-shrink-0" size={13} />
              {copied ? "Copied" : ""}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Settings → Messaging: connect the business's own chat accounts to the shared inbox. */
export function MessagingPanel({ channels, publicUrl }: { channels: Channel[]; publicUrl: boolean }) {
  const connected = new Set(channels.map((channel) => channel.provider));
  return (
    <div className="space-y-3">
      {channels.map((channel) => (
        <ConnectedChannel channel={channel} key={channel.id} />
      ))}
      {(Object.keys(GUIDES) as ProviderKey[])
        .filter((provider) => !connected.has(provider))
        .map((provider) => (
          <ConnectForm key={provider} provider={provider} publicUrl={publicUrl} />
        ))}
      <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-3 text-[13px] text-[var(--muted)]">
        <span className="font-semibold text-[var(--foreground-secondary)]">WhatsApp, Messenger and Instagram</span> are coming next. They need approval from Meta before any business can connect them.
      </div>
    </div>
  );
}
