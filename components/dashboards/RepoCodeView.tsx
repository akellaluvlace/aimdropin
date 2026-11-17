"use client";
import type { JSX } from "react";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { buildFileTree, defaultOpenFile, isBinaryPath, isImagePath, languageForPath, type TreeNode } from "@/lib/dashboards/tree";
import { rawFileUrl } from "@/lib/dashboards/urls";

const Monaco = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center font-mono text-xs uppercase tracking-[0.2em] text-muted">Loading viewer…</div>,
});

// Bigger text files are linked to GitHub instead of loaded into the viewer.
const MAX_VIEW_BYTES = 1_500_000;

interface RepoCodeViewProps {
  repo: string;
  sha: string;
  entry: string;
  files: Array<[string, number]>;
  // Fill the parent's height on desktop (the dashboard page).
  fillOnDesktop?: boolean;
}

type Loaded = { path: string; state: "loading" } | { path: string; state: "ok"; text: string } | { path: string; state: "error"; message: string };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export default function RepoCodeView({ repo, sha, entry, files, fillOnDesktop = false }: RepoCodeViewProps) {
  const tree = useMemo(() => buildFileTree(files), [files]);
  const sizes = useMemo(() => new Map(files), [files]);
  const [open, setOpen] = useState<string | null>(() => defaultOpenFile(files, entry));
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const first = defaultOpenFile(files, entry);
    const dirs = new Set<string>();
    if (first) {
      const parts = first.split("/");
      for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
    }
    return dirs;
  });
  const [filter, setFilter] = useState("");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [copied, setCopied] = useState(false);
  const target = { repo, sha };

  useEffect(() => {
    if (!open || isBinaryPath(open) || (sizes.get(open) ?? 0) > MAX_VIEW_BYTES) return;
    let cancelled = false;
    setLoaded({ path: open, state: "loading" });
    fetch(rawFileUrl(target, open))
      .then(async (r) => {
        if (!r.ok) throw new Error(`GitHub returned ${r.status}`);
        const text = await r.text();
        if (!cancelled) setLoaded({ path: open, state: "ok", text });
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoaded({ path: open, state: "error", message: e instanceof Error ? e.message : "Couldn't load the file" });
      });
    return () => {
      cancelled = true;
    };
    // target is derived from repo + sha
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, repo, sha, sizes]);

  const q = filter.trim().toLowerCase();
  const matches = q ? files.filter(([p]) => p.toLowerCase().includes(q)).slice(0, 300) : null;

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const renderNodes = (nodes: TreeNode[], depth: number): JSX.Element[] =>
    nodes.flatMap((n) => {
      const pad = { paddingLeft: `${8 + depth * 14}px` };
      if (n.kind === "dir") {
        const isOpen = expanded.has(n.path);
        return [
          <li key={n.path}>
            <button type="button" onClick={() => toggle(n.path)} style={pad} className="flex w-full items-center gap-1.5 py-1 pr-2 text-left font-mono text-[12px] hover:bg-soft" aria-expanded={isOpen}>
              <span aria-hidden="true" className="w-3 text-muted">{isOpen ? "▾" : "▸"}</span>
              <span className="truncate">{n.name}</span>
            </button>
          </li>,
          ...(isOpen ? renderNodes(n.children, depth + 1) : []),
        ];
      }
      return [
        <li key={n.path}>
          <button
            type="button"
            onClick={() => setOpen(n.path)}
            style={pad}
            aria-current={open === n.path ? "true" : undefined}
            className={"flex w-full items-center gap-1.5 py-1 pr-2 text-left font-mono text-[12px] " + (open === n.path ? "bg-ink text-paper" : "hover:bg-soft")}
          >
            <span aria-hidden="true" className="w-3" />
            <span className="truncate">{n.name}</span>
          </button>
        </li>,
      ];
    });

  const size = open ? sizes.get(open) ?? 0 : 0;
  const viewerBody = (() => {
    if (!open) return <Empty text="This repository has no files." />;
    if (isImagePath(open)) {
      return (
        <div className="flex h-full items-center justify-center bg-[repeating-conic-gradient(#EDE6D9_0_25%,#F5F1EA_0_50%)] bg-[length:20px_20px] p-6">
          <img src={rawFileUrl(target, open)} alt={open} className="max-h-full max-w-full border-2 border-ink bg-white object-contain" />
        </div>
      );
    }
    if (isBinaryPath(open)) return <Empty text={`Binary file · ${formatBytes(size)}. It's in the ZIP download.`} />;
    if (size > MAX_VIEW_BYTES) return <Empty text={`Large file · ${formatBytes(size)}. Open it on GitHub or get it in the ZIP.`} />;
    if (!loaded || loaded.path !== open || loaded.state === "loading") return <Empty text="Loading…" />;
    if (loaded.state === "error") return <Empty text={`${loaded.message}. Try again or open it on GitHub.`} />;
    return (
      <Monaco
        height="100%"
        path={`repo:${repo}/${open}`}
        language={languageForPath(open)}
        value={loaded.text}
        theme="vs"
        options={{
          readOnly: true,
          domReadOnly: true,
          minimap: { enabled: false },
          fontFamily: "'JetBrains Mono', Menlo, monospace",
          fontSize: 13,
          lineHeight: 1.6,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          renderLineHighlight: "none",
        }}
      />
    );
  })();

  return (
    <div className={"grid grid-cols-1 border-2 border-ink bg-card md:grid-cols-[280px_minmax(0,1fr)] " + (fillOnDesktop ? "h-[72vh] min-h-[480px] lg:h-auto lg:min-h-0 lg:flex-1" : "h-[72vh] min-h-[520px]")}>
      <div className="flex min-h-0 flex-col border-b-2 border-ink md:border-b-0 md:border-r-2">
        <div className="border-b-2 border-ink p-2">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Find a file (${files.length.toLocaleString("en-US")})`}
            aria-label="Find a file"
            className="h-9 w-full border-2 border-ink bg-paper px-3 font-mono text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-coral"
          />
        </div>
        <ul className="min-h-0 flex-1 overflow-auto py-1" aria-label="Files">
          {matches
            ? matches.map(([p]) => (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => setOpen(p)}
                    className={"block w-full truncate px-3 py-1 text-left font-mono text-[12px] " + (open === p ? "bg-ink text-paper" : "hover:bg-soft")}
                  >
                    {p}
                  </button>
                </li>
              ))
            : renderNodes(tree, 0)}
        </ul>
      </div>
      <div className="flex min-h-0 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink px-3 py-2">
          <p className="min-w-0 truncate font-mono text-[11px]">{open ?? "-"}</p>
          {open && (
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">{formatBytes(size)}</span>
              {loaded?.state === "ok" && loaded.path === open && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(loaded.text);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1400);
                    } catch {
                      // clipboard blocked: the text stays selectable
                    }
                  }}
                  className="border-2 border-ink px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] hover:bg-ink hover:text-paper"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
              <a
                href={`https://github.com/${repo}/blob/${sha}/${open.split("/").map(encodeURIComponent).join("/")}`}
                target="_blank"
                rel="noreferrer"
                className="border-2 border-ink px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] hover:bg-ink hover:text-paper"
              >
                GitHub ↗
              </a>
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1">{viewerBody}</div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="flex h-full items-center justify-center p-6 text-center font-mono text-xs uppercase tracking-[0.15em] text-muted">{text}</div>;
}
