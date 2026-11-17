"use client";

// /me - pages saved to the account (with their review status) and builds
// kept in this browser.

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useSession } from "@/lib/supabase/use-session";
import { deletePage, listMyPages, type SavedPage } from "@/lib/community/pages";
import { listDrafts, type BuilderDraft } from "@/lib/builder/drafts";
import { SignInDialog } from "@/components/auth/AccountButton";

const STATUS_LABEL: Record<SavedPage["status"], string> = {
  draft: "Private",
  pending_review: "In review",
  published: "Live in library",
  rejected: "Not accepted",
};

export default function MyPages() {
  const { available, user, ready } = useSession();
  const [pages, setPages] = useState<SavedPage[] | null>(null);
  const [drafts, setDrafts] = useState<BuilderDraft[]>([]);
  const [signIn, setSignIn] = useState(false);

  useEffect(() => {
    listDrafts().then(setDrafts, () => setDrafts([]));
  }, []);

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb || !user) return;
    listMyPages(sb).then(setPages);
  }, [user]);

  return (
    <main className="mx-auto max-w-[1100px] px-4 pb-24 pt-8 sm:px-6">
      <h1 className="font-display text-display-lg">My pages</h1>

      <section className="mt-8">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          Saved to your account
        </h2>
        {!available ? (
          <p className="mt-2 text-sm text-ink/70">
            Accounts aren&apos;t switched on yet.
          </p>
        ) : !ready ? null : !user ? (
          <div className="mt-2 border-2 border-dashed border-ink/40 p-5">
            <p className="text-sm">
              Sign in to keep pages across devices and share them in the
              library.
            </p>
            <button
              type="button"
              className="btn btn-accent mt-3 px-4 py-2"
              onClick={() => setSignIn(true)}
            >
              Sign in
            </button>
          </div>
        ) : pages === null ? (
          <p className="mt-2 text-sm text-ink/60">Loading…</p>
        ) : pages.length === 0 ? (
          <p className="mt-2 text-sm text-ink/70">
            Nothing saved yet.{" "}
            <Link href="/build" className="underline">
              Build a page
            </Link>{" "}
            and press Save.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-ink/10 border-2 border-ink bg-card">
            {pages.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                    {p.kind} · {p.purpose} · {p.stack} · updated{" "}
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={
                    "border-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] " +
                    (p.status === "published"
                      ? "border-ink bg-coral text-paper"
                      : "border-ink/30")
                  }
                >
                  {STATUS_LABEL[p.status]}
                </span>
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={async () => {
                    const sb = getBrowserSupabase();
                    if (
                      !sb ||
                      !window.confirm(
                        `Delete "${p.title}"? This can't be undone.`,
                      )
                    )
                      return;
                    if (await deletePage(sb, p.id))
                      setPages(
                        (all) => all?.filter((x) => x.id !== p.id) ?? null,
                      );
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          Builds in this browser
        </h2>
        {drafts.length === 0 ? (
          <p className="mt-2 text-sm text-ink/70">None yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink/10 border-2 border-ink bg-card">
            {drafts.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/build/d/${d.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-soft"
                >
                  <span className="truncate">{d.title}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted">
                    {d.remotePageId ? "saved · " : ""}
                    {new Date(d.updatedAt).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {signIn ? <SignInDialog onClose={() => setSignIn(false)} /> : null}
    </main>
  );
}
