import { getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";
import { fileSizeLabel } from "@/lib/support-shared";
import type { SupportMessageRow } from "@/lib/support-data";

const BANGKOK = "Asia/Bangkok";

function when(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { timeZone: BANGKOK, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** The messages in one Help conversation. `side` decides which bubbles are "mine". */
export async function HelpThread({ messages, side, businessName, locale }: { messages: SupportMessageRow[]; side: "business" | "team"; businessName: string; locale: string }) {
  const t = await getTranslations("help");
  return (
    <ol className="space-y-3">
      {messages.map((message) => {
        const mine = side === "team" ? message.fromTeam : !message.fromTeam;
        const who = message.fromTeam ? t("fromTeam") : message.authorName || businessName;
        return (
          <li className={`flex ${mine ? "justify-end" : "justify-start"}`} key={message.id}>
            <div className={`max-w-[88%] rounded-2xl px-4 py-3 sm:max-w-[75%] ${mine ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)]"}`}>
              <p className={`text-[13px] font-semibold ${mine ? "text-white/80" : "text-[var(--muted)]"}`}>
                {who} · {when(message.createdAt, locale)}
              </p>
              {message.body ? <p className="mt-1 whitespace-pre-wrap break-words text-[16px] font-medium">{message.body}</p> : null}
              {message.attachments.length ? (
                <ul className="mt-2 grid gap-2">
                  {message.attachments.map((file) =>
                    file.type.startsWith("image/") && file.url ? (
                      <li key={file.path}>
                        <a href={file.url} rel="noreferrer" target="_blank">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img alt={file.name} className="max-h-56 rounded-xl object-cover" src={file.url} />
                        </a>
                      </li>
                    ) : (
                      <li key={file.path}>
                        <a
                          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[15px] font-semibold ${mine ? "bg-white/15 text-white" : "bg-[var(--panel-secondary)] text-[var(--foreground)]"}`}
                          href={file.url || undefined}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <FileText className="shrink-0" size={18} />
                          <span className="min-w-0 truncate">{file.name}</span>
                          <span className={`ml-auto shrink-0 font-medium ${mine ? "text-white/75" : "text-[var(--muted)]"}`}>{fileSizeLabel(file.size)}</span>
                        </a>
                      </li>
                    )
                  )}
                </ul>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
