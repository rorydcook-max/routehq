"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Eye, EyeOff, MessageSquareReply, Star } from "lucide-react";
import { saveGoogleReviewLink, saveReviewReply, setReviewPublished } from "@/app/actions/reviews";
import type { OperatorReview } from "@/lib/reviews";

type Say = (key: string, values?: Record<string, string | number>) => string;

function flagOf(code: string) {
  return code.toUpperCase().replace(/./g, (letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)));
}

export function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span aria-label={`${rating}/5`} className="inline-flex shrink-0 gap-0.5" role="img">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star className={value <= rating ? "fill-[#F5A623] text-[#F5A623]" : "text-[var(--border-strong)]"} key={value} size={size} strokeWidth={1.75} />
      ))}
    </span>
  );
}

export function ReviewsList({ reviews }: { reviews: OperatorReview[] }) {
  const say = useTranslations("reviewsPage") as unknown as Say;
  if (!reviews.length) return <div className="card p-6 text-center font-semibold text-[var(--foreground-secondary)]">{say("empty")}</div>;
  return (
    <ul className="space-y-3">
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </ul>
  );
}

function ReviewCard({ review }: { review: OperatorReview }) {
  const say = useTranslations("reviewsPage") as unknown as Say;
  const locale = useLocale();
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState(review.reply);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const live = review.published && review.consent;
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(review.submittedAt));

  function run(job: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await job().catch(() => ({ ok: false, error: say("failed") }));
      if (!result.ok) {
        setError(("error" in result && result.error) || say("failed"));
        return;
      }
      after?.();
      router.refresh();
    });
  }

  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars rating={review.rating} />
        <span className="font-bold text-[var(--foreground)]">
          {review.country ? `${flagOf(review.country)} ` : ""}
          {review.displayName || review.customerName}
        </span>
        <span className="text-sm text-[var(--muted)]">{date}</span>
        <span className="ms-auto flex flex-wrap gap-1.5">
          {!review.checked ? <span className="rounded-full bg-[var(--warning-light)] px-2.5 py-0.5 text-xs font-bold text-[var(--foreground)]">{say("new")}</span> : null}
          {review.isTest ? <span className="rounded-full bg-[var(--panel-secondary)] px-2.5 py-0.5 text-xs font-bold text-[var(--muted)]">{say("test")}</span> : null}
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${live ? "bg-[var(--success-light)] text-[var(--success)]" : "bg-[var(--panel-secondary)] text-[var(--foreground-secondary)]"}`}>
            {live ? say("published") : review.consent ? say("hidden") : say("noConsent")}
          </span>
        </span>
      </div>

      {review.text ? <p className="mt-2 whitespace-pre-line text-[15px] text-[var(--foreground)]">{review.text}</p> : null}

      <p className="mt-2 flex flex-wrap gap-x-3 text-sm text-[var(--foreground-secondary)]">
        {review.customerId ? (
          <Link className="font-semibold hover:underline" href={`/customers/${review.customerId}` as Route}>
            {review.customerName}
          </Link>
        ) : null}
        {review.vehicleId && review.vehicle ? (
          <Link className="hover:underline" href={`/fleet/${review.vehicleId}` as Route}>
            {review.vehicle}
          </Link>
        ) : null}
        <Link className="hover:underline" href={`/bookings/${review.rentalId}` as Route}>
          {say("booking")}
        </Link>
      </p>

      {review.reply && !replying ? (
        <div className="mt-3 rounded-xl bg-[var(--panel-secondary)] px-3 py-2">
          <p className="text-xs font-bold text-[var(--muted)]">{say("yourReply")}</p>
          <p className="mt-0.5 whitespace-pre-line text-sm text-[var(--foreground)]">{review.reply}</p>
        </div>
      ) : null}

      {replying ? (
        <div className="mt-3">
          <label className="block">
            <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{say("reply")}</span>
            <textarea className="mt-1 block min-h-20 w-full" disabled={isPending} maxLength={1000} onChange={(event) => setReply(event.target.value)} rows={3} value={reply} />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="primary-action pressable min-h-9 px-3 text-sm" disabled={isPending} onClick={() => run(() => saveReviewReply(review.id, reply), () => setReplying(false))} type="button">
              {say("save")}
            </button>
            <button className="secondary-action pressable min-h-9 px-3 text-sm" disabled={isPending} onClick={() => { setReplying(false); setReply(review.reply); }} type="button">
              {say("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {!live && review.consent ? (
            <button className="primary-action pressable min-h-9 gap-1.5 px-3 text-sm" disabled={isPending} onClick={() => run(() => setReviewPublished(review.id, true))} type="button">
              <Eye size={16} /> {say("publish")}
            </button>
          ) : null}
          {live || !review.checked ? (
            <button className="secondary-action pressable min-h-9 gap-1.5 px-3 text-sm" disabled={isPending} onClick={() => run(() => setReviewPublished(review.id, false))} type="button">
              <EyeOff size={16} /> {say("hide")}
            </button>
          ) : null}
          <button className="secondary-action pressable min-h-9 gap-1.5 px-3 text-sm" disabled={isPending} onClick={() => setReplying(true)} type="button">
            <MessageSquareReply size={16} /> {review.reply ? say("editReply") : say("reply")}
          </button>
        </div>
      )}
      {error ? <p className="mt-2 text-sm font-bold text-[var(--danger)]">{error}</p> : null}
    </li>
  );
}

/** The Google review link offered to renters after 4-5 stars. Owner only. */
export function GoogleReviewLink({ initial, canEdit }: { initial: string; canEdit: boolean }) {
  const say = useTranslations("reviewsPage") as unknown as Say;
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setState("idle");
    startTransition(async () => {
      const result = await saveGoogleReviewLink(value).catch(() => ({ ok: false as const, error: say("failed") }));
      if (result.ok) setState("saved");
      else {
        setError(result.error);
        setState("error");
      }
    });
  }

  return (
    <div className="card p-4">
      <label className="block">
        <span className="font-semibold text-[var(--foreground-secondary)]">{say("googleLink")}</span>
        <input
          className="mt-1 w-full"
          disabled={!canEdit || isPending}
          inputMode="url"
          onChange={(event) => {
            setValue(event.target.value);
            setState("idle");
          }}
          placeholder="https://g.page/r/…/review"
          type="url"
          value={value}
        />
      </label>
      {canEdit ? (
        <div className="mt-2 flex items-center gap-3">
          <button className="secondary-action pressable min-h-9 px-3 text-sm" disabled={isPending || value === initial} onClick={save} type="button">
            {say("save")}
          </button>
          {state === "saved" ? <span className="text-sm font-bold text-[var(--success)]">{say("saved")}</span> : null}
          {state === "error" ? <span className="text-sm font-bold text-[var(--danger)]">{error || say("failed")}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
