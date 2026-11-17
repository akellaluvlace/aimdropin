"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import RatingStars from "./RatingStars";
import { buildPreviewDocument } from "@/lib/preview";
import { createProject } from "@/lib/studio/projects";
import { trackUsage } from "@/lib/community/usage";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { SignInDialog } from "@/components/auth/AccountButton";

interface Props {
  id: string;
  title: string;
  description: string | null;
  username: string | null;
  kindLabel: string;
  stack: "html" | "jsx";
  source: string;
  credits: Array<{ id: string; title: string; sourceUrl: string | null; license: string }>;
  full: boolean;
}

// A community page. It runs in an opaque-origin sandbox (no same-origin), so
// its scripts can't reach this site's session or storage.
export default function PublishedPageView({ id, title, description, username, kindLabel, stack, source, credits, full }: Props) {
  const router = useRouter();
  const [remixing, setRemixing] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const doc = useMemo(() => buildPreviewDocument({ code: source, kind: stack === "jsx" ? "jsx" : "html" }), [source, stack]);

  const remix = async () => {
    setRemixing(true);
    const r = await createProject({
      title: `${title} (remix)`,
      stack,
      source,
      origin: { type: "community", id, title, license: "MIT" },
    });
    if (r.ok) {
      trackUsage("page", id, "remix");
      router.push(`/me/edit/${r.value.id}`);
    } else setRemixing(false);
  };

  const report = async (reason: string) => {
    const sb = getBrowserSupabase();
    const { data } = sb ? await sb.auth.getSession() : { data: { session: null } };
    const uid = data.session?.user.id;
    if (!sb || !uid) {
      setSignIn(true);
      return;
    }
    const { error } = await sb.from("reports").insert({ target_type: "page", target_id: id, reason, reporter_id: uid });
    if (!error) setReported(true);
    setReportOpen(false);
  };

  const frame = (
    <iframe title={title} srcDoc={doc} sandbox="allow-scripts allow-forms allow-popups allow-modals" referrerPolicy="no-referrer" className="h-full w-full border-0 bg-white" />
  );

  if (full) {
    return (
      <div className="flex h-[100dvh] flex-col bg-paper font-sans text-ink">
        <div className="flex items-center justify-between gap-3 border-b-2 border-ink px-3 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/gallery/community" className="shrink-0 border-2 border-ink px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] hover:bg-ink hover:text-paper">
              ← Gallery
            </Link>
            <p className="truncate font-display text-lg leading-none">{title}</p>
          </div>
          <Link href={`/p/${id}`} className="btn btn-accent shrink-0">
            Rate &amp; remix
          </Link>
        </div>
        <div className="min-h-0 flex-1">{frame}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans text-ink">
      <header className="border-b-2 border-ink bg-white/70">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 md:px-6 lg:px-10">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] md:text-[11px]">
            <Link href="/" className="-my-1 flex shrink-0 items-center gap-2 font-display text-2xl normal-case leading-none tracking-tight hover:text-coral" aria-label="AiM Dropin - home">
              {/* The same head as the site's navbar, at its drawn size (59 by
                  48). The link's negative margin (-my-1) keeps this bar the
                  height it was with the 40px mark. */}
              <img
                src="/assets/wolf-head.svg"
                alt=""
                aria-hidden="true"
                width={59}
                height={48}
                className="h-12 w-[59px] flex-none"
                style={{ imageRendering: "pixelated" }}
              />
              <span className="hidden sm:inline">
                <span className="text-coral">AiM </span>Dropin
              </span>
            </Link>
            <span aria-hidden="true" className="text-muted">/</span>
            <Link href="/gallery/community" className="shrink-0 hover:text-coral">
              Community
            </Link>
            {username ? (
              <>
                <span aria-hidden="true" className="text-muted">/</span>
                <Link href={`/u/${username}`} className="truncate hover:text-coral">
                  @{username}
                </Link>
              </>
            ) : null}
          </nav>
          <Link href="/me" className="btn btn-accent">
            My studio
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 md:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
              {kindLabel} · {stack.toUpperCase()} · MIT{username ? ` · by @${username}` : ""}
            </p>
            <h1 className="mt-2 font-display text-4xl leading-none tracking-tight md:text-5xl">{title}</h1>
            {description ? <p className="mt-2 max-w-3xl text-ink/75">{description}</p> : null}
            <div className="mt-3">
              <RatingStars targetType="page" targetId={id} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={remix} disabled={remixing} className="btn btn-accent">
              {remixing ? "Copying…" : "Remix in my studio"}
            </button>
            <Link href={`/p/${id}?full=1`} className="btn">
              Full screen
            </Link>
            <button type="button" onClick={() => setReportOpen((o) => !o)} className="btn" disabled={reported}>
              {reported ? "Reported" : "Report"}
            </button>
          </div>
        </div>
        {reportOpen ? (
          <div className="mt-3 flex flex-wrap gap-2 border-2 border-ink bg-card p-3 text-sm">
            <span className="mr-2 self-center">What&apos;s wrong?</span>
            {(
              [
                ["copyright", "Copied from someone"],
                ["malicious", "Harmful or scammy"],
                ["broken", "Broken"],
                ["other", "Something else"],
              ] as const
            ).map(([reason, label]) => (
              <button key={reason} type="button" className="btn" onClick={() => report(reason)}>
                {label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-6 h-[75vh] min-h-[520px] border-2 border-ink">{frame}</div>
        {credits.length ? (
          <p className="mt-3 text-xs text-ink/60">
            Built from:{" "}
            {credits.map((c, i) => (
              <span key={c.id}>
                {i > 0 ? ", " : ""}
                {c.sourceUrl ? (
                  <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                    {c.title}
                  </a>
                ) : (
                  c.title
                )}{" "}
                ({c.license})
              </span>
            ))}
          </p>
        ) : null}
      </main>
      {signIn ? <SignInDialog onClose={() => setSignIn(false)} reason="Sign in to report a page." /> : null}
    </div>
  );
}
