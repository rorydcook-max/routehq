"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, BookOpen, Check, Copy, FileText, History, LifeBuoy, Paperclip, Plus, Send, UserRound, X } from "lucide-react";
import { confirmAssistantAction } from "@/app/actions/ask";
import { chatContext, chatHandoff, chatLoad, chatMarkProposal, chatPoll, chatSend, chatSetEmail, chatThreads, prepareChatUploads } from "@/app/actions/chat";
import { handFiles } from "@/components/chat/chat-handoff";
import { setPendingReceipt } from "@/components/receipt-handoff";
import type { ChatAttachment, ChatMessage, ChatMeta, ChatThreadInfo } from "@/lib/chat";
import { CHAT_ACCEPT, CHAT_MAX_FILES, chatSuggestions, type ChatActionChip, type ChatChip } from "@/lib/chat-suggestions";
import { uploadFormFiles } from "@/lib/direct-upload-client";
import { SUPPORT_BUCKET, fileSizeLabel } from "@/lib/support-shared";

type Say = (key: string, values?: Record<string, string | number>) => string;
type Shown = ChatMessage & { pending?: boolean };
type Earlier = Awaited<ReturnType<typeof chatThreads>>;
export type ChatRequest = { prompt?: string; action?: ChatActionChip; nonce: number };

/** The chat's thread id is kept in this browser, so the conversation is still there on the next page or visit. */
const THREAD_KEY = "rove-chat-thread";
export function storedThread() {
  try {
    return window.localStorage.getItem(THREAD_KEY) || "";
  } catch {
    return "";
  }
}
function storeThread(id: string) {
  try {
    if (id) window.localStorage.setItem(THREAD_KEY, id);
    else window.localStorage.removeItem(THREAD_KEY);
  } catch {
    // Private windows: the chat still works, it just isn't remembered.
  }
}

/** Button names come back in **bold** from the assistants; keep them bold here. */
function emphasised(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => (part.startsWith("**") && part.endsWith("**") ? <strong className="font-semibold" key={index}>{part.slice(2, -2)}</strong> : part));
}

/** A file sent earlier in the chat, fetched again from storage so it can be handed to the next screen after a reload. */
async function fileFrom(attachment: ChatAttachment): Promise<File | null> {
  if (!attachment.url) return null;
  try {
    const response = await fetch(attachment.url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new File([blob], attachment.name, { type: attachment.type || blob.type });
  } catch {
    return null;
  }
}

/**
 * The live chat panel: a 400×640 panel above the chat button on computers, a full-screen sheet on phones. It starts
 * with the assistant (records questions for owners, how-to for everyone, files sent to the right screen) and hands
 * over to the RoveHQ team on "Talk to a person". Team replies arrive by polling every 5 seconds while it's open.
 */
export function ChatPanel({
  open,
  onClose,
  site,
  pathname,
  ownerHint,
  request,
  desktopBottom
}: {
  open: boolean;
  onClose: () => void;
  site: boolean;
  pathname: string;
  /** The app shell already knows the role: starters show right away, before chatContext answers. */
  ownerHint?: boolean;
  request: ChatRequest | null;
  /** Where the panel's bottom edge sits on a computer: just above the chat button. */
  desktopBottom: number;
}) {
  const t = useTranslations("chat") as unknown as Say;
  const router = useRouter();
  const [context, setContext] = useState<{ signedIn: boolean; owner: boolean }>({ signedIn: !site, owner: Boolean(ownerHint) });
  const [threadId, setThreadId] = useState("");
  const [thread, setThread] = useState<ChatThreadInfo | null>(null);
  const [messages, setMessages] = useState<Shown[]>([]);
  const [earlier, setEarlier] = useState<Earlier>([]);
  const [showEarlier, setShowEarlier] = useState(false);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileAction, setFileAction] = useState<ChatActionChip | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState<"idle" | "saving" | "saved">("idle");
  const [proposalBusy, setProposalBusy] = useState<string | null>(null);
  const [proposalError, setProposalError] = useState<Record<string, string>>({});
  const [desktop, setDesktop] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  // The files sent from this page, by storage path: handed straight to the next screen without downloading them again.
  const localFiles = useRef(new Map<string, File>());
  const loaded = useRef(false);
  const lastRequest = useRef(0);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  /** Opens a chat (the remembered one, or one from Previous conversations). */
  const openThread = useCallback(async (id: string) => {
    if (!id) return;
    const result = await chatLoad(id).catch(() => null);
    if (!result || !result.ok) {
      // Gone, or from another business they've switched away from: start fresh.
      storeThread("");
      setThreadId("");
      setThread(null);
      setMessages([]);
      return;
    }
    storeThread(id);
    setThreadId(id);
    setThread(result.thread);
    setMessages(result.messages);
  }, []);

  // First open: who they are (for the starters), the remembered chat, and their earlier chats.
  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    void chatContext().then(setContext).catch(() => undefined);
    void openThread(storedThread());
    void chatThreads().then(setEarlier).catch(() => undefined);
  }, [open, openThread]);

  // Focus goes into the box when the panel opens.
  useEffect(() => {
    if (open) window.setTimeout(() => input.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, busy, open]);

  // New team replies while it's open: every 5 seconds, paused while the tab is in the background.
  useEffect(() => {
    if (!open || !threadId) return;
    const timer = window.setInterval(async () => {
      if (document.hidden) return;
      const since = [...messages].reverse().find((message) => !message.pending)?.createdAt || null;
      const result = await chatPoll(threadId, since).catch(() => null);
      if (!result || !result.ok) return;
      setThread(result.thread);
      if (result.messages.length) setMessages((list) => [...list.filter((message) => !result.messages.some((fresh) => fresh.id === message.id)), ...result.messages]);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [open, threadId, messages]);

  // Escape closes; Tab stays inside the panel while it's open (it's a dialog).
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="file"]), [tabindex]:not([tabindex="-1"])')).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function merge(result: { thread: ChatThreadInfo; messages: ChatMessage[] }, replaceAll = false) {
    storeThread(result.thread.id);
    setThreadId(result.thread.id);
    setThread(result.thread);
    setMessages((list) => (replaceAll ? result.messages : [...list.filter((message) => !message.pending && !result.messages.some((fresh) => fresh.id === message.id)), ...result.messages]));
  }

  async function send(options: { prompt?: string; route?: "records" | "support"; action?: ChatActionChip | null } = {}) {
    if (busy) return;
    const body = (options.prompt ?? text).trim();
    const sending = options.prompt !== undefined ? [] : files;
    if (!body && !sending.length) return;
    setBusy(true);
    setError(null);
    const action = options.action ?? (sending.length ? fileAction : null);
    // Shown at once; replaced by the saved message when the server answers.
    const temp: Shown = {
      id: `pending-${Date.now()}`,
      role: "user",
      body,
      createdAt: new Date().toISOString(),
      attachments: sending.map((file, index) => ({ path: `local-${index}`, name: file.name, size: file.size, type: file.type, url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null })),
      meta: {},
      pending: true
    };
    setMessages((list) => [...list, temp]);
    if (options.prompt === undefined) {
      setText("");
      setFiles([]);
    }
    try {
      let uploaded: Array<{ path: string; name: string; type: string; size: number }> = [];
      if (sending.length) {
        const form = new FormData();
        sending.forEach((file) => form.append("file", file));
        const ready = await uploadFormFiles(form, prepareChatUploads, (done, total) => setProgress(t("uploading", { done, total })), SUPPORT_BUCKET);
        uploaded = JSON.parse(String(ready.get("uploadedFiles") || "[]"));
        // Same order as sent: remember each original so it can be handed over without a download.
        uploaded.forEach((file, index) => sending[index] && localFiles.current.set(file.path, sending[index]));
        setProgress(null);
      }
      const result = await chatSend({ threadId: threadId || null, text: body, files: uploaded, pathname, route: options.route ?? null, action });
      if (!result.ok) throw new Error(result.error);
      merge(result);
      setFileAction(null);
    } catch (failure: any) {
      setMessages((list) => list.filter((message) => message.id !== temp.id));
      if (options.prompt === undefined) {
        setText(body);
        setFiles(sending);
      }
      setError(failure?.message || t("sendFailed"));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function talkToPerson() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await chatHandoff({ threadId: threadId || null, pathname }).catch(() => null);
    setBusy(false);
    if (!result || !result.ok) {
      setError(result && !result.ok ? result.error : t("sendFailed"));
      return;
    }
    merge(result, true);
  }

  function startNew() {
    storeThread("");
    setThreadId("");
    setThread(null);
    setMessages([]);
    setError(null);
    setShowEarlier(false);
    void chatThreads().then(setEarlier).catch(() => undefined);
    input.current?.focus();
  }

  function chooseChip(chip: ChatChip) {
    if (chip.kind === "ask") {
      void send({ prompt: t(chip.label), route: chip.route });
      return;
    }
    if (chip.action === "handoff") {
      void talkToPerson();
      return;
    }
    // A file chip: say what the files are, then pick them.
    setFileAction(chip.action);
    picker.current?.click();
  }

  // Opened by another part of the app (the Help page's "Open live chat", an empty state): do what it asked.
  useEffect(() => {
    if (!open || !request || request.nonce === lastRequest.current) return;
    lastRequest.current = request.nonce;
    if (request.action === "handoff") void talkToPerson();
    else if (request.action) setFileAction(request.action);
    else if (request.prompt) void send({ prompt: request.prompt });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list);
    setFiles((current) => [...current, ...picked].slice(0, CHAT_MAX_FILES));
    if (picker.current) picker.current.value = "";
    input.current?.focus();
  }

  /** The card under a files reply: opens the right screen and hands the file over where that screen can take it. */
  async function runAction(message: Shown) {
    const action = message.meta.action;
    if (!action) return;
    const sent = messages.flatMap((item) => item.attachments);
    const filesFor = async (paths: string[]) =>
      (
        await Promise.all(
          paths.map(async (path) => localFiles.current.get(path) || (await (async () => {
            const attachment = sent.find((item) => item.path === path);
            return attachment ? fileFrom(attachment) : null;
          })()))
        )
      ).filter(Boolean) as File[];
    if (action.handover === "receipt") {
      const [file] = await filesFor(action.paths || []);
      if (file) setPendingReceipt(file);
    } else if (action.handover === "photos") {
      handFiles("photos", await filesFor(action.paths || []));
    } else if (action.handover === "sheet") {
      handFiles("sheet", await filesFor(action.paths || []));
    }
    if (!desktop) onClose();
    router.push(action.href as Route);
  }

  async function confirmProposal(message: Shown) {
    const proposal = message.meta.proposal;
    if (!proposal || proposalBusy) return;
    setProposalBusy(message.id);
    setProposalError((current) => ({ ...current, [message.id]: "" }));
    const outcome = await confirmAssistantAction(proposal.kind, proposal.args).catch(() => ({ ok: false as const, error: t("sendFailed") }));
    setProposalBusy(null);
    if (!outcome.ok) {
      setProposalError((current) => ({ ...current, [message.id]: outcome.error }));
      return;
    }
    const result = { message: outcome.message, link: outcome.link, copy: outcome.copy };
    patchMeta(message.id, { proposalState: "done", proposalResult: result });
    void chatMarkProposal({ threadId, messageId: message.id, state: "done", result }).catch(() => undefined);
  }

  function cancelProposal(message: Shown) {
    patchMeta(message.id, { proposalState: "cancelled" });
    void chatMarkProposal({ threadId, messageId: message.id, state: "cancelled" }).catch(() => undefined);
  }

  function patchMeta(id: string, changes: Partial<ChatMeta>) {
    setMessages((list) => list.map((message) => (message.id === id ? { ...message, meta: { ...message.meta, ...changes } } : message)));
  }

  async function saveEmail() {
    if (!threadId || emailState === "saving") return;
    setEmailState("saving");
    const result = await chatSetEmail(threadId, email).catch(() => null);
    if (result?.ok) {
      setEmailState("saved");
      setThread((current) => (current ? { ...current, visitorEmail: email } : current));
    } else {
      setEmailState("idle");
      setError(result && !result.ok ? result.error : t("sendFailed"));
    }
  }

  // On the website the starters are about RoveHQ itself, signed in or not; the answers still use their normal context.
  const chips = chatSuggestions(pathname, { site, owner: context.owner });
  const human = thread?.mode === "human";
  const linkClick = () => {
    if (!desktop) onClose();
  };

  if (!open) return null;

  return (
    <div
      aria-label={t("panelLabel")}
      aria-modal="true"
      className={
        desktop
          ? "fixed z-[56] flex w-[400px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] shadow-[0_24px_60px_-20px_rgba(16,38,43,0.45)]"
          : "fixed inset-0 z-[56] flex flex-col bg-[var(--panel)] text-[var(--foreground)]"
      }
      data-chat-root=""
      ref={panel}
      role="dialog"
      style={
        desktop
          ? { right: "max(16px, env(safe-area-inset-right))", bottom: desktopBottom, height: `min(640px, calc(100dvh - ${desktopBottom + 24}px))` }
          : { paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }
      }
    >
      <header className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <p className="min-w-0 flex-1 truncate text-[17px] font-bold">{t("title")}</p>
        {messages.length ? (
          <button aria-label={t("newChat")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--foreground-secondary)] hover:bg-[var(--panel-secondary)]" onClick={startNew} title={t("newChat")} type="button">
            <Plus size={18} />
          </button>
        ) : null}
        {human ? null : (
          <button className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 text-[14px] font-semibold text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-60" disabled={busy} onClick={() => void talkToPerson()} type="button">
            <UserRound size={15} />
            {t("talkToPerson")}
          </button>
        )}
        <button aria-label={t("close")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--foreground-secondary)] hover:bg-[var(--panel-secondary)]" onClick={onClose} type="button">
          <X size={19} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <div>
            <p className="text-[18px] font-bold">{t("greeting")}</p>
            <p className="mt-1 text-[15px] text-[var(--foreground-secondary)]">{site && !context.signedIn ? t("greetingSite") : context.owner ? t("greetingOwner") : t("greetingTeammate")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button
                  className={`pressable rounded-full border px-3.5 py-2 text-left text-[14px] font-semibold ${chip.kind === "action" ? "border-[var(--primary)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--panel-secondary)] text-[var(--foreground)] hover:border-[var(--primary)]"}`}
                  disabled={busy}
                  key={`${chip.kind}-${chip.label}`}
                  onClick={() => chooseChip(chip)}
                  type="button"
                >
                  {t(chip.label)}
                </button>
              ))}
            </div>
            {earlier.length ? (
              <div className="mt-6">
                <button aria-expanded={showEarlier} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--foreground-secondary)] hover:text-[var(--primary)]" onClick={() => setShowEarlier((value) => !value)} type="button">
                  <History size={15} />
                  {t("previous")}
                </button>
                {showEarlier ? (
                  <ul className="mt-2 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
                    {earlier.map((item) => (
                      <li key={item.id}>
                        <button className="flex w-full items-center gap-2 px-3 py-2.5 text-left" onClick={() => void openThread(item.id)} type="button">
                          {item.unread ? <span aria-label={t("unread")} className="h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" /> : null}
                          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{item.subject || t("untitled")}</span>
                          {item.mode === "human" ? <span className="shrink-0 text-[12px] font-semibold text-[var(--muted)]">{t("withTeam")}</span> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <ol className="space-y-3">
            {messages.map((message) => {
              const mine = message.role === "user";
              const name = message.role === "team" ? t("team") : message.role === "assistant" ? t("assistant") : t("you");
              return (
                <li className={`flex ${mine ? "justify-end" : "justify-start"}`} key={message.id}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                      mine
                        ? "bg-[var(--primary)] text-white"
                        : message.role === "team"
                          ? "border border-[var(--primary)] bg-[var(--panel)]"
                          : message.meta.error
                            ? "bg-[var(--danger-light)] text-[var(--danger)]"
                            : "bg-[var(--panel-secondary)]"
                    } ${message.pending ? "opacity-70" : ""}`}
                  >
                    {mine ? null : <p className="text-[12px] font-semibold text-[var(--muted)]">{name}</p>}
                    {message.body ? <p className="whitespace-pre-line [overflow-wrap:anywhere] text-[15px] leading-relaxed">{emphasised(message.body)}</p> : null}
                    {message.attachments.length ? (
                      <ul className="mt-2 grid gap-1.5">
                        {message.attachments.map((file) =>
                          file.type.startsWith("image/") && file.url ? (
                            <li key={file.path}>
                              <a href={file.url} rel="noreferrer" target="_blank">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img alt={file.name} className="max-h-40 rounded-xl object-cover" src={file.url} />
                              </a>
                            </li>
                          ) : (
                            <li key={file.path}>
                              <a className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[14px] font-semibold ${mine ? "bg-white/15 text-white" : "bg-[var(--panel)]"}`} href={file.url || undefined} rel="noreferrer" target="_blank">
                                <FileText className="shrink-0" size={16} />
                                <span className="min-w-0 truncate">{file.name}</span>
                                <span className={`ml-auto shrink-0 font-medium ${mine ? "text-white/75" : "text-[var(--muted)]"}`}>{fileSizeLabel(file.size)}</span>
                              </a>
                            </li>
                          )
                        )}
                      </ul>
                    ) : null}
                    {message.meta.proposal ? <ProposalCard busy={proposalBusy === message.id} error={proposalError[message.id]} message={message} onCancel={() => cancelProposal(message)} onConfirm={() => void confirmProposal(message)} onLink={linkClick} say={t} /> : null}
                    {message.meta.links?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {message.meta.links.map((link) => (
                          <Link className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-[13px] font-semibold text-[var(--primary)]" href={link.href as Route} key={link.href} onClick={linkClick}>
                            {link.label}
                            <ArrowRight size={13} />
                          </Link>
                        ))}
                      </div>
                    ) : null}
                    {message.meta.articles?.length ? (
                      // Guides open in a new tab, so the chat and the page under it stay put.
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {message.meta.articles.map((article) => (
                          <a className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-[13px] font-semibold text-[var(--primary)]" href={article.href} key={article.slug} rel="noreferrer" target="_blank">
                            <BookOpen size={13} />
                            {article.title}
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {message.meta.action ? (
                      <button className="primary-action pressable mt-2.5 min-h-10 w-full justify-center px-4 text-[14px]" onClick={() => void runAction(message)} type="button">
                        {message.meta.action.label}
                        <ArrowRight size={15} />
                      </button>
                    ) : null}
                    {message.meta.offerHandoff && !human ? (
                      <button className="secondary-action pressable mt-2.5 min-h-9 px-3 text-[14px]" disabled={busy} onClick={() => void talkToPerson()} type="button">
                        <LifeBuoy size={15} />
                        {t("talkToPerson")}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
            {busy && !progress && !human ? <li className="animate-pulse text-[14px] text-[var(--muted)]">{t("thinking")}</li> : null}
          </ol>
        )}
        {human ? (
          <div className="mt-4 rounded-xl bg-[var(--panel-secondary)] px-3.5 py-3 text-[14px] font-medium text-[var(--foreground-secondary)]">
            <p>{t("humanNote")}</p>
            {/* Visitors can leave an email so we can tell them a reply is waiting (optional). */}
            {!context.signedIn ? (
              thread?.visitorEmail || emailState === "saved" ? (
                <p className="mt-2 flex items-center gap-1.5 font-semibold text-[var(--success)]">
                  <Check size={15} /> {t("emailSaved")}
                </p>
              ) : (
                <form
                  className="mt-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveEmail();
                  }}
                >
                  <label className="block text-[13px]" htmlFor="chat-email">
                    {t("emailPrompt")}
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input autoComplete="email" className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-[15px]" id="chat-email" inputMode="email" onChange={(event) => setEmail(event.target.value)} placeholder={t("emailPlaceholder")} type="email" value={email} />
                    <button className="secondary-action pressable min-h-10 px-3 text-[14px]" disabled={emailState === "saving" || !email.trim()} type="submit">
                      {t("emailSave")}
                    </button>
                  </div>
                </form>
              )
            ) : null}
          </div>
        ) : null}
        <div ref={end} />
      </div>

      <form
        className="border-t border-[var(--border)] px-3 pb-3 pt-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        {fileAction && fileAction !== "handoff" ? (
          <p className="mb-2 flex items-center gap-2 rounded-lg bg-[var(--primary-light)] px-3 py-1.5 text-[13px] font-semibold text-[var(--primary)]">
            <span className="min-w-0 flex-1">{t(`pickFor_${fileAction}`)}</span>
            <button aria-label={t("clearAction")} className="flex h-6 w-6 items-center justify-center rounded-full" onClick={() => setFileAction(null)} type="button">
              <X size={14} />
            </button>
          </p>
        ) : null}
        {files.length ? (
          <ul className="mb-2 flex flex-wrap gap-1.5">
            {files.map((file, index) => (
              <li className="flex max-w-full items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--panel)] py-1 pl-3 pr-1 text-[13px] font-medium" key={`${file.name}-${index}`}>
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 text-[var(--muted)]">{fileSizeLabel(file.size)}</span>
                <button aria-label={t("removeFile", { name: file.name })} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-[var(--panel-secondary)]" disabled={busy} onClick={() => setFiles((current) => current.filter((_, at) => at !== index))} type="button">
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex items-end gap-2">
          <input accept={CHAT_ACCEPT} className="hidden" multiple onChange={(event) => addFiles(event.target.files)} ref={picker} tabIndex={-1} type="file" />
          <button aria-label={t("attach")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--panel-secondary)] text-[var(--primary)] disabled:opacity-50" disabled={busy || files.length >= CHAT_MAX_FILES} onClick={() => picker.current?.click()} title={t("attach")} type="button">
            <Paperclip size={19} />
          </button>
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t("placeholder")}</span>
            <textarea
              className="block max-h-32 min-h-11 w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-3.5 py-2.5 text-[16px] leading-snug"
              disabled={busy}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends on a computer; Shift+Enter (and the phone's return key) adds a line.
                if (event.key === "Enter" && !event.shiftKey && desktop) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder={human ? t("placeholderHuman") : t("placeholder")}
              ref={input}
              rows={1}
              value={text}
            />
          </label>
          <button aria-label={t("send")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-white disabled:opacity-40" disabled={busy || (!text.trim() && !files.length)} type="submit">
            <Send size={18} />
          </button>
        </div>
        {progress ? <p className="mt-1.5 text-[13px] font-medium text-[var(--muted)]">{progress}</p> : null}
        {error ? <p className="mt-1.5 text-[13px] font-semibold text-[var(--danger)]">{error}</p> : null}
      </form>
    </div>
  );
}

/** A records change waiting for the owner's go-ahead: the same Confirm / Cancel card the old question box had. */
function ProposalCard({ message, busy, error, onConfirm, onCancel, onLink, say }: { message: Shown; busy: boolean; error?: string; onConfirm: () => void; onCancel: () => void; onLink: () => void; say: Say }) {
  const proposal = message.meta.proposal!;
  const state = message.meta.proposalState;
  const result = message.meta.proposalResult;
  return (
    <div className="mt-2.5 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)]">
      <p className="border-b border-[var(--border)] px-3 py-2 text-[13px] font-semibold">{proposal.title}</p>
      <dl className="divide-y divide-[var(--border)]">
        {proposal.rows.map((row) => (
          <div className="flex gap-3 px-3 py-2 text-[13px]" key={row.label}>
            <dt className="w-24 shrink-0 text-[var(--muted)]">{row.label}</dt>
            <dd className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-[var(--border)] bg-[var(--panel-secondary)] px-3 py-2.5">
        {state === "done" && result ? (
          <div>
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--success)]">
              <Check size={15} /> {result.message}
            </p>
            {result.copy ? (
              <button className="mt-2 flex w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-left font-mono text-[12px]" onClick={() => navigator.clipboard.writeText(result.copy || "").catch(() => undefined)} title={say("copy")} type="button">
                <span className="min-w-0 flex-1 truncate">{result.copy}</span>
                <Copy className="shrink-0 text-[var(--muted)]" size={14} />
              </button>
            ) : null}
            {result.link ? (
              <Link className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--primary)]" href={result.link.href as Route} onClick={onLink}>
                {result.link.label}
                <ArrowRight size={13} />
              </Link>
            ) : null}
          </div>
        ) : state === "cancelled" ? (
          <p className="text-[13px] text-[var(--muted)]">{say("cancelled")}</p>
        ) : (
          <div>
            {error ? <p className="mb-2 text-[13px] font-medium text-[var(--danger)]">{error}</p> : null}
            <div className="flex flex-wrap items-center gap-2">
              <button className="primary-action pressable min-h-9 px-4 text-[13px] disabled:opacity-60" disabled={busy} onClick={onConfirm} type="button">
                {busy ? say("saving") : say("confirm")}
              </button>
              <button className="secondary-action pressable min-h-9 px-3 text-[13px]" disabled={busy} onClick={onCancel} type="button">
                {say("cancel")}
              </button>
            </div>
            <p className="mt-1.5 text-[12px] text-[var(--muted)]">{say("wrongHint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
