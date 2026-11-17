"use client";

// Opens a builder draft in the full editor. The editor keeps its own copy
// (IndexedDB project "build-<id>"), so hand edits survive reloads; the
// draft's AI versions stay as they were.

import { useEffect, useState } from "react";
import Link from "next/link";
import Workspace from "@/components/Workspace";
import { getDraft, type BuilderDraft } from "@/lib/builder/drafts";

export default function DraftEditor({ id }: { id: string }) {
  const [draft, setDraft] = useState<BuilderDraft | null | undefined>(
    undefined,
  );

  useEffect(() => {
    getDraft(id).then(setDraft, () => setDraft(null));
  }, [id]);

  if (draft === undefined) {
    return (
      <p className="p-10 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
        Loading…
      </p>
    );
  }
  if (draft === null) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="font-display text-3xl">
          That build isn&apos;t in this browser.
        </p>
        <Link href="/build" className="btn btn-accent mt-6">
          Start a new build
        </Link>
      </div>
    );
  }
  return (
    <Workspace
      initialCode={draft.code}
      initialKind={draft.output === "html" ? "html" : "jsx"}
      filename={`build-${draft.id}`}
      persistEdits
      title={draft.title}
      subtitle="Built with your AI · edits save in this browser"
    />
  );
}
