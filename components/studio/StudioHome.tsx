"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SignInDialog } from "@/components/auth/AccountButton";
import { useSession } from "@/lib/supabase/use-session";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { createProject, listProjects, moveBrowserDraftsToAccount, removeProject, unpublishProject } from "@/lib/studio/projects";
import { originHref } from "@/lib/studio/origin";
import type { Project } from "@/lib/studio/types";

const BLANK_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>My page</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-white text-slate-900">
  <main class="mx-auto max-w-3xl px-6 py-24">
    <h1 class="text-5xl font-bold tracking-tight">Start here</h1>
    <p class="mt-4 text-lg text-slate-600">Edit this page, or paste your own code over it.</p>
  </main>
</body>
</html>
`;

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "Waiting for review",
  published: "Published",
  rejected: "Needs changes",
};

function ago(t: number): string {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
}

export default function StudioHome() {
  const router = useRouter();
  const { available, user, ready } = useSession();
  const [data, setData] = useState<{ account: Project[]; browser: Project[]; signedIn: boolean } | null>(null);
  const [signIn, setSignIn] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listProjects().then(setData, () => setData({ account: [], browser: [], signedIn: false }));
  }, []);
  useEffect(() => {
    if (ready) refresh();
  }, [ready, user?.id, refresh]);

  const start = async (kind: "blank" | "paste") => {
    setBusy(kind);
    setError(null);
    const r = await createProject({
      title: kind === "blank" ? "Untitled page" : "Pasted page",
      stack: "html",
      source: kind === "blank" ? BLANK_HTML : "<!-- Paste your HTML or JSX here -->\n",
      origin: { type: kind },
    });
    setBusy(null);
    if (r.ok) router.push(`/me/edit/${r.value.id}`);
    else setError(r.error);
  };

  const projects = [...(data?.account ?? []), ...(data?.browser ?? [])];

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 md:px-6 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">Your playground</p>
          <h1 className="mt-2 font-display text-5xl leading-none tracking-tight">My studio</h1>
        </div>
        {available ? (
          user ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-ink/70">{user.email}</span>
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  await getBrowserSupabase()?.auth.signOut();
                  refresh();
                }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-accent" onClick={() => setSignIn(true)}>
              Sign in
            </button>
          )
        ) : null}
      </div>

      {available && !user && ready ? (
        <p className="mt-4 border-2 border-ink bg-card p-3 text-sm">
          You&apos;re not signed in, so projects stay in this browser. Sign in to keep them across devices and to publish.
        </p>
      ) : null}
      {user && (data?.browser.length ?? 0) > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-2 border-ink bg-card p-3 text-sm">
          <span>
            {data?.browser.length} draft{data?.browser.length === 1 ? "" : "s"} in this browser aren&apos;t in your account yet.
          </span>
          <button
            type="button"
            className="btn btn-accent"
            disabled={busy === "move"}
            onClick={async () => {
              setBusy("move");
              await moveBrowserDraftsToAccount();
              setBusy(null);
              refresh();
            }}
          >
            {busy === "move" ? "Moving…" : "Move them to my account"}
          </button>
        </div>
      ) : null}

      <section className="mt-8">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">Start something</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ["From a landing page", "Pick one of 111 and change it", "/gallery"],
              ["From a dashboard", "Take a page of a full dashboard", "/gallery/dashboards"],
              ["From components", "Start from a block or component", "/gallery/components"],
              ["Build with AI", "Describe it, your AI writes it", "/build"],
            ] as const
          ).map(([label, hint, href]) => (
            <Link key={href} href={href} className="flex min-h-28 flex-col justify-between border-2 border-ink bg-card p-3 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#FF4D2E]">
              <span className="font-display text-lg leading-tight">{label}</span>
              <span className="text-xs text-ink/60">{hint}</span>
            </Link>
          ))}
          {(
            [
              ["paste", "Paste code", "HTML or JSX from anywhere"],
              ["blank", "Blank page", "An empty Tailwind page"],
            ] as const
          ).map(([kind, label, hint]) => (
            <button
              key={kind}
              type="button"
              onClick={() => start(kind)}
              disabled={busy === kind}
              className="flex min-h-28 flex-col justify-between border-2 border-ink bg-card p-3 text-left hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#FF4D2E]"
            >
              <span className="font-display text-lg leading-tight">{busy === kind ? "Creating…" : label}</span>
              <span className="text-xs text-ink/60">{hint}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink/60">Opening any template, dashboard page or the playground gives you a &ldquo;Save to my studio&rdquo; button.</p>
        {error ? <p className="mt-2 text-sm text-coral">{error}</p> : null}
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">Projects · {projects.length}</h2>
        {!data ? (
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.2em] text-muted">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="mt-3 text-sm text-ink/70">Nothing yet. Start from one of the options above.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => {
              const from = p.origin ? originHref(p.origin) : null;
              return (
                <li key={p.id} className="flex flex-col gap-2 border-2 border-ink bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/me/edit/${p.id}`} className="min-w-0 font-display text-xl leading-tight hover:text-coral">
                      <span className="block truncate">{p.title}</span>
                    </Link>
                    <span className={"chip shrink-0 " + (p.status === "published" ? "chip-accent" : "")}>{STATUS_LABEL[p.status] ?? p.status}</span>
                  </div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
                    {p.stack.toUpperCase()} · {p.local ? "this browser" : "account"} · {ago(p.updatedAt)}
                    {p.status === "published" && p.visibility === "private" ? " · hidden" : ""}
                  </p>
                  {p.origin?.title && from ? (
                    <p className="text-xs text-ink/60">
                      Started from{" "}
                      <Link href={from} className="underline">
                        {p.origin.title}
                      </Link>
                    </p>
                  ) : null}
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    <Link href={`/me/edit/${p.id}`} className="btn btn-accent">
                      Open
                    </Link>
                    {p.status === "published" && p.visibility !== "private" ? (
                      <>
                        <Link href={`/p/${p.id}`} className="btn">
                          View
                        </Link>
                        <button type="button" className="btn" onClick={async () => (await unpublishProject(p)) && refresh()}>
                          Unpublish
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="btn"
                      onClick={async () => {
                        if (!window.confirm(`Delete “${p.title}”? This can't be undone.`)) return;
                        if (await removeProject(p)) refresh();
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {signIn ? <SignInDialog onClose={() => setSignIn(false)} reason="Sign in to keep your projects across devices and publish them." /> : null}
    </main>
  );
}
