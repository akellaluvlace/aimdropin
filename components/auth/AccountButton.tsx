"use client";

// Header account control. Hidden entirely when Supabase isn't configured, so
// the site works exactly as before until accounts are switched on.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  signInWithEmail,
  signInWithProvider,
  signOut,
  useSession,
} from "@/lib/supabase/use-session";
import Portal from "@/components/ui/Portal";

export default function AccountButton() {
  const { available, user, ready } = useSession();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  if (!available || !ready) return null;

  if (user) {
    const name =
      (user.user_metadata?.user_name as string | undefined) ??
      (user.user_metadata?.full_name as string | undefined) ??
      user.email ??
      "Account";
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          className="inline-flex items-center gap-2 border-2 border-ink bg-card px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] hover:bg-soft"
          aria-expanded={menu}
        >
          <span className="max-w-[14ch] truncate">{name}</span>
        </button>
        {menu ? (
          <div className="absolute right-0 z-50 mt-1 w-48 border-2 border-ink bg-paper shadow-[4px_4px_0_0_#0F0F0F]">
            <Link
              href="/me"
              className="block px-3 py-2 text-sm hover:bg-soft"
              onClick={() => setMenu(false)}
            >
              My pages
            </Link>
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-soft"
              onClick={() => {
                setMenu(false);
                void signOut();
              }}
            >
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center border-2 border-ink bg-card px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] hover:bg-soft"
      >
        Sign in
      </button>
      {open ? <SignInDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function SignInDialog({
  onClose,
  reason,
}: {
  onClose: () => void;
  reason?: string;
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const here = () => window.location.pathname + window.location.search;

  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign in"
        className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/70 p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-sm border-2 border-ink bg-paper p-5 shadow-[8px_8px_0_0_#FF4D2E]"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="font-display text-2xl">Sign in</h2>
          <p className="mt-1 text-sm text-ink/70">
            {reason ??
              "Save pages, star favourites and share your work with the community."}
          </p>
          <div className="mt-4 space-y-2">
            {(["github", "google"] as const).map((p) => (
              <button
                key={p}
                type="button"
                disabled={busy}
                className="btn w-full"
                onClick={async () => {
                  setBusy(true);
                  const err = await signInWithProvider(p, here());
                  if (err) {
                    setError(err);
                    setBusy(false);
                  }
                }}
              >
                Continue with {p === "github" ? "GitHub" : "Google"}
              </button>
            ))}
          </div>
          <div className="my-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            <span className="h-px flex-1 bg-ink/20" /> or email{" "}
            <span className="h-px flex-1 bg-ink/20" />
          </div>
          {sent ? (
            <p className="border-2 border-ink bg-card px-3 py-2 text-sm">
              Check {email} for a sign-in link.
            </p>
          ) : (
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!/^\S+@\S+\.\S+$/.test(email)) {
                  setError("Enter a valid email address.");
                  return;
                }
                setBusy(true);
                const err = await signInWithEmail(email, here());
                setBusy(false);
                if (err) setError(err);
                else setSent(true);
              }}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-label="Email"
                className="w-full border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:border-coral"
              />
              <button
                type="submit"
                disabled={busy}
                className="btn btn-accent w-full"
              >
                Email me a link
              </button>
            </form>
          )}
          {error ? <p className="mt-3 text-sm text-coral">{error}</p> : null}
          <button
            type="button"
            onClick={onClose}
            className="mt-4 text-sm underline"
          >
            Not now
          </button>
        </div>
      </div>
    </Portal>
  );
}
