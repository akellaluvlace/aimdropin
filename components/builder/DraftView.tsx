"use client";

// /build/d/[id] - a generated page: live preview at desktop / tablet / phone
// widths, plain-words refine ("make the hero darker, add an FAQ"), version
// history, layout report, then open in the editor, download, or save to the
// user's account and share it to the library.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAiConnection } from "@/lib/ai/use-ai-connection";
import { AiError } from "@/lib/ai/complete";
import AiConnectDialog from "@/components/ai/AiConnectDialog";
import {
  getDraft,
  putDraft,
  withVersion,
  type BuilderDraft,
} from "@/lib/builder/drafts";
import {
  previewDocFor,
  refinePage,
  type BuildProgress,
} from "@/lib/builder/generate";
import type { LayoutProblem } from "@/lib/builder/prompt";
import SavePageDialog from "./SavePageDialog";
import { ACCOUNTS_ENABLED } from "@/lib/supabase/client";

const WIDTHS = [
  { id: "desktop", label: "Desktop", px: null },
  { id: "tablet", label: "Tablet", px: 820 },
  { id: "phone", label: "Phone", px: 390 },
] as const;

const QUICK_CHANGES = [
  "Tighten the copy and make headlines punchier",
  "More whitespace, calmer layout",
  "Make it dark mode",
  "Add a testimonials section",
  "Add an FAQ before the footer",
  "Make the hero more striking",
];

function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const PROBLEM_LABEL: Record<string, string> = {
  "overflow-x": "content wider than the screen",
  "broken-image": "broken images",
  "js-error": "script errors",
  empty: "a blank render",
  truncated: "a cut-off file",
};

function problemSummary(problems: LayoutProblem[]): string {
  const labels = problems.map((p) => {
    const base = PROBLEM_LABEL[p.kind] ?? p.kind;
    return p.kind === "overflow-x" && p.viewport
      ? `${base} (${p.viewport < 600 ? "phone" : "desktop"})`
      : base;
  });
  return [...new Set(labels)].join(", ");
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "page"
  );
}

export default function DraftView({ id }: { id: string }) {
  const [draft, setDraft] = useState<BuilderDraft | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [width, setWidth] = useState<(typeof WIDTHS)[number]["id"]>("desktop");
  const [instruction, setInstruction] = useState("");
  const [progress, setProgress] = useState<BuildProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{
    problems: LayoutProblem[];
    fixed: LayoutProblem[];
    missing?: string[];
  } | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [abort, setAbort] = useState<AbortController | null>(null);
  const { connection } = useAiConnection();

  useEffect(() => {
    getDraft(id).then(
      (d) => (d ? setDraft(d) : setNotFound(true)),
      () => setNotFound(true),
    );
    try {
      const raw = window.sessionStorage.getItem(`aimdropin:build:report:${id}`);
      if (raw) setReport(JSON.parse(raw));
    } catch {
      // no report
    }
  }, [id]);

  const srcDoc = useMemo(
    () => (draft ? previewDocFor(draft.code, draft.output) : ""),
    [draft],
  );

  async function refine(text: string) {
    if (!draft || !text.trim()) return;
    if (!connection) {
      setShowConnect(true);
      return;
    }
    setError(null);
    const ac = new AbortController();
    setAbort(ac);
    try {
      const r = await refinePage({
        connection,
        code: draft.code,
        output: draft.output,
        instruction: text,
        signal: ac.signal,
        onProgress: setProgress,
      });
      const next = withVersion(draft, r.code, text.trim().slice(0, 80));
      next.costUsd =
        draft.costUsd != null && r.costUsd != null
          ? draft.costUsd + r.costUsd
          : null;
      await putDraft(next);
      setDraft(next);
      setReport({ problems: r.problems, fixed: r.fixedProblems });
      setInstruction("");
    } catch (e) {
      if (!(e instanceof AiError && e.kind === "aborted"))
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
      setAbort(null);
    }
  }

  async function restore(index: number) {
    if (!draft) return;
    const v = draft.versions[index];
    if (!v) return;
    const next = withVersion(
      draft,
      v.code,
      `Restored: ${v.label}`.slice(0, 80),
    );
    await putDraft(next);
    setDraft(next);
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="font-display text-3xl">
          That build isn&apos;t in this browser.
        </p>
        <p className="mt-3 text-ink/70">
          Builds are kept on the device that made them until you save them to
          your account.
        </p>
        <Link href="/build" className="btn btn-accent mt-6">
          Start a new build
        </Link>
      </div>
    );
  }
  if (!draft) {
    return (
      <p className="p-10 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
        Loading…
      </p>
    );
  }

  const frameWidth = WIDTHS.find((w) => w.id === width)?.px;
  const remaining = report?.problems.filter((p) => p.kind !== "timeout") ?? [];
  const ext = draft.output === "html" ? "html" : "jsx";

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col lg:h-[calc(100vh-64px)] lg:flex-row">
      <div className="flex min-h-[70vh] min-w-0 flex-1 flex-col border-b-2 border-ink lg:border-b-0 lg:border-r-2">
        <div className="flex flex-wrap items-center gap-3 border-b-2 border-ink bg-paper px-4 py-2">
          <h1 className="min-w-0 flex-1 truncate font-display text-xl">
            {draft.title}
          </h1>
          <div
            className="flex border-2 border-ink"
            role="group"
            aria-label="Preview width"
          >
            {WIDTHS.map((w, i) => (
              <button
                key={w.id}
                type="button"
                aria-pressed={width === w.id}
                onClick={() => setWidth(w.id)}
                className={
                  "px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] " +
                  (i ? "border-l-2 border-ink " : "") +
                  (width === w.id ? "bg-ink text-paper" : "hover:bg-soft")
                }
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-soft">
          <iframe
            key={draft.updatedAt}
            title={`Preview: ${draft.title}`}
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-popups allow-forms"
            className="h-full min-h-[70vh] bg-white transition-[width] duration-200"
            style={{
              width: frameWidth ? `${frameWidth}px` : "100%",
              maxWidth: "100%",
            }}
          />
        </div>
      </div>

      <aside className="flex w-full shrink-0 flex-col overflow-y-auto bg-paper lg:w-[380px]">
        <div className="space-y-3 border-b-2 border-ink p-4">
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/build/d/${draft.id}/edit`}
              className="btn btn-accent px-3 py-2.5"
            >
              Open in editor
            </Link>
            <button
              type="button"
              className="btn px-3 py-2.5"
              onClick={() =>
                download(
                  `${slugify(draft.title)}.${ext}`,
                  draft.code,
                  draft.output === "html" ? "text/html" : "text/javascript",
                )
              }
            >
              Download .{ext}
            </button>
            {ACCOUNTS_ENABLED ? (
              <button
                type="button"
                className="btn col-span-2 px-3 py-2.5"
                onClick={() => setShowSave(true)}
              >
                {draft.remotePageId
                  ? "Saved · update or share"
                  : "Save to my pages / share"}
              </button>
            ) : null}
          </div>
          {draft.costUsd != null ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
              Spent so far: ${draft.costUsd.toFixed(2)} · {draft.model}
            </p>
          ) : (
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
              {draft.model}
            </p>
          )}
        </div>

        <form
          className="space-y-3 border-b-2 border-ink p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void refine(instruction);
          }}
        >
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Change something
            </span>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={3}
              maxLength={2000}
              disabled={!!progress}
              placeholder="Say it in plain words: “make the pricing cards green and add a yearly toggle”"
              className="mt-2 w-full border-2 border-ink bg-card px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void refine(instruction);
                }
              }}
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_CHANGES.map((q) => (
              <button
                key={q}
                type="button"
                disabled={!!progress}
                onClick={() => void refine(q)}
                className="border border-ink/25 px-2 py-1 text-left text-xs hover:border-ink disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
          {progress ? (
            <div
              className="flex items-center justify-between gap-2 border-2 border-ink bg-card px-3 py-2 text-sm"
              aria-live="polite"
            >
              <span>
                {progress.phase === "writing"
                  ? `Rewriting… ${progress.chars ? `${Math.round(progress.chars / 1000)}k chars` : ""}`
                  : progress.phase === "fixing"
                    ? "Fixing layout…"
                    : "Checking layout…"}
              </span>
              <button
                type="button"
                className="text-xs underline"
                onClick={() => abort?.abort()}
              >
                Stop
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={!instruction.trim()}
              className="btn w-full disabled:opacity-50"
            >
              {connection ? "Apply change" : "Connect AI to change"}
            </button>
          )}
          {error ? <p className="text-sm text-coral">{error}</p> : null}
        </form>

        {report ? (
          <div className="border-b-2 border-ink p-4 text-sm">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Layout check
            </h2>
            {report.fixed.length ? (
              <p className="mt-2">
                Found and fixed automatically: {problemSummary(report.fixed)}.
              </p>
            ) : null}
            {remaining.length ? (
              <>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-ink/75">
                  {remaining.slice(0, 5).map((p, i) => (
                    <li key={i}>
                      {p.detail.slice(0, 200)}
                      {p.viewport ? ` (${p.viewport}px)` : ""}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={!!progress}
                  className="btn mt-3 w-full px-3 py-2"
                  onClick={() =>
                    void refine(
                      "Fix these layout problems without changing the design:\n" +
                        remaining
                          .map(
                            (p) =>
                              `- ${p.detail}${p.viewport ? ` (at ${p.viewport}px)` : ""}`,
                          )
                          .join("\n"),
                    )
                  }
                >
                  Ask AI to fix these
                </button>
              </>
            ) : (
              <p className="mt-2 text-ink/75">
                No problems found on desktop or phone.
              </p>
            )}
            {report.missing?.length ? (
              <p className="mt-2 text-xs text-ink/60">
                No code was available for: {report.missing.join(", ")}.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="p-4">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Versions
          </h2>
          <ol className="mt-2 space-y-1 text-sm">
            {draft.versions.map((v, i) => (
              <li
                key={v.at + ":" + i}
                className="flex items-center justify-between gap-2"
              >
                <span
                  className={
                    "truncate " + (i === 0 ? "font-medium" : "text-ink/70")
                  }
                >
                  {i === 0 ? "● " : ""}
                  {v.label}
                </span>
                {i > 0 ? (
                  <button
                    type="button"
                    disabled={!!progress}
                    className="shrink-0 text-xs underline"
                    onClick={() => void restore(i)}
                  >
                    Restore
                  </button>
                ) : (
                  <span className="shrink-0 text-xs text-muted">current</span>
                )}
              </li>
            ))}
          </ol>
          {draft.credits.length ? (
            <>
              <h2 className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                Built from
              </h2>
              <ul className="mt-2 space-y-1 text-xs text-ink/70">
                {draft.credits.map((c) => (
                  <li key={c.id}>
                    {c.sourceUrl ? (
                      <a
                        href={c.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        {c.title}
                      </a>
                    ) : (
                      c.title
                    )}{" "}
                    · {c.license}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink/50">
                These notices are kept in a comment at the top of the code.
              </p>
            </>
          ) : null}
        </div>
      </aside>

      {showConnect ? (
        <AiConnectDialog onClose={() => setShowConnect(false)} />
      ) : null}
      {showSave ? (
        <SavePageDialog
          draft={draft}
          onClose={() => setShowSave(false)}
          onSaved={async (remoteId) => {
            const next = { ...draft, remotePageId: remoteId };
            await putDraft(next);
            setDraft(next);
          }}
        />
      ) : null}
    </div>
  );
}
