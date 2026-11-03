import { headers } from "next/headers";
import { AppShell } from "@/components/app-shell";

/**
 * Shown the moment a page is opened, while its figures load: the page's usual shape (title, counts,
 * four tiles, a list) in soft grey that breathes, so the screen answers the tap at once.
 */
export default async function Loading() {
  // Customer pages have no staff app: drawing its sidebar there flashed an empty app frame and, with none of the
  // staff words sent to those pages, logged "MISSING_MESSAGE: nav" on every visit. (The website has its own root
  // layout and no loading screen.)
  try {
    const requestHeaders = await headers();
    if (requestHeaders.get("x-routehq-customer-page")) return <div aria-busy="true" className="min-h-screen" />;
  } catch {
    // No request to read: the staff skeleton below.
  }
  return (
    <AppShell>
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <span className="sr-only">Loading</span>
        <div className="space-y-3">
          <div className="skel h-9 w-48" />
          <div className="flex gap-2">
            <div className="skel h-10 w-28 rounded-2xl" />
            <div className="skel h-10 w-32 rounded-2xl" />
            <div className="skel hidden h-10 w-28 rounded-2xl sm:block" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div className="card space-y-3 p-4" key={item}>
              <div className="skel h-4 w-24" />
              <div className="skel h-8 w-28" />
              <div className="skel h-4 w-20" />
            </div>
          ))}
        </div>
        <div className="card space-y-3 p-4">
          {[0, 1, 2, 3, 4].map((item) => (
            <div className="flex items-center gap-3" key={item}>
              <div className="skel h-12 w-12 shrink-0 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <div className="skel h-4 w-1/2" />
                <div className="skel h-4 w-1/3" />
              </div>
              <div className="skel h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
