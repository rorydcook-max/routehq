import { ldText } from "@/lib/rove/seo";

/** Structured data (schema.org JSON-LD) for search engines. */
export function JsonLd({ data }: { data: unknown }) {
  return <script dangerouslySetInnerHTML={{ __html: ldText(data) }} type="application/ld+json" />;
}
