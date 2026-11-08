"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { approveContentAction, collateContentAction, draftContentAction, markContentMadeAction, rejectContentAction, saveContentDraftAction } from "@/app/actions/content-requests";

type Say = (key: string, values?: Record<string, string | number>) => string;

export type ContentCardData = {
  id: string;
  kind: "article" | "faq" | "video" | "resource";
  status: "suggested" | "drafted" | "approved" | "published" | "rejected";
  title: string;
  summary: string;
  targetSlug: string | null;
  askCount: number;
  date: string;
  questions: { id: string; text: string; page: string | null; date: string }[];
  article: { title: string; description: string; body: string; html: string; slug: string | null } | null;
  faq: { q: string; a: string } | null;
};

/** "Collate new questions": groups what the assistant couldn't answer into requests, then shows what it did. */
export function CollateButton() {
  const say = useTranslations("help") as unknown as Say;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        className="primary-action pressable"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            setNote(null);
            const result = await collateContentAction();
            if (!result.ok) return setError(result.error);
            setNote(result.questions ? say("contentCollated", { questions: result.questions, created: result.created, merged: result.merged }) : say("contentNothingNew"));
            router.refresh();
          })
        }
        type="button"
      >
        {pending ? say("contentCollating") : say("contentCollate")}
      </button>
      {note ? <p className="font-semibold text-[var(--foreground-secondary)]">{note}</p> : null}
      {error ? <p className="font-bold text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

const KIND_STYLE: Record<ContentCardData["kind"], string> = {
  article: "bg-[var(--primary)] text-white",
  faq: "bg-[var(--panel-secondary)] text-[var(--foreground)]",
  video: "bg-[var(--success-light)] text-[var(--success)]",
  resource: "bg-[var(--panel-secondary)] text-[var(--foreground-secondary)]"
};

/**
 * One request: what it is, how often it was asked, the questions behind it, the draft (with a preview) and the
 * buttons for where it is in its life. Publishing only ever happens on "Approve & publish".
 */
export function ContentRequestCard({ data }: { data: ContentCardData }) {
  const say = useTranslations("help") as unknown as Say;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(data.article?.title || "");
  const [body, setBody] = useState(data.article?.body || "");
  const [q, setQ] = useState(data.faq?.q || "");
  const [a, setA] = useState(data.faq?.a || "");
  const writable = data.kind === "article" || data.kind === "faq";
  const hasCheck = /\[check\]/i.test(`${data.article?.body || ""} ${data.faq?.a || ""}`);

  const run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) return setError(result.error);
      setEditing(false);
      router.refresh();
    });
  };
  const save = () => run(() => saveContentDraftAction(data.id, data.kind === "article" ? { title, body } : { q, a }));

  return (
    <article className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-bold ${KIND_STYLE[data.kind]}`}>{say(`contentKind_${data.kind}`)}</span>
        <span className="rounded-full bg-[var(--panel-secondary)] px-2.5 py-0.5 text-[13px] font-bold text-[var(--foreground-secondary)]">{say("contentAsked", { count: data.askCount })}</span>
        {data.status === "published" || data.status === "rejected" ? (
          <span className="rounded-full bg-[var(--panel-secondary)] px-2.5 py-0.5 text-[13px] font-bold text-[var(--foreground-secondary)]">{say(`contentStatus_${data.status}`)}</span>
        ) : null}
        <span className="ml-auto text-sm font-medium text-[var(--muted)]">{data.date}</span>
      </div>
      <h3 className="mt-2 text-[17px] font-bold text-[var(--foreground)]">{data.title}</h3>
      {data.summary ? <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{data.summary}</p> : null}
      {data.targetSlug ? (
        <p className="mt-1 text-sm font-medium text-[var(--muted)]">
          {say("contentFor")}{" "}
          <a className="font-semibold underline" href={`/docs/${data.targetSlug}`} rel="noreferrer" target="_blank">
            /docs/{data.targetSlug}
          </a>
        </p>
      ) : null}

      {data.questions.length ? (
        <details className="mt-3 rounded-xl border border-[var(--border)] p-3">
          <summary className="cursor-pointer font-semibold text-[var(--foreground)]">{say("contentQuestions", { count: data.questions.length })}</summary>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {data.questions.map((question) => (
              <li className="py-2" key={question.id}>
                <p className="font-medium text-[var(--foreground)]">{question.text}</p>
                <p className="text-sm font-medium text-[var(--muted)]">
                  {question.date}
                  {question.page ? ` · ${say("contentAskedOn", { page: question.page })}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* The draft: a preview to read, or the fields to change it before approving. */}
      {data.status === "drafted" && (data.article || data.faq) ? (
        <div className="mt-3 rounded-xl bg-[var(--panel-secondary)] p-3">
          {hasCheck ? <p className="mb-2 text-sm font-bold text-[var(--foreground)]">{say("contentCheckNote")}</p> : null}
          {editing ? (
            <div className="space-y-2">
              <label className="block text-sm font-bold text-[var(--foreground)]">
                {data.kind === "article" ? say("contentDraftTitle") : say("contentFaqQ")}
                <input className="mt-1 block w-full" disabled={pending} onChange={(event) => (data.kind === "article" ? setTitle(event.target.value) : setQ(event.target.value))} value={data.kind === "article" ? title : q} />
              </label>
              <label className="block text-sm font-bold text-[var(--foreground)]">
                {data.kind === "article" ? say("contentDraftBody") : say("contentFaqA")}
                <textarea
                  className={`mt-1 block w-full resize-y font-mono text-[14px] ${data.kind === "article" ? "min-h-[320px]" : "min-h-[120px]"}`}
                  disabled={pending}
                  onChange={(event) => (data.kind === "article" ? setBody(event.target.value) : setA(event.target.value))}
                  value={data.kind === "article" ? body : a}
                />
              </label>
            </div>
          ) : data.article ? (
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">{say("contentPreview")}</p>
              <p className="mt-1 text-[18px] font-bold text-[var(--foreground)]">{data.article.title}</p>
              {data.article.description ? <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{data.article.description}</p> : null}
              {/* Rendered with the help centre's own Markdown renderer, styled simply here. */}
              <div
                className="mt-2 text-[15px] leading-relaxed text-[var(--foreground)] [&_a]:underline [&_h2]:mt-4 [&_h2]:text-[16px] [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:font-bold [&_li]:mt-1 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: data.article.html }}
              />
            </div>
          ) : data.faq ? (
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">{say("contentPreview")}</p>
              <p className="mt-1 font-bold text-[var(--foreground)]">{data.faq.q}</p>
              <p className="mt-1 whitespace-pre-wrap font-medium text-[var(--foreground-secondary)]">{data.faq.a}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {data.status === "published" && data.article?.slug ? (
        <a className="mt-3 inline-block font-semibold underline" href={`/docs/${data.article.slug}`} rel="noreferrer" target="_blank">
          {say("contentView")}
        </a>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {data.status === "suggested" && writable ? (
          <button className="primary-action pressable" disabled={pending} onClick={() => run(() => draftContentAction(data.id))} type="button">
            {pending ? say("contentDrafting") : say("contentDraft")}
          </button>
        ) : null}
        {data.status === "suggested" && !writable ? (
          <button className="primary-action pressable" disabled={pending} onClick={() => run(() => approveContentAction(data.id))} type="button">
            {say("contentApproveMake")}
          </button>
        ) : null}
        {data.status === "drafted" && editing ? (
          <>
            <button className="primary-action pressable" disabled={pending} onClick={save} type="button">
              {say("contentSave")}
            </button>
            <button className="secondary-action pressable" disabled={pending} onClick={() => setEditing(false)} type="button">
              {say("contentCancel")}
            </button>
          </>
        ) : null}
        {data.status === "drafted" && !editing ? (
          <>
            <button className="primary-action pressable" disabled={pending} onClick={() => run(() => approveContentAction(data.id), say("contentApproveConfirm"))} type="button">
              {say("contentApprove")}
            </button>
            <button className="secondary-action pressable" disabled={pending} onClick={() => setEditing(true)} type="button">
              {say("contentEdit")}
            </button>
            <button className="secondary-action pressable" disabled={pending} onClick={() => run(() => draftContentAction(data.id))} type="button">
              {pending ? say("contentDrafting") : say("contentRedraft")}
            </button>
          </>
        ) : null}
        {data.status === "approved" ? (
          <button className="primary-action pressable" disabled={pending} onClick={() => run(() => markContentMadeAction(data.id))} type="button">
            {say("contentMarkMade")}
          </button>
        ) : null}
        {data.status === "suggested" || data.status === "drafted" || data.status === "approved" ? (
          <button className="secondary-action pressable" disabled={pending || editing} onClick={() => run(() => rejectContentAction(data.id), say("contentRejectConfirm"))} type="button">
            {say("contentReject")}
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-2 font-bold text-[var(--danger)]">{error}</p> : null}
    </article>
  );
}
