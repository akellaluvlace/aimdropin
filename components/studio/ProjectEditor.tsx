"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Workspace from "@/components/Workspace";
import PublishDialog from "./PublishDialog";
import { SignInDialog } from "@/components/auth/AccountButton";
import type { PreviewKind } from "@/lib/preview";
import { loadProject, saveProject } from "@/lib/studio/projects";
import type { Project } from "@/lib/studio/types";

const AUTOSAVE_MS = 1200;

type SaveState = { kind: "saved"; at: number } | { kind: "saving" } | { kind: "dirty" } | { kind: "error"; message: string };

// A studio project in the editor: autosaves while you type, keeps a version
// history, and publishes.
export default function ProjectEditor({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);
  const [save, setSave] = useState<SaveState>({ kind: "saved", at: Date.now() });
  const [publishing, setPublishing] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const projectRef = useRef<Project | null>(null);
  const pending = useRef<{ code: string; kind: PreviewKind } | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    loadProject(id).then(
      (p) => {
        if (!p) setMissing(true);
        projectRef.current = p;
        setProject(p);
      },
      () => setMissing(true),
    );
  }, [id]);

  const flush = useCallback(async () => {
    const p = projectRef.current;
    const next = pending.current;
    if (!p || !next) return;
    pending.current = null;
    setSave({ kind: "saving" });
    const r = await saveProject(p, { source: next.code, stack: next.kind === "jsx" ? "jsx" : "html" });
    if (r.ok) {
      projectRef.current = r.value;
      setProject(r.value);
      setSave({ kind: "saved", at: Date.now() });
    } else {
      setSave({ kind: "error", message: r.error });
    }
  }, []);

  const onCodeChange = useCallback(
    (code: string, kind: PreviewKind) => {
      pending.current = { code, kind };
      setSave({ kind: "dirty" });
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), AUTOSAVE_MS);
    },
    [flush],
  );

  // Don't lose the last keystrokes when leaving.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (pending.current) {
        void flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [flush]);

  if (missing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center font-sans text-ink">
        <p className="font-display text-3xl">This project isn&apos;t here.</p>
        <p className="max-w-md text-ink/70">It may be in another browser, or in your account if you&apos;re signed out.</p>
        <Link href="/me" className="btn btn-accent">
          Back to my studio
        </Link>
      </div>
    );
  }
  if (!project) {
    return <div className="flex min-h-screen items-center justify-center font-mono text-xs uppercase tracking-[0.2em] text-muted">Loading project…</div>;
  }

  const status =
    save.kind === "saving"
      ? "Saving…"
      : save.kind === "dirty"
        ? "Unsaved changes"
        : save.kind === "error"
          ? save.message
          : project.local
            ? "Saved in this browser"
            : "Saved to your account";

  return (
    <>
      <Workspace
        key={`${project.id}:${reloadKey}`}
        initialCode={project.source}
        initialKind={project.stack}
        filename={project.id}
        allowKindToggle
        title={project.title}
        subtitle={project.status === "published" ? "Published" : project.status === "pending_review" ? "Waiting for review" : "Draft"}
        onCodeChange={onCodeChange}
        headerExtra={
          <>
            <span className={"font-mono text-[10px] uppercase tracking-[0.15em] " + (save.kind === "error" ? "text-coral" : "text-muted")} title={status}>
              {status}
            </span>
            {project.versions.length > 0 ? (
              <button type="button" className="btn" onClick={() => setShowVersions((v) => !v)}>
                History · {project.versions.length}
              </button>
            ) : null}
            <Link href="/me" className="btn">
              My studio
            </Link>
            <button
              type="button"
              className="btn btn-accent"
              onClick={async () => {
                await flush();
                if (projectRef.current?.local) setSignIn(true);
                else setPublishing(true);
              }}
            >
              {project.status === "published" ? "Update" : "Publish"}
            </button>
          </>
        }
      />
      {showVersions ? (
        <div className="fixed right-4 top-20 z-[90] max-h-[70vh] w-80 overflow-y-auto border-2 border-ink bg-paper p-3 font-sans text-ink shadow-[6px_6px_0_0_#0F0F0F]">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Earlier versions</p>
          <ul className="mt-2 space-y-1">
            {project.versions.map((v, i) => (
              <li key={i} className="flex items-center justify-between gap-2 border-b border-ink/15 py-1.5 text-sm">
                <span>{new Date(v.at).toLocaleString()}</span>
                <button
                  type="button"
                  className="border-2 border-ink px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] hover:bg-ink hover:text-paper"
                  onClick={async () => {
                    const r = await saveProject(project, { source: v.source, stack: v.stack });
                    if (r.ok) {
                      projectRef.current = r.value;
                      setProject(r.value);
                      setReloadKey((k) => k + 1);
                      setShowVersions(false);
                    }
                  }}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {publishing ? (
        <PublishDialog
          project={project}
          onClose={() => setPublishing(false)}
          onPublished={() => loadProject(project.id).then((p) => p && (projectRef.current = p) && setProject(p))}
        />
      ) : null}
      {signIn ? <SignInDialog onClose={() => setSignIn(false)} reason="Sign in to publish. Your drafts move into your account." /> : null}
    </>
  );
}
