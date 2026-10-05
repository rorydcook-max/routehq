/**
 * The PromptPay QR picture is saved as a signed link, and signed links expire
 * (the saved one after a year). Rather than show a link that will one day stop
 * working, find the file it points to and make a fresh link each time.
 */
const MARKERS = ["/storage/v1/object/sign/documents/", "/storage/v1/object/public/documents/"];

/** The file inside the "documents" bucket that a saved QR link points to. */
export function promptPayQrPath(url: string | null | undefined): string | null {
  if (!url) return null;
  for (const marker of MARKERS) {
    const index = url.indexOf(marker);
    if (index >= 0) return decodeURIComponent(url.slice(index + marker.length).split("?")[0]) || null;
  }
  return null;
}

/** A link to the QR picture that works now. Falls back to the saved link if a fresh one can't be made. */
export async function freshPromptPayQrUrl(supabase: any, savedUrl: string | null | undefined, expiresInSeconds = 60 * 60 * 24): Promise<string | null> {
  const path = promptPayQrPath(savedUrl);
  if (!path) return savedUrl || null;
  try {
    const { data } = await supabase.storage.from("documents").createSignedUrl(path, expiresInSeconds);
    return data?.signedUrl || savedUrl || null;
  } catch {
    return savedUrl || null;
  }
}
