/**
 * Website content written ahead of a feature going live. A guide with `launch: payments` in its frontmatter
 * describes RoveHQ as it will be once online card payments (Stripe Connect) are switched on, so it stays off the
 * site until then: left out of every list and the sitemap, its page answers 404, and any paragraph elsewhere that
 * links to it is dropped (lib/site/content.ts).
 *
 * The one switch: NEXT_PUBLIC_PAYMENTS_LIVE=1 in the environment, at build time (guide pages are drawn at build).
 */

export const LAUNCH_GATES = ["payments"] as const;
export type LaunchGate = (typeof LAUNCH_GATES)[number];

/** True once online card payments are live for operators. */
export function paymentsLive() {
  return process.env.NEXT_PUBLIC_PAYMENTS_LIVE === "1";
}

/** Whether content held for this launch may be shown. No gate means always; an unknown gate stays hidden. */
export function isLaunched(gate: string | null | undefined) {
  if (!gate) return true;
  if (gate === "payments") return paymentsLive();
  return false;
}
