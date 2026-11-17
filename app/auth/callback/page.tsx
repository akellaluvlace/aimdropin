"use client";

// Supabase sends people back here after GitHub / Google / email sign-in with
// ?code=… (PKCE). The browser client exchanges it (detectSessionInUrl), then
// we continue to ?next=, which is limited to same-site paths.

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { safeReturnTo } from "@/lib/ai/openrouter-oauth";

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = safeReturnTo(params.get("next"));
    const providerError =
      params.get("error_description") ?? params.get("error");
    if (providerError) {
      setError(providerError);
      return;
    }
    const sb = getBrowserSupabase();
    if (!sb) {
      setError("Accounts aren't set up on this site yet.");
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.location.replace(next);
    };
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION"))
        finish();
    });
    // The exchange may already have happened before we subscribed.
    sb.auth.getSession().then(({ data }) => {
      if (data.session) finish();
    });
    const timer = window.setTimeout(() => {
      if (!done)
        setError(
          "Sign-in didn't complete. The link may have expired; try again.",
        );
    }, 10000);
    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-6 font-sans text-ink">
      <div className="w-full max-w-md border-2 border-ink bg-paper p-6 shadow-[8px_8px_0_0_#FF4D2E]">
        {error ? (
          <>
            <h1 className="font-display text-2xl">Couldn&apos;t sign you in</h1>
            <p className="mt-3 text-sm text-ink/70">{error}</p>
            <Link href="/" className="btn mt-5">
              Back to AIMdropin
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl">Signing you in…</h1>
            <p className="mt-3 text-sm text-ink/70">One second.</p>
          </>
        )}
      </div>
    </main>
  );
}
