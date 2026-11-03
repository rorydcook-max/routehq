"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Where an emailed link lands when it carries its result after the "#" in the
 * address (invites do). The server never sees that part, so this page reads it
 * in the browser: a good link signs the person in and sends them on; a used or
 * out-of-date link says so plainly instead of dropping them on the sign-in page
 * with no explanation.
 */
export default function AuthLandingPage() {
  const say = useTranslations("auth") as unknown as (key: string) => string;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const wanted = query.get("next") || "/";
    const next = wanted.startsWith("/") && !wanted.startsWith("//") && !wanted.includes("\\") ? wanted : "/";
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");

    if (!accessToken || !refreshToken) {
      setFailed(true);
      return;
    }
    createSupabaseBrowserClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) setFailed(true);
        // A full page load, so the server sees the new sign-in.
        else window.location.replace(next);
      })
      .catch(() => setFailed(true));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="card p-6 text-center">
        {failed ? (
          <>
            <h1 className="text-xl font-bold text-[var(--foreground)]">{say("link_expiredTitle")}</h1>
            <p className="mt-3 font-medium text-[var(--foreground-secondary)]">{say("link_expiredBody")}</p>
            <Link className="primary-action mt-5 inline-flex w-full justify-center" href="/login">
              {say("link_login")}
            </Link>
          </>
        ) : (
          <p className="font-semibold text-[var(--foreground-secondary)]">
            <span aria-hidden="true" className="spinner mr-2" />
            {say("link_working")}
          </p>
        )}
      </div>
    </main>
  );
}
