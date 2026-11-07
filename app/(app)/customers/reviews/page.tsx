import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { FlagFont } from "@/components/flag-font";
import { BackLink } from "@/components/ui";
import { BandPills, PageBand } from "@/components/page-band";
import { getCurrentMembership } from "@/lib/auth/roles";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { averageOf, googleReviewUrl, listReviews } from "@/lib/reviews";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GoogleReviewLink, ReviewsList } from "./reviews-list";

/** Reviews renters left after their rental (lib/reviews.ts): publish or hide each one, and reply. Under Customers. */
export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const [userEmail, organization, membership, supabase] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), getCurrentMembership(), createSupabaseServerClient()]);
  const say = await getTranslations("reviewsPage");
  const reviews = await listReviews(supabase, organization.id);
  const { average, count } = averageOf(reviews);
  const published = reviews.filter((review) => review.published && review.consent).length;
  const toCheck = reviews.filter((review) => !review.checked).length;
  const shown = show === "check" ? reviews.filter((review) => !review.checked) : show === "published" ? reviews.filter((review) => review.published && review.consent) : reviews;
  const link = (key: string) => (show === key ? "/customers/reviews" : `/customers/reviews?show=${key}`);

  return (
    <AppShell
      userEmail={userEmail}
      hero={
        <div>
          <BackLink className="!mb-2" href="/customers" label={say("back")} />
          <PageBand title={say("title")}>
            <BandPills
              items={[
                { count, value: count ? `★ ${average.toFixed(1)}` : "–", label: say("average") },
                { count, label: say("pillAll"), href: show ? "/customers/reviews" : null },
                { count: toCheck, label: say("pillToCheck"), alert: true, href: link("check"), active: show === "check" },
                { count: published, label: say("pillPublished"), href: link("published"), active: show === "published" }
              ]}
            />
          </PageBand>
        </div>
      }
    >
      <FlagFont />
      <ReviewsList reviews={shown} />
      <div className="mt-6 max-w-xl">
        <GoogleReviewLink canEdit={membership?.role === "owner"} initial={googleReviewUrl(organization.settings) || ""} />
      </div>
    </AppShell>
  );
}
