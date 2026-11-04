# Supabase account emails

The sign-in emails (invite, password reset, email check...) are sent by Supabase, not by the app, so their design lives in
the Supabase dashboard. These files are the same design as the app's own emails (`lib/email/layout.ts`).

**Where:** Supabase dashboard → Authentication → Emails → Templates. For each template below, paste the Subject, then
replace the whole "Message body" (Source) with the contents of the file, and save.

| Dashboard template | Subject to paste | File | Sent today? |
| --- | --- | --- | --- |
| Confirm signup | `Confirm your email for RoveHQ` | `confirm-signup.html` | No: sign-up creates the account already confirmed |
| Invite user | `You're invited to RoveHQ` | `invite-user.html` | Yes: Settings › Team › Invite |
| Magic link | `Confirm your email for RoveHQ` | `magic-link.html` | Yes: "Verify your email" on the Get ready list |
| Change email address | `Confirm your new RoveHQ email address` | `change-email.html` | No: there is no self-service email change |
| Reset password | `Reset your RoveHQ password` | `reset-password.html` | Yes: Forgot password |
| Reauthentication | `Your RoveHQ confirmation code` | `reauthentication.html` | No: the app never asks for it |

The ones not sent today are there so nothing ever goes out in Supabase's plain default look.

## Links: keep `{{ .ConfirmationURL }}`

Every flow sends people to `/auth/callback` (`app/(app)/auth/callback/route.ts`), which signs them in from a `?code=`
(password reset, the email check) or, through `/auth/landing`, from a `#access_token` (invites). `{{ .ConfirmationURL }}`
produces exactly those, using the `redirectTo` each call passes in `app/actions/auth.ts`. The app has no `/auth/confirm`
route that takes `token_hash`, so don't switch these to `{{ .TokenHash }}` links: they would break.

Also check, in Authentication → URL Configuration, that the Site URL is `https://rovehq.app` and that
`https://rovehq.app/auth/callback**` is in the Redirect URLs.

## Logo

The header logo loads from `https://rovehq.io/email/rovehq-logo.png` (`public/email/rovehq-logo.png`, a PNG because
Gmail blocks SVG). Deploy the site before pasting, or the logo shows as its "RoveHQ" alt text until then.

## Changing them

Edit `scripts/supabase-email-templates.ts` (wording) or `lib/email/layout.ts` (design), then run
`npx tsx scripts/email-previews.ts --supabase` to rewrite these files and the previews in `%TEMP%\email-previews`,
and paste again. English only: Supabase has one template per email, not one per language.
