"use client";

// OpenRouter sends the user back here with ?code=…&state=… after they approve
// AIMdropin. We check the state against the one we stored, swap the code for
// a key (PKCE), save the connection and return the user to where they were.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { saveConnection } from "@/lib/ai/connection-store";
import {
  PKCE_MAX_AGE_MS,
  exchangeCodeForKey,
  takePendingPkce,
} from "@/lib/ai/openrouter-oauth";

export default function OpenRouterCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Strict mode runs effects twice in dev; the code is single-use.
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const pending = takePendingPkce();

    if (!code) {
      setError(
        "OpenRouter didn't send a sign-in code. You may have cancelled; try connecting again.",
      );
      return;
    }
    if (!pending || pending.state !== state) {
      setError(
        "This sign-in didn't start here (or the tab changed). Try connecting again.",
      );
      return;
    }
    if (Date.now() - pending.createdAt > PKCE_MAX_AGE_MS) {
      setError("The sign-in took too long and expired. Try connecting again.");
      return;
    }

    exchangeCodeForKey(code, pending.verifier).then((r) => {
      if (!r.ok) {
        setError(r.error);
        return;
      }
      saveConnection({
        provider: "openrouter",
        key: r.key,
        via: "oauth",
        model: AI_PROVIDERS.openrouter.defaultModel,
        remember: pending.remember,
        connectedAt: new Date().toISOString(),
      });
      // Replace, so Back doesn't land on a spent code.
      window.location.replace(pending.returnTo);
    });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-6 font-sans text-ink">
      <div className="w-full max-w-md border-2 border-ink bg-paper p-6 shadow-[8px_8px_0_0_#FF4D2E]">
        {error ? (
          <>
            <h1 className="font-display text-2xl">
              Couldn&apos;t connect OpenRouter
            </h1>
            <p className="mt-3 text-sm text-ink/70">{error}</p>
            <Link href="/" className="btn mt-5">
              Back to AIMdropin
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl">Connecting OpenRouter…</h1>
            <p className="mt-3 text-sm text-ink/70">
              Finishing sign-in. This takes a second.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
