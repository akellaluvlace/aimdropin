"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase, supabaseConfigured } from "./client";

export function useSession(): {
  // Supabase isn't set up in this deployment: hide account UI entirely.
  available: boolean;
  user: User | null;
  ready: boolean;
} {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const available = supabaseConfigured();

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) {
      setReady(true);
      return;
    }
    let active = true;
    sb.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { available, user, ready };
}

export async function signInWithProvider(
  provider: "github" | "google",
  returnTo: string,
): Promise<string | null> {
  const sb = getBrowserSupabase();
  if (!sb) return "Accounts aren't set up yet.";
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: authCallbackUrl(returnTo) },
  });
  return error?.message ?? null;
}

export async function signInWithEmail(
  email: string,
  returnTo: string,
): Promise<string | null> {
  const sb = getBrowserSupabase();
  if (!sb) return "Accounts aren't set up yet.";
  const { error } = await sb.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: authCallbackUrl(returnTo) },
  });
  return error?.message ?? null;
}

export async function signOut(): Promise<void> {
  await getBrowserSupabase()?.auth.signOut();
}

function authCallbackUrl(returnTo: string): string {
  const u = new URL("/auth/callback", window.location.origin);
  u.searchParams.set(
    "next",
    returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/",
  );
  return u.toString();
}
