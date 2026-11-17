// Supabase - accounts, stars, ratings, usage counts, saved and published pages.
//
// Everything here is optional: without NEXT_PUBLIC_SUPABASE_URL and
// NEXT_PUBLIC_SUPABASE_ANON_KEY the getters return null and every caller
// falls back to "signed out, no counts" behaviour. The anon key is public by
// design; row-level security in supabase/migrations decides what it can do.
// The service-role key is never imported here.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Accounts, ratings, the studio and community pages ship switched off until
// NEXT_PUBLIC_FEATURE_ACCOUNTS=1; with it off the site behaves exactly as if
// Supabase weren't configured.
export const ACCOUNTS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_ACCOUNTS === "1";
const URL_ENV = ACCOUNTS_ENABLED ? process.env.NEXT_PUBLIC_SUPABASE_URL : undefined;
const ANON_ENV = ACCOUNTS_ENABLED ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined;

export function supabaseConfigured(): boolean {
  return Boolean(URL_ENV && ANON_ENV);
}

let browserClient: SupabaseClient | null = null;

// Browser client: PKCE sign-in, session kept in localStorage, the auth
// callback page finishes the code exchange.
export function getBrowserSupabase(): SupabaseClient | null {
  if (typeof window === "undefined" || !URL_ENV || !ANON_ENV) return null;
  if (!browserClient) {
    browserClient = createClient(URL_ENV, ANON_ENV, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "aimdropin:auth",
      },
    });
  }
  return browserClient;
}

// Server client for public reads (rankings, published pages). No session:
// it sees exactly what a signed-out visitor sees. Responses are cached by
// Next's fetch cache for a few minutes so the library doesn't hit the
// database on every request.
export function getServerSupabase(
  revalidateSeconds = 300,
): SupabaseClient | null {
  if (!URL_ENV || !ANON_ENV) return null;
  return createClient(URL_ENV, ANON_ENV, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          next: { revalidate: revalidateSeconds },
        } as RequestInit),
    },
  });
}
