"use client";

// Usage signals that drive ranking: views, copies, installs, remixes,
// exports (one per visitor, item and day, deduped in the database), plus
// stars and ratings for signed-in users. All calls are fire-and-forget and
// silently do nothing when Supabase isn't configured.

import { getBrowserSupabase } from "@/lib/supabase/client";

export type TargetType = "catalog" | "page" | "template" | "dashboard";
export type UsageEvent = "view" | "copy" | "install" | "remix" | "export";

const ANON_ID_KEY = "aimdropin:anon-id";

// A random id for signed-out visitors so one person viewing an item ten
// times counts once. Not tied to anything else; clearing site data resets it.
export function anonId(): string | null {
  try {
    let id = window.localStorage.getItem(ANON_ID_KEY);
    if (!id || id.length < 8) {
      const bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      window.localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function trackUsage(
  targetType: TargetType,
  targetId: string,
  event: UsageEvent,
): void {
  const sb = getBrowserSupabase();
  if (!sb) return;
  const anon = anonId();
  void sb
    .rpc("track_event", { t_type: targetType, t_id: targetId, ev: event, anon })
    .then(({ error }) => {
      if (error && process.env.NODE_ENV !== "production") {
        console.warn("[usage] track_event failed:", error.message);
      }
    });
}

export interface TargetStats {
  views: number;
  copies: number;
  installs: number;
  remixes: number;
  exports: number;
  stars: number;
  rating: number | null;
  ratingCount: number;
}

export async function fetchStats(
  targetType: TargetType,
  targetId: string,
): Promise<TargetStats | null> {
  const sb = getBrowserSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("ranked_targets")
    .select(
      "views, copies, installs, remixes, exports, stars, rating, rating_count",
    )
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    views: Number(data.views ?? 0),
    copies: Number(data.copies ?? 0),
    installs: Number(data.installs ?? 0),
    remixes: Number(data.remixes ?? 0),
    exports: Number(data.exports ?? 0),
    stars: Number(data.stars ?? 0),
    rating: data.rating == null ? null : Number(data.rating),
    ratingCount: Number(data.rating_count ?? 0),
  };
}

export async function isStarred(
  targetType: TargetType,
  targetId: string,
): Promise<boolean> {
  const sb = getBrowserSupabase();
  if (!sb) return false;
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return false;
  const { data } = await sb
    .from("stars")
    .select("target_id")
    .eq("user_id", auth.user.id)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();
  return !!data;
}

export type StarResult =
  | { ok: true; starred: boolean }
  | { ok: false; reason: "signed_out" | "unavailable" | "error" };

export async function setStar(
  targetType: TargetType,
  targetId: string,
  starred: boolean,
): Promise<StarResult> {
  const sb = getBrowserSupabase();
  if (!sb) return { ok: false, reason: "unavailable" };
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { ok: false, reason: "signed_out" };
  const row = {
    user_id: auth.user.id,
    target_type: targetType,
    target_id: targetId,
  };
  const { error } = starred
    ? await sb
        .from("stars")
        .upsert(row, {
          onConflict: "user_id,target_type,target_id",
          ignoreDuplicates: true,
        })
    : await sb
        .from("stars")
        .delete()
        .eq("user_id", auth.user.id)
        .eq("target_type", targetType)
        .eq("target_id", targetId);
  return error ? { ok: false, reason: "error" } : { ok: true, starred };
}

export type RateResult =
  | { ok: true }
  // not_allowed: your own page, or one that isn't published.
  | { ok: false; reason: "signed_out" | "unavailable" | "not_allowed" | "error" };

// Ratings only count from people who copied, installed, remixed or exported
// the item; the database enforces it and we translate the refusal.
export async function rate(
  targetType: TargetType,
  targetId: string,
  score: number,
): Promise<RateResult> {
  const sb = getBrowserSupabase();
  if (!sb) return { ok: false, reason: "unavailable" };
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { ok: false, reason: "signed_out" };
  const s = Math.min(5, Math.max(1, Math.round(score)));
  const { error } = await sb
    .from("ratings")
    .upsert(
      {
        user_id: auth.user.id,
        target_type: targetType,
        target_id: targetId,
        score: s,
      },
      { onConflict: "user_id,target_type,target_id" },
    );
  if (!error) return { ok: true };
  return {
    ok: false,
    reason: /row-level security/i.test(error.message) ? "not_allowed" : "error",
  };
}

/** The signed-in user's own rating of a target, or null. */
export async function myRating(targetType: TargetType, targetId: string): Promise<number | null> {
  const sb = getBrowserSupabase();
  if (!sb) return null;
  const { data: session } = await sb.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return null;
  const { data } = await sb
    .from("ratings")
    .select("score")
    .eq("user_id", uid)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();
  return data ? Number(data.score) : null;
}
