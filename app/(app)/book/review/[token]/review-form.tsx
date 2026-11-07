"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, ExternalLink, Star } from "lucide-react";
import { sendRenterReview } from "@/app/actions/reviews";

const MAX = 600;

/** Stars, a few words and the yes to show it. The same form whatever the stars; every review is kept. */
export function ReviewForm({ token, business, displayName, flag }: { token: string; business: string; displayName: string; flag: string | null }) {
  const t = useTranslations("renterReview");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  // Opt-in: shown on the website only when the renter ticks it.
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ googleUrl: string | null } | null>(null);
  const [isPending, startTransition] = useTransition();

  if (done) return <ReviewThanks googleUrl={done.googleUrl} />;

  function send() {
    setError(null);
    if (!rating) {
      setError(t("pickStars"));
      return;
    }
    startTransition(async () => {
      const result = await sendRenterReview({ token, rating, text, consent }).catch(() => ({ ok: false as const, error: "failed" as const }));
      if (result.ok) setDone({ googleUrl: result.googleUrl });
      else if (result.error === "done") setDone({ googleUrl: null });
      else setError(result.error === "rating" ? t("pickStars") : t("failed"));
    });
  }

  const shown = hover || rating;
  return (
    <div className="mt-5 space-y-5">
      <div aria-label={t("stars")} className="flex gap-1" onMouseLeave={() => setHover(0)} role="radiogroup">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            aria-checked={rating === value}
            aria-label={t("starCount", { count: value })}
            className="pressable flex h-12 w-12 items-center justify-center rounded-full"
            disabled={isPending}
            key={value}
            onClick={() => {
              setRating(value);
              setError(null);
            }}
            onMouseEnter={() => setHover(value)}
            role="radio"
            type="button"
          >
            <Star className={value <= shown ? "fill-[#F5A623] text-[#F5A623]" : "text-[var(--border-strong)]"} size={36} strokeWidth={1.75} />
          </button>
        ))}
      </div>

      <label className="block">
        <span className="text-sm font-semibold text-[var(--foreground)]">{t("yourWords")}</span>
        <textarea className="mt-1 block min-h-28 w-full" disabled={isPending} maxLength={MAX} onChange={(event) => setText(event.target.value)} rows={4} value={text} />
        <span className="mt-1 block text-end text-xs text-[var(--muted)]">
          {text.length}/{MAX}
        </span>
      </label>

      {displayName ? (
        <p className="text-sm text-[var(--muted)]">
          {t("shownAs")}{" "}
          <span className="font-semibold text-[var(--foreground)]">
            {flag ? `${flag} ` : ""}
            {displayName}
          </span>
        </p>
      ) : null}

      <label className="flex cursor-pointer items-start gap-3 text-[15px] font-medium text-[var(--foreground)]">
        <input checked={consent} className="mt-0.5 h-5 w-5 shrink-0" disabled={isPending} onChange={(event) => setConsent(event.target.checked)} type="checkbox" />
        {t("consent", { business })}
      </label>

      <button className="pressable inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--primary)] px-5 py-3 text-base font-semibold text-white" disabled={isPending} onClick={send} type="button">
        {isPending ? t("sending") : t("send")}
      </button>
      {error ? <p className="text-sm font-bold text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

export function ReviewThanks({ googleUrl }: { googleUrl: string | null }) {
  const t = useTranslations("renterReview");
  return (
    <div className="text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success-light)] text-[var(--success)]">
        <CheckCircle2 />
      </div>
      <h1 className="mt-4 text-2xl font-semibold [text-wrap:balance]">{t("thanks")}</h1>
      {googleUrl ? (
        <a
          className="pressable mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--border-strong)] bg-white px-5 py-3 text-base font-semibold text-[var(--foreground)]"
          href={googleUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          <ExternalLink size={18} /> {t("google")}
        </a>
      ) : null}
    </div>
  );
}
