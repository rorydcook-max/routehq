/**
 * Loads Google Maps (Places) once for the whole app.
 *
 * When the key is refused (billing off, key restricted), Google pops a
 * "This page can't load Google Maps correctly" dialog over the form. That is
 * for the site owner, not the person booking a car, so it is removed and the
 * address field simply works as a plain text field for the rest of the session.
 */
const FAILED_KEY = "routehq_maps_failed";

function mapsFailedBefore() {
  try {
    return window.sessionStorage.getItem(FAILED_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberFailure() {
  try {
    window.sessionStorage.setItem(FAILED_KEY, "1");
  } catch {
    // Private mode: the dialog is still hidden below.
  }
}

/**
 * The refusal shows up inside the suggestions dropdown (.pac-container) or as
 * a dialog on the page. Either way: hide it for good this session and stop
 * loading Maps on the next page.
 */
function watchForGoogleError() {
  const isError = (node: Element) => /can't load Google Maps correctly/i.test(node.textContent || "");
  const hide = () => {
    let found = false;
    document.querySelectorAll(".pac-container").forEach((node) => {
      if (isError(node)) {
        found = true;
        (node as HTMLElement).style.display = "none";
      }
    });
    if (!found) return;
    rememberFailure();
    if (!document.getElementById("routehq-pac-off")) {
      const style = document.createElement("style");
      style.id = "routehq-pac-off";
      style.textContent = ".pac-container { display: none !important; }";
      document.head.appendChild(style);
    }
    observer.disconnect();
  };
  const observer = new MutationObserver(hide);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  hide();
}

export function loadGooglePlaces(): Promise<void> | null {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey || typeof window === "undefined" || mapsFailedBefore()) return null;

  const w = window as any;
  if (w.google?.maps?.places?.Autocomplete) return Promise.resolve();

  if (!w.__routeHqGoogleMapsPromise) {
    w.gm_authFailure = rememberFailure;
    watchForGoogleError();
    w.__routeHqGoogleMapsPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-routehq-google-places="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Google Maps failed to load.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.async = true;
      script.defer = true;
      script.dataset.routehqGooglePlaces = "true";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google Maps failed to load."));
      document.head.appendChild(script);
    });
  }
  return w.__routeHqGoogleMapsPromise as Promise<void>;
}
