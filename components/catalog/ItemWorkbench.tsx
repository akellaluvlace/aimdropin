"use client";

// The detail page's working area: live preview, code, install command, star.
// Records a "view" once per mount and "copy" / "install" when people copy
// code or the install command (these feed ranking when Supabase is on).

import { useEffect, useMemo, useState } from "react";
import type { LibraryItem } from "@/lib/catalog/library";
import { getComponentFull } from "@/lib/component-library/client";
import { buildPreviewDoc } from "@/lib/component-library/preview-doc";
import type { ComponentFull } from "@/lib/component-library/types";
import {
  fetchStats,
  isStarred,
  setStar,
  trackUsage,
  type TargetStats,
} from "@/lib/community/usage";
import { useSession } from "@/lib/supabase/use-session";
import { SignInDialog } from "@/components/auth/AccountButton";
import RegistryPreviewSlot from "./RegistryPreviewSlot";
import FullscreenLink from "@/components/fullscreen/FullscreenLink";
import { buildPreviewDocument } from "@/lib/preview";
import { buildZip } from "@/lib/publish/zip";

type Tab = "preview" | "code";

interface CodeFile {
  path: string;
  content: string;
}

async function loadRegistryFiles(url: string): Promise<CodeFile[]> {
  const res = await fetch(`/api/registry/item?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`Couldn't load the code (${res.status}).`);
  const j = (await res.json()) as {
    files?: Array<{ path?: string; target?: string; content?: string }>;
    item?: unknown;
  };
  const item = (j.item && typeof j.item === "object" ? j.item : j) as {
    files?: Array<{ path?: string; target?: string; content?: string }>;
  };
  return (item.files ?? [])
    .filter((f) => typeof f.content === "string")
    .map((f) => ({
      path: f.target || f.path || "file",
      content: f.content as string,
    }));
}

function CopyButton({
  text,
  label,
  onCopied,
}: {
  text: string;
  label: string;
  onCopied?: () => void;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="shrink-0 border-2 border-ink bg-card px-3 py-1.5 text-ink font-mono text-[10px] uppercase tracking-[0.15em] hover:bg-ink hover:text-paper"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          onCopied?.();
          window.setTimeout(() => setDone(false), 1500);
        } catch {
          // clipboard blocked: leave the text selectable
        }
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

// Community pages are tracked as "page" targets by uuid; catalog items by id.
function target(item: LibraryItem): { type: "catalog" | "page"; id: string } {
  return item.src === "community"
    ? { type: "page", id: item.name }
    : { type: "catalog", id: item.id };
}

export default function ItemWorkbench({
  item,
  inlineSource,
  fullscreenHref,
}: {
  item: LibraryItem;
  inlineSource?: string;
  // The item's full-screen preview; shown beside the Preview / Code tabs.
  fullscreenHref?: string;
}) {
  const [tab, setTab] = useState<Tab>(
    item.preview === "none" ? "code" : "preview",
  );
  const [htmlFull, setHtmlFull] = useState<ComponentFull | null>(null);
  const [files, setFiles] = useState<CodeFile[] | null>(null);
  const [activeFile, setActiveFile] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<TargetStats | null>(null);
  const [starred, setStarredState] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const { available } = useSession();
  const [dark, setDark] = useState(false);

  const isHtmlComponent =
    item.install.method === "editor" &&
    item.stack === "html" &&
    !item.editorSlug;
  const isRegistry = item.install.method === "shadcn" && !!item.install.url;

  useEffect(() => {
    trackUsage(target(item).type, target(item).id, "view");
    void fetchStats(target(item).type, target(item).id).then(setStats);
    void isStarred(target(item).type, target(item).id).then(setStarredState);
  }, [item.id]);

  useEffect(() => {
    if (!isHtmlComponent) return;
    getComponentFull(item.name).then(setHtmlFull, (e) => setError(String(e)));
  }, [isHtmlComponent, item.name]);

  useEffect(() => {
    if (tab !== "code" || !isRegistry || files) return;
    loadRegistryFiles(item.install.url as string).then(setFiles, (e) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  }, [tab, isRegistry, files, item.install.url]);

  const htmlFiles: CodeFile[] | null = useMemo(() => {
    if (!htmlFull) return null;
    const out: CodeFile[] = [
      { path: `${item.name}.html`, content: htmlFull.html },
    ];
    if (htmlFull.css)
      out.push({
        path: `${item.name}.css`,
        content: htmlFull.css.replace(/__UIV_SCOPE__/g, ".your-scope"),
      });
    return out;
  }, [htmlFull, item.name]);

  const inlineFiles: CodeFile[] | null = inlineSource
    ? [
        {
          path: `page.${item.stack === "html" ? "html" : "jsx"}`,
          content: inlineSource,
        },
      ]
    : null;
  const codeFiles = inlineFiles ?? (isHtmlComponent ? htmlFiles : files);
  const current =
    codeFiles?.[Math.min(activeFile, (codeFiles?.length ?? 1) - 1)];

  async function toggleStar() {
    const r = await setStar(target(item).type, target(item).id, !starred);
    if (r.ok) {
      setStarredState(r.starred);
      setStats((s) =>
        s ? { ...s, stars: Math.max(0, s.stars + (r.starred ? 1 : -1)) } : s,
      );
    } else if (r.reason === "signed_out") {
      setSignIn(true);
    }
  }

  return (
    <section className="mt-6">
      {item.install.command ? (
        <div className="flex items-center gap-2 border-2 border-ink bg-ink px-3 py-2 text-paper">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/50">
            {item.install.method === "clone" ? "Clone" : "Install"}
          </span>
          <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs sm:text-sm">
            {item.install.command}
          </code>
          <CopyButton
            text={item.install.command}
            label="Copy"
            onCopied={() =>
              trackUsage(target(item).type, target(item).id, "install")
            }
          />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex border-2 border-ink" role="tablist">
          {(["preview", "code"] as Tab[]).map((t, i) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={
                "px-4 py-2 font-mono text-[10px] uppercase tracking-[0.15em] " +
                (i > 0 ? "border-l-2 border-ink " : "") +
                (tab === t ? "bg-ink text-paper" : "bg-paper hover:bg-soft")
              }
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
          {fullscreenHref && item.preview !== "none" ? (
            <FullscreenLink
              href={fullscreenHref}
              iconOnly
              className="inline-flex h-8 w-8 items-center justify-center border-2 border-ink bg-ink text-paper transition-colors hover:bg-sun hover:text-ink"
              iconClassName="h-4 w-4"
            />
          ) : null}
          {isRegistry && tab === "preview" ? (
            <button
              type="button"
              className="underline"
              onClick={() => setDark((d) => !d)}
            >
              {dark ? "Light" : "Dark"} mode
            </button>
          ) : null}
          {stats ? (
            <span>
              {stats.views.toLocaleString("en-US")} views ·{" "}
              {stats.copies + stats.installs} uses
            </span>
          ) : null}
          {available ? (
            <button
              type="button"
              onClick={toggleStar}
              aria-pressed={starred}
              className={
                "border-2 border-ink px-2 py-1 " +
                (starred
                  ? "bg-coral text-paper"
                  : "bg-card text-ink hover:bg-soft")
              }
            >
              {starred ? "★" : "☆"} {stats?.stars ?? 0}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 border-2 border-ink bg-card">
        {tab === "preview" ? (
          <div className="h-[70vh] min-h-[420px]">
            {inlineSource ? (
              <iframe
                title={`Preview: ${item.title}`}
                srcDoc={buildPreviewDocument({
                  code: inlineSource,
                  kind: item.stack === "html" ? "html" : "jsx",
                })}
                sandbox="allow-scripts allow-popups allow-forms"
                className="h-full w-full"
              />
            ) : item.editorSlug ? (
              <iframe
                title={`Preview: ${item.title}`}
                src={`/preview/${item.editorSlug}`}
                className="h-full w-full"
                loading="lazy"
              />
            ) : isHtmlComponent ? (
              htmlFull ? (
                <iframe
                  title={`Preview: ${item.title}`}
                  srcDoc={buildPreviewDoc(htmlFull)}
                  sandbox="allow-scripts"
                  referrerPolicy="no-referrer"
                  className="h-full w-full"
                />
              ) : (
                <Loading />
              )
            ) : isRegistry ? (
              <RegistryPreviewSlot
                installUrl={item.install.url as string}
                dark={dark}
                title={item.title}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="font-display text-2xl">This is a full app.</p>
                <p className="max-w-md text-sm text-ink/70">
                  It runs as its own project, so there&apos;s no in-page
                  preview.{" "}
                  {item.demo
                    ? "Open the live demo, or clone it with the command above."
                    : "Clone it with the command above."}
                </p>
                {item.demo ? (
                  <a
                    href={item.demo}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-accent"
                  >
                    Live demo ↗
                  </a>
                ) : null}
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-[70vh] min-h-[420px] flex-col">
            {codeFiles && codeFiles.length > 1 ? (
              <div className="flex shrink-0 gap-0 overflow-x-auto border-b-2 border-ink bg-soft">
                {codeFiles.map((f, i) => (
                  <button
                    key={f.path + i}
                    type="button"
                    onClick={() => setActiveFile(i)}
                    className={
                      "whitespace-nowrap px-3 py-2 font-mono text-[11px] " +
                      (i === activeFile
                        ? "bg-ink text-paper"
                        : "hover:bg-paper")
                    }
                  >
                    {f.path.split("/").pop()}
                  </button>
                ))}
              </div>
            ) : null}
            {current ? (
              <div className="relative min-h-0 flex-1">
                <div className="absolute right-3 top-3 z-10 flex gap-2">
                  <CopyButton
                    text={current.content}
                    label="Copy code"
                    onCopied={() =>
                      trackUsage(target(item).type, target(item).id, "copy")
                    }
                  />
                  <button
                    type="button"
                    className="shrink-0 border-2 border-ink bg-card px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink hover:bg-ink hover:text-paper"
                    onClick={() => {
                      const files = codeFiles ?? [];
                      if (!files.length) return;
                      // One file downloads as itself; several as a ZIP.
                      const blob =
                        files.length === 1
                          ? new Blob([files[0].content], { type: "text/plain;charset=utf-8" })
                          : buildZip(files.map((f) => ({ path: f.path.replace(/^\/+/, ""), content: f.content })));
                      const name = files.length === 1 ? files[0].path.split("/").pop() || item.name : `${item.name.replace(/[^a-z0-9._-]+/gi, "-")}.zip`;
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = name;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                      trackUsage(target(item).type, target(item).id, "export");
                    }}
                  >
                    {codeFiles && codeFiles.length > 1 ? "Download ZIP" : "Download"}
                  </button>
                </div>
                <pre className="h-full overflow-auto bg-ink p-4 pr-56 font-mono text-[12px] leading-[1.55] text-paper">
                  <code>{current.content}</code>
                </pre>
              </div>
            ) : error ? (
              <p className="p-6 text-sm text-coral">{error}</p>
            ) : item.install.method === "clone" ? (
              <div className="p-6 text-sm">
                <p>
                  This is a whole project. Clone it with the command above, or
                  browse it on GitHub.
                </p>
                {item.srcUrl ? (
                  <a
                    href={item.srcUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn mt-4"
                  >
                    Open on GitHub ↗
                  </a>
                ) : null}
              </div>
            ) : item.editorSlug ? (
              <div className="p-6 text-sm">
                <p>Open it in the editor to see and change the code.</p>
                <a
                  href={`/t/${item.editorSlug}`}
                  className="btn btn-accent mt-4"
                >
                  Open in editor
                </a>
              </div>
            ) : (
              <Loading />
            )}
          </div>
        )}
      </div>
      {signIn ? (
        <SignInDialog
          onClose={() => setSignIn(false)}
          reason="Sign in to star items and save pages."
        />
      ) : null}
    </section>
  );
}

function Loading() {
  return (
    <div className="flex h-full items-center justify-center font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
      Loading…
    </div>
  );
}
