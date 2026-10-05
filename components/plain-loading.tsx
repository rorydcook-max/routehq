/**
 * Loading screen for pages outside the owner's app: customer links, the public
 * booking page, sign-in and sign-up. The app's own loading screen draws the
 * owner's menu, which customers must never see, even for a moment.
 */
export function PlainLoading() {
  return (
    <div aria-busy="true" className="flex min-h-screen items-center justify-center bg-[var(--background)]" role="status">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--border-strong)] border-t-[var(--primary)]" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
