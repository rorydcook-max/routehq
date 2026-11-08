import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BrandStyle } from "@/components/brand-style";
import { FlagFont } from "@/components/flag-font";
import { PublicBrand, PublicShell } from "@/components/public-shell";
import { flagOf } from "@/lib/customer-options";
import { loadReviewPage } from "@/lib/reviews";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ReviewForm, ReviewThanks } from "./review-form";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("renterReview");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** "How was it?": the link in the message a renter gets the day after their return (lib/reviews.ts). */
export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const page = await loadReviewPage(createSupabaseAdminClient() as any, token);
  const t = await getTranslations("renterReview");

  if (page.state === "not_found") {
    return (
      <PublicShell width="narrow">
        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--danger-light)] text-[var(--danger)]">
            <AlertTriangle />
          </div>
          <h1 className="mt-4 text-2xl font-semibold [text-wrap:balance]">{t("notFound")}</h1>
        </section>
      </PublicShell>
    );
  }

  return (
    <PublicShell brand={<PublicBrand logoOnly logoUrl={page.logoUrl} name={page.businessName} />} width="narrow">
      <BrandStyle colour={page.brandColour} />
      <FlagFont />
      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        {page.state === "done" ? (
          <ReviewThanks googleUrl={page.rating ? page.googleUrl : null} />
        ) : (
          <>
            <h1 className="text-2xl font-semibold [text-wrap:balance]">{page.vehicle ? t("titleVehicle", { vehicle: page.vehicle }) : t("title")}</h1>
            <ReviewForm business={page.businessName} displayName={page.displayName} flag={page.country ? flagOf(page.country) : null} token={token} />
          </>
        )}
      </section>
    </PublicShell>
  );
}
