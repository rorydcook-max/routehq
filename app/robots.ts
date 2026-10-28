import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site/seo";

/** The staff app, sign-in flows, customers' private links and the API: not for search engines. */
const PRIVATE = [
  "/api/",
  "/account",
  "/accept-invite",
  "/amend/",
  "/auth/",
  "/book/",
  "/bookings",
  "/business-closed",
  "/calendar",
  "/customers",
  "/documents",
  "/fleet",
  "/forgot-password",
  "/help",
  "/import",
  "/inbox",
  "/inspections",
  "/invite",
  "/login",
  "/onboarding",
  "/partners",
  "/platform",
  "/rental-calculator",
  "/reports",
  "/reset-password",
  "/settings",
  "/signup",
  "/subscription-required",
  "/tasks",
  "/transactions",
  "/trial-expired"
];

/** robots.txt: the website (home, pricing, FAQ, contact, guides, free resources, in every language) is open. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE }],
    sitemap: `${siteOrigin()}/sitemap.xml`,
    host: siteOrigin()
  };
}
