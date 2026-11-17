"use client";

import Link from "next/link";
import { useState } from "react";
import { publishProject } from "@/lib/studio/projects";
import type { Project } from "@/lib/studio/types";

const PURPOSES: Array<[string, string]> = [
  ["landing", "Landing page"],
  ["dashboard", "Dashboard"],
  ["ecommerce", "Shop"],
  ["blog", "Blog"],
  ["auth", "Sign-in / auth screen"],
  ["docs", "Docs"],
  ["general", "Something else"],
];

export default function PublishDialog({ project, onClose, onPublished }: { project: Project; onClose: () => void; onPublished: (status: string) => void }) {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? "");
  const [purpose, setPurpose] = useState<string>(project.purpose);
  const [visibility, setVisibility] = useState<"public" | "unlisted">("public");
  const [license, setLicense] = useState(false);
  const [username, setUsername] = useState("");
  const [needUsername, setNeedUsername] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; findings: Array<{ level: string; detail: string }> } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await publishProject(project, { title, description: description || null, purpose, visibility, license, username: username || undefined });
    setBusy(false);
    if (!r.ok) {
      if (r.need === "username") setNeedUsername(true);
      setError(r.error);
      return;
    }
    setResult({ status: r.status, findings: r.findings });
    onPublished(r.status);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 p-4" role="dialog" aria-modal="true" aria-label="Publish">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border-2 border-ink bg-paper p-6 font-sans text-ink shadow-[8px_8px_0_0_#FF4D2E]">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-3xl leading-none">Publish</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="font-mono text-2xl leading-none hover:text-coral">
            ×
          </button>
        </div>
        {result ? (
          <div className="mt-4 space-y-3 text-sm">
            {result.status === "published" ? (
              <>
                <p>It&apos;s live in the community gallery. When enough people rate it 4★ or more, it moves into the main gallery.</p>
                <Link href={`/p/${project.id}`} className="btn btn-accent">
                  Open your page
                </Link>
              </>
            ) : result.status === "pending_review" ? (
              <p>Saved and waiting for a quick review before it goes live, because the automatic check flagged something:</p>
            ) : (
              <p>This can&apos;t be published as it is:</p>
            )}
            {result.findings.length > 0 && result.status !== "published" ? (
              <ul className="list-disc space-y-1 pl-5 text-ink/80">
                {result.findings.map((f, i) => (
                  <li key={i}>{f.detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4 text-sm">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className="mt-1 h-10 w-full border-2 border-ink bg-white px-3" />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Description (optional)</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} className="mt-1 w-full border-2 border-ink bg-white p-3" />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">What is it?</span>
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="mt-1 h-10 w-full border-2 border-ink bg-white px-3">
                {PURPOSES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Who can see it</legend>
              <div className="mt-1 flex gap-4">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={visibility === "public"} onChange={() => setVisibility("public")} /> Everyone, in the community gallery
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={visibility === "unlisted"} onChange={() => setVisibility("unlisted")} /> Only people with the link
                </label>
              </div>
            </fieldset>
            {needUsername ? (
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Username (your public name)</span>
                <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} pattern="[a-z0-9][a-z0-9-]{1,38}" required className="mt-1 h-10 w-full border-2 border-ink bg-white px-3 font-mono" />
              </label>
            ) : null}
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={license} onChange={(e) => setLicense(e.target.checked)} className="mt-1" />
              <span>I made this (or it&apos;s built from MIT-licensed parts) and I&apos;m sharing it under the MIT license, so anyone can use it.</span>
            </label>
            {error ? <p className="text-coral">{error}</p> : null}
            <button type="submit" disabled={busy || !license} className="btn btn-accent w-full justify-center disabled:opacity-50">
              {busy ? "Checking…" : "Publish"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
