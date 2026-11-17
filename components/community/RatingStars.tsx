"use client";

import { useEffect, useState } from "react";
import { SignInDialog } from "@/components/auth/AccountButton";
import { fetchStats, myRating, rate, trackUsage, type TargetStats, type TargetType } from "@/lib/community/usage";
import { supabaseConfigured } from "@/lib/supabase/client";

function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

// Star rating (the vote that ranks things and promotes community pages),
// plus views and downloads. Records one view per visitor per day.
export default function RatingStars({ targetType, targetId, trackView = true }: { targetType: TargetType; targetId: string; trackView?: boolean }) {
  const [stats, setStats] = useState<TargetStats | null>(null);
  const [mine, setMine] = useState<number | null>(null);
  const [hover, setHover] = useState(0);
  const [signIn, setSignIn] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const enabled = supabaseConfigured();

  useEffect(() => {
    if (!enabled) return;
    if (trackView) trackUsage(targetType, targetId, "view");
    void fetchStats(targetType, targetId).then(setStats);
    void myRating(targetType, targetId).then(setMine);
  }, [enabled, targetType, targetId, trackView]);

  if (!enabled) return null;

  const vote = async (score: number) => {
    setNote(null);
    const r = await rate(targetType, targetId, score);
    if (r.ok) {
      setMine(score);
      void fetchStats(targetType, targetId).then(setStats);
      setNote("Thanks for rating.");
    } else if (r.reason === "signed_out") setSignIn(true);
    else if (r.reason === "not_allowed") setNote("You can't rate your own page.");
    else setNote("Couldn't save your rating. Try again.");
  };

  const shown = hover || mine || 0;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <div className="flex items-center" role="radiogroup" aria-label="Rate it" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={mine === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onClick={() => vote(n)}
            className={"px-0.5 text-2xl leading-none transition-colors " + (n <= shown ? "text-coral" : "text-ink/25 hover:text-coral/60")}
          >
            ★
          </button>
        ))}
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        {stats?.rating != null ? `${stats.rating.toFixed(1)} · ${stats.ratingCount} rating${stats.ratingCount === 1 ? "" : "s"}` : "No ratings yet"}
        {stats ? ` · ${compact(stats.views)} views` : ""}
        {stats && stats.exports > 0 ? ` · ${compact(stats.exports)} downloads` : ""}
        {mine ? ` · you gave ${mine}★` : ""}
      </p>
      {note ? <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/70">{note}</p> : null}
      {signIn ? <SignInDialog onClose={() => setSignIn(false)} reason="Sign in to rate. Ratings decide what rises to the top." /> : null}
    </div>
  );
}
