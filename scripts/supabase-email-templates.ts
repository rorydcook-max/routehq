/**
 * The Supabase account emails (Authentication -> Emails -> Templates in the Supabase dashboard), in the same design
 * as the app's own emails. `npx tsx scripts/email-previews.ts --supabase` writes them to docs/supabase-email-templates/.
 *
 * Links: every flow in the app sends people to /auth/callback (app/(app)/auth/callback/route.ts), which takes either a
 * ?code= (PKCE: password reset, the "Verify your email" sign-in link) or a #access_token (invites, via /auth/landing).
 * Supabase's {{ .ConfirmationURL }} produces exactly those, using the redirectTo each call passes. There is no
 * /auth/confirm route taking token_hash, so these templates must NOT be switched to {{ .TokenHash }} links.
 *
 * English only: Supabase has one template per email, not one per language.
 */
import type { EmailContent } from "../lib/email/layout";

export type SupabaseTemplate = { file: string; dashboard: string; subject: string; usedBy: string; content: EmailContent };

const ignore = "If you didn't ask for this, you can ignore this email.";

export const SUPABASE_TEMPLATES: SupabaseTemplate[] = [
  {
    file: "confirm-signup",
    dashboard: "Confirm signup",
    subject: "Confirm your email for RoveHQ",
    usedBy: "Not sent today: sign-up creates the account already confirmed (app/actions/auth.ts signUpWithEmail). Kept in the same design in case that changes.",
    content: {
      preheader: "One tap to confirm your email and finish setting up RoveHQ.",
      heading: "Confirm your email",
      blocks: [
        { type: "text", text: "Hi,\n\nThanks for signing up to RoveHQ. Tap the button to confirm {{ .Email }} is your email address." },
        { type: "fallback-link", intro: "If the button doesn't work, copy this link into your browser:", url: "{{ .ConfirmationURL }}" }
      ],
      button: { label: "Confirm my email", url: "{{ .ConfirmationURL }}" },
      footer: { reason: `You get this because this address was used to sign up for RoveHQ. ${ignore}` }
    }
  },
  {
    file: "invite-user",
    dashboard: "Invite user",
    subject: "You're invited to RoveHQ",
    usedBy: "Settings › Team › Invite (app/actions/auth.ts inviteUser, inviteUserByEmail -> /auth/callback?next=/accept-invite).",
    content: {
      preheader: "You've been invited to join a team on RoveHQ.",
      heading: "You're invited to RoveHQ",
      blocks: [
        { type: "text", text: "Hi,\n\nYou've been invited to join a rental business's team on RoveHQ, where they run their bookings, vehicles and payments.\n\nTap the button to accept and choose your password." },
        { type: "fallback-link", intro: "If the button doesn't work, copy this link into your browser:", url: "{{ .ConfirmationURL }}" },
        { type: "text", text: "The invite works once. If it has run out, ask the person who invited you to send a new one.", tone: "muted" }
      ],
      button: { label: "Accept the invite", url: "{{ .ConfirmationURL }}" },
      footer: { reason: `You get this because someone invited {{ .Email }} to RoveHQ. If you weren't expecting it, you can ignore this email.` }
    }
  },
  {
    file: "magic-link",
    dashboard: "Magic link",
    subject: "Confirm your email for RoveHQ",
    usedBy: "\"Verify your email\" on the dashboard's Get ready list (app/actions/auth.ts sendEmailCheck, signInWithOtp -> /auth/callback?next=/auth/verified).",
    content: {
      preheader: "One tap to confirm this is your email address.",
      heading: "Confirm your email",
      blocks: [
        { type: "text", text: "Hi,\n\nTap the button to confirm {{ .Email }} is yours. It signs you in to RoveHQ and ticks off \"Verify your email\" on your Get ready list." },
        { type: "fallback-link", intro: "If the button doesn't work, copy this link into your browser:", url: "{{ .ConfirmationURL }}" },
        { type: "text", text: "The link works once and stops working after a short while.", tone: "muted" }
      ],
      button: { label: "Confirm my email", url: "{{ .ConfirmationURL }}" },
      footer: { reason: `You get this because a sign-in link was asked for on RoveHQ. ${ignore}` }
    }
  },
  {
    file: "change-email",
    dashboard: "Change email address",
    subject: "Confirm your new RoveHQ email address",
    usedBy: "Not sent today: the app has no self-service email change (RoveHQ support changes it already confirmed). Kept in the same design in case that changes.",
    content: {
      preheader: "Confirm the new email address for your RoveHQ account.",
      heading: "Confirm your new email address",
      blocks: [
        { type: "text", text: "Hi,\n\nTap the button to change the email you sign in to RoveHQ with from {{ .Email }} to {{ .NewEmail }}." },
        { type: "fallback-link", intro: "If the button doesn't work, copy this link into your browser:", url: "{{ .ConfirmationURL }}" }
      ],
      button: { label: "Confirm new email", url: "{{ .ConfirmationURL }}" },
      footer: { reason: `You get this because someone asked to change the email on a RoveHQ account. If it wasn't you, contact RoveHQ support.` }
    }
  },
  {
    file: "reset-password",
    dashboard: "Reset password",
    subject: "Reset your RoveHQ password",
    usedBy: "Forgot password (app/actions/auth.ts requestPasswordReset, resetPasswordForEmail -> /auth/callback?next=/reset-password).",
    content: {
      preheader: "Choose a new password for your RoveHQ account.",
      heading: "Reset your password",
      blocks: [
        { type: "text", text: "Hi,\n\nSomeone asked to reset the password for {{ .Email }}. Tap the button to choose a new one." },
        { type: "fallback-link", intro: "If the button doesn't work, copy this link into your browser:", url: "{{ .ConfirmationURL }}" },
        { type: "text", text: "The link works once and stops working after a short while. If you didn't ask for this, you can ignore this email: your password stays the same.", tone: "muted" }
      ],
      button: { label: "Choose a new password", url: "{{ .ConfirmationURL }}" },
      footer: { reason: "You get this because a password reset was asked for on RoveHQ." }
    }
  },
  {
    file: "reauthentication",
    dashboard: "Reauthentication",
    subject: "Your RoveHQ confirmation code",
    usedBy: "Not sent today: the app never calls reauthenticate(). Kept in the same design in case that changes.",
    content: {
      preheader: "Your RoveHQ confirmation code.",
      heading: "Your confirmation code",
      blocks: [
        { type: "text", text: "Hi,\n\nEnter this code in RoveHQ to confirm it's you:" },
        { type: "card", lines: [{ text: "{{ .Token }}", size: "big" }] },
        { type: "text", text: `The code stops working after a short while. ${ignore}`, tone: "muted" }
      ],
      footer: { reason: "You get this because a RoveHQ action needed you to confirm it's you." }
    }
  }
];
