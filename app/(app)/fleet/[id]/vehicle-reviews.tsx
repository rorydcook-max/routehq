import Link from "next/link";
import type { Route } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Stars } from "@/app/(app)/customers/reviews/reviews-list";
import { Card } from "@/components/ui";
import { averageOf, listReviews } from "@/lib/reviews";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Reviews renters left after renting this vehicle (lib/reviews.ts). Nothing when there are none. */
export async function VehicleReviews({ organizationId, vehicleId }: { organizationId: string; vehicleId: string }) {
  const reviews = await listReviews(await createSupabaseServerClient(), organizationId, { vehicleId, limit: 50 }).catch(() => []);
  if (!reviews.length) return null;
  const [say, locale] = await Promise.all([getTranslations("reviewsPage"), getLocale()]);
  const { average, count } = averageOf(reviews);
  const format = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  return (
    <Card className="mt-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="card-title">{say("title")}</h2>
        <span className="font-bold text-[var(--foreground)]">★ {average.toFixed(1)}</span>
        <span className="text-sm text-[var(--muted)]">{say("count", { count })}</span>
        <Link className="ms-auto text-sm font-semibold text-[var(--primary)] hover:underline" href={"/customers/reviews" as Route}>
          {say("all")}
        </Link>
      </div>
      <ul className="mt-3 divide-y divide-[var(--border)]">
        {reviews.slice(0, 3).map((review) => (
          <li className="py-2.5" key={review.id}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Stars rating={review.rating} size={14} />
              <span className="font-semibold text-[var(--foreground)]">{review.displayName || review.customerName}</span>
              <span className="text-sm text-[var(--muted)]">{format.format(new Date(review.submittedAt))}</span>
            </div>
            {review.text ? <p className="mt-1 line-clamp-3 text-sm text-[var(--foreground-secondary)]">{review.text}</p> : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
