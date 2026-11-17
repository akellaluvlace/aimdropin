import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client for server routes that must act past row-level
// security (publishing after the automatic checks). Never import this from
// client code; the key bypasses RLS.
export function getAdminSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_FEATURE_ACCOUNTS === "1" ? process.env.NEXT_PUBLIC_SUPABASE_URL : undefined;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
