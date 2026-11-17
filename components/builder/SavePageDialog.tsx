"use client";

// Save a build to the user's account, and optionally share it to the library
// as a landing page / dashboard / section / component. Sharing sends it for
// review (the database won't let owners publish themselves) and asks the
// owner to confirm they can license it MIT.

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useSession } from "@/lib/supabase/use-session";
import {
  savePage,
  submitPage,
  type PageKind,
  type PagePurpose,
} from "@/lib/community/pages";
import type { BuilderDraft } from "@/lib/builder/drafts";
import { SignInDialog } from "@/components/auth/AccountButton";
import Portal from "@/components/ui/Portal";

const LISTINGS: Array<{ kind: PageKind; purpose: PagePurpose; label: string }> =
  [
    { kind: "page", purpose: "landing", label: "Landing page" },
    { kind: "page", purpose: "dashboard", label: "Dashboard" },
    { kind: "section", purpose: "general", label: "Section" },
    { kind: "component", purpose: "general", label: "Component" },
  ];

function purposeFromBrief(d: BuilderDraft): number {
  return d.brief.pageType === "dashboard" ? 1 : 0;
}

export default function SavePageDialog({
  draft,
  onClose,
  onSaved,
}: {
  draft: BuilderDraft;
  onClose: () => void;
  onSaved: (remoteId: string) => void | Promise<void>;
}) {
  const { available, user, ready } = useSession();
  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState("");
  const [listing, setListing] = useState(purposeFromBrief(draft));
  const [share, setShare] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!available) {
    return (
      <Shell onClose={onClose} title="Save your page">
        <p className="text-sm text-ink/70">
          Accounts aren&apos;t switched on yet. Your build is safe in this
          browser; download it or open it in the editor in the meantime.
        </p>
      </Shell>
    );
  }
  if (ready && !user) {
    return (
      <SignInDialog
        onClose={onClose}
        reason="Sign in to save this page to your account and share it."
      />
    );
  }

  async function save() {
    const sb = getBrowserSupabase();
    if (!sb) return;
    if (share && !confirm) {
      setError(
        "Tick the box to confirm you can share it under the MIT license.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    const l = LISTINGS[listing];
    const r = await savePage(
      sb,
      {
        title,
        description,
        kind: l.kind,
        purpose: l.purpose,
        stack: draft.output,
        source: draft.code,
        credits: draft.credits,
      },
      draft.remotePageId ?? undefined,
    );
    if (!r.ok) {
      setBusy(false);
      setError(r.error);
      return;
    }
    await onSaved(r.page.id);
    // Already shared: saving new code puts a live page back into review on its
    // own (database trigger), and submitting twice would be refused.
    if (r.page.status === "pending_review" || r.page.status === "published") {
      setBusy(false);
      setDone(
        r.page.status === "published"
          ? "Saved. It's live in the library."
          : "Saved. Your changes are in review and go live once they pass the checks.",
      );
      return;
    }
    if (share) {
      const s = await submitPage(sb, r.page.id, "public");
      setBusy(false);
      if (!s.ok) {
        setError(`Saved, but couldn't send it for review: ${s.error}`);
        return;
      }
      setDone(
        "Saved and sent for review. Once it passes the checks it appears in the library for everyone.",
      );
      return;
    }
    setBusy(false);
    setDone("Saved to your pages. Only you can see it.");
  }

  return (
    <Shell
      onClose={onClose}
      title={draft.remotePageId ? "Update your page" : "Save your page"}
    >
      {done ? (
        <div className="space-y-4">
          <p className="text-sm">{done}</p>
          <div className="flex gap-2">
            <a href="/me" className="btn btn-accent px-4 py-2">
              My pages
            </a>
            <button type="button" onClick={onClose} className="btn px-4 py-2">
              Close
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Title
            </span>
            <input
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:border-coral"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Short description
            </span>
            <textarea
              value={description}
              maxLength={500}
              rows={2}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:border-coral"
            />
          </label>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              List it under
            </span>
            <div className="mt-1 flex flex-wrap gap-2">
              {LISTINGS.map((l, i) => (
                <button
                  key={l.label}
                  type="button"
                  aria-pressed={listing === i}
                  onClick={() => setListing(i)}
                  className={
                    "border-2 px-2.5 py-1 text-sm " +
                    (listing === i
                      ? "border-ink bg-ink text-paper"
                      : "border-ink/25 hover:border-ink")
                  }
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={share}
              onChange={(e) => setShare(e.target.checked)}
              className="mt-1 accent-[#FF4D2E]"
            />
            <span>
              Share it in the library so others can use it
              <span className="block text-xs text-ink/60">
                It&apos;s checked before it goes live.
              </span>
            </span>
          </label>
          {share ? (
            <label className="flex items-start gap-2 border-2 border-ink bg-card p-3 text-xs">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
                className="mt-0.5 accent-[#FF4D2E]"
              />
              <span>
                I made this page (or have the rights to it), it contains no one
                else&apos;s paid or copyrighted material beyond the credited
                open-source pieces, and I license it under the MIT license so
                anyone can use it.
              </span>
            </label>
          ) : null}
          {error ? <p className="text-sm text-coral">{error}</p> : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="btn btn-accent w-full"
          >
            {busy ? "Saving…" : share ? "Save and share" : "Save"}
          </button>
        </div>
      )}
    </Shell>
  );
}

function Shell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/70 p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md border-2 border-ink bg-paper p-5 shadow-[8px_8px_0_0_#FF4D2E]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="font-display text-2xl">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-sm underline"
            >
              Close
            </button>
          </div>
          {children}
        </div>
      </div>
    </Portal>
  );
}
